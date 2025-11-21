
import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ChunkData, Vector3 } from '../types';
import { CHUNK_SIZE } from '../constants';
import { BLOCK_DEFINITIONS, BlockType } from '../blocks';

interface DistantTerrainProps {
  chunks: ChunkData[];
  playerPosition: Vector3;
  renderDistance: number;
}

const _color = new THREE.Color();
const _sideColor = new THREE.Color();
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
  const maxCount = 250000; 

  // Create geometry with baked-in directional lighting and setup material shader patch
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); 
    
    // Generate vertex colors based on normals to simulate directional light
    // This restores the "simple face direction shadows" requested
    const colors: number[] = [];
    const normals = geo.attributes.normal;
    const count = normals.count;

    for (let i = 0; i < count; i++) {
        const ny = normals.getY(i);
        const nx = normals.getX(i);

        let intensity = 1.0; // Top Face

        if (ny < -0.5) {
            intensity = 0.4; // Bottom Face (dark shadow)
        } else if (ny < 0.5) {
            // Side Faces
            // X sides slightly brighter than Z sides for depth
            if (Math.abs(nx) > 0.5) {
                intensity = 0.8; 
            } else {
                intensity = 0.6; 
            }
        }
        colors.push(intensity, intensity, intensity);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // We patch MeshBasicMaterial to support a secondary "side color" for instances.
    // This allows mountains to have Snow tops but Stone sides.
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true 
    });

    mat.onBeforeCompile = (shader) => {
        shader.vertexShader = `
          attribute vec3 instanceSideColor;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <color_vertex>',
            `
            #include <color_vertex>
            
            #ifdef USE_INSTANCING_COLOR
                // Default logic is vColor = color * instanceColor;
                // We override instanceColor if it's a side face (normal.y < 0.5)
                
                vec3 finalInstanceColor = instanceColor;
                
                // Use standard 'normal' attribute directly. 
                // MeshBasicMaterial allows 'normal' usage and Three.js binds it.
                if (abs(normal.y) < 0.5) {
                    finalInstanceColor = instanceSideColor;
                }
                
                // Apply lighting (geometry color) to the chosen instance color
                // We must re-calculate vColor because <color_vertex> has already multiplied it.
                
                vec3 lighting = vec3(1.0);
                #ifdef USE_COLOR
                    lighting = color.rgb;
                #endif

                vColor = lighting * finalInstanceColor;
            #endif
            `
        );
    };

    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Initialize Instance Color (Primary/Top)
    if (!mesh.instanceColor || mesh.instanceColor.count < maxCount) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3);
    }

    // Initialize Instance Side Color (Secondary/Side)
    if (!geometry.getAttribute('instanceSideColor') || geometry.getAttribute('instanceSideColor').count < maxCount) {
        geometry.setAttribute('instanceSideColor', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3));
    }
    const sideColorAttr = geometry.getAttribute('instanceSideColor') as THREE.InstancedBufferAttribute;

    const pChunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const pChunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);

    let index = 0;

    for (const chunk of chunks) {
        if (!chunk.heightMap || !chunk.topLayer) continue;

        const distX = chunk.x - pChunkX;
        const distZ = chunk.z - pChunkZ;
        const dist = Math.sqrt(distX*distX + distZ*distZ);
        
        const relativeDist = dist - renderDistance;
        
        let step = 1; 
        
        // LOD Steps
        if (relativeDist > 2) step = 2;
        if (relativeDist > 6) step = 4;
        if (relativeDist > 12) step = 8;
        if (relativeDist > 20) step = 16;

        for (let x = 0; x < CHUNK_SIZE; x += step) {
            for (let z = 0; z < CHUNK_SIZE; z += step) {
                if (index >= maxCount) break;

                const sampleX = Math.min(x + Math.floor(step/2), CHUNK_SIZE - 1);
                const sampleZ = Math.min(z + Math.floor(step/2), CHUNK_SIZE - 1);
                const idx = sampleX * CHUNK_SIZE + sampleZ;
                
                let h = chunk.heightMap[idx];
                let type = chunk.topLayer[idx];

                if (type === 0) continue;

                // EXCLUSION LOGIC: Treat sprites as the block underneath
                // Prevents flowers/grass from rendering as giant colored cubes
                const def = BLOCK_DEFINITIONS[type];
                if (def?.isSprite) {
                    h -= 1; // Lower height to ground level
                    if (h < 0) continue; // Safety check

                    // Guess ground type
                    if (type === BlockType.DEAD_BUSH) {
                        type = BlockType.SAND;
                    } else if (type === BlockType.SEAGRASS) {
                        type = BlockType.WATER;
                    } else {
                        // Default to Grass for flowers/tall grass
                        type = BlockType.GRASS;
                    }
                }

                const wx = (chunk.x * CHUNK_SIZE) + x;
                const wz = (chunk.z * CHUNK_SIZE) + z;

                const topY = h + 1;
                const bottomY = 0; 
                const height = topY - bottomY;

                _position.set(wx + step / 2, bottomY, wz + step / 2);
                // Overlap slightly to prevent cracks
                _scale.set(step + 0.05, height, step + 0.05);
                _quaternion.identity();
                _matrix.compose(_position, _quaternion, _scale);

                // Color Logic
                const baseColor = BLOCK_COLORS[type] || BLOCK_COLORS[0];
                _color.copy(baseColor);
                _sideColor.copy(baseColor);

                // Special handling for visual correctness
                if (type === BlockType.SNOW) {
                    _sideColor.copy(BLOCK_COLORS[BlockType.STONE]); // Snow mountains have stone sides
                } else if (type === BlockType.GRASS) {
                    _sideColor.copy(BLOCK_COLORS[BlockType.DIRT]); // Grass blocks have dirt sides
                }

                // Height-based tinting for atmosphere
                const heightShade = 0.8 + (h / 384) * 0.2; 
                _color.multiplyScalar(heightShade);
                _sideColor.multiplyScalar(heightShade);

                // Set Instance Data
                mesh.setMatrixAt(index, _matrix);
                mesh.setColorAt(index, _color); // Top Color
                sideColorAttr.setXYZ(index, _sideColor.r, _sideColor.g, _sideColor.b); // Side Color
                
                index++;
            }
        }
        if (index >= maxCount) break;
    }
    
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    sideColorAttr.needsUpdate = true;
    
    // Ensure the material updates to pick up new attributes
    material.needsUpdate = true;

  }, [chunks, playerPosition, renderDistance, maxCount, geometry, material]);

  return (
    <instancedMesh 
        ref={meshRef} 
        args={[geometry, material, maxCount]} 
        frustumCulled={false}
    />
  );
};

export default React.memo(DistantTerrain);
