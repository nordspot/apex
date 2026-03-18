import { useMemo } from 'react';
import { generateTerrainGeometry, paintTerrainVertexColors, LEVEL1_TERRAIN } from '../../utils/terrain';

export function ProceduralTerrain() {
  const geometry = useMemo(() => {
    const geo = generateTerrainGeometry(LEVEL1_TERRAIN);
    paintTerrainVertexColors(geo, LEVEL1_TERRAIN.maxHeight);
    return geo;
  }, []);

  // Offset so MEMO-9 at world (0,0,0) is at the southern quarter
  const offsetZ = LEVEL1_TERRAIN.sizeZ * (0.5 - LEVEL1_TERRAIN.playerNZ);

  return (
    <mesh geometry={geometry} position={[0, 0, offsetZ]} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  );
}
