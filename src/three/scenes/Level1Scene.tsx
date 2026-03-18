import { useRef } from 'react';
import * as THREE from 'three';
import { ProceduralTerrain } from '../environment/ProceduralTerrain';
import { SunsetLighting } from '../lighting/SunsetLighting';
import { PuzzlePart } from '../props/PuzzlePart';
import { Memo9 } from '../characters/Memo9';
import { FollowCamera } from '../camera/FollowCamera';
import { LEVEL1_PARTS } from '../../types/game';

export function Level1Scene() {
  const memo9Ref = useRef<THREE.Group>(null);

  return (
    <>
      <SunsetLighting />

      {/* Ambient fill to ensure nothing is pitch black */}
      <ambientLight intensity={0.3} />
      <ProceduralTerrain />

      {/* Ground plane for physics (flat, invisible) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={0.3} />
      </mesh>

      {/* MEMO-9 */}
      <Memo9 ref={memo9Ref} />

      {/* Puzzle parts */}
      {LEVEL1_PARTS.map((part) => (
        <PuzzlePart key={part.id} part={part} />
      ))}

      {/* Crash crate */}
      <group position={[-2.5, 0.4, -1]} rotation={[0, 0.26, 0.14]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 1.2, 1]} />
          <meshStandardMaterial color="#8B6914" roughness={0.8} />
        </mesh>
      </group>

      {/* Debris rocks */}
      {ROCK_POSITIONS.map(([x, y, z], i) => (
        <mesh key={`rock-${i}`} position={[x, y, z]} castShadow>
          <dodecahedronGeometry args={[ROCK_SIZES[i], 0]} />
          <meshStandardMaterial color="#6B6B6B" roughness={0.9} />
        </mesh>
      ))}

      {/* Repair station */}
      <group position={[0, 0, 21]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 1, 16]} />
          <meshStandardMaterial
            color="#FFD038"
            roughness={0.3}
            metalness={0.8}
            emissive="#FF8800"
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>

      <FollowCamera target={memo9Ref} />
    </>
  );
}

const ROCK_SIZES = [0.45, 0.55, 0.35, 0.6, 0.4, 0.5, 0.65, 0.3, 0.55, 0.45];

const ROCK_POSITIONS: [number, number, number][] = [
  [3, 0.15, -2],
  [-4, 0.1, 1],
  [5, 0.2, 3],
  [-6, 0.15, -3],
  [7, 0.1, 8],
  [-3, 0.2, 5],
  [10, 0.15, 10],
  [-9, 0.1, 9],
  [2, 0.2, 12],
  [-5, 0.15, 14],
];
