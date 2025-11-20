
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
    FLOWER: new THREE.Color('#43A047'), // Bright green
    
    TREE_OAK: new THREE.Color('#2E7D32'),
    TREE_BIRCH: new THREE.Color('#66BB6A'),
    TREE_SPRUCE: new THREE.Color('#1B5E20'),
};

// Match ChunkMesh water offset
const WATER_HEIGHT_OFFSET = 0.875;

interface DistantTerrainProps {
  chunks: ChunkData[];
}

const DistantTerrain: React.FC<DistantTerrainProps> = ({ chunks }) => {
  const landMeshRef = useRef<THREE.InstancedMesh>(null);
  const waterMeshRef = useRef<THREE.InstancedMesh>(null);
  const treeMeshRef = useRef<THREE.InstancedMesh>(null);

  // Create a plane geometry for water to only show the top face
  const waterGeometry = useMemo(() => {
      const geo = new THREE.PlaneGeometry(1, 1);
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
          
          // Always render land for all chunks (seabed or ground)
          land.push(c);
          
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
      
      // Scale height to average height
      dummy.scale.set(CHUNK_SIZE, Math.max(1, chunk.averageHeight), CHUNK_SIZE);
      dummy.position.set(
        chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2, 
        Math.max(1, chunk.averageHeight) / 2, 
        chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      dummy.updateMatrix();
      landMeshRef.current.setMatrixAt(i, dummy.matrix);

      // Determine Color
      if (chunk.biome === 'desert') color.copy(COLORS.SAND);
      else if (chunk.biome === 'mountain') {
           if (chunk.averageHeight > 90) color.copy(COLORS.SNOW);
           else color.copy(COLORS.STONE);
      }
      else if (chunk.biome === 'forest') color.copy(COLORS.FOREST);
      else if (chunk.biome === 'flower_hill') color.copy(COLORS.FLOWER);
      else if (chunk.biome === 'ocean') color.copy(COLORS.SAND); // Seabed is sand
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
      
      // Calculate precise water surface height
      // WATER_LEVEL is the index of the top water block.
      // The visual surface is at index + WATER_HEIGHT_OFFSET.
      const surfaceY = WATER_LEVEL + WATER_HEIGHT_OFFSET;
      
      // Flatten scale Y to 1 since it is a plane
      dummy.scale.set(CHUNK_SIZE, 1, CHUNK_SIZE);
      dummy.position.set(
        chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2, 
        surfaceY, 
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
        {/* Land/Seabed Layer */}
        <instancedMesh 
        ref={landMeshRef} 
        args={[undefined, undefined, landChunks.length]}
        frustumCulled={false}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial roughness={1} metalness={0} />
        </instancedMesh>

        {/* Water Layer - Uses PlaneGeometry via prop to only show top face */}
        <instancedMesh 
        ref={waterMeshRef} 
        args={[undefined, undefined, waterChunks.length]}
        geometry={waterGeometry}
        frustumCulled={false}
        >
            <meshStandardMaterial 
                roughness={0.1} 
                metalness={0.1} 
                transparent={true} 
                opacity={0.6}
                side={THREE.DoubleSide} // Plane is single sided by default, ensure it is visible from below if diving
            />
        </instancedMesh>

        {/* Trees */}
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
