import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlayerStore } from '../../stores/usePlayerStore';

interface CameraConfig {
  height: number;
  distance: number;
  lookOffset: number;
}

const CAMERA_CONFIGS: Record<number, CameraConfig> = {
  0: { height: 3, distance: 6, lookOffset: 0.3 },
  1: { height: 3, distance: 6, lookOffset: 0.3 },
  2: { height: 5, distance: 8, lookOffset: 0.8 },
  3: { height: 8, distance: 10, lookOffset: 1.5 },
};

export function FollowCamera({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const { camera } = useThree();
  const currentConfig = useRef<CameraConfig>({ ...CAMERA_CONFIGS[0] });

  useFrame((_, delta) => {
    if (!target.current) return;

    const repairState = usePlayerStore.getState().repairState;
    const goalConfig = CAMERA_CONFIGS[repairState];

    // Smooth interpolation to target config
    const lerpSpeed = 2 * delta;
    currentConfig.current.height = THREE.MathUtils.lerp(currentConfig.current.height, goalConfig.height, lerpSpeed);
    currentConfig.current.distance = THREE.MathUtils.lerp(currentConfig.current.distance, goalConfig.distance, lerpSpeed);
    currentConfig.current.lookOffset = THREE.MathUtils.lerp(currentConfig.current.lookOffset, goalConfig.lookOffset, lerpSpeed);

    const { height, distance, lookOffset } = currentConfig.current;
    const targetPos = target.current.position;

    // Position camera behind and above the character
    const idealPos = new THREE.Vector3(
      targetPos.x,
      targetPos.y + height,
      targetPos.z - distance
    );

    camera.position.lerp(idealPos, 4 * delta);

    const lookAt = new THREE.Vector3(targetPos.x, targetPos.y + lookOffset, targetPos.z);
    camera.lookAt(lookAt);
  });

  return null;
}
