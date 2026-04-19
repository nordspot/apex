"""
Convert LaFan mocap BVH data to APEX pivot JSON animations.
Handles sign conventions, rest-pose subtraction, and cycle extraction.

Our pivot system conventions:
  shoulder: + = forward, - = backward (relative to body)
  elbow:    + = bend (forearm toward upper arm), - = straighten (but stays >=0 usually)
  hip:      + = forward, - = backward
  knee:     - = bend, + = straighten (negative convention)
  body_tilt_x: + = lean forward

BVH LaFan skeleton conventions:
  Arms hang at sides in rest pose. Rotation X around the joint's local X axis.
  We need to check and potentially flip signs per joint.
"""

import json
import os
import numpy as np
from bvh_parser import parse_bvh, BVHData

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../../public/animations/kimodo')

JOINT_MAP = {
    'LeftArm':      'left_arm_shoulder',
    'LeftForeArm':  'left_arm_elbow',
    'RightArm':     'right_arm_shoulder',
    'RightForeArm': 'right_arm_elbow',
    'LeftUpLeg':    'left_leg_hip',
    'LeftLeg':      'left_leg_knee',
    'RightUpLeg':   'right_leg_hip',
    'RightLeg':     'right_leg_knee',
}

SPINE_JOINTS = ['Spine', 'Spine1', 'Spine2', 'Spine3']

# Sign and offset corrections per pivot.
# BVH data may have offsets from rest pose that we need to subtract.
# sign: multiply BVH value by this (-1 to flip)
# offset: subtract this from BVH value (rest pose angle)
CORRECTIONS = {
    'left_arm_shoulder':  {'sign': 1.0, 'offset': 0.0},
    'left_arm_elbow':     {'sign': 1.0, 'offset': 0.0},
    'right_arm_shoulder': {'sign': 1.0, 'offset': 0.0},
    'right_arm_elbow':    {'sign': 1.0, 'offset': 0.0},
    'left_leg_hip':       {'sign': 1.0, 'offset': 0.0},
    'left_leg_knee':      {'sign': -1.0, 'offset': 0.0},  # Negate: BVH positive bend -> our negative bend
    'right_leg_hip':      {'sign': 1.0, 'offset': 0.0},
    'right_leg_knee':     {'sign': -1.0, 'offset': 0.0},
}


def extract_segment(bvh: BVHData, start: int, end: int, target_fps: int = 30,
                    name: str = '', loop: bool = True, prompt: str = '') -> dict:
    """Extract a segment and convert to pivot JSON."""
    step = max(1, round(bvh.fps / target_fps))
    frames = list(range(start, end, step))
    num_frames = len(frames)
    duration = round(num_frames / target_fps, 6)
    times = [round(i / target_fps, 6) for i in range(num_frames)]

    # Determine rest-pose offsets from first frame of a standing segment
    # For walking/standing anims, use frame[0] as rough rest reference
    # For ground anims, we skip this

    pivots = {}
    for bvh_name, pivot_key in JOINT_MAP.items():
        joint = bvh.joint_by_name(bvh_name)
        corr = CORRECTIONS[pivot_key]
        angles = []
        if joint:
            for f in frames:
                euler = bvh.get_rotation_euler(joint, f)
                val = (euler[0] - corr['offset']) * corr['sign']
                angles.append(round(float(val), 6))
        else:
            angles = [0.0] * num_frames

        pivots[pivot_key] = {
            'joint': pivot_key,
            'axis': 'x',
            'angles': angles,
        }

    # Body tilt
    body_tilt_x = []
    for f in frames:
        tilt = 0.0
        for spine_name in SPINE_JOINTS:
            j = bvh.joint_by_name(spine_name)
            if j:
                tilt += bvh.get_rotation_euler(j, f)[0]
        body_tilt_x.append(round(float(tilt), 6))

    # Root translation (relative to first frame)
    hips = bvh.joint_by_name('Hips')
    root_translation = []
    ref_pos = bvh.get_position(hips, frames[0]) if hips else None
    for f in frames:
        if hips and ref_pos is not None:
            pos = bvh.get_position(hips, f)
            rel = pos - ref_pos if pos is not None else np.zeros(3)
            # Scale down (BVH uses cm, we use meters-ish)
            root_translation.append([round(float(rel[0]) * 0.01, 4),
                                      round(float(rel[1]) * 0.01, 4),
                                      round(float(rel[2]) * 0.01, 4)])
        else:
            root_translation.append([0.0, 0.0, 0.0])

    return {
        'fps': target_fps,
        'duration': duration,
        'num_frames': num_frames,
        'times': times,
        'root_translation': root_translation,
        'pivots': pivots,
        'body_tilt_x': body_tilt_x,
        'name': name,
        'loop': loop,
        'prompt': prompt,
    }


def find_cycles(bvh: BVHData, joint_name: str = 'LeftUpLeg',
                desired_duration: float = 1.6, num_cycles: int = 1,
                search_start: float = 0.25) -> tuple[int, int]:
    """Find clean cycles using zero-crossing detection on a joint's X rotation."""
    joint = bvh.joint_by_name(joint_name)
    if not joint:
        length = int(desired_duration * bvh.fps * num_cycles)
        start = bvh.num_frames // 4
        return start, start + length

    # Search in middle portion
    s = int(bvh.num_frames * search_start)
    e = int(bvh.num_frames * 0.75)
    rots = [bvh.get_rotation_euler(joint, f)[0] for f in range(s, e)]

    # Find positive zero crossings
    crossings = []
    for i in range(1, len(rots)):
        if rots[i-1] <= 0 < rots[i]:
            crossings.append(s + i)

    if len(crossings) < 2:
        length = int(desired_duration * bvh.fps * num_cycles)
        return s, s + length

    # Find pairs that match desired cycle duration
    target_frames = int(desired_duration * bvh.fps * num_cycles)
    best_pair = (crossings[0], crossings[0] + target_frames)
    best_diff = float('inf')

    for i in range(len(crossings)):
        for j in range(i + 1, min(i + num_cycles + 2, len(crossings))):
            length = crossings[j] - crossings[i]
            diff = abs(length - target_frames)
            if diff < best_diff:
                best_diff = diff
                best_pair = (crossings[i], crossings[j])

    return best_pair


def print_analysis(data: dict):
    """Print rotation ranges for debugging."""
    for key in ['left_arm_shoulder', 'right_arm_shoulder',
                'left_leg_hip', 'right_leg_hip',
                'left_arm_elbow', 'right_arm_elbow',
                'left_leg_knee', 'right_leg_knee']:
        angles = data['pivots'][key]['angles']
        arr = np.array(angles)
        print(f'    {key:25s}: [{arr.min():+.2f} .. {arr.max():+.2f}] range={arr.max()-arr.min():.2f}')
    arr = np.array(data['body_tilt_x'])
    print(f'    {"body_tilt_x":25s}: [{arr.min():+.2f} .. {arr.max():+.2f}]')


def main():
    mocap_dir = 'c:/tmp/mocap/bvh'
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_anims = {}

    # ======= STATE 3: WALKING =======
    print('\n=== Walking (State 3) ===')
    bvh = parse_bvh(f'{mocap_dir}/walk1_subject1.bvh')
    start, end = find_cycles(bvh, 'LeftUpLeg', desired_duration=0.8, num_cycles=2)
    print(f'  Cycle frames: {start}-{end} ({(end-start)/bvh.fps:.2f}s)')
    data = extract_segment(bvh, start, end, name='walking', loop=True,
                           prompt='Natural walking from LaFan mocap')
    print_analysis(data)
    all_anims['walking'] = data

    # ======= STATE 3: HAPPY WALK =======
    print('\n=== Happy Walk (State 3) ===')
    bvh2 = parse_bvh(f'{mocap_dir}/walk2_subject1.bvh')
    start, end = find_cycles(bvh2, 'LeftUpLeg', desired_duration=0.7, num_cycles=2)
    print(f'  Cycle frames: {start}-{end} ({(end-start)/bvh2.fps:.2f}s)')
    data = extract_segment(bvh2, start, end, name='happy_walk', loop=True,
                           prompt='Confident walking from LaFan mocap')
    print_analysis(data)
    all_anims['happy_walk'] = data

    # ======= GROUND MOTION (for crawl states) =======
    print('\n=== Ground Motion Analysis ===')
    bvh3 = parse_bvh(f'{mocap_dir}/ground1_subject1.bvh')
    hips = bvh3.joint_by_name('Hips')
    # Find floor segments (hips Y < 20)
    floor_segments = []
    in_floor = False
    seg_start = 0
    for f in range(bvh3.num_frames):
        y = bvh3.get_position(hips, f)[1]
        if y < 20 and not in_floor:
            seg_start = f
            in_floor = True
        elif y >= 20 and in_floor:
            if f - seg_start > 120:  # at least 2 seconds
                floor_segments.append((seg_start, f))
            in_floor = False
    if in_floor and bvh3.num_frames - seg_start > 120:
        floor_segments.append((seg_start, bvh3.num_frames))

    print(f'  Found {len(floor_segments)} floor segments > 2s')
    for i, (s, e) in enumerate(floor_segments[:5]):
        print(f'    Segment {i}: frames {s}-{e} ({(e-s)/bvh3.fps:.1f}s)')

    # Use the longest floor segment for crawling animations
    if floor_segments:
        longest = max(floor_segments, key=lambda x: x[1] - x[0])
        ls, le = longest
        seg_dur = (le - ls) / bvh3.fps
        print(f'\n  Using longest segment: frames {ls}-{le} ({seg_dur:.1f}s)')

        # Extract belly crawl (2-3 second loop from middle)
        mid = (ls + le) // 2
        crawl_len = int(3.0 * bvh3.fps)  # 3 seconds
        cs = max(ls, mid - crawl_len // 2)
        ce = min(le, cs + crawl_len)
        data = extract_segment(bvh3, cs, ce, name='belly_crawl', loop=True,
                               prompt='Ground crawling from LaFan mocap')
        print('\n  Belly Crawl:')
        print_analysis(data)
        all_anims['belly_crawl'] = data

        # Also extract a shorter segment for crawl_idle
        idle_len = int(3.5 * bvh3.fps)
        data = extract_segment(bvh3, ls, min(ls + idle_len, le),
                               name='crawl_idle', loop=True,
                               prompt='Ground idle from LaFan mocap')
        print('\n  Crawl Idle:')
        print_analysis(data)
        all_anims['crawl_idle'] = data

    # ======= FALL AND GET UP (for state 0) =======
    print('\n=== Fall and Get Up ===')
    bvh4 = parse_bvh(f'{mocap_dir}/fallAndGetUp1_subject1.bvh')
    hips4 = bvh4.joint_by_name('Hips')
    # Find the lowest point (fallen)
    min_y = float('inf')
    min_f = 0
    for f in range(bvh4.num_frames):
        y = bvh4.get_position(hips4, f)[1]
        if y < min_y:
            min_y = y
            min_f = f
    print(f'  Lowest hips Y: {min_y:.1f} at frame {min_f}')

    # Extract fallen idle (around the lowest point)
    idle_start = max(0, min_f - int(2.0 * bvh4.fps))
    idle_end = min(bvh4.num_frames, min_f + int(2.0 * bvh4.fps))
    data = extract_segment(bvh4, idle_start, idle_end, name='fallen_idle', loop=True,
                           prompt='Fallen on ground from LaFan mocap')
    print('\n  Fallen Idle:')
    print_analysis(data)
    all_anims['fallen_idle'] = data

    # ======= Write all animation files =======
    print('\n=== Writing files ===')
    for name, data in all_anims.items():
        path = os.path.join(OUTPUT_DIR, f'{name}.json')
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'  {name}.json ({data["num_frames"]} frames, {data["duration"]:.2f}s)')

    # Keep hand-crafted animations for states we don't have mocap for
    # (one_arm_crawl, hobble_idle, hobble_walk, standard_idle, picking_up, celebrate)
    # These stay as-is from the generator

    # Update manifest
    # Load existing manifest to keep hand-crafted entries
    manifest_path = os.path.join(OUTPUT_DIR, 'manifest.json')
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except FileNotFoundError:
        manifest = {'version': 1, 'mode': 'pivot', 'animations': {}}

    for name, data in all_anims.items():
        manifest['animations'][name] = {
            'file': f'{name}.json',
            'loop': data['loop'],
            'duration': data['duration'],
            'prompt': data['prompt'],
        }

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f'\n  Manifest updated: {len(manifest["animations"])} total animations')
    print('\nDone!')


if __name__ == '__main__':
    main()
