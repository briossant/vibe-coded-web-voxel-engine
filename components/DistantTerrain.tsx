
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
const _topColor = new THREE.Color();
const _sideColor = new THREE.Color();
const _white = new THREE.Color(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();

// Pre-compute colors
const BLOCK_COLORS = new Array(256).fill(null).map((_, i) => {
    const def = BLOCK_DEFINITIONS[i];
    if (!def) return new THREE.Color('#ff00ff');
    return new THREE.Color(def.mapColor);
});

const DistantTerrain: React.FC<DistantTerrainProps> = ({ chunks, playerPosition, renderDistance }) => {
  const opaqueMeshRef = useRef<THREE.InstancedMesh>(null);
  const waterMeshRef = useRef<THREE.InstancedMesh>(null);
  const maxCount = 400000; 

  const { opaqueGeometry, waterGeometry, opaqueMaterial, waterMaterial } = useMemo(() => {
    const baseGeo = new THREE.BoxGeometry(1, 1, 1);
    baseGeo.translate(0, 0.5, 0); // Pivot at bottom
    
    // Bake simple directional lighting into vertex colors
    const colors: number[] = [];
    const normals = baseGeo.attributes.normal;
    const count = normals.count;

    for (let i = 0; i < count; i++) {
        const ny = normals.getY(i);
        const nx = normals.getX(i);
        let intensity = 1.0; 
        if (ny < -0.5) intensity = 0.4; // Bottom
        else if (ny < 0.5) intensity = Math.abs(nx) > 0.5 ? 0.8 : 0.6; // Sides
        colors.push(intensity, intensity, intensity);
    }
    baseGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const opGeo = baseGeo.clone();
    const waGeo = baseGeo.clone();

    // Custom Shader: Mix Top and Side colors based on height threshold
    const onBeforeCompile = (shader: any) => {
        shader.vertexShader = `
          attribute vec3 instanceTopColor;
          attribute vec3 instanceSideColor;
          attribute float instanceHeight;
          attribute float instanceCapHeight;
          varying vec3 vTopColor;
          varying vec3 vSideColor;
          varying float vY;
          varying float vH;
          varying float vCap;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            vTopColor = instanceTopColor;
            vSideColor = instanceSideColor;
            vY = position.y; // 0 to 1
            vH = instanceHeight; // Height in blocks
            vCap = instanceCapHeight;
            `
        );

        shader.fragmentShader = `
          varying vec3 vTopColor;
          varying vec3 vSideColor;
          varying float vY;
          varying float vH;
          varying float vCap;
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment> // vColor contains lighting intensity
            
            // Calculate cap threshold. 
            // We want the top [vCap] blocks to be TopColor.
            // vY is 0..1. The local height of 1.0 corresponds to vH blocks in world.
            // So vCap blocks in local space is vCap / vH.
            
            float threshold = 1.0 - (vCap / max(vH, 0.01));
            
            vec3 finalColor = vSideColor;
            
            // Apply Top Color if above threshold
            if (vY >= threshold) {
                finalColor = vTopColor;
            }
            
            diffuseColor.rgb *= finalColor;
            `
        );
    };

    const opMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    opMat.onBeforeCompile = onBeforeCompile;

    const waMat = new THREE.MeshBasicMaterial({ 
        vertexColors: true, 
        transparent: true, 
        opacity: 0.80, 
        depthWrite: false 
    });
    waMat.onBeforeCompile = onBeforeCompile;

    return { opaqueGeometry: opGeo, waterGeometry: waGeo, opaqueMaterial: opMat, waterMaterial: waMat };
  }, []);

  useEffect(() => {
    const opaqueMesh = opaqueMeshRef.current;
    const waterMesh = waterMeshRef.current;
    if (!opaqueMesh || !waterMesh) return;

    // Initialize custom attributes
    const initAttrs = (mesh: THREE.InstancedMesh) => {
        if (!mesh.instanceColor || mesh.instanceColor.count < maxCount) {
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3);
        }
        if (!mesh.geometry.getAttribute('instanceTopColor')) {
            mesh.geometry.setAttribute('instanceTopColor', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3));
        }
        if (!mesh.geometry.getAttribute('instanceSideColor')) {
            mesh.geometry.setAttribute('instanceSideColor', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3));
        }
        if (!mesh.geometry.getAttribute('instanceHeight')) {
            mesh.geometry.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(new Float32Array(maxCount), 1));
        }
        if (!mesh.geometry.getAttribute('instanceCapHeight')) {
            mesh.geometry.setAttribute('instanceCapHeight', new THREE.InstancedBufferAttribute(new Float32Array(maxCount), 1));
        }
    };
    initAttrs(opaqueMesh);
    initAttrs(waterMesh);

    // Get attribute references
    const getAttrs = (mesh: THREE.InstancedMesh) => ({
        top: mesh.geometry.getAttribute('instanceTopColor') as THREE.InstancedBufferAttribute,
        side: mesh.geometry.getAttribute('instanceSideColor') as THREE.InstancedBufferAttribute,
        height: mesh.geometry.getAttribute('instanceHeight') as THREE.InstancedBufferAttribute,
        cap: mesh.geometry.getAttribute('instanceCapHeight') as THREE.InstancedBufferAttribute
    });

    const opAttrs = getAttrs(opaqueMesh);
    const waAttrs = getAttrs(waterMesh);

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

                const def = BLOCK_DEFINITIONS[type];
                if (def?.isSprite) {
                    h -= 1; 
                    if (h < 0) continue; 
                    if (type === BlockType.DEAD_BUSH) type = BlockType.SAND;
                    else if (type === BlockType.SEAGRASS) type = BlockType.WATER;
                    else type = BlockType.GRASS;
                }

                const wx = (chunk.x * CHUNK_SIZE) + x;
                const wz = (chunk.z * CHUNK_SIZE) + z;

                // --- INSTANCE SETTER ---
                const setInstance = (
                    mesh: THREE.InstancedMesh, 
                    attrs: ReturnType<typeof getAttrs>,
                    i: number, 
                    bType: number, 
                    startY: number, 
                    height: number,
                    capSize: number = 0,
                    isWater: boolean = false
                ) => {
                    const overlap = isWater ? 0.0 : 0.05;

                    _position.set(wx + step / 2, startY, wz + step / 2);
                    _scale.set(step + overlap, height, step + overlap);
                    _matrix.compose(_position, _quaternion, _scale);
                    
                    mesh.setMatrixAt(i, _matrix);
                    
                    // Set standard color to WHITE so vColor only tracks lighting
                    mesh.setColorAt(i, _white);

                    // Determine Colors
                    const baseColor = BLOCK_COLORS[bType] || BLOCK_COLORS[0];
                    _topColor.copy(baseColor);
                    _sideColor.copy(baseColor);

                    // Specific Logic for Grass and Snow Sides
                    if (bType === BlockType.SNOW) {
                         const stone = BLOCK_COLORS[BlockType.STONE];
                         if (stone) _sideColor.copy(stone);
                    } else if (bType === BlockType.GRASS) {
                         const dirt = BLOCK_COLORS[BlockType.DIRT];
                         if (dirt) _sideColor.copy(dirt);
                    }

                    // Height Tinting (Atmospheric)
                    const topH = startY + height;
                    const heightShade = 0.8 + (topH / 384) * 0.2; 
                    _topColor.multiplyScalar(heightShade);
                    _sideColor.multiplyScalar(heightShade);

                    // Update Attributes
                    attrs.top.setXYZ(i, _topColor.r, _topColor.g, _topColor.b);
                    attrs.side.setXYZ(i, _sideColor.r, _sideColor.g, _sideColor.b);
                    attrs.height.setX(i, height);
                    attrs.cap.setX(i, capSize);
                };

                if (type === BlockType.WATER) {
                    let seabedY = 0;
                    let floorBlock: number = BlockType.SAND;
                    
                    // Scan down to find the seabed. Check chunk.data exists first.
                    if (chunk.data && chunk.data.length > 0) {
                        for(let y = h - 1; y > 0; y--) {
                             const b = chunk.data[(sampleX * WORLD_HEIGHT + y) * CHUNK_SIZE + sampleZ];
                             if (b !== BlockType.WATER && b !== BlockType.SEAGRASS && b !== BlockType.TALL_GRASS && b !== BlockType.AIR) {
                                 floorBlock = b;
                                 seabedY = y;
                                 break;
                             }
                        }
                    } else {
                        // Fallback if data isn't available: Assume deep ocean or 10 block depth
                        seabedY = Math.max(0, h - 15);
                        floorBlock = BlockType.SAND;
                    }
                    
                    const seabedHeight = seabedY + 1;
                    
                    // 1. Render Seabed Pillar
                    setInstance(opaqueMesh, opAttrs, opaqueIndex, floorBlock, 0, seabedHeight, 0, false);
                    opaqueIndex++;

                    // 2. Render Water Volume (Full Depth)
                    const waterHeight = (h + 1) - seabedHeight;
                    if (waterHeight > 0) {
                        setInstance(waterMesh, waAttrs, waterIndex, type, seabedHeight, waterHeight, 0, true);
                        waterIndex++;
                    }
                } else {
                    // Standard Terrain
                    const height = h + 1;
                    let capH = 0.0;
                    if (type === BlockType.GRASS) capH = 0.25;
                    if (type === BlockType.SNOW) capH = 4.0; // Larger snow cap
                    
                    setInstance(opaqueMesh, opAttrs, opaqueIndex, type, 0, height, capH, false);
                    opaqueIndex++;
                }
            }
        }
        if (opaqueIndex >= maxCount || waterIndex >= maxCount) break;
    }
    
    opaqueMesh.count = opaqueIndex;
    waterMesh.count = waterIndex;

    // UPDATE OPAQUE MESH
    opaqueMesh.instanceMatrix.needsUpdate = true;
    if (opaqueMesh.instanceColor) opaqueMesh.instanceColor.needsUpdate = true;
    opAttrs.top.needsUpdate = true;
    opAttrs.side.needsUpdate = true;
    opAttrs.height.needsUpdate = true;
    opAttrs.cap.needsUpdate = true;
    opaqueMaterial.needsUpdate = true;

    // UPDATE WATER MESH (Fix for missing water)
    waterMesh.instanceMatrix.needsUpdate = true;
    if (waterMesh.instanceColor) waterMesh.instanceColor.needsUpdate = true;
    waAttrs.top.needsUpdate = true;
    waAttrs.side.needsUpdate = true;
    waAttrs.height.needsUpdate = true;
    waAttrs.cap.needsUpdate = true;
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
