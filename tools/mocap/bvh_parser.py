"""
Standalone BVH parser for motion capture files.
Extracts joint rotations from BVH files without requiring ai4animationpy.
Outputs joint rotations as euler angles per frame.
"""

import re
import numpy as np
from dataclasses import dataclass, field


@dataclass
class Joint:
    name: str
    parent: int  # -1 for root
    offset: np.ndarray  # [3] local offset
    channels: list  # e.g. ['Xrotation', 'Yrotation', 'Zrotation']
    channel_start: int = 0  # index into flat channel array


@dataclass
class BVHData:
    joints: list  # list of Joint
    frametime: float
    num_frames: int
    channel_data: np.ndarray  # [num_frames, total_channels]

    @property
    def fps(self) -> float:
        return round(1.0 / self.frametime)

    @property
    def duration(self) -> float:
        return self.num_frames * self.frametime

    def joint_by_name(self, name: str) -> Joint | None:
        for j in self.joints:
            if j.name == name:
                return j
        return None

    def get_rotation_euler(self, joint: Joint, frame: int) -> np.ndarray:
        """Get [roll, pitch, yaw] euler angles in radians for a joint at a frame."""
        rot_channels = [c for c in joint.channels if 'rotation' in c.lower()]
        angles = np.zeros(3)
        channel_map = {'Xrotation': 0, 'Yrotation': 1, 'Zrotation': 2}
        for i, ch in enumerate(rot_channels):
            ch_idx = joint.channel_start + joint.channels.index(ch)
            axis = channel_map.get(ch, i)
            angles[axis] = np.radians(self.channel_data[frame, ch_idx])
        return angles

    def get_all_rotations(self, joint: Joint) -> np.ndarray:
        """Get [num_frames, 3] euler angles in radians for a joint across all frames."""
        result = np.zeros((self.num_frames, 3))
        for f in range(self.num_frames):
            result[f] = self.get_rotation_euler(joint, f)
        return result

    def get_position(self, joint: Joint, frame: int) -> np.ndarray | None:
        """Get [x, y, z] position for joints with position channels (usually root)."""
        pos_channels = [c for c in joint.channels if 'position' in c.lower()]
        if not pos_channels:
            return None
        pos = np.zeros(3)
        channel_map = {'Xposition': 0, 'Yposition': 1, 'Zposition': 2}
        for ch in pos_channels:
            ch_idx = joint.channel_start + joint.channels.index(ch)
            axis = channel_map.get(ch, 0)
            pos[axis] = self.channel_data[frame, ch_idx]
        return pos


def parse_bvh(filepath: str) -> BVHData:
    """Parse a BVH file into structured data."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Split into HIERARCHY and MOTION sections
    parts = content.split('MOTION')
    hierarchy_text = parts[0]
    motion_text = parts[1] if len(parts) > 1 else ''

    # Parse hierarchy
    joints = []
    parent_stack = []
    total_channels = 0

    lines = hierarchy_text.strip().split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if line.startswith('ROOT') or line.startswith('JOINT'):
            name = line.split()[-1]
            parent = parent_stack[-1] if parent_stack else -1
            joints.append(Joint(
                name=name,
                parent=parent,
                offset=np.zeros(3),
                channels=[],
                channel_start=total_channels,
            ))

        elif line.startswith('End Site'):
            # Skip end site block
            i += 1
            while i < len(lines) and '}' not in lines[i]:
                i += 1
            if parent_stack:
                pass  # don't pop, the } for End Site is separate
            i += 1
            continue

        elif line.startswith('OFFSET'):
            vals = line.split()[1:]
            if joints:
                joints[-1].offset = np.array([float(v) for v in vals])

        elif line.startswith('CHANNELS'):
            parts_ch = line.split()
            n_ch = int(parts_ch[1])
            ch_names = parts_ch[2:2 + n_ch]
            if joints:
                joints[-1].channels = ch_names
                joints[-1].channel_start = total_channels
                total_channels += n_ch

        elif '{' in line:
            parent_stack.append(len(joints) - 1)

        elif '}' in line:
            if parent_stack:
                parent_stack.pop()

        i += 1

    # Parse motion data
    motion_lines = motion_text.strip().split('\n')
    num_frames = 0
    frametime = 1.0 / 30.0

    data_start = 0
    for i, line in enumerate(motion_lines):
        line = line.strip()
        if line.startswith('Frames:'):
            num_frames = int(line.split(':')[1].strip())
        elif line.startswith('Frame Time:'):
            frametime = float(line.split(':')[1].strip())
        elif line and not line.startswith('Frames') and not line.startswith('Frame'):
            data_start = i
            break

    # Read frame data
    channel_data = np.zeros((num_frames, total_channels))
    for f in range(num_frames):
        if data_start + f < len(motion_lines):
            vals = motion_lines[data_start + f].strip().split()
            for c in range(min(len(vals), total_channels)):
                channel_data[f, c] = float(vals[c])

    return BVHData(
        joints=joints,
        frametime=frametime,
        num_frames=num_frames,
        channel_data=channel_data,
    )


def print_skeleton(bvh: BVHData):
    """Print the skeleton hierarchy."""
    for i, j in enumerate(bvh.joints):
        indent = ''
        p = j.parent
        while p >= 0:
            indent += '  '
            p = bvh.joints[p].parent
        print(f'{indent}{j.name} (parent={j.parent}, channels={j.channels})')


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print('Usage: python bvh_parser.py <file.bvh>')
        sys.exit(1)

    bvh = parse_bvh(sys.argv[1])
    print(f'Joints: {len(bvh.joints)}')
    print(f'Frames: {bvh.num_frames}')
    print(f'FPS: {bvh.fps}')
    print(f'Duration: {bvh.duration:.2f}s')
    print()
    print_skeleton(bvh)
