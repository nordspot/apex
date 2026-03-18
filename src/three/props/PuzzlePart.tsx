import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BodyPart } from '../../types/game';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useUIStore } from '../../stores/useUIStore';
import { REPAIR_LABELS } from '../../types/game';

interface PuzzlePartProps {
  part: BodyPart;
}

export function PuzzlePart({ part }: PuzzlePartProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const collected = usePlayerStore((s) => s.partsCollected.includes(part.id));

  useFrame((_, delta) => {
    if (!meshRef.current || collected) return;
    // Bob
    meshRef.current.position.y = part.position[1] + Math.sin(Date.now() * 0.0015) * 0.15;
    // Spin
    meshRef.current.rotation.y += delta * 0.8;
  });

  if (collected) return null;

  const handleClick = () => {
    // Check distance to player (simplified — proper interaction system later)
    const playerPos = new THREE.Vector3(0, 0, 0); // TODO: get from player ref
    const partPos = new THREE.Vector3(...part.position);
    if (playerPos.distanceTo(partPos) > 3) return;

    usePlayerStore.getState().collectPart(part.id, part.repairStateGrant);
    const stateLabel = REPAIR_LABELS[part.repairStateGrant];
    useUIStore.getState().showMessage(`${part.displayName} attached!\nYou can ${stateLabel.toLowerCase()} now.`);
  };

  return (
    <mesh
      ref={meshRef}
      position={part.position}
      onClick={handleClick}
      castShadow
    >
      <capsuleGeometry args={[0.15, 0.5, 8, 16]} />
      <meshStandardMaterial
        color="#FFD038"
        roughness={0.3}
        metalness={0.8}
        emissive="#FF8800"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}
