
import React, { useLayoutEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ChunkData } from '../types';
import { CHUNK_SIZE } from '../constants';

const COLORS = {
    WATER: new THREE.Color('#0288d1'),
    GRASS: new THREE.Color('#388e3c'),
    FOREST: new THREE.Color('#2e7d32'),
    SAND: new THREE.Color('#fbc02d'),
    STONE: new THREE.Color('#757575'),
    SNOW: new THREE.Color('#ECEFF1'),
    FLOWER: new THREE.Color('#43A047'), // Bright green
    
    TREE_OAK: new THREE.Color('#2E7D32'),
    TREE_BIRCH: new THREE.Color('#66BB6A'),
    TREE_SPRUCE: new THREE.Color('#1B5E20'),
};

interface DistantTerrainProps {
  chunks: ChunkData[];
}

const DistantTerrain: React.FC<DistantTerrainProps> = ({ chunks }) => {
  const landMeshRef = useRef<THREE.InstancedMesh>(null);
  const waterMeshRef = useRef<THREE.InstancedMesh>(null);
  const treeMeshRef = useRef<THREE.InstancedMesh>(null);

  const { landChunks, waterChunks, totalTrees } = useMemo(() => {
      const land: ChunkData[] = [];
      const water: ChunkData[] = [];
      let treeCount = 0;
      
      chunks.forEach(c => {
          if (c.biome === 'ocean') water.push(c);
          else land.push(c);
          
          if (c.trees) {
              treeCount += c.trees.length;
          }
      });
      return { landChunks: land, waterChunks: water, totalTrees: treeCount };
  }, [chunks]);

  // --- Land Rendering ---
  useLayoutEffect(() => {
    if (!landMeshRef.current) return;
    const count = landChunks.length;
    landMeshRef.current.count = count;
    if (count === 0) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const chunk = landChunks[i];
      
      dummy.scale.set(CHUNK_SIZE, chunk.averageHeight, CHUNK_SIZE);
      dummy.position.set(
        chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2, 
        chunk.averageHeight / 2, 
        chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      dummy.updateMatrix();
      landMeshRef.current.setMatrixAt(i, dummy.matrix);

      if (chunk.biome === 'desert') color.copy(COLORS.SAND);
      else if (chunk.biome === 'mountain') {
           if (chunk.averageHeight > 90) color.copy(COLORS.SNOW);
           else color.copy(COLORS.STONE);
      }
      else if (chunk.biome === 'forest') color.copy(COLORS.FOREST);
      else if (chunk.biome === 'flower_hill') color.copy(COLORS.FLOWER);
      else color.copy(COLORS.GRASS); // Plain

      landMeshRef.current.setColorAt(i, color);
    }
    landMeshRef.current.instanceMatrix.needsUpdate = true;
    if (landMeshRef.current.instanceColor) landMeshRef.current.instanceColor.needsUpdate = true;
  }, [landChunks]);

  // --- Water Rendering ---
  useLayoutEffect(() => {
    if (!waterMeshRef.current) return;
    const count = waterChunks.length;
    waterMeshRef.current.count = count;
    if (count === 0) return;

    const dummy = new THREE.Object3D();
    const color = COLORS.WATER;

    for (let i = 0; i < count; i++) {
      const chunk = waterChunks[i];
      const h = chunk.averageHeight; 
      dummy.scale.set(CHUNK_SIZE, h, CHUNK_SIZE);
      dummy.position.set(
        chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2, 
        h / 2, 
        chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      dummy.updateMatrix();
      waterMeshRef.current.setMatrixAt(i, dummy.matrix);
      waterMeshRef.current.setColorAt(i, color);
    }
    waterMeshRef.current.instanceMatrix.needsUpdate = true;
    if (waterMeshRef.current.instanceColor) waterMeshRef.current.instanceColor.needsUpdate = true;
  }, [waterChunks]);

  // --- Tree Rendering ---
  useLayoutEffect(() => {
      if (!treeMeshRef.current) return;
      treeMeshRef.current.count = totalTrees;
      if (totalTrees === 0) return;

      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      let idx = 0;

      // Iterate through all chunks (land + water) just in case a tree is on an island in ocean chunk
      for (const chunk of chunks) {
          if (!chunk.trees) continue;
          
          const startX = chunk.x * CHUNK_SIZE;
          const startZ = chunk.z * CHUNK_SIZE;

          for (const tree of chunk.trees) {
              // tree.x/z are local to chunk (0-15)
              const wx = startX + tree.x;
              const wy = tree.y;
              const wz = startZ + tree.z;

              // Simple tree representation
              // Oak/Birch: 5-6 high. Spruce: 7 high.
              // We'll just use a box approx 5 units high, 1 unit wide
              let height = 5;
              let width = 1.2; // Slightly thicker for visibility at distance
              
              if (tree.type === 2) { // Spruce
                  height = 7;
                  color.copy(COLORS.TREE_SPRUCE);
              } else if (tree.type === 1) { // Birch
                  height = 6;
                  color.copy(COLORS.TREE_BIRCH);
              } else { // Oak
                  color.copy(COLORS.TREE_OAK);
              }

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
    <>
        <instancedMesh 
        ref={landMeshRef} 
        args={[undefined, undefined, landChunks.length]}
        frustumCulled={false}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial roughness={1} metalness={0} />
        </instancedMesh>

        <instancedMesh 
        ref={waterMeshRef} 
        args={[undefined, undefined, waterChunks.length]}
        frustumCulled={false}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial 
                roughness={0.1} 
                metalness={0.1} 
                transparent={true} 
                opacity={0.6}
            />
        </instancedMesh>

        <instancedMesh
          ref={treeMeshRef}
          args={[undefined, undefined, totalTrees]}
          frustumCulled={false}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial roughness={0.8} metalness={0} />
        </instancedMesh>
    </>
  );
};

export default React.memo(DistantTerrain);