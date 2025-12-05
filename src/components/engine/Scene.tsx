import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { CloudShaderMaterial } from '@/src/rendering/shaders/clouds';
import { globalTexture } from '@/src/utils/textures';
import { CHUNK_SIZE, MAX_RENDER_DISTANCE } from '@/src/constants';

interface SceneProps {
  isUnderwater: boolean;
}

const TextureManager = () => {
    const { gl } = useThree();
    useEffect(() => {
        const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
        globalTexture.anisotropy = maxAnisotropy;
        globalTexture.needsUpdate = true;
    }, [gl]);
    return null;
};

const CloudLayer = () => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef2 = useRef<THREE.ShaderMaterial>(null);
    const meshRef2 = useRef<THREE.Mesh>(null);

    useFrame(({ clock, camera }) => {
        const t = clock.getElapsedTime();
        if (materialRef.current) materialRef.current.uniforms.uTime.value = t;
        if (materialRef2.current) materialRef2.current.uniforms.uTime.value = t + 100;
        if (meshRef.current) meshRef.current.position.set(camera.position.x, 280, camera.position.z);
        if (meshRef2.current) meshRef2.current.position.set(camera.position.x, 310, camera.position.z);
    });

    const planeSize = MAX_RENDER_DISTANCE * CHUNK_SIZE * 2.5;

    return (
        <>
            <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[planeSize, planeSize]} />
                <shaderMaterial ref={materialRef} attach="material" {...CloudShaderMaterial} transparent depthWrite={false} uniforms-uCloudScale-value={0.006} uniforms-uOpacity-value={0.8} />
            </mesh>
            <mesh ref={meshRef2} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[planeSize, planeSize]} />
                <shaderMaterial ref={materialRef2} attach="material" {...CloudShaderMaterial} transparent depthWrite={false} uniforms-uCloudScale-value={0.003} uniforms-uOpacity-value={0.5} uniforms-uCloudSpeed-value={0.01} />
            </mesh>
        </>
    );
};

const SkyBox = () => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame(({ camera }) => {
        if (groupRef.current) groupRef.current.position.copy(camera.position);
    });
    return (
        <group ref={groupRef}>
            <Stars radius={200} depth={50} count={5000} factor={4} fade />
        </group>
    );
};

export const Scene: React.FC<SceneProps> = ({ isUnderwater }) => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ camera }) => {
      // Lighting Update - Follow camera
      if (lightRef.current) {
          const cx = camera.position.x;
          const cz = camera.position.z;
          lightRef.current.position.set(cx + 60, 140, cz + 40);
          lightRef.current.target.position.set(cx, 0, cz);
          lightRef.current.target.updateMatrixWorld();
      }
  });

  return (
    <>
      <TextureManager />
      <color attach="background" args={['#87CEEB']} />
      <Sky 
        distance={450000} sunPosition={[100, 50, 100]} inclination={0.49} azimuth={0.25} 
        rayleigh={isUnderwater ? 1 : 0.2} mieCoefficient={0.005} mieDirectionalG={0.7}
      />
      <SkyBox />
      <fogExp2 attach="fog" args={[isUnderwater ? '#00334d' : '#B3D9FF', isUnderwater ? 0.08 : 0.0015]} />
      <CloudLayer />
      <hemisphereLight args={['#E3F2FD', '#3E2723', 0.7]} />
      <ambientLight intensity={0.4} />
      <primitive object={lightTarget} />
      <directionalLight
        ref={lightRef} target={lightTarget} position={[50, 100, 50]} intensity={1.2}
        castShadow shadow-bias={-0.0001} shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} shadow-camera-far={350}
      />
      
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} opacity={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
};