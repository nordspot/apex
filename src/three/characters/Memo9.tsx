import { useRef, useImperativeHandle, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useInputStore } from '../../systems/InputManager';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { REPAIR_SPEEDS, LEVEL1_PARTS } from '../../types/game';

const INTERACTION_RADIUS = 2.0;

export const Memo9 = forwardRef<THREE.Group>(function Memo9(_props, ref) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useImperativeHandle(ref, () => groupRef.current!, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const { moveX, moveY, interact } = useInputStore.getState();
    const repairState = usePlayerStore.getState().repairState;
    const speed = REPAIR_SPEEDS[repairState];

    // Camera-relative movement
    if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
      const cameraForward = new THREE.Vector3();
      const cameraRight = new THREE.Vector3();
      camera.getWorldDirection(cameraForward);
      cameraForward.y = 0;
      cameraForward.normalize();
      cameraRight.crossVectors(cameraForward, THREE.Object3D.DEFAULT_UP).normalize();

      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(cameraForward, moveY);
      moveDir.addScaledVector(cameraRight, moveX);
      moveDir.normalize();

      groupRef.current.position.addScaledVector(moveDir, speed * delta);
      groupRef.current.position.y = 0;

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetAngle,
        5 * delta
      );

      usePlayerStore.getState().setIsMoving(true);
    } else {
      usePlayerStore.getState().setIsMoving(false);
    }

    // Proximity interaction check
    if (interact) {
      const playerPos = groupRef.current.position;
      const partsCollected = usePlayerStore.getState().partsCollected;

      for (const part of LEVEL1_PARTS) {
        if (partsCollected.includes(part.id)) continue;
        const partPos = new THREE.Vector3(...part.position);
        if (playerPos.distanceTo(partPos) < INTERACTION_RADIUS) {
          usePlayerStore.getState().collectPart(part.id, part.repairStateGrant);
          const labels: Record<number, string> = { 0: 'Broken', 1: 'crawl', 2: 'hobble', 3: 'walk normally' };
          const label = labels[part.repairStateGrant] ?? '';
          useUIStore.getState().showMessage(
            `${part.displayName} attached!\nYou can ${label} now.`
          );
          useInputStore.getState().setInteract(false);
          break;
        }
      }
    }
  });

  const repairState = usePlayerStore((s) => s.repairState);
  const bodyHeight = repairState <= 1 ? 0.4 : repairState === 2 ? 0.9 : 1.0;
  const bodyY = repairState <= 1 ? 0.3 : 1.0;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Body */}
      <mesh position={[0, bodyY, 0]} castShadow>
        <capsuleGeometry args={[0.35, bodyHeight, 8, 16]} />
        <meshStandardMaterial color="#E8E8EC" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Head */}
      <mesh position={[0, bodyY + bodyHeight / 2 + 0.35, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#E8E8EC" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.08, bodyY + bodyHeight / 2 + 0.38, 0.2]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-0.08, bodyY + bodyHeight / 2 + 0.38, 0.2]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={2} />
      </mesh>
      {/* Right arm (visible when repairState >= 1) */}
      {repairState >= 1 && (
        <mesh position={[0.5, bodyY + bodyHeight / 4, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
          <meshStandardMaterial color="#D0D0D4" roughness={0.5} metalness={0.5} />
        </mesh>
      )}
      {/* Left leg (visible when repairState >= 2) */}
      {repairState >= 2 && (
        <mesh position={[-0.18, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
          <meshStandardMaterial color="#D0D0D4" roughness={0.5} metalness={0.5} />
        </mesh>
      )}
      {/* Right leg (visible when repairState >= 3) */}
      {repairState >= 3 && (
        <mesh position={[0.18, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
          <meshStandardMaterial color="#D0D0D4" roughness={0.5} metalness={0.5} />
        </mesh>
      )}
    </group>
  );
});
