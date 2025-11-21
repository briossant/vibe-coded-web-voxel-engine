
import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ChunkData, Vector3 } from '../types';
import { CHUNK_SIZE } from '../constants';
import { BLOCK_DEFINITIONS } from '../blocks';

interface DistantTerrainProps {
  chunks: ChunkData[];
  playerPosition: Vector3;
  renderDistance: number;
}

const _color = new THREE.Color();
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();

// Pre-compute colors. Ensure fallback for missing definitions.
const BLOCK_COLORS = new Array(256).fill(null).map((_, i) => {
    const def = BLOCK_DEFINITIONS[i];
    if (!def) return new THREE.Color('#ff00ff'); // Error magenta
    return new THREE.Color(def.mapColor);
});

const DistantTerrain: React.FC<DistantTerrainProps> = ({ chunks, playerPosition, renderDistance }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Max instance count estimate: (ExtraDistance / AvgStep)^2
  // 250,000 is plenty for reasonable settings.
  const maxCount = 250000; 

  // Use a simple Box geometry with origin at bottom-center for easier scaling
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); 
    
    // Use MeshBasicMaterial to avoid lighting issues (black chunks) on distant geometry
    // VertexColors allows each instance to have its own color
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false, 
    });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // CRITICAL: Explicitly create instanceColor attribute if it doesn't exist or if buffer needs resize
    if (!mesh.instanceColor || mesh.instanceColor.count < maxCount) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3);
    }

    const pChunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const pChunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);

    let index = 0;

    for (const chunk of chunks) {
        // Robustness check: data must be present
        if (!chunk.heightMap || !chunk.topLayer) continue;

        const distX = chunk.x - pChunkX;
        const distZ = chunk.z - pChunkZ;
        const dist = Math.sqrt(distX*distX + distZ*distZ);
        
        // Calculate LOD step based on distance relative to the render edge
        // Dist is in Chunks.
        const relativeDist = dist - renderDistance;
        
        let step = 1; // Default full resolution
        
        // Gradually increase cube size (step) as distance increases
        if (relativeDist > 2) step = 2;
        if (relativeDist > 6) step = 4;
        if (relativeDist > 12) step = 8;
        if (relativeDist > 20) step = 16;

        // Iterate over the chunk in steps
        for (let x = 0; x < CHUNK_SIZE; x += step) {
            for (let z = 0; z < CHUNK_SIZE; z += step) {
                if (index >= maxCount) break;

                // Sample center of the LOD block for better accuracy
                const sampleX = Math.min(x + Math.floor(step/2), CHUNK_SIZE - 1);
                const sampleZ = Math.min(z + Math.floor(step/2), CHUNK_SIZE - 1);
                const idx = sampleX * CHUNK_SIZE + sampleZ;
                
                const h = chunk.heightMap[idx];
                const type = chunk.topLayer[idx];

                if (type === 0) continue; // Skip Air

                const wx = (chunk.x * CHUNK_SIZE) + x;
                const wz = (chunk.z * CHUNK_SIZE) + z;

                // GAP PREVENTION:
                // Instead of a small cube, render a "pillar" that extends downwards.
                // This ensures that even on steep cliffs, there are no gaps between this LOD block
                // and the one below it or next to it.
                // We extend down to y=0 (or near it) because overdraw is cheap with BasicMaterial.
                const topY = h + 1;
                const bottomY = 0; 
                const height = topY - bottomY;

                _position.set(wx + step / 2, bottomY, wz + step / 2);
                // Add slight overlap (0.05) to prevent stitching artifacts/lines between cubes
                _scale.set(step + 0.05, height, step + 0.05);
                _quaternion.identity();
                _matrix.compose(_position, _quaternion, _scale);

                // Color Logic
                const baseColor = BLOCK_COLORS[type] || BLOCK_COLORS[0];
                _color.copy(baseColor);
                
                // Fake Depth/Height Shading
                // Since we use BasicMaterial (unlit), we manually darken lower blocks 
                // to simulate depth and atmosphere.
                const brightness = 0.5 + (h / 384) * 0.5; 
                _color.multiplyScalar(brightness);

                // Set Matrix and Color
                mesh.setMatrixAt(index, _matrix);
                mesh.setColorAt(index, _color);
                
                index++;
            }
        }
        if (index >= maxCount) break;
    }
    
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  }, [chunks, playerPosition, renderDistance, maxCount]);

  return (
    <instancedMesh 
        ref={meshRef} 
        args={[geometry, material, maxCount]} 
        frustumCulled={false}
    />
  );
};

// Memoize to prevent re-renders unless chunks array ref changes
export default React.memo(DistantTerrain);
