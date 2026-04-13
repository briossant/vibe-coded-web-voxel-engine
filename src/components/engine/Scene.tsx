import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { CloudShaderMaterial } from '@/src/rendering/shaders/clouds';
import { sharedWaterMaterial } from '@/src/rendering/shaders/water';
import { globalTexture } from '@/src/utils/textures';
import { CHUNK_SIZE, MAX_RENDER_DISTANCE } from '@/src/constants';

interface SceneProps {
  isUnderwater: boolean;
}

const TextureManager = () => {
  const { gl } = useThree();
  useEffect(() => {
    globalTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
    globalTexture.needsUpdate = true;
  }, [gl]);
  return null;
};

const CloudLayer = () => {
  const mat1Ref  = useRef<THREE.ShaderMaterial>(null);
  const mat2Ref  = useRef<THREE.ShaderMaterial>(null);
  const mesh1Ref = useRef<THREE.Mesh>(null);
  const mesh2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    if (mat1Ref.current)  mat1Ref.current.uniforms.uTime.value  = t;
    if (mat2Ref.current)  mat2Ref.current.uniforms.uTime.value  = t + 100;
    if (mesh1Ref.current) mesh1Ref.current.position.set(camera.position.x, 280, camera.position.z);
    if (mesh2Ref.current) mesh2Ref.current.position.set(camera.position.x, 310, camera.position.z);
  });

  // Smaller plane — clouds are far away and the full MAX_RENDER_DISTANCE size isn't necessary
  const planeSize = MAX_RENDER_DISTANCE * CHUNK_SIZE * 1.5;

  return (
    <>
      <mesh ref={mesh1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[planeSize, planeSize]} />
        <shaderMaterial ref={mat1Ref} attach="material" {...CloudShaderMaterial}
          transparent depthWrite={false}
          uniforms-uCloudScale-value={0.006} uniforms-uOpacity-value={0.8} />
      </mesh>
      <mesh ref={mesh2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[planeSize, planeSize]} />
        <shaderMaterial ref={mat2Ref} attach="material" {...CloudShaderMaterial}
          transparent depthWrite={false}
          uniforms-uCloudScale-value={0.003} uniforms-uOpacity-value={0.5}
          uniforms-uCloudSpeed-value={0.01} />
      </mesh>
    </>
  );
};

export const Scene: React.FC<SceneProps> = ({ isUnderwater }) => {
  const lightRef    = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock, camera }) => {
    // Tick water time once per frame (shared across all water meshes)
    sharedWaterMaterial.uniforms.uTime.value = clock.getElapsedTime();

    // Sun follows camera (shadow stays local)
    if (lightRef.current) {
      lightRef.current.position.set(camera.position.x + 60, 140, camera.position.z + 40);
      lightRef.current.target.position.set(camera.position.x, 0, camera.position.z);
      lightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <TextureManager />
      <color attach="background" args={['#87CEEB']} />
      <Sky
        distance={450000} sunPosition={[100, 50, 100]}
        inclination={0.49} azimuth={0.25}
        rayleigh={isUnderwater ? 1 : 0.2}
        mieCoefficient={0.005} mieDirectionalG={0.7}
      />
      <fogExp2 attach="fog" args={[isUnderwater ? '#00334d' : '#B3D9FF', isUnderwater ? 0.08 : 0.0015]} />
      <CloudLayer />
      <hemisphereLight args={['#E3F2FD', '#3E2723', 0.7]} />
      <ambientLight intensity={0.4} />
      <primitive object={lightTarget} />
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        position={[50, 100, 50]}
        intensity={1.2}
        castShadow
        shadow-bias={-0.0001}
        shadow-mapSize={[512, 512]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={250}
      />
      {/* Post-processing removed — Bloom was halving fps. Re-enable when targeting desktop GPU. */}
    </>
  );
};
