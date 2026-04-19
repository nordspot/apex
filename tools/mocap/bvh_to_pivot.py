"""
Convert BVH mocap data to Kimodo pivot JSON format for APEX game.

Reads BVH files, extracts rotations for the 8 pivots our game uses
(shoulder/elbow/hip/knee for left+right), and outputs JSON files
compatible with KimodoAnimator.ts.

The key challenge: BVH gives local euler rotations per joint, but our
pivot system uses a single rotation.x angle per pivot. We extract the
X-axis component (forward/back swing) as the primary motion axis.

Joint mapping (BVH -> Pivot):
  LeftArm      -> left_arm_shoulder  (rotation.x = swing forward/back)
  LeftForeArm  -> left_arm_elbow     (rotation.x = bend)
  RightArm     -> right_arm_shoulder
  RightForeArm -> right_arm_elbow
  LeftUpLeg    -> left_leg_hip       (rotation.x = swing forward/back)
  LeftLeg      -> left_leg_knee      (rotation.x = bend)
  RightUpLeg   -> right_leg_hip
  RightLeg     -> right_leg_knee
  Spine chain  -> body_tilt_x        (sum of spine rotations)
  Hips         -> root_translation   (world position)
"""

import json
import sys
import os
import numpy as np
from bvh_parser import parse_bvh, BVHData

# BVH joint name -> our pivot key
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

# Spine joints for body tilt accumulation
SPINE_JOINTS = ['Spine', 'Spine1', 'Spine2', 'Spine3']


def extract_walk_cycle(bvh: BVHData, start_frame: int, end_frame: int,
                       target_fps: int = 30) -> dict:
    """Extract a segment of BVH motion and convert to pivot JSON format."""

    # Downsample if BVH fps > target
    step = max(1, bvh.fps // target_fps)
    frames = list(range(start_frame, end_frame, step))
    num_frames = len(frames)
    duration = num_frames / target_fps

    # Time array
    times = [round(i / target_fps, 6) for i in range(num_frames)]

    # Extract pivot rotations
    pivots = {}
    for bvh_name, pivot_key in JOINT_MAP.items():
        joint = bvh.joint_by_name(bvh_name)
        if not joint:
            print(f'  Warning: joint {bvh_name} not found, using zeros')
            pivots[pivot_key] = {
                'joint': pivot_key,
                'axis': 'x',
                'angles': [0.0] * num_frames,
            }
            continue

        angles = []
        for f in frames:
            euler = bvh.get_rotation_euler(joint, f)
            # X rotation is the primary swing axis (forward/back)
            angles.append(round(float(euler[0]), 6))

        pivots[pivot_key] = {
            'joint': pivot_key,
            'axis': 'x',
            'angles': angles,
        }

    # Extract body tilt (sum of spine X rotations)
    body_tilt_x = []
    for f in frames:
        tilt = 0.0
        for spine_name in SPINE_JOINTS:
            joint = bvh.joint_by_name(spine_name)
            if joint:
                euler = bvh.get_rotation_euler(joint, f)
                tilt += euler[0]
        body_tilt_x.append(round(float(tilt), 6))

    # Extract root translation (Hips world position)
    hips = bvh.joint_by_name('Hips')
    root_translation = []
    if hips:
        # Get reference position (first frame) to make relative
        ref_pos = bvh.get_position(hips, frames[0])
        for f in frames:
            pos = bvh.get_position(hips, f)
            if pos is not None and ref_pos is not None:
                rel = pos - ref_pos
                root_translation.append([round(float(rel[0]), 4),
                                          round(float(rel[1]), 4),
                                          round(float(rel[2]), 4)])
            else:
                root_translation.append([0.0, 0.0, 0.0])
    else:
        root_translation = [[0.0, 0.0, 0.0]] * num_frames

    return {
        'fps': target_fps,
        'duration': round(duration, 6),
        'num_frames': num_frames,
        'times': times,
        'root_translation': root_translation,
        'pivots': pivots,
        'body_tilt_x': body_tilt_x,
    }


def find_walk_cycles(bvh: BVHData, cycle_duration: float = 1.6,
                     num_cycles: int = 1) -> tuple[int, int]:
    """Find a good walk cycle segment by looking at hip rotation periodicity."""
    hips_joint = bvh.joint_by_name('LeftUpLeg')
    if not hips_joint:
        # Fallback: just take from the middle
        total = bvh.num_frames
        length = int(cycle_duration * bvh.fps * num_cycles)
        start = total // 4  # skip initial frames (often T-pose or transition)
        return start, start + length

    # Get left hip X rotation across all frames
    all_rots = bvh.get_all_rotations(hips_joint)
    hip_x = all_rots[:, 0]

    # Find a stable section (skip first/last 10%)
    skip = len(hip_x) // 10
    search = hip_x[skip:-skip] if skip > 0 else hip_x

    # Find zero crossings to identify cycle boundaries
    crossings = []
    for i in range(1, len(search)):
        if search[i-1] <= 0 < search[i]:  # positive zero crossing
            crossings.append(i + skip)

    if len(crossings) >= num_cycles + 1:
        # Use the cycles from the middle of the recording
        mid = len(crossings) // 2
        start = crossings[mid]
        # Find end after desired number of cycles
        end_idx = min(mid + num_cycles, len(crossings) - 1)
        end = crossings[end_idx]
        return start, end

    # Fallback
    length = int(cycle_duration * bvh.fps * num_cycles)
    start = skip
    return start, start + length


def analyze_motion(bvh: BVHData, start: int, end: int):
    """Print analysis of joint rotation ranges for debugging."""
    step = max(1, bvh.fps // 30)
    frames = list(range(start, end, step))

    print(f'\n  Frame range: {start}-{end} ({len(frames)} frames at 30fps)')
    print(f'  Duration: {len(frames)/30:.2f}s')

    for bvh_name, pivot_key in JOINT_MAP.items():
        joint = bvh.joint_by_name(bvh_name)
        if not joint:
            continue
        angles = [bvh.get_rotation_euler(joint, f)[0] for f in frames]
        arr = np.array(angles)
        print(f'  {pivot_key:25s}: min={arr.min():+.3f}  max={arr.max():+.3f}  range={arr.max()-arr.min():.3f}')

    # Body tilt
    tilts = []
    for f in frames:
        tilt = 0.0
        for name in SPINE_JOINTS:
            j = bvh.joint_by_name(name)
            if j:
                tilt += bvh.get_rotation_euler(j, f)[0]
        tilts.append(tilt)
    arr = np.array(tilts)
    print(f'  {"body_tilt_x":25s}: min={arr.min():+.3f}  max={arr.max():+.3f}  range={arr.max()-arr.min():.3f}')


def convert_file(bvh_path: str, output_path: str, name: str,
                 loop: bool = True, prompt: str = '',
                 start_frame: int = None, end_frame: int = None,
                 cycle_duration: float = 1.6, num_cycles: int = 1):
    """Convert a BVH file to pivot JSON."""
    print(f'\nConverting: {bvh_path}')
    bvh = parse_bvh(bvh_path)
    print(f'  Source: {bvh.num_frames} frames, {bvh.fps}fps, {bvh.duration:.1f}s')

    if start_frame is None or end_frame is None:
        start_frame, end_frame = find_walk_cycles(bvh, cycle_duration, num_cycles)

    analyze_motion(bvh, start_frame, end_frame)

    data = extract_walk_cycle(bvh, start_frame, end_frame)
    data['name'] = name
    data['loop'] = loop
    data['prompt'] = prompt

    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f'  Output: {output_path} ({data["num_frames"]} frames, {data["duration"]:.2f}s)')
    return data


if __name__ == '__main__':
    # Convert all relevant mocap files for APEX repair states
    mocap_dir = 'c:/tmp/mocap/bvh'
    output_dir = os.path.join(os.path.dirname(__file__), '../../public/animations/kimodo')
    os.makedirs(output_dir, exist_ok=True)

    conversions = [
        # State 3: Normal walking
        {
            'bvh': f'{mocap_dir}/walk1_subject1.bvh',
            'name': 'walking',
            'prompt': 'Natural walking motion from mocap',
            'cycle_duration': 1.6,
            'num_cycles': 1,
        },
        # State 3: Happy/confident walk (use same walk but different segment)
        {
            'bvh': f'{mocap_dir}/walk2_subject1.bvh',
            'name': 'happy_walk',
            'prompt': 'Confident walking motion from mocap',
            'cycle_duration': 1.4,
            'num_cycles': 1,
        },
    ]

    results = {}
    for conv in conversions:
        bvh_path = conv.pop('bvh')
        name = conv['name']
        output_path = os.path.join(output_dir, f'{name}.json')
        data = convert_file(bvh_path, output_path, **conv)
        results[name] = data

    print(f'\n=== Converted {len(results)} animations ===')
