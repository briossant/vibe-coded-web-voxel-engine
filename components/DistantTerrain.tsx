
import React, { useLayoutEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ChunkData } from '../types';
import { CHUNK_SIZE, WATER_LEVEL } from '../constants';

const COLORS = {
    WATER: new THREE.Color('#0288d1'),
    GRASS: new THREE.Color('#388e3c'),
    FOREST: new THREE.Color('#2e7d32'),
    SAND: new THREE.Color('#fbc02d'),
    STONE: new THREE.Color('#757575'),
    SNOW: new THREE.Color('#ECEFF1'),
    FLOWER: new THREE.Color('#43A047'), 
    TREE_OAK: new THREE.Color('#2E7D32'),
    TREE_BIRCH: new THREE.Color('#66BB6A'),
    TREE_SPRUCE: new THREE.Color('#1B5E20'),
};

const WATER_HEIGHT_OFFSET = 0.875;

interface DistantTerrainProps {
  chunks: ChunkData[];
}

const DistantTerrain: React.FC<DistantTerrainProps> = ({ chunks }) => {
  const landMeshRef = useRef<THREE.InstancedMesh>(null);
  const waterMeshRef = useRef<THREE.InstancedMesh>(null);
  const treeMeshRef = useRef<THREE.InstancedMesh>(null);
  
  // Create materials safely within useMemo
  const { landMaterial, waterMaterial, waterUniforms } = useMemo(() => {
        const wUniforms = { uTime: { value: 0 } };
        
        // --- LAND MATERIAL ---
        const lMat = new THREE.MeshStandardMaterial({
            roughness: 1.0,
            metalness: 0.0,
            vertexColors: false, // IMPORTANT: Must be false because Geometry has no colors, InstancedMesh handles instanceColor via USE_INSTANCING_COLOR
        });

        lMat.onBeforeCompile = (shader) => {
            // Inject varying declaration at the top
            shader.vertexShader = `
                varying vec3 vWorldPos;
                ${shader.vertexShader}
            `;

            // Manually calculate world position for the varying
            // We do this after begin_vertex where 'transformed' is defined
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                #ifdef USE_INSTANCING
                    vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                #else
                    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                #endif
                `
            );

            shader.fragmentShader = `
                varying vec3 vWorldPos;
                ${shader.fragmentShader}
            `;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
                }
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                // Modulo to keep precision high for noise function
                vec2 noisePos = mod(vWorldPos.xz, 10000.0);

                float n = noise(noisePos * 0.15); 
                float n2 = noise(noisePos * 0.02); 
                
                float grain = 0.85 + 0.15 * n;
                grain *= (0.9 + 0.2 * n2);
                
                diffuseColor.rgb *= grain;
                
                // Fake AO for sides/depth
                if (vWorldPos.y < ${WATER_LEVEL}.0 + 3.0) {
                    float factor = smoothstep(${WATER_LEVEL}.0, ${WATER_LEVEL}.0 + 3.0, vWorldPos.y);
                    diffuseColor.rgb *= (0.75 + 0.25 * factor);
                }
                `
            );
        };

        // --- WATER MATERIAL ---
        const wMat = new THREE.MeshStandardMaterial({
            color: COLORS.WATER,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
        });

        wMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = wUniforms.uTime;
            
            shader.vertexShader = `
                uniform float uTime;
                varying vec3 vWorldPos;
                ${shader.vertexShader}
            `;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // Calculate approximate world pos for wave logic
                #ifdef USE_INSTANCING
                    vec3 waveWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                #else
                    vec3 waveWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                #endif
                
                float wave = sin(waveWorldPos.x * 0.5 + uTime) * 0.2 + cos(waveWorldPos.z * 0.4 + uTime * 0.8) * 0.2;
                transformed.y += wave;

                // Update vWorldPos after wave modification
                // Note: This uses the modified 'transformed' position, effectively applying the wave to the worldpos varying too
                #ifdef USE_INSTANCING
                    vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                #else
                    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                #endif
                `
            );
            
            shader.fragmentShader = `
                varying vec3 vWorldPos;
                ${shader.fragmentShader}
            `;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                float nW = sin(vWorldPos.x * 0.1) * cos(vWorldPos.z * 0.1);
                diffuseColor.rgb += nW * 0.05;
                `
            );
        };

        return { landMaterial: lMat, waterMaterial: wMat, waterUniforms: wUniforms };
  }, []);

  // Animation loop
  React.useEffect(() => {
      let frameId: number;
      const animate = () => {
          waterUniforms.uTime.value = performance.now() / 1000;
          frameId = requestAnimationFrame(animate);
      };
      animate();
      return () => cancelAnimationFrame(frameId);
  }, [waterUniforms]);

  const waterGeometry = useMemo(() => {
      const geo = new THREE.PlaneGeometry(1, 1, 4, 4); 
      geo.rotateX(-Math.PI / 2);
      return geo;
  }, []);

  const { landChunks, waterChunks, totalTrees } = useMemo(() => {
      const land: ChunkData[] = [];
      const water: ChunkData[] = [];
      let treeCount = 0;
      
      chunks.forEach(c => {
          if (c.biome === 'ocean' || c.biome === 'river') {
              water.push(c);
          }
          land.push(c);
          if (c.trees) {
              treeCount += c.trees.length;
          }
      });
      return { landChunks: land, waterChunks: water, totalTrees: treeCount };
  }, [chunks]);

  // Update Land Mesh
  useLayoutEffect(() => {
    if (!landMeshRef.current) return;
    const count = landChunks.length;
    landMeshRef.current.count = count;
    if (count === 0) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const chunk = landChunks[i];
      
      dummy.scale.set(CHUNK_SIZE, Math.max(1, chunk.averageHeight), CHUNK_SIZE);
      dummy.position.set(
        chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2, 
        Math.max(1, chunk.averageHeight) / 2, 
        chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      dummy.updateMatrix();
      landMeshRef.current.setMatrixAt(i, dummy.matrix);

      // Color Logic
      if (chunk.biome === 'desert') color.copy(COLORS.SAND);
      else if (chunk.biome === 'mountain') {
           if (chunk.averageHeight > 90) color.copy(COLORS.SNOW);
           else color.copy(COLORS.STONE);
      }
      else if (chunk.biome === 'forest') color.copy(COLORS.FOREST);
      else if (chunk.biome === 'flower_hill') color.copy(COLORS.FLOWER);
      else if (chunk.biome === 'ocean') color.copy(COLORS.SAND);
      else if (chunk.biome === 'mesa') color.copy(COLORS.SAND);
      else color.copy(COLORS.GRASS);

      color.multiplyScalar(0.9); 
      landMeshRef.current.setColorAt(i, color);
    }
    landMeshRef.current.instanceMatrix.needsUpdate = true;
    if (landMeshRef.current.instanceColor) landMeshRef.current.instanceColor.needsUpdate = true;
  }, [landChunks]);

  // Update Water Mesh
  useLayoutEffect(() => {
    if (!waterMeshRef.current) return;
    const count = waterChunks.length;
    waterMeshRef.current.count = count;
    if (count === 0) return;

    const dummy = new THREE.Object3D();
    const surfaceY = WATER_LEVEL + WATER_HEIGHT_OFFSET;
    
    for (let i = 0; i < count; i++) {
      const chunk = waterChunks[i];
      dummy.scale.set(CHUNK_SIZE, 1, CHUNK_SIZE);
      dummy.position.set(
        chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2, 
        surfaceY, 
        chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      dummy.updateMatrix();
      waterMeshRef.current.setMatrixAt(i, dummy.matrix);
    }
    waterMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [waterChunks]);

  // Update Tree Mesh
  useLayoutEffect(() => {
      if (!treeMeshRef.current) return;
      treeMeshRef.current.count = totalTrees;
      if (totalTrees === 0) return;

      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      let idx = 0;

      for (const chunk of chunks) {
          if (!chunk.trees) continue;
          
          const startX = chunk.x * CHUNK_SIZE;
          const startZ = chunk.z * CHUNK_SIZE;

          for (const tree of chunk.trees) {
              const wx = startX + tree.x;
              const wy = tree.y;
              const wz = startZ + tree.z;

              let height = 5;
              let width = 1.2;
              
              if (tree.type === 2) { // Spruce
                  height = 7;
                  color.copy(COLORS.TREE_SPRUCE);
              } else if (tree.type === 1) { // Birch
                  height = 6;
                  color.copy(COLORS.TREE_BIRCH);
              } else { // Oak
                  color.copy(COLORS.TREE_OAK);
              }

              // Simple rotation
              const rot = (wx * 13 + wz * 7) % 6.28;
              dummy.rotation.set(0, rot, 0);

              dummy.position.set(wx + 0.5, wy + height/2, wz + 0.5);
              dummy.scale.set(width, height, width);
              dummy.updateMatrix();

              treeMeshRef.current.setMatrixAt(idx, dummy.matrix);
              treeMeshRef.current.setColorAt(idx, color);
              idx++;
          }
      }
      treeMeshRef.current.instanceMatrix.needsUpdate = true;
      if (treeMeshRef.current.instanceColor) treeMeshRef.current.instanceColor.needsUpdate = true;
  }, [chunks, totalTrees]);

  return (
    <group>
        {/* Land */}
        <instancedMesh 
        ref={landMeshRef} 
        args={[undefined, undefined, landChunks.length]}
        frustumCulled={false}
        >
            <boxGeometry args={[1, 1, 1]} />
            <primitive object={landMaterial} attach="material" />
        </instancedMesh>

        {/* Water */}
        <instancedMesh 
        ref={waterMeshRef} 
        args={[undefined, undefined, waterChunks.length]}
        geometry={waterGeometry}
        frustumCulled={false}
        >
             <primitive object={waterMaterial} attach="material" />
        </instancedMesh>

        {/* Trees */}
        <instancedMesh
          ref={treeMeshRef}
          args={[undefined, undefined, totalTrees]}
          frustumCulled={false}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial roughness={0.9} metalness={0} />
        </instancedMesh>
    </group>
  );
};

export default React.memo(DistantTerrain);
