#!/usr/bin/env python3
"""
Kimodo Motion Generator — calls NVIDIA Kimodo via HuggingFace Spaces API.

Usage:
    python generate.py                          # Generate all MEMO-9 animation presets
    python generate.py --prompt "A person crawls on their belly" --name crawl --duration 3
    python generate.py --list                   # List available presets

Output:
    Saves .npz files to output/ directory, one per animation.
    Each NPZ contains: root_translation [T,3], local_rot_mats [T,30,3,3]
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

# ── Animation presets for MEMO-9 repair states ─────────────────────────────

PRESETS = {
    # State 0: Broken — dragging with one arm
    "fallen_idle": {
        "prompt": "A person lies face down on the ground, barely moving, breathing slowly, exhausted",
        "duration": 4,
        "loop": True,
    },
    "one_arm_crawl": {
        "prompt": "A person lying face down drags themselves forward using only their right arm, pulling their body along the ground with great effort, legs limp and dragging behind",
        "duration": 5,
        "loop": True,
    },

    # State 1: Crawling — two arms, no legs
    "crawl_idle": {
        "prompt": "A person lies on their stomach propped up on both arms, looking around slowly, resting",
        "duration": 4,
        "loop": True,
    },
    "belly_crawl": {
        "prompt": "A person army crawls forward on their belly using both arms alternately, pulling themselves along the ground, legs dragging behind, military low crawl",
        "duration": 5,
        "loop": True,
    },

    # State 2: Hobbling — both arms + one leg
    "hobble_idle": {
        "prompt": "A person stands on one leg, slightly unsteady, shifting weight, arms at sides for balance",
        "duration": 4,
        "loop": True,
    },
    "hobble_walk": {
        "prompt": "A person hops forward on one leg, using arms for balance, injured gait, limping without one leg",
        "duration": 4,
        "loop": True,
    },

    # State 3: Walking — fully repaired
    "standard_idle": {
        "prompt": "A person stands still in a relaxed pose, weight shifting slightly, arms relaxed at sides, gentle breathing",
        "duration": 4,
        "loop": True,
    },
    "walking": {
        "prompt": "A person walks forward at a normal pace, relaxed confident gait, arms swinging naturally",
        "duration": 3,
        "loop": True,
    },
    "happy_walk": {
        "prompt": "A person walks forward with a happy energetic bounce in their step, arms swinging with enthusiasm, celebrating",
        "duration": 3,
        "loop": True,
    },

    # Interaction animations
    "picking_up": {
        "prompt": "A person bends down and picks something up from the ground with their right hand, then stands back up",
        "duration": 3,
        "loop": False,
    },
    "celebrate": {
        "prompt": "A person raises both arms in triumph, fist pump celebration, victorious pose",
        "duration": 3,
        "loop": False,
    },
}


def generate_motion(prompt: str, duration: float, space_url: str = "nvidia/Kimodo", use_local: bool = False) -> dict:
    """
    Generate motion via Kimodo.

    Tries in order:
    1. Local Kimodo install (if use_local=True or KIMODO_LOCAL env var set)
    2. HuggingFace Spaces API (Gradio client)
    3. Synthetic procedural fallback (for testing pipeline without GPU)

    Returns dict with:
        - root_translation: np.ndarray [num_frames, 3]
        - local_rot_mats: np.ndarray [num_frames, 30, 3, 3]
        - fps: int
    """
    fps = 30
    num_frames = int(duration * fps)

    # --- Try local Kimodo install ---
    if use_local or os.environ.get('KIMODO_LOCAL'):
        try:
            return _generate_local(prompt, duration, fps)
        except ImportError:
            print("  Local Kimodo not installed. Install with:")
            print('  pip install "kimodo[all] @ git+https://github.com/nv-tlabs/kimodo.git"')
            if use_local:
                sys.exit(1)

    # --- Try HuggingFace Space API ---
    try:
        return _generate_hf_space(prompt, duration, space_url, fps)
    except Exception as e:
        print(f"  HF Space API failed: {e}")

    # --- Synthetic fallback ---
    print(f"  Using synthetic motion generation (for pipeline testing)")
    return _generate_synthetic(prompt, duration, fps)


def _generate_local(prompt: str, duration: float, fps: int) -> dict:
    """Generate motion using locally installed Kimodo package."""
    import kimodo  # noqa: F401
    from kimodo.api import generate as kimodo_generate

    print(f"  Generating locally: \"{prompt}\" ({duration}s)...")
    start = time.time()

    result = kimodo_generate(
        prompt=prompt,
        duration=duration,
        model="Kimodo-SOMA-RP-v1",
    )

    elapsed = time.time() - start
    print(f"  Generated in {elapsed:.1f}s")

    return {
        'root_translation': result.root_translation,
        'local_rot_mats': result.local_rot_mats,
        'fps': fps,
    }


def _generate_hf_space(prompt: str, duration: float, space_url: str, fps: int) -> dict:
    """Generate motion via HuggingFace Spaces API."""
    from gradio_client import Client

    print(f"  Connecting to Kimodo Space ({space_url})...")
    client = Client(space_url)

    print(f"  Generating: \"{prompt}\" ({duration}s)...")
    start = time.time()

    result = client.predict(prompt, duration, api_name="/generate")

    elapsed = time.time() - start
    print(f"  Generated in {elapsed:.1f}s")

    # Parse NPZ result
    if isinstance(result, str) and result.endswith('.npz'):
        data = np.load(result, allow_pickle=True)
        return {
            'root_translation': data.get('root_translation', data.get('trans', np.zeros((int(duration * fps), 3)))),
            'local_rot_mats': data.get('local_rot_mats', data.get('rots', None)),
            'fps': int(data.get('fps', fps)),
        }

    raise ValueError(f"Unexpected result type from Space: {type(result)}")


def _generate_synthetic(prompt: str, duration: float, fps: int) -> dict:
    """
    Generate synthetic (procedural) motion data for pipeline testing.
    Produces plausible joint rotations based on prompt keywords.
    NOT AI-generated — just math to validate the pipeline end-to-end.
    """
    from scipy.spatial.transform import Rotation

    num_frames = int(duration * fps)
    prompt_lower = prompt.lower()

    # All joints start at identity rotation
    local_rot_mats = np.zeros((num_frames, 30, 3, 3), dtype=np.float32)
    for f in range(num_frames):
        for j in range(30):
            local_rot_mats[f, j] = np.eye(3)

    root_trans = np.zeros((num_frames, 3), dtype=np.float32)

    # Determine motion type from prompt
    is_crawl = any(w in prompt_lower for w in ['crawl', 'drag', 'belly', 'army'])
    is_hobble = any(w in prompt_lower for w in ['hobble', 'hop', 'one leg', 'limp'])
    is_walk = any(w in prompt_lower for w in ['walk', 'forward', 'gait'])
    is_idle = any(w in prompt_lower for w in ['idle', 'stand', 'still', 'rest', 'lie', 'breath'])
    is_one_arm = any(w in prompt_lower for w in ['one arm', 'only their right', 'only their left', 'single arm'])

    for f in range(num_frames):
        t = f / fps
        phase = t * 2 * np.pi  # one full cycle per second

        if is_crawl and is_one_arm:
            # State 0: one-arm drag — slow asymmetric pull
            cycle = np.sin(phase * 0.45)
            reach = max(0, -cycle)
            pull = max(0, cycle)

            # Right arm (index 17): reach forward, pull back
            rx = reach * 0.5 - pull * 1.5
            local_rot_mats[f, 17] = Rotation.from_euler('x', rx).as_matrix()
            # Right forearm (18): bend on pull
            local_rot_mats[f, 18] = Rotation.from_euler('x', pull * 0.8).as_matrix()

            # Spine twist
            local_rot_mats[f, 1] = Rotation.from_euler('xyz', [pull * 0.1, 0, cycle * 0.15]).as_matrix()

            # Root translation: lurch forward on pull
            root_trans[f, 2] = t * 0.15 * (0.5 + pull * 0.5)

        elif is_crawl:
            # State 1: two-arm belly crawl — alternating arms
            cycle = np.sin(phase * 0.55)
            r_reach = max(0, -cycle)
            r_pull = max(0, cycle)
            l_reach = max(0, cycle)
            l_pull = max(0, -cycle)

            # Right arm
            local_rot_mats[f, 17] = Rotation.from_euler('x', r_reach * 0.4 - r_pull * 1.3).as_matrix()
            local_rot_mats[f, 18] = Rotation.from_euler('x', r_pull * 0.7).as_matrix()
            # Left arm
            local_rot_mats[f, 11] = Rotation.from_euler('x', l_reach * 0.4 - l_pull * 1.3).as_matrix()
            local_rot_mats[f, 12] = Rotation.from_euler('x', l_pull * 0.7).as_matrix()

            # Body rock
            local_rot_mats[f, 1] = Rotation.from_euler('xyz', [0, 0, cycle * 0.12]).as_matrix()

            root_trans[f, 2] = t * 0.25

        elif is_hobble:
            # State 2: one-leg hop
            stride = np.sin(phase * 0.7)
            bounce = abs(stride)

            # Left leg (22) stride, left shin (23) knee bend
            local_rot_mats[f, 22] = Rotation.from_euler('x', stride * 0.45).as_matrix()
            local_rot_mats[f, 23] = Rotation.from_euler('x', -max(0, np.sin(phase * 0.7 - 0.4)) * 0.65).as_matrix()

            # Arms for balance
            local_rot_mats[f, 17] = Rotation.from_euler('x', -stride * 0.3).as_matrix()
            local_rot_mats[f, 11] = Rotation.from_euler('x', stride * 0.2).as_matrix()

            # Body lean
            local_rot_mats[f, 1] = Rotation.from_euler('xyz', [-0.03, 0, stride * 0.08 + 0.04]).as_matrix()

            # Bounce
            root_trans[f, 1] = bounce * 0.04
            root_trans[f, 2] = t * 0.5

        elif is_walk and not is_idle:
            # State 3: normal walk
            stride = np.sin(phase)

            # Legs
            local_rot_mats[f, 22] = Rotation.from_euler('x', stride * 0.35).as_matrix()
            local_rot_mats[f, 26] = Rotation.from_euler('x', -stride * 0.35).as_matrix()
            # Knees
            l_swing = max(0, np.sin(phase - 0.3))
            r_swing = max(0, np.sin(phase + np.pi - 0.3))
            local_rot_mats[f, 23] = Rotation.from_euler('x', -l_swing * 0.5).as_matrix()
            local_rot_mats[f, 27] = Rotation.from_euler('x', -r_swing * 0.5).as_matrix()

            # Arms counter-swing
            local_rot_mats[f, 11] = Rotation.from_euler('x', -stride * 0.25).as_matrix()
            local_rot_mats[f, 17] = Rotation.from_euler('x', stride * 0.25).as_matrix()

            # Body
            local_rot_mats[f, 1] = Rotation.from_euler('xyz', [-0.03, 0, stride * 0.02]).as_matrix()

            root_trans[f, 1] = abs(stride) * 0.03
            root_trans[f, 2] = t * 1.2

        else:
            # Idle: subtle breathing, weight shift
            breathe = np.sin(phase * 0.25)
            sway = np.sin(phase * 0.15)

            local_rot_mats[f, 1] = Rotation.from_euler('xyz', [breathe * 0.01, 0, sway * 0.008]).as_matrix()
            # Slight arm sway
            local_rot_mats[f, 11] = Rotation.from_euler('x', sway * 0.02).as_matrix()
            local_rot_mats[f, 17] = Rotation.from_euler('x', -sway * 0.02).as_matrix()

            root_trans[f, 1] = breathe * 0.005

    print(f"  Synthetic: {num_frames} frames, 30 joints @ {fps}fps")
    return {
        'root_translation': root_trans,
        'local_rot_mats': local_rot_mats,
        'fps': fps,
    }


def save_motion(motion: dict, name: str, output_dir: str, metadata: dict = None):
    """Save motion data as NPZ + metadata JSON."""
    os.makedirs(output_dir, exist_ok=True)

    npz_path = os.path.join(output_dir, f"{name}.npz")
    save_dict = {}
    for key, val in motion.items():
        if isinstance(val, np.ndarray):
            save_dict[key] = val
        elif isinstance(val, (int, float)):
            save_dict[key] = np.array(val)

    np.savez_compressed(npz_path, **save_dict)
    print(f"  Saved: {npz_path}")

    if metadata:
        meta_path = os.path.join(output_dir, f"{name}_meta.json")
        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2)


def generate_preset(name: str, preset: dict, output_dir: str):
    """Generate a single preset animation."""
    print(f"\n[{name}]")
    motion = generate_motion(preset["prompt"], preset["duration"])
    save_motion(motion, name, output_dir, metadata={
        "name": name,
        "prompt": preset["prompt"],
        "duration": preset["duration"],
        "loop": preset.get("loop", False),
        "fps": motion.get("fps", 30),
    })


def main():
    parser = argparse.ArgumentParser(description="Generate MEMO-9 animations via Kimodo")
    parser.add_argument("--prompt", type=str, help="Custom text prompt")
    parser.add_argument("--name", type=str, default="custom", help="Output name")
    parser.add_argument("--duration", type=float, default=3.0, help="Duration in seconds (max 10)")
    parser.add_argument("--output", type=str, default="output", help="Output directory")
    parser.add_argument("--list", action="store_true", help="List available presets")
    parser.add_argument("--preset", type=str, help="Generate a single preset by name")
    parser.add_argument("--all", action="store_true", help="Generate all presets")
    parser.add_argument("--space", type=str, default="nvidia/Kimodo", help="HuggingFace Space URL")
    args = parser.parse_args()

    output_dir = os.path.join(os.path.dirname(__file__), args.output)

    if args.list:
        print("Available animation presets:")
        for name, preset in PRESETS.items():
            loop = " (loop)" if preset.get("loop") else ""
            print(f"  {name:20s} {preset['duration']}s{loop}  \"{preset['prompt'][:60]}...\"")
        return

    if args.all:
        print(f"Generating all {len(PRESETS)} presets...")
        for name, preset in PRESETS.items():
            try:
                generate_preset(name, preset, output_dir)
            except Exception as e:
                print(f"  FAILED: {e}")
        print(f"\nDone! Output in: {output_dir}")
        return

    if args.preset:
        if args.preset not in PRESETS:
            print(f"Unknown preset: {args.preset}")
            print(f"Available: {', '.join(PRESETS.keys())}")
            sys.exit(1)
        generate_preset(args.preset, PRESETS[args.preset], output_dir)
        return

    if args.prompt:
        print(f"Generating custom animation...")
        motion = generate_motion(args.prompt, args.duration, args.space)
        save_motion(motion, args.name, output_dir, metadata={
            "name": args.name,
            "prompt": args.prompt,
            "duration": args.duration,
            "fps": motion.get("fps", 30),
        })
        return

    parser.print_help()


if __name__ == "__main__":
    main()
