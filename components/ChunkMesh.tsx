
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ChunkData } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { globalTexture, getUVOffset, TEXTURE_ATLAS_SIZE } from '../utils/textures';
import { getBlockDef, BlockType } from '../blocks';

interface ChunkMeshProps {
  chunk: ChunkData;
  lodLevel: number; 
  neighbors?: {
      nx?: ChunkData; px?: ChunkData; nz?: ChunkData; pz?: ChunkData;
  };
}

// Replaced local helpers with Registry lookups
const isSprite = (type: number) => getBlockDef(type).isSprite;
const isWater = (type: number) => getBlockDef(type).isFluid;
const isWaterOrUnderwaterPlant = (type: number) => {
    const def = getBlockDef(type);
    return def.isFluid || (def.isSprite && type === BlockType.SEAGRASS); // Special case for seagrass
};

// Ground = Terrain Skin. Exclude Wood (Trees) so they don't stretch.
const isGround = (type: number) => {
    const def = getBlockDef(type);
    // Exclude Logs and Leaves so they render as distinct blocks instead of terrain skin
    if (def.category === 'Wood') return false; 
    if (type === BlockType.CACTUS || type === BlockType.MELON) return false;
    return def.isSolid && !def.isTransparent && !def.isFluid;
};

// Features = Objects on top of terrain (Trees, Cactus, etc)
const isBlockFeature = (type: number) => {
    const def = getBlockDef(type);
    // Include all Wood (Logs & Leaves) to be rendered as individual blocks in LOD 1
    if (def.category === 'Wood') return true; 
    if (type === BlockType.CACTUS || type === BlockType.MELON) return true;
    return false;
};

const UV_EPSILON = 0.001;
const WATER_HEIGHT_OFFSET = 0.875;

const ChunkMesh: React.FC<ChunkMeshProps> = ({ chunk, lodLevel, neighbors }) => {
  const { opaque, transparent: transGeo } = useMemo(() => {
    const opaque = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[] };
    let opaqueCount = 0;
    
    const transparent = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[] };
    let transCount = 0;

    const uW = 1 / TEXTURE_ATLAS_SIZE;
    const vH = 1.0;

    const { nx, px, nz, pz } = neighbors || {};

    const getBlock = (cx: number, cy: number, cz: number): number => {
        if (cy < 0 || cy >= WORLD_HEIGHT) return BlockType.AIR;

        if (cx >= 0 && cx < CHUNK_SIZE && cz >= 0 && cz < CHUNK_SIZE) {
            return chunk.data[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz];
        }

        let nChunk: ChunkData | undefined;
        let lx = cx;
        let lz = cz;

        if (cx < 0) { nChunk = nx; lx += CHUNK_SIZE; }
        else if (cx >= CHUNK_SIZE) { nChunk = px; lx -= CHUNK_SIZE; }
        else if (cz < 0) { nChunk = nz; lz += CHUNK_SIZE; }
        else if (cz >= CHUNK_SIZE) { nChunk = pz; lz -= CHUNK_SIZE; }

        if (nChunk) {
            return nChunk.data[(lx * WORLD_HEIGHT + cy) * CHUNK_SIZE + lz];
        }
        return BlockType.AIR;
    };

    const addQuad = (
        isTrans: boolean,
        pos: number[], 
        corners: number[][], 
        norm: number[], 
        uStart: number, vStart: number,
        heightOverride?: number 
    ) => {
        const target = isTrans ? transparent : opaque;
        const baseIndex = isTrans ? transCount : opaqueCount;

        for (let i = 0; i < 4; i++) {
            const x = pos[0] + corners[i][0];
            let y = pos[1] + corners[i][1];
            const z = pos[2] + corners[i][2];

            if (heightOverride !== undefined && corners[i][1] === 0) {
               y = heightOverride;
            }

            target.positions.push(x, y, z);
            target.normals.push(norm[0], norm[1], norm[2]);
        }

        const u0 = uStart + UV_EPSILON;
        const u1 = uStart + uW - UV_EPSILON;
        const v0 = vStart;
        const v1 = vStart + vH;

        target.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);

        target.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex + 1, baseIndex + 3, baseIndex + 2
        );
        
        if (isTrans) transCount += 4; else opaqueCount += 4;
    };

    const addCross = (x: number, y: number, z: number, uStart: number, vStart: number) => {
        const u0 = uStart + UV_EPSILON;
        const u1 = uStart + uW - UV_EPSILON;
        const v0 = vStart;
        const v1 = vStart + vH;

        opaque.positions.push(x, y, z, x+1, y, z+1, x, y+1, z, x+1, y+1, z+1);
        opaque.normals.push(0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7);
        opaque.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        opaque.indices.push(opaqueCount, opaqueCount+1, opaqueCount+2, opaqueCount+1, opaqueCount+3, opaqueCount+2);
        opaqueCount += 4;

        opaque.positions.push(x, y, z+1, x+1, y, z, x, y+1, z+1, x+1, y+1, z);
        opaque.normals.push(-0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7);
        opaque.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        opaque.indices.push(opaqueCount, opaqueCount+1, opaqueCount+2, opaqueCount+1, opaqueCount+3, opaqueCount+2);
        opaqueCount += 4;
    };

    // === LOD 1: SURFACE MESH ===
    if (lodLevel >= 1) {
        const groundHeightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                let y = WORLD_HEIGHT - 1;
                let groundY = -1;
                let waterY = -1;

                while (y >= 0) {
                    const t = getBlock(x, y, z);
                    if (isGround(t)) {
                        groundY = y;
                        break; 
                    }
                    if (isWaterOrUnderwaterPlant(t) && waterY === -1) {
                        waterY = y; 
                    }
                    y--;
                }
                
                groundHeightMap[x * CHUNK_SIZE + z] = groundY;

                if (groundY >= 0) {
                    const type = getBlock(x, groundY, z);
                    const [u, v] = getUVOffset(type, [0, 1, 0]);
                    addQuad(false, [x, groundY, z], [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], [0, 1, 0], u, v);
                }

                if (waterY > groundY) {
                    const type = BlockType.WATER;
                    const [u, v] = getUVOffset(type, [0, 1, 0]);
                    const wh = WATER_HEIGHT_OFFSET;
                    addQuad(true, [x, waterY, z], [[0, wh, 1], [1, wh, 1], [0, wh, 0], [1, wh, 0]], [0, 1, 0], u, v);
                }
            }
        }

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const groundY = groundHeightMap[x * CHUNK_SIZE + z];

                if (groundY >= 0) {
                    const type = getBlock(x, groundY, z);
                    const [uSide, vSide] = getUVOffset(type, [1, 0, 0]);

                    const checkNeighbor = (nx: number, nz: number, dirX: number, dirZ: number) => {
                        let ny = -1;
                        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                             ny = groundHeightMap[nx * CHUNK_SIZE + nz];
                        } else {
                             let scanY = WORLD_HEIGHT - 1;
                             while (scanY >= 0) {
                                 const t = getBlock(nx, scanY, nz);
                                 if (isGround(t)) { ny = scanY; break; }
                                 scanY--;
                             }
                        }

                        if (ny < groundY) {
                            let corners: number[][] = [];
                            let normal: number[] = [];
                            if (dirX === 1) { corners = [[1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0]]; normal = [1, 0, 0]; } 
                            else if (dirX === -1) { corners = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]]; normal = [-1, 0, 0]; } 
                            else if (dirZ === 1) { corners = [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]; normal = [0, 0, 1]; } 
                            else { corners = [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]]; normal = [0, 0, -1]; }
                            addQuad(false, [x, groundY, z], corners, normal, uSide, vSide, ny + 1);
                        }
                    };
                    
                    checkNeighbor(x + 1, z, 1, 0);
                    checkNeighbor(x - 1, z, -1, 0);
                    checkNeighbor(x, z + 1, 0, 1);
                    checkNeighbor(x, z - 1, 0, -1);
                }

                const startScan = Math.max(0, groundY + 1);
                for (let y = startScan; y < WORLD_HEIGHT; y++) {
                    const type = getBlock(x, y, z);
                    if (type === BlockType.AIR) continue;
                    if (isWater(type)) continue;

                    if (isSprite(type)) {
                        const [u, v] = getUVOffset(type, [0, 1, 0]);
                        addCross(x, y, z, u, v);
                    } 
                    else if (isBlockFeature(type)) {
                        const [u, v] = getUVOffset(type, [0, 1, 0]);
                        const [uS, vS] = getUVOffset(type, [1, 0, 0]);
                        
                        const isExposed = (dx: number, dy: number, dz: number) => {
                             const t = getBlock(x+dx, y+dy, z+dz);
                             return t === BlockType.AIR || isSprite(t) || isWater(t);
                        };

                        if (isExposed(0, 1, 0)) addQuad(false, [x, y, z], [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], [0, 1, 0], u, v);
                        if (isExposed(0, -1, 0)) addQuad(false, [x, y, z], [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]], [0, -1, 0], u, v);
                        if (isExposed(0, 0, 1)) addQuad(false, [x, y, z], [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], [0, 0, 1], uS, vS);
                        if (isExposed(0, 0, -1)) addQuad(false, [x, y, z], [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, -1], uS, vS);
                        if (isExposed(1, 0, 0)) addQuad(false, [x, y, z], [[1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0]], [1, 0, 0], uS, vS);
                        if (isExposed(-1, 0, 0)) addQuad(false, [x, y, z], [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]], [-1, 0, 0], uS, vS);
                    }
                }
            }
        }
    } 
    // === LOD 0: FULL VOXEL MESH ===
    else {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const type = chunk.data[(x * WORLD_HEIGHT + y) * CHUNK_SIZE + z];
                    if (type === BlockType.AIR) continue;
                    
                    if (isSprite(type)) {
                        const [u, v] = getUVOffset(type, [0, 1, 0]);
                        addCross(x, y, z, u, v);
                    }

                    const isWaterBlock = isWaterOrUnderwaterPlant(type);

                    if (isSprite(type) && !isWaterBlock) continue;
                    if (!isWaterBlock && isSprite(type)) continue; 

                    const isSolid = (dx: number, dy: number, dz: number) => {
                        const t = getBlock(x + dx, y + dy, z + dz);
                        const tDef = getBlockDef(t);
                        
                        if (isWaterBlock) {
                            // Cull against water or solids
                            if (isWaterOrUnderwaterPlant(t)) return true;
                            if (isGround(t)) return true;
                            return false;
                        } else {
                            // Normal block logic
                            if (isWaterOrUnderwaterPlant(t)) return false;
                            // Cull against other solid blocks (but not transparent ones like leaves)
                            if (tDef.isSolid && !tDef.isTransparent) return true;
                            return false;
                        }
                    };

                    const textureType = isWaterBlock ? BlockType.WATER : type;
                    const [u, v] = getUVOffset(textureType, [0, 1, 0]);
                    const [uBottom, vBottom] = getUVOffset(textureType, [0, -1, 0]);
                    const [uS, vS] = getUVOffset(textureType, [1, 0, 0]);

                    if (!isSolid(0, 1, 0)) {
                        // Top Face
                        if (isWaterBlock) {
                             const wh = WATER_HEIGHT_OFFSET;
                             addQuad(true, [x, y, z], [[0, wh, 1], [1, wh, 1], [0, wh, 0], [1, wh, 0]], [0, 1, 0], u, v);
                        } else {
                             addQuad(isWaterBlock, [x, y, z], [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], [0, 1, 0], u, v);
                        }
                    }
                    if (!isSolid(0, -1, 0)) addQuad(isWaterBlock, [x, y, z], [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]], [0, -1, 0], uBottom, vBottom);
                    if (!isSolid(0, 0, 1)) addQuad(isWaterBlock, [x, y, z], [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], [0, 0, 1], uS, vS);
                    if (!isSolid(0, 0, -1)) addQuad(isWaterBlock, [x, y, z], [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, -1], uS, vS);
                    if (!isSolid(1, 0, 0)) addQuad(isWaterBlock, [x, y, z], [[1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0]], [1, 0, 0], uS, vS);
                    if (!isSolid(-1, 0, 0)) addQuad(isWaterBlock, [x, y, z], [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]], [-1, 0, 0], uS, vS);
                }
            }
        }
    }

    const createGeo = (data: { positions: number[], normals: number[], uvs: number[], indices: number[] }) => {
        const bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        bufferGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        bufferGeometry.setIndex(data.indices);
        bufferGeometry.computeBoundingSphere();
        return bufferGeometry;
    };
    
    return { opaque: createGeo(opaque), transparent: createGeo(transparent) };
  }, [chunk, lodLevel, neighbors]);

  return (
    <group position={[chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE]}>
        <mesh 
            geometry={opaque}
            castShadow={lodLevel === 0}
            receiveShadow={lodLevel === 0}
        >
            <meshStandardMaterial 
                map={globalTexture} 
                roughness={0.9} 
                metalness={0.1}
                side={THREE.DoubleSide} 
                alphaTest={0.5}
                transparent={false}
            />
        </mesh>
        <mesh 
            geometry={transGeo}
            castShadow={false}
            receiveShadow={lodLevel === 0}
        >
            <meshStandardMaterial 
                map={globalTexture} 
                roughness={0.05} 
                metalness={0.2}
                side={THREE.DoubleSide} 
                transparent={true}
                opacity={0.65}
                depthWrite={false} 
            />
        </mesh>
    </group>
  );
};

const arePropsEqual = (prev: ChunkMeshProps, next: ChunkMeshProps) => {
    return prev.chunk === next.chunk && 
           prev.lodLevel === next.lodLevel &&
           prev.neighbors?.nx === next.neighbors?.nx &&
           prev.neighbors?.px === next.neighbors?.px &&
           prev.neighbors?.nz === next.neighbors?.nz &&
           prev.neighbors?.pz === next.neighbors?.pz;
};

export default React.memo(ChunkMesh, arePropsEqual);
    