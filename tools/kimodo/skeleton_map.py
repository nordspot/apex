"""
SOMA 30-joint skeleton -> Mixamo/Humanoid bone mapping for Kimodo pipeline.

SOMA skeleton (Kimodo-SOMA-RP-v1) uses 30 joints:
  Index 0-29, output as rotation matrices [num_frames, 30, 3, 3]

This module provides:
  - SOMA joint names and hierarchy
  - Mapping to standard Mixamo bone names
  - Mapping to our pivot-based system (shoulder/elbow/hip/knee angles)
"""

from dataclasses import dataclass
import numpy as np
from typing import Optional


# ── SOMA 30-joint skeleton definition ──────────────────────────────────────

SOMA_JOINT_NAMES = [
    "Hips",                 # 0  - root
    "Spine1",               # 1
    "Spine2",               # 2
    "Chest",                # 3
    "Neck1",                # 4
    "Neck2",                # 5
    "Head",                 # 6
    "Jaw",                  # 7
    "LeftEye",              # 8
    "RightEye",             # 9
    "LeftShoulder",         # 10
    "LeftArm",              # 11 - upper arm
    "LeftForeArm",          # 12 - lower arm
    "LeftHand",             # 13
    "LeftHandThumbEnd",     # 14
    "LeftHandMiddleEnd",    # 15
    "RightShoulder",        # 16
    "RightArm",             # 17 - upper arm
    "RightForeArm",         # 18 - lower arm
    "RightHand",            # 19
    "RightHandThumbEnd",    # 20
    "RightHandMiddleEnd",   # 21
    "LeftLeg",              # 22 - upper leg (thigh)
    "LeftShin",             # 23 - lower leg
    "LeftFoot",             # 24
    "LeftToeBase",          # 25
    "RightLeg",             # 26 - upper leg (thigh)
    "RightShin",            # 27 - lower leg
    "RightFoot",            # 28
    "RightToeBase",         # 29
]

# Parent indices (-1 = root)
SOMA_PARENTS = [
    -1,  # 0  Hips
     0,  # 1  Spine1
     1,  # 2  Spine2
     2,  # 3  Chest
     3,  # 4  Neck1
     4,  # 5  Neck2
     5,  # 6  Head
     6,  # 7  Jaw
     6,  # 8  LeftEye
     6,  # 9  RightEye
     3,  # 10 LeftShoulder
    10,  # 11 LeftArm
    11,  # 12 LeftForeArm
    12,  # 13 LeftHand
    13,  # 14 LeftHandThumbEnd
    13,  # 15 LeftHandMiddleEnd
     3,  # 16 RightShoulder
    16,  # 17 RightArm
    17,  # 18 RightForeArm
    18,  # 19 RightHand
    19,  # 20 RightHandThumbEnd
    19,  # 21 RightHandMiddleEnd
     0,  # 22 LeftLeg
    22,  # 23 LeftShin
    23,  # 24 LeftFoot
    24,  # 25 LeftToeBase
     0,  # 26 RightLeg
    26,  # 27 RightShin
    27,  # 28 RightFoot
    28,  # 29 RightToeBase
]


# ── SOMA -> Mixamo bone name mapping ───────────────────────────────────────
# Used when the target model has a Mixamo skeleton (e.g., X Bot, Y Bot)

SOMA_TO_MIXAMO = {
    "Hips":           "mixamorigHips",
    "Spine1":         "mixamorigSpine",
    "Spine2":         "mixamorigSpine1",
    "Chest":          "mixamorigSpine2",
    "Neck1":          "mixamorigNeck",
    "Head":           "mixamorigHead",
    "LeftShoulder":   "mixamorigLeftShoulder",
    "LeftArm":        "mixamorigLeftArm",
    "LeftForeArm":    "mixamorigLeftForeArm",
    "LeftHand":       "mixamorigLeftHand",
    "RightShoulder":  "mixamorigRightShoulder",
    "RightArm":       "mixamorigRightArm",
    "RightForeArm":   "mixamorigRightForeArm",
    "RightHand":      "mixamorigRightHand",
    "LeftLeg":        "mixamorigLeftUpLeg",
    "LeftShin":       "mixamorigLeftLeg",
    "LeftFoot":       "mixamorigLeftFoot",
    "LeftToeBase":    "mixamorigLeftToeBase",
    "RightLeg":       "mixamorigRightUpLeg",
    "RightShin":      "mixamorigRightLeg",
    "RightFoot":      "mixamorigRightFoot",
    "RightToeBase":   "mixamorigRightToeBase",
    # These SOMA joints have no Mixamo equivalent:
    # Neck2, Jaw, LeftEye, RightEye, *HandThumbEnd, *HandMiddleEnd
}

# Joints we skip (no Mixamo equivalent or not needed for game animation)
SOMA_SKIP_JOINTS = {"Neck2", "Jaw", "LeftEye", "RightEye",
                    "LeftHandThumbEnd", "LeftHandMiddleEnd",
                    "RightHandThumbEnd", "RightHandMiddleEnd"}


# ── SOMA -> Pivot system mapping ───────────────────────────────────────────
# Used when the target model has no skeleton (mesh pivot animation).
# Maps SOMA joints to our RawScene.ts pivot names + rotation axis.

@dataclass
class PivotMapping:
    """Maps a SOMA joint to one of our mesh pivots."""
    soma_index: int          # Index in SOMA 30-joint array
    pivot_name: str          # Key in limbPivots/elbowPivots/kneePivots map
    pivot_type: str          # 'shoulder', 'elbow', 'hip', 'knee'
    rotation_axis: str       # Which axis of the 3x3 rotation matrix to extract ('x', 'y', 'z')
    sign: float              # +1 or -1 to flip rotation direction if needed


SOMA_TO_PIVOTS = [
    # Arms: SOMA LeftArm/RightArm -> our shoulder pivots (rotation.x)
    PivotMapping(soma_index=11, pivot_name="left_arm",  pivot_type="shoulder", rotation_axis="x", sign=1.0),
    PivotMapping(soma_index=17, pivot_name="right_arm", pivot_type="shoulder", rotation_axis="x", sign=1.0),
    # Elbows: SOMA LeftForeArm/RightForeArm -> our elbow pivots (rotation.x)
    PivotMapping(soma_index=12, pivot_name="left_arm",  pivot_type="elbow",   rotation_axis="x", sign=1.0),
    PivotMapping(soma_index=18, pivot_name="right_arm", pivot_type="elbow",   rotation_axis="x", sign=1.0),
    # Hips: SOMA LeftLeg/RightLeg -> our hip pivots (rotation.x)
    PivotMapping(soma_index=22, pivot_name="left_leg",  pivot_type="hip",     rotation_axis="x", sign=1.0),
    PivotMapping(soma_index=26, pivot_name="right_leg", pivot_type="hip",     rotation_axis="x", sign=1.0),
    # Knees: SOMA LeftShin/RightShin -> our knee pivots (rotation.x)
    PivotMapping(soma_index=23, pivot_name="left_leg",  pivot_type="knee",    rotation_axis="x", sign=1.0),
    PivotMapping(soma_index=27, pivot_name="right_leg", pivot_type="knee",    rotation_axis="x", sign=1.0),
]

# Body pose from spine chain
SOMA_SPINE_INDICES = [0, 1, 2, 3]  # Hips, Spine1, Spine2, Chest


# ── Utility functions ─────────────────────────────────────────────────────

def rotmat_to_euler(rot_mat: np.ndarray) -> np.ndarray:
    """
    Extract Euler angles (XYZ order) from a 3x3 rotation matrix.
    Returns array of [rx, ry, rz] in radians.
    """
    # Using scipy for robust conversion
    from scipy.spatial.transform import Rotation
    r = Rotation.from_matrix(rot_mat)
    return r.as_euler('xyz')


def rotmat_to_quaternion(rot_mat: np.ndarray) -> np.ndarray:
    """
    Convert 3x3 rotation matrix to quaternion [x, y, z, w].
    glTF uses [x, y, z, w] order.
    """
    from scipy.spatial.transform import Rotation
    r = Rotation.from_matrix(rot_mat)
    return r.as_quat()  # scipy returns [x, y, z, w]


def extract_axis_angle(rot_mat: np.ndarray, axis: str) -> float:
    """
    Extract rotation angle around a single axis from a 3x3 rotation matrix.
    Used for pivot-based animation where we only rotate around X.
    """
    euler = rotmat_to_euler(rot_mat)
    axis_map = {'x': 0, 'y': 1, 'z': 2}
    return float(euler[axis_map[axis]])


def extract_pivot_keyframes(
    local_rot_mats: np.ndarray,
    root_translation: np.ndarray,
    fps: int = 30,
) -> dict:
    """
    Extract pivot rotation keyframes from Kimodo SOMA output.

    Args:
        local_rot_mats: [num_frames, 30, 3, 3] local rotation matrices
        root_translation: [num_frames, 3] root position
        fps: frame rate (Kimodo outputs at 30fps)

    Returns:
        Dict with keyframe data for each pivot, plus root motion.
        Format compatible with JSON export for Three.js consumption.
    """
    num_frames = local_rot_mats.shape[0]
    times = np.arange(num_frames, dtype=np.float32) / fps

    result = {
        "fps": fps,
        "duration": float(num_frames / fps),
        "num_frames": num_frames,
        "times": times.tolist(),
        "root_translation": root_translation.tolist(),
        "pivots": {},
    }

    for mapping in SOMA_TO_PIVOTS:
        key = f"{mapping.pivot_name}_{mapping.pivot_type}"
        angles = []
        for frame in range(num_frames):
            rot = local_rot_mats[frame, mapping.soma_index]
            angle = extract_axis_angle(rot, mapping.rotation_axis) * mapping.sign
            angles.append(float(angle))

        result["pivots"][key] = {
            "soma_joint": SOMA_JOINT_NAMES[mapping.soma_index],
            "pivot_name": mapping.pivot_name,
            "pivot_type": mapping.pivot_type,
            "angles": angles,
        }

    # Extract overall body tilt from spine chain
    spine_angles_x = []
    for frame in range(num_frames):
        # Sum spine rotations to get overall forward tilt
        total_tilt = 0.0
        for si in SOMA_SPINE_INDICES:
            euler = rotmat_to_euler(local_rot_mats[frame, si])
            total_tilt += euler[0]  # X rotation = forward/back tilt
        spine_angles_x.append(float(total_tilt))

    result["body_tilt_x"] = spine_angles_x

    return result


def extract_skeletal_keyframes(
    local_rot_mats: np.ndarray,
    root_translation: np.ndarray,
    target_bones: Optional[dict] = None,
    fps: int = 30,
) -> dict:
    """
    Extract full skeletal animation keyframes for GLB export.

    Args:
        local_rot_mats: [num_frames, 30, 3, 3] local rotation matrices
        root_translation: [num_frames, 3] root position
        target_bones: Optional custom bone name mapping (defaults to Mixamo)
        fps: frame rate

    Returns:
        Dict with per-bone quaternion keyframes for GLB animation creation.
    """
    if target_bones is None:
        target_bones = SOMA_TO_MIXAMO

    num_frames = local_rot_mats.shape[0]
    times = np.arange(num_frames, dtype=np.float32) / fps

    tracks = {}
    for soma_name, target_name in target_bones.items():
        soma_idx = SOMA_JOINT_NAMES.index(soma_name)
        quats = []
        for frame in range(num_frames):
            rot = local_rot_mats[frame, soma_idx]
            q = rotmat_to_quaternion(rot)
            quats.append(q.tolist())  # [x, y, z, w]

        tracks[target_name] = {
            "type": "quaternion",
            "times": times.tolist(),
            "values": quats,
        }

    # Root translation track
    tracks[target_bones.get("Hips", "mixamorigHips")] = {
        **tracks.get(target_bones.get("Hips", "mixamorigHips"), {}),
        "translation_times": times.tolist(),
        "translation_values": root_translation.tolist(),
    }

    return {
        "fps": fps,
        "duration": float(num_frames / fps),
        "num_frames": num_frames,
        "tracks": tracks,
    }


if __name__ == "__main__":
    print("SOMA 30-joint skeleton:")
    for i, name in enumerate(SOMA_JOINT_NAMES):
        parent = SOMA_JOINT_NAMES[SOMA_PARENTS[i]] if SOMA_PARENTS[i] >= 0 else "ROOT"
        mixamo = SOMA_TO_MIXAMO.get(name, "(no mapping)")
        print(f"  [{i:2d}] {name:24s} parent={parent:20s} mixamo={mixamo}")

    print(f"\nPivot mappings ({len(SOMA_TO_PIVOTS)}):")
    for m in SOMA_TO_PIVOTS:
        print(f"  SOMA[{m.soma_index}] {SOMA_JOINT_NAMES[m.soma_index]:16s} -> {m.pivot_name}_{m.pivot_type} (rot.{m.rotation_axis} * {m.sign})")
