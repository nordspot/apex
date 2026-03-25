#!/usr/bin/env python3
"""
Kimodo NPZ -> GLB Animation Clip Converter

Converts Kimodo SOMA motion data (.npz) into GLB animation files
that Three.js can load via GLTFLoader + AnimationMixer.

Two output modes:
  1. --mode skeletal  -> Full skeleton animation (requires rigged model)
  2. --mode pivot     -> JSON keyframes for our pivot-based system (no skeleton needed)

Usage:
    # Convert single NPZ to GLB animation clip
    python convert.py input.npz --output output.glb --mode skeletal

    # Convert to pivot JSON for our mesh-pivot system
    python convert.py input.npz --output output.json --mode pivot

    # Batch convert all NPZ files in a directory
    python convert.py output/ --batch --mode skeletal --dest ../../public/models/memo9/animations/

    # Convert all and copy to game assets
    python convert.py output/ --batch --mode pivot --dest ../../public/animations/
"""

import argparse
import json
import os
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

from skeleton_map import (
    SOMA_JOINT_NAMES,
    SOMA_PARENTS,
    SOMA_TO_MIXAMO,
    SOMA_SKIP_JOINTS,
    SOMA_TO_PIVOTS,
    SOMA_SPINE_INDICES,
    extract_pivot_keyframes,
    extract_skeletal_keyframes,
    rotmat_to_quaternion,
)


# ── GLB/glTF binary format helpers ────────────────────────────────────────

def pack_float32_array(data: list) -> bytes:
    """Pack a flat list of floats into a little-endian float32 buffer."""
    return struct.pack(f'<{len(data)}f', *data)


def pad_to_4(data: bytes) -> bytes:
    """Pad bytes to 4-byte alignment (glTF requirement)."""
    remainder = len(data) % 4
    if remainder:
        data += b'\x00' * (4 - remainder)
    return data


def create_animation_glb(
    tracks: dict,
    animation_name: str = "animation",
    fps: int = 30,
) -> bytes:
    """
    Create a minimal GLB file containing only animation data.

    The GLB contains:
    - A skeleton of named nodes (bones) matching Mixamo naming
    - Animation tracks with quaternion rotations per bone
    - Root translation track on the hip bone

    This GLB can be loaded alongside the model GLB using Three.js:
        const {animations} = await loader.loadAsync('animation.glb')
        mixer.clipAction(animations[0]).play()

    Three.js matches animation tracks to bones by name.
    """
    # Build the list of bones we'll animate
    bone_names = []
    bone_tracks = {}

    for soma_name, mixamo_name in SOMA_TO_MIXAMO.items():
        if soma_name in SOMA_SKIP_JOINTS:
            continue
        if mixamo_name in tracks.get("tracks", {}):
            bone_names.append(mixamo_name)
            bone_tracks[mixamo_name] = tracks["tracks"][mixamo_name]

    if not bone_names:
        raise ValueError("No valid bone tracks found")

    num_frames = tracks["num_frames"]
    duration = tracks["duration"]

    # ── Build binary buffer ──
    # All accessor data goes into a single binary buffer
    buffer_data = bytearray()
    accessors = []
    buffer_views = []

    def add_accessor(data_list: list, component_type: int, acc_type: str,
                     count: int, min_vals=None, max_vals=None) -> int:
        """Add data to buffer and create accessor + bufferView. Returns accessor index."""
        flat = []
        for item in data_list:
            if isinstance(item, (list, tuple, np.ndarray)):
                flat.extend(item)
            else:
                flat.append(float(item))

        raw = pack_float32_array(flat)
        raw = pad_to_4(raw)

        bv_idx = len(buffer_views)
        offset = len(buffer_data)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(raw),
        })
        buffer_data.extend(raw)

        acc = {
            "bufferView": bv_idx,
            "componentType": component_type,  # 5126 = FLOAT
            "count": count,
            "type": acc_type,
        }
        if min_vals is not None:
            acc["min"] = min_vals
        if max_vals is not None:
            acc["max"] = max_vals

        acc_idx = len(accessors)
        accessors.append(acc)
        return acc_idx

    # ── Create animation channels and samplers ──
    channels = []
    samplers = []
    nodes = []

    # Create a node for each bone
    node_index_map = {}
    for i, name in enumerate(bone_names):
        nodes.append({"name": name})
        node_index_map[name] = i

    # Time accessor (shared across all tracks)
    times = np.arange(num_frames, dtype=np.float32) / fps
    time_acc = add_accessor(
        times.tolist(), 5126, "SCALAR", num_frames,
        min_vals=[0.0], max_vals=[float(duration)]
    )

    for bone_name in bone_names:
        track = bone_tracks[bone_name]
        node_idx = node_index_map[bone_name]

        # Quaternion rotation track
        if "values" in track:
            quats = track["values"]  # List of [x, y, z, w]
            quat_acc = add_accessor(quats, 5126, "VEC4", num_frames)

            sampler_idx = len(samplers)
            samplers.append({
                "input": time_acc,
                "interpolation": "LINEAR",
                "output": quat_acc,
            })
            channels.append({
                "sampler": sampler_idx,
                "target": {"node": node_idx, "path": "rotation"},
            })

        # Translation track (typically only on root/hips)
        if "translation_values" in track:
            trans = track["translation_values"]
            trans_acc = add_accessor(trans, 5126, "VEC3", num_frames)

            # May need separate time accessor if translation has different timing
            trans_time_acc = time_acc
            if "translation_times" in track:
                trans_times = track["translation_times"]
                if len(trans_times) != num_frames:
                    trans_time_acc = add_accessor(
                        trans_times, 5126, "SCALAR", len(trans_times),
                        min_vals=[trans_times[0]], max_vals=[trans_times[-1]]
                    )

            sampler_idx = len(samplers)
            samplers.append({
                "input": trans_time_acc,
                "interpolation": "LINEAR",
                "output": trans_acc,
            })
            channels.append({
                "sampler": sampler_idx,
                "target": {"node": node_idx, "path": "translation"},
            })

    # ── Assemble glTF JSON ──
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "APEX Kimodo Pipeline",
        },
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "animations": [{
            "name": animation_name,
            "channels": channels,
            "samplers": samplers,
        }],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{
            "byteLength": len(buffer_data),
        }],
    }

    # ── Pack as GLB ──
    json_str = json.dumps(gltf, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    json_bytes = pad_to_4(json_bytes)

    bin_bytes = pad_to_4(bytes(buffer_data))

    # GLB header: magic + version + total length
    total_length = (
        12 +                          # GLB header
        8 + len(json_bytes) +         # JSON chunk header + data
        8 + len(bin_bytes)            # BIN chunk header + data
    )

    glb = bytearray()
    # Header
    glb.extend(struct.pack('<I', 0x46546C67))  # magic: glTF
    glb.extend(struct.pack('<I', 2))           # version
    glb.extend(struct.pack('<I', total_length))
    # JSON chunk
    glb.extend(struct.pack('<I', len(json_bytes)))
    glb.extend(struct.pack('<I', 0x4E4F534A))  # type: JSON
    glb.extend(json_bytes)
    # BIN chunk
    glb.extend(struct.pack('<I', len(bin_bytes)))
    glb.extend(struct.pack('<I', 0x004E4942))  # type: BIN
    glb.extend(bin_bytes)

    return bytes(glb)


# ── Conversion functions ──────────────────────────────────────────────────

def convert_to_skeletal_glb(npz_path: str, output_path: str, anim_name: str = None):
    """Convert Kimodo NPZ to a GLB with skeletal animation tracks."""
    data = np.load(npz_path, allow_pickle=True)

    # Try different key names Kimodo might use
    local_rots = None
    root_trans = None

    for key in ['local_rot_mats', 'rots', 'rotations', 'joint_rotations']:
        if key in data:
            local_rots = data[key]
            break

    for key in ['root_translation', 'trans', 'translation', 'root_trans']:
        if key in data:
            root_trans = data[key]
            break

    if local_rots is None:
        # If only global rotations available, convert to local
        for key in ['global_rot_mats', 'global_rots']:
            if key in data:
                local_rots = global_to_local_rotations(data[key])
                break

    if local_rots is None:
        raise ValueError(f"No rotation data found in {npz_path}. Keys: {list(data.keys())}")

    if root_trans is None:
        # Default to zero translation
        num_frames = local_rots.shape[0]
        root_trans = np.zeros((num_frames, 3), dtype=np.float32)

    fps = int(data.get('fps', np.array(30)))

    if anim_name is None:
        anim_name = Path(npz_path).stem

    print(f"  Converting: {local_rots.shape[0]} frames, {local_rots.shape[1]} joints @ {fps}fps")

    # Extract skeletal keyframes
    tracks = extract_skeletal_keyframes(local_rots, root_trans, fps=fps)

    # Create GLB
    glb_data = create_animation_glb(tracks, animation_name=anim_name, fps=fps)

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(glb_data)

    size_kb = len(glb_data) / 1024
    print(f"  Wrote: {output_path} ({size_kb:.1f} KB)")


def convert_to_pivot_json(npz_path: str, output_path: str):
    """Convert Kimodo NPZ to JSON keyframes for our pivot animation system."""
    data = np.load(npz_path, allow_pickle=True)

    local_rots = None
    root_trans = None

    for key in ['local_rot_mats', 'rots', 'rotations']:
        if key in data:
            local_rots = data[key]
            break

    for key in ['root_translation', 'trans', 'translation']:
        if key in data:
            root_trans = data[key]
            break

    if local_rots is None:
        for key in ['global_rot_mats', 'global_rots']:
            if key in data:
                local_rots = global_to_local_rotations(data[key])
                break

    if local_rots is None:
        raise ValueError(f"No rotation data found in {npz_path}. Keys: {list(data.keys())}")

    if root_trans is None:
        num_frames = local_rots.shape[0]
        root_trans = np.zeros((num_frames, 3), dtype=np.float32)

    fps = int(data.get('fps', np.array(30)))

    # Load metadata if available
    meta_path = npz_path.replace('.npz', '_meta.json')
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)

    print(f"  Converting: {local_rots.shape[0]} frames @ {fps}fps -> pivot keyframes")

    keyframes = extract_pivot_keyframes(local_rots, root_trans, fps=fps)
    keyframes["name"] = meta.get("name", Path(npz_path).stem)
    keyframes["loop"] = meta.get("loop", False)
    keyframes["prompt"] = meta.get("prompt", "")

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(keyframes, f, indent=2)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Wrote: {output_path} ({size_kb:.1f} KB)")


def global_to_local_rotations(global_rots: np.ndarray) -> np.ndarray:
    """
    Convert global rotation matrices to local (parent-relative) rotations.
    global_rots: [num_frames, num_joints, 3, 3]
    """
    num_frames, num_joints = global_rots.shape[:2]
    local_rots = np.zeros_like(global_rots)

    for frame in range(num_frames):
        for joint in range(num_joints):
            parent = SOMA_PARENTS[joint]
            if parent < 0:
                # Root joint: local = global
                local_rots[frame, joint] = global_rots[frame, joint]
            else:
                # local = parent_global^-1 * joint_global
                parent_inv = np.linalg.inv(global_rots[frame, parent])
                local_rots[frame, joint] = parent_inv @ global_rots[frame, joint]

    return local_rots


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Convert Kimodo NPZ to GLB/JSON")
    parser.add_argument("input", help="Input NPZ file or directory (with --batch)")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument("--mode", choices=["skeletal", "pivot"], default="pivot",
                        help="Output mode: skeletal (GLB) or pivot (JSON)")
    parser.add_argument("--batch", action="store_true",
                        help="Process all NPZ files in input directory")
    parser.add_argument("--dest", help="Destination directory for batch output")
    parser.add_argument("--name", help="Animation name (default: filename)")
    args = parser.parse_args()

    if args.batch:
        input_dir = Path(args.input)
        if not input_dir.is_dir():
            print(f"Error: {args.input} is not a directory")
            sys.exit(1)

        dest = Path(args.dest) if args.dest else input_dir
        npz_files = sorted(input_dir.glob("*.npz"))

        if not npz_files:
            print(f"No NPZ files found in {input_dir}")
            sys.exit(1)

        print(f"Batch converting {len(npz_files)} files (mode={args.mode})...")
        for npz_path in npz_files:
            name = npz_path.stem
            if args.mode == "skeletal":
                out_path = dest / f"{name}.glb"
                try:
                    convert_to_skeletal_glb(str(npz_path), str(out_path), anim_name=name)
                except Exception as e:
                    print(f"  FAILED {name}: {e}")
            else:
                out_path = dest / f"{name}.json"
                try:
                    convert_to_pivot_json(str(npz_path), str(out_path))
                except Exception as e:
                    print(f"  FAILED {name}: {e}")

        print(f"\nDone! Output in: {dest}")
        return

    # Single file conversion
    if not os.path.exists(args.input):
        print(f"Error: {args.input} not found")
        sys.exit(1)

    if args.mode == "skeletal":
        output = args.output or args.input.replace('.npz', '.glb')
        convert_to_skeletal_glb(args.input, output, anim_name=args.name)
    else:
        output = args.output or args.input.replace('.npz', '.json')
        convert_to_pivot_json(args.input, output)


if __name__ == "__main__":
    main()
