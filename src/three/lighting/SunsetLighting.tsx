import * as THREE from 'three';

export function SunsetLighting() {
  return (
    <>
      {/* Directional sun — low angle golden hour */}
      <directionalLight
        position={[-50, 25, -30]}
        color={new THREE.Color(1.0, 0.85, 0.65)}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Hemisphere light for ambient fill */}
      <hemisphereLight
        args={[
          new THREE.Color(0.85, 0.65, 0.75),  // sky: pink
          new THREE.Color(0.35, 0.35, 0.50),  // ground: cool shadow
          0.6,
        ]}
      />

      {/* Fog for atmospheric depth */}
      <fog attach="fog" args={[new THREE.Color(0.90, 0.75, 0.70), 80, 350]} />
    </>
  );
}
