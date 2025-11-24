
import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ChunkData, Vector3 } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
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
  const opaqueMeshRef = useRef<THREE.InstancedMesh>(null);
  const waterMeshRef = useRef<THREE.InstancedMesh>(null);
  const maxCount = 400000; 

  // Create separate geometries for opaque and water to prevent attribute sharing conflicts
  const { opaqueGeometry, waterGeometry, opaqueMaterial, waterMaterial } = useMemo(() => {
    const baseGeo = new THREE.BoxGeometry(1, 1, 1);
    // Pivot at bottom center for easy height scaling from ground up
    baseGeo.translate(0, 0.5, 0); 
    
    // Generate vertex colors based on normals to simulate directional light
    const colors: number[] = [];
    const normals = baseGeo.attributes.normal;
    const count = normals.count;

    for (let i = 0; i < count; i++) {
        const ny = normals.getY(i);
        const nx = normals.getX(i);

        let intensity = 1.0; // Top Face

        if (ny < -0.5) {
            intensity = 0.4; // Bottom Face (dark shadow)
        } else if (ny < 0.5) {
            // Side Faces
            if (Math.abs(nx) > 0.5) {
                intensity = 0.8; 
            } else {
                intensity = 0.6; 
            }
        }
        colors.push(intensity, intensity, intensity);
    }

    baseGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Clone geometries so we can attach distinct 'instanceSideColor' attributes to each without conflict
    const opGeo = baseGeo.clone();
    const waGeo = baseGeo.clone();

    // Custom Shader Logic for Side Colors (e.g., Snow mountains with Stone sides)
    const onBeforeCompile = (shader: any) => {
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
                if (abs(normal.y) < 0.5) {
                    finalInstanceColor = instanceSideColor;
                }
                
                vec3 lighting = vec3(1.0);
                #ifdef USE_COLOR
                    lighting = color.rgb;
                #endif

                vColor = lighting * finalInstanceColor;
            #endif
            `
        );
    };

    const opMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    opMat.onBeforeCompile = onBeforeCompile;

    const waMat = new THREE.MeshBasicMaterial({ 
        vertexColors: true, 
        transparent: true, 
        opacity: 0.85, // Higher opacity to reduce layering artifacts
        depthWrite: false // CRITICAL: Disable depth write to prevent sorting issues with transparent water
    });
    waMat.onBeforeCompile = onBeforeCompile;

    return { opaqueGeometry: opGeo, waterGeometry: waGeo, opaqueMaterial: opMat, waterMaterial: waMat };
  }, []);

  useEffect(() => {
    const opaqueMesh = opaqueMeshRef.current;
    const waterMesh = waterMeshRef.current;
    if (!opaqueMesh || !waterMesh) return;

    // Helper to init attributes on the specific mesh's geometry
    const initAttrs = (mesh: THREE.InstancedMesh) => {
        if (!mesh.instanceColor || mesh.instanceColor.count < maxCount) {
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3);
        }
        if (!mesh.geometry.getAttribute('instanceSideColor') || mesh.geometry.getAttribute('instanceSideColor').count < maxCount) {
            mesh.geometry.setAttribute('instanceSideColor', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3));
        }
    };
    initAttrs(opaqueMesh);
    initAttrs(waterMesh);

    const opSideColorAttr = opaqueMesh.geometry.getAttribute('instanceSideColor') as THREE.InstancedBufferAttribute;
    const waSideColorAttr = waterMesh.geometry.getAttribute('instanceSideColor') as THREE.InstancedBufferAttribute;

    const pChunkX = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const pChunkZ = Math.floor(playerPosition[2] / CHUNK_SIZE);

    let opaqueIndex = 0;
    let waterIndex = 0;

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
                if (opaqueIndex >= maxCount || waterIndex >= maxCount) break;

                const sampleX = Math.min(x + Math.floor(step/2), CHUNK_SIZE - 1);
                const sampleZ = Math.min(z + Math.floor(step/2), CHUNK_SIZE - 1);
                const idx = sampleX * CHUNK_SIZE + sampleZ;
                
                let h = chunk.heightMap[idx];
                let type = chunk.topLayer[idx];

                if (type === 0) continue;

                // EXCLUSION LOGIC: Treat sprites as the block underneath to avoid "floating" flowers
                const def = BLOCK_DEFINITIONS[type];
                if (def?.isSprite) {
                    h -= 1; // Lower height to ground level
                    if (h < 0) continue; 
                    // Guess ground type if we don't scan down
                    if (type === BlockType.DEAD_BUSH) type = BlockType.SAND;
                    else if (type === BlockType.SEAGRASS) type = BlockType.WATER;
                    else type = BlockType.GRASS;
                }

                const wx = (chunk.x * CHUNK_SIZE) + x;
                const wz = (chunk.z * CHUNK_SIZE) + z;

                // --- INSTANCE SETTER HELPER ---
                const setInstance = (
                    mesh: THREE.InstancedMesh, 
                    sideAttr: THREE.InstancedBufferAttribute, 
                    i: number, 
                    bType: number, 
                    startY: number, // Bottom Y
                    height: number, // Total Height
                    isWater: boolean = false
                ) => {
                    // For water, reduce overlap to prevent alpha accumulation grid lines
                    const overlap = isWater ? 0.0 : 0.05;

                    _position.set(wx + step / 2, startY, wz + step / 2);
                    _scale.set(step + overlap, height, step + overlap);
                    _matrix.compose(_position, _quaternion, _scale);
                    
                    mesh.setMatrixAt(i, _matrix);

                    const baseColor = BLOCK_COLORS[bType] || BLOCK_COLORS[0];
                    _color.copy(baseColor);
                    _sideColor.copy(baseColor);

                    if (bType === BlockType.SNOW) {
                        _sideColor.copy(BLOCK_COLORS[BlockType.STONE]); 
                    } else if (bType === BlockType.GRASS) {
                        _sideColor.copy(BLOCK_COLORS[BlockType.DIRT]); 
                    }

                    // Tint based on absolute height of the TOP of this block
                    const topH = startY + height;
                    const heightShade = 0.8 + (topH / 384) * 0.2; 
                    _color.multiplyScalar(heightShade);
                    _sideColor.multiplyScalar(heightShade);

                    mesh.setColorAt(i, _color);
                    sideAttr.setXYZ(i, _sideColor.r, _sideColor.g, _sideColor.b);
                };

                // --- LOGIC SPLIT: WATER vs OPAQUE ---
                if (type === BlockType.WATER) {
                    // 1. Scan down for Seabed
                    let seabedY = 0;
                    let floorBlock: number = BlockType.SAND; // Default fallback

                    // Scan from surface down
                    for(let y = h - 1; y > 0; y--) {
                         const b = chunk.data[(sampleX * WORLD_HEIGHT + y) * CHUNK_SIZE + sampleZ];
                         if (b !== BlockType.WATER && b !== BlockType.SEAGRASS && b !== BlockType.TALL_GRASS && b !== BlockType.AIR) {
                             floorBlock = b;
                             seabedY = y;
                             break;
                         }
                    }
                    
                    // 2. Render Seabed (Opaque) - From 0 up to seabedY + 1
                    const seabedHeight = seabedY + 1;
                    setInstance(opaqueMesh, opSideColorAttr, opaqueIndex, floorBlock, 0, seabedHeight);
                    opaqueIndex++;

                    // 3. Render Water (Transparent)
                    // Flatten distant water to avoid opacity stacking and side artifacts.
                    // Instead of a full volume, render a thin "lid" or slab at the surface.
                    const waterHeight = (h + 1) - seabedHeight;
                    if (waterHeight > 0) {
                        const slabThickness = 0.5;
                        const waterSurfaceY = h + 1;
                        const slabStart = waterSurfaceY - slabThickness;
                        
                        setInstance(waterMesh, waSideColorAttr, waterIndex, type, slabStart, slabThickness, true);
                        waterIndex++;
                    }

                } else {
                    // Standard Opaque Block
                    const height = h + 1;
                    setInstance(opaqueMesh, opSideColorAttr, opaqueIndex, type, 0, height);
                    opaqueIndex++;
                }
            }
        }
        if (opaqueIndex >= maxCount || waterIndex >= maxCount) break;
    }
    
    opaqueMesh.count = opaqueIndex;
    waterMesh.count = waterIndex;

    opaqueMesh.instanceMatrix.needsUpdate = true;
    if (opaqueMesh.instanceColor) opaqueMesh.instanceColor.needsUpdate = true;
    opSideColorAttr.needsUpdate = true;

    waterMesh.instanceMatrix.needsUpdate = true;
    if (waterMesh.instanceColor) waterMesh.instanceColor.needsUpdate = true;
    waSideColorAttr.needsUpdate = true;
    
    opaqueMaterial.needsUpdate = true;
    waterMaterial.needsUpdate = true;

  }, [chunks, playerPosition, renderDistance, maxCount, opaqueGeometry, waterGeometry, opaqueMaterial, waterMaterial]);

  return (
    <group>
        <instancedMesh 
            ref={opaqueMeshRef} 
            args={[opaqueGeometry, opaqueMaterial, maxCount]} 
            frustumCulled={false}
        />
        <instancedMesh 
            ref={waterMeshRef} 
            args={[waterGeometry, waterMaterial, maxCount]} 
            frustumCulled={false}
        />
    </group>
  );
};

export default React.memo(DistantTerrain);
