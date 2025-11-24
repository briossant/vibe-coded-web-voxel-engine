

import { ChunkData } from '../types';
import { getAllBlocks, BlockType } from '../blocks';
import { TEXTURE_ATLAS_SIZE } from '../constants';

// --- INLINED WORKER CODE ---
// We inline this to avoid file serving issues in the preview environment.
// This script contains the logic from TerrainMath.ts and GenerationLogic.ts
const WORKER_SCRIPT = `
/* eslint-disable */
// --- MATH UTILS (from TerrainMath.ts) ---
const SEED_OFFSET = 10000;
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function hash(x, z, seed) {
    let h = 0xdeadbeef;
    h = Math.imul(h ^ x, 0x85ebca6b);
    h = Math.imul(h ^ z, 0xc2b2ae35);
    h = Math.imul(h ^ seed, 0x12345678);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

class SimplexNoise {
    constructor(seed = 12345) {
        this.p = new Uint8Array(256);
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        this.grad3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
        this.reseed(seed);
    }
    reseed(seed) {
        const random = mulberry32(seed);
        for (let i = 0; i < 256; i++) { this.p[i] = i; }
        for (let i = 255; i > 0; i--) {
            const r = Math.floor(random() * (i + 1));
            const t = this.p[i]; this.p[i] = this.p[r]; this.p[r] = t;
        }
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }
    noise2D(xin, yin) {
        let n0=0, n1=0, n2=0;
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const X0 = i - t; const Y0 = j - t;
        const x0 = xin - X0; const y0 = yin - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2; const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2; const y2 = y0 - 1.0 + 2.0 * G2;
        const ii = i & 255; const jj = j & 255;
        const gi0 = this.permMod12[ii + this.perm[jj]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (this.grad3[gi0 * 3] * x0 + this.grad3[gi0 * 3 + 1] * y0); }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (this.grad3[gi1 * 3] * x1 + this.grad3[gi1 * 3 + 1] * y1); }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (this.grad3[gi2 * 3] * x2 + this.grad3[gi2 * 3 + 1] * y2); }
        return 70.0 * (n0 + n1 + n2);
    }
    fbm(x, y, octaves, lacunarity = 2.0, gain = 0.5) {
        let total = 0; let amplitude = 1; let frequency = 1; let maxValue = 0;
        for(let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude; amplitude *= gain; frequency *= lacunarity;
        }
        return total / maxValue;
    }
    ridged(x, y, octaves, lacunarity = 2.0, gain = 0.5) {
        let total = 0; let amplitude = 1; let frequency = 1; let maxValue = 0;
        for(let i = 0; i < octaves; i++) {
            let n = this.noise2D(x * frequency, y * frequency);
            n = 1.0 - Math.abs(n);
            n = n * n; 
            total += n * amplitude;
            maxValue += amplitude; amplitude *= gain; frequency *= lacunarity;
        }
        return total / maxValue;
    }
}

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}

const BIOMES = {
    OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, 
    SNOWY: 5, MOUNTAIN: 6, JUNGLE: 7, SAVANNA: 8, MESA: 9, RIVER: 10
};

// --- TERRAIN GENERATION (from TerrainMath.ts) ---
function getTerrainInfo(wx, wz, noiseInstance, waterLevel, worldHeight) {
    const nx = wx + SEED_OFFSET;
    const nz = wz + SEED_OFFSET;

    const warpFreq = 0.002;
    const warpAmp = 60.0;
    const qx = noiseInstance.fbm(nx * warpFreq, nz * warpFreq, 2);
    const qz = noiseInstance.fbm((nx + 521) * warpFreq, (nz + 132) * warpFreq, 2);
    
    const warpedX = nx + qx * warpAmp;
    const warpedZ = nz + qz * warpAmp;

    const continentalness = noiseInstance.fbm(warpedX * 0.001, warpedZ * 0.001, 2); 
    const erosion = noiseInstance.fbm(warpedX * 0.0025, warpedZ * 0.0025, 2);
    const pv = noiseInstance.fbm(nx * 0.008, nz * 0.008, 3);
    const temperature = noiseInstance.fbm(nx * 0.0005, nz * 0.0005, 2); 
    const humidity = noiseInstance.fbm((nx + 600) * 0.0005, (nz + 600) * 0.0005, 2); 

    const riverWarpX = noiseInstance.noise2D(nx * 0.006, nz * 0.006) * 35;
    const riverWarpZ = noiseInstance.noise2D(nx * 0.006 + 123, nz * 0.006 + 456) * 35;

    const riverNoise = noiseInstance.noise2D((warpedX + riverWarpX) * 0.0006, (warpedZ + riverWarpZ) * 0.0006);
    const riverVal = Math.abs(riverNoise); 
    
    const valleyWidth = 0.14; 
    const riverValleyMask = smoothstep(0.025, valleyWidth, riverVal); 
    const effectiveValleyMask = riverValleyMask * riverValleyMask;

    let baseHeight = waterLevel;
    let landOffset = 0;

    if (continentalness < -0.2) {
        landOffset = lerp(-30, -5, smoothstep(-0.8, -0.2, continentalness));
    } else if (continentalness < 0.0) {
        landOffset = lerp(-5, 2, smoothstep(-0.2, 0.0, continentalness));
    } else {
        landOffset = lerp(2, 60, smoothstep(0.0, 1.0, continentalness));
    }

    if (landOffset > 0) {
        landOffset *= effectiveValleyMask;
    }
    baseHeight += landOffset;

    const mountainShape = noiseInstance.ridged(nx * 0.004, nz * 0.004, 5) * 220;
    const hillShape = pv * 30;

    const mountainMix = smoothstep(0.3, -0.3, erosion); 
    const coastDampen = smoothstep(-0.1, 0.2, continentalness);

    const terrainRoughness = lerp(hillShape, mountainShape, mountainMix) * coastDampen * effectiveValleyMask;

    let h = baseHeight + terrainRoughness;

    const valleyFloorHeight = waterLevel + 2;
    h = lerp(valleyFloorHeight, h, effectiveValleyMask);

    const oceanFade = smoothstep(-0.4, -0.1, continentalness); 

    const riverWidthBase = 0.02;
    const riverWidthVar = smoothstep(-0.5, 0.5, erosion) * 0.015; 
    const riverEdge = riverWidthBase + riverWidthVar;

    const riverFactor = smoothstep(riverEdge * 0.6, riverEdge, riverVal);
    const isRiver = riverFactor < 0.95 && oceanFade > 0.1;

    if (isRiver) {
        const riverBedHeight = waterLevel - 6;
        let mix = smoothstep(0.0, 1.0, riverFactor);
        mix = lerp(1.0, mix, oceanFade);
        h = lerp(riverBedHeight, h, mix);
    }

    h += noiseInstance.noise2D(nx * 0.1, nz * 0.1) * 1.5;

    const height = Math.floor(Math.max(2, Math.min(worldHeight - 2, h)));

    let biome = BIOMES.PLAINS;

    if (height < waterLevel) {
        biome = BIOMES.OCEAN;
        if (isRiver && height < waterLevel - 1) biome = BIOMES.RIVER;
    } else if (height < waterLevel + 2 && continentalness < 0.1) {
        if (temperature > 0.3) biome = BIOMES.BEACH;
        else biome = BIOMES.BEACH; 
    } else {
        if (height > 240) {
            biome = BIOMES.SNOWY; 
        } else if (height > 160) {
            if (temperature < 0) biome = BIOMES.SNOWY;
            else biome = BIOMES.MOUNTAIN;
        } else {
            if (temperature > 0.5) {
                if (humidity > 0.3) biome = BIOMES.JUNGLE;
                else if (humidity > -0.1) biome = BIOMES.SAVANNA;
                else if (humidity > -0.6) biome = BIOMES.MESA;
                else biome = BIOMES.DESERT;
            } else if (temperature > -0.3) {
                if (humidity > 0.2) biome = BIOMES.FOREST;
                else if (humidity > -0.4) biome = BIOMES.PLAINS;
                else biome = BIOMES.SAVANNA;
            } else {
                biome = BIOMES.SNOWY;
            }
        }
    }
    
    if (isRiver && height >= waterLevel) {
        biome = BIOMES.RIVER;
    }

    return { h: height, biome, isRiver };
}

// --- GENERATION LOGIC (from GenerationLogic.ts) ---
function computeChunk(ctx, cx, cz) {
    const { 
        CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, SEED, 
        BLOCKS, BIOMES, noise, getTerrainInfo, hash 
    } = ctx;

    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;
    
    const chunkBuffer = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const heightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const trees = [];
    
    chunkBuffer.fill(BLOCKS.AIR);
    
    let totalHeight = 0;
    const biomeCounts = {};

    const getIndex = (x, y, z) => (x * WORLD_HEIGHT + y) * CHUNK_SIZE + z;
    const hash3 = (x, y, z) => hash(x + y * 31, z, SEED);

    function safeSetBlock(x, y, z, block) {
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) {
            const idx = getIndex(x, y, z);
            const current = chunkBuffer[idx];
            
            const isCurrentFoliage = current === BLOCKS.WATER || current === BLOCKS.TALL_GRASS || (current >= BLOCKS.FLOWER_YELLOW && current <= BLOCKS.SEAGRASS) || 
                                     current === BLOCKS.OAK_LEAVES || current === BLOCKS.BIRCH_LEAVES || current === BLOCKS.SPRUCE_LEAVES || 
                                     current === BLOCKS.JUNGLE_LEAVES || current === BLOCKS.ACACIA_LEAVES;
            
            const isNewLog = block === BLOCKS.OAK_LOG || block === BLOCKS.BIRCH_LOG || block === BLOCKS.SPRUCE_LOG || 
                             block === BLOCKS.ACACIA_LOG || block === BLOCKS.JUNGLE_LOG;
            
            if (current === BLOCKS.AIR || isCurrentFoliage) {
                const isCurrentLeaf = current === BLOCKS.OAK_LEAVES || current === BLOCKS.BIRCH_LEAVES || 
                                      current === BLOCKS.SPRUCE_LEAVES || current === BLOCKS.JUNGLE_LEAVES || current === BLOCKS.ACACIA_LEAVES;
                
                if (isCurrentLeaf && !isNewLog) return; 
                chunkBuffer[idx] = block;
            }
        }
    }

    function placeLogLine(x1, y1, z1, x2, y2, z2, block) {
        const dist = Math.max(Math.abs(x2-x1), Math.abs(y2-y1), Math.abs(z2-z1));
        if (dist === 0) {
            safeSetBlock(Math.floor(x1), Math.floor(y1), Math.floor(z1), block);
            return;
        }
        const dx = (x2-x1)/dist;
        const dy = (y2-y1)/dist;
        const dz = (z2-z1)/dist;

        for (let i=0; i<=dist; i++) {
            safeSetBlock(Math.floor(x1 + dx*i), Math.floor(y1 + dy*i), Math.floor(z1 + dz*i), block);
        }
    }

    function placeLeafBlob(cx, cy, cz, radius, block, density = 1.0) {
        const rSq = radius * radius;
        const ir = Math.ceil(radius);
        for (let x = -ir; x <= ir; x++) {
            for (let y = -ir; y <= ir; y++) {
                for (let z = -ir; z <= ir; z++) {
                    const dSq = x*x + y*y + z*z;
                    if (dSq <= rSq) {
                        if (dSq >= rSq - 2 && hash3(cx+x, cy+y, cz+z) > density) continue;
                        safeSetBlock(cx+x, cy+y, cz+z, block);
                    }
                }
            }
        }
    }

    function placeLeafLayer(cx, cy, cz, r, type) {
        const rSq = r * r;
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                const d = Math.abs(i) + Math.abs(j);
                const d2 = i*i + j*j;
                if (d <= r * 1.2 && d2 <= rSq + 1) {
                    safeSetBlock(cx + i, cy, cz + j, type);
                }
            }
        }
    }

    function placeTree(x, y, z, typeStr) {
        const rVal = hash3(x, y, z);
        
        let logType = BLOCKS.OAK_LOG;
        let leafType = BLOCKS.OAK_LEAVES;
        let treeTypeIdx = 0;
        
        if (typeStr === 'BIRCH') { logType = BLOCKS.BIRCH_LOG; leafType = BLOCKS.BIRCH_LEAVES; treeTypeIdx = 1; }
        else if (typeStr === 'SPRUCE') { logType = BLOCKS.SPRUCE_LOG; leafType = BLOCKS.SPRUCE_LEAVES; treeTypeIdx = 2; }
        else if (typeStr === 'JUNGLE') { logType = BLOCKS.JUNGLE_LOG; leafType = BLOCKS.JUNGLE_LEAVES; treeTypeIdx = 3; }
        else if (typeStr === 'ACACIA') { logType = BLOCKS.ACACIA_LOG; leafType = BLOCKS.ACACIA_LEAVES; treeTypeIdx = 4; }

        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
            trees.push({ x, y, z, type: treeTypeIdx });
        }

        if (typeStr === 'OAK') {
            const isBig = rVal > 0.65; 
            if (isBig) {
                const height = 7 + Math.floor(rVal * 6); 
                placeLogLine(x, y, z, x, y+height-2, z, logType);
                
                if (hash3(x, y, z+1) > 0.4) safeSetBlock(x+1, y, z, logType);
                if (hash3(x, y, z-1) > 0.4) safeSetBlock(x-1, y, z, logType);
                if (hash3(x+1, y, z) > 0.4) safeSetBlock(x, y, z+1, logType);
                if (hash3(x-1, y, z) > 0.4) safeSetBlock(x, y, z-1, logType);

                const numBranches = 3 + Math.floor(hash3(x, height, z) * 3); 
                for (let b = 0; b < numBranches; b++) {
                    const startH = Math.floor(height * 0.4) + Math.floor(hash3(x, b, z) * (height * 0.4));
                    const angle = hash3(b, y, x) * Math.PI * 2;
                    const len = 3 + hash3(z, b, y) * 3; 
                    const lift = 1 + hash3(x, z, b) * 3; 
                    const bx = x + Math.cos(angle) * len;
                    const bz = z + Math.sin(angle) * len;
                    const by = y + startH + lift;
                    placeLogLine(x, y + startH, z, Math.floor(bx), Math.floor(by), Math.floor(bz), logType);
                    placeLeafBlob(Math.floor(bx), Math.floor(by), Math.floor(bz), 2.5, leafType, 0.7);
                }
                placeLeafBlob(x, y+height, z, 3.5, leafType, 0.6);
            } else {
                const height = 5 + Math.floor(rVal * 3);
                placeLogLine(x, y, z, x, y+height-1, z, logType);
                placeLeafBlob(x, y+height, z, 2.8, leafType, 0.8);
                placeLeafBlob(x+1, y+height-2, z, 2.0, leafType, 0.8);
                placeLeafBlob(x-1, y+height-2, z, 2.0, leafType, 0.8);
                placeLeafBlob(x, y+height-2, z+1, 2.0, leafType, 0.8);
            }
        }
        else if (typeStr === 'BIRCH') {
             const height = 7 + Math.floor(rVal * 5); 
             placeLogLine(x, y, z, x, y+height, z, logType);
             const canopyStart = Math.floor(height * 0.5);
             placeLeafBlob(x, y+height+1, z, 1.5, leafType, 0.9);
             for (let i = canopyStart; i <= height; i += 2) {
                 const r = 1.8 + hash3(x, i, z) * 0.8;
                 placeLeafBlob(x, y+i, z, r, leafType, 0.75);
             }
        }
        else if (typeStr === 'SPRUCE') {
            const height = 10 + Math.floor(rVal * 14); 
            placeLogLine(x, y, z, x, y+height-1, z, logType);
            let maxR = 3.5 + hash3(x,y,z);
            const startLeaf = 3;
            for (let ly = startLeaf; ly < height; ly++) {
                const nh = (ly - startLeaf) / (height - startLeaf);
                const r = Math.max(0.5, maxR * (1.0 - nh));
                if (ly % 2 === 0 || ly === height-1) {
                    const ri = Math.ceil(r);
                    placeLeafLayer(x, y + ly, z, ri, leafType);
                }
            }
            safeSetBlock(x, y+height, z, leafType);
            safeSetBlock(x, y+height+1, z, leafType);
        }
        else if (typeStr === 'ACACIA') {
             const height = 5 + Math.floor(rVal * 4);
             const forkH = Math.max(2, Math.floor(height * 0.6));
             placeLogLine(x, y, z, x, y+forkH, z, logType);
             const numBranches = 2 + (hash3(x,z,y) > 0.5 ? 1 : 0);
             for(let i=0; i<numBranches; i++) {
                 const ang = (Math.PI * 2 * i) / numBranches + hash3(x,i,z);
                 const len = 2 + hash3(z,i,y) * 3;
                 const bx = x + Math.cos(ang) * len;
                 const bz = z + Math.sin(ang) * len;
                 const by = y + height + (hash3(x,z,i) * 2 - 1);
                 placeLogLine(x, y+forkH, z, Math.floor(bx), Math.floor(by), Math.floor(bz), logType);
                 placeLeafLayer(Math.floor(bx), Math.floor(by), Math.floor(bz), 2.5, leafType);
             }
        }
        else if (typeStr === 'JUNGLE') {
            const height = 22 + Math.floor(rVal * 15);
            for(let i=0; i<height; i++) {
                safeSetBlock(x, y+i, z, logType);
                safeSetBlock(x+1, y+i, z, logType);
                safeSetBlock(x, y+i, z+1, logType);
                safeSetBlock(x+1, y+i, z+1, logType);
            }
            placeLeafBlob(x, y+height, z, 6.5, leafType, 0.7);
            for(let i=5; i<height-6; i+=4) {
                if (hash3(x,i,z) > 0.3) {
                    const dir = hash3(z,i,x) * Math.PI * 2;
                    const len = 2 + hash3(x,z,i) * 3;
                    const bx = x + Math.cos(dir) * len;
                    const bz = z + Math.sin(dir) * len;
                    placeLogLine(x, y+i, z, Math.floor(bx), y+i+1, Math.floor(bz), logType);
                    placeLeafBlob(Math.floor(bx), y+i+1, Math.floor(bz), 2.8, leafType, 0.8);
                }
            }
        }
    }

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = worldX + x;
            const wz = worldZ + z;

            const { h: groundHeight, biome } = getTerrainInfo(wx, wz, noise, WATER_LEVEL, WORLD_HEIGHT);

            heightMap[x * CHUNK_SIZE + z] = groundHeight;
            totalHeight += groundHeight;
            biomeMap[x * CHUNK_SIZE + z] = biome;
            biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;

            for (let y = 0; y < WORLD_HEIGHT; y++) {
                const idx = getIndex(x, y, z);

                if (y === 0) {
                    chunkBuffer[idx] = BLOCKS.BEDROCK;
                    continue;
                }

                if (y <= groundHeight) {
                    let block = BLOCKS.STONE;
                    
                    if (y === groundHeight) {
                         switch(biome) {
                            case BIOMES.OCEAN: block = BLOCKS.SAND; break;
                            case BIOMES.BEACH: block = BLOCKS.SAND; break;
                            case BIOMES.DESERT: block = BLOCKS.SAND; break;
                            case BIOMES.SNOWY: block = BLOCKS.SNOW; break;
                            case BIOMES.MOUNTAIN: block = BLOCKS.STONE; break; 
                            case BIOMES.FOREST: block = BLOCKS.GRASS; break;
                            case BIOMES.JUNGLE: block = BLOCKS.GRASS; break;
                            case BIOMES.SAVANNA: block = BLOCKS.DIRT; break; 
                            case BIOMES.MESA: block = BLOCKS.RED_SAND; break;
                            case BIOMES.RIVER: 
                                if (y <= WATER_LEVEL + 2) {
                                    block = hash(x, z, SEED) > 0.3 ? BLOCKS.SAND : BLOCKS.GRAVEL;
                                } else {
                                    block = BLOCKS.GRASS;
                                }
                                break;
                            default: block = BLOCKS.GRASS; break;
                        }
                    } 
                    else if (y > groundHeight - 4) {
                        if (biome === BIOMES.DESERT || biome === BIOMES.BEACH) block = BLOCKS.SANDSTONE;
                        else if (biome === BIOMES.MESA) block = BLOCKS.RED_SANDSTONE;
                        else if (biome === BIOMES.SNOWY) block = BLOCKS.STONE;
                        else if (biome === BIOMES.MOUNTAIN) block = BLOCKS.STONE;
                        else if (biome === BIOMES.RIVER) block = BLOCKS.GRAVEL;
                        else block = BLOCKS.DIRT;
                    }
                    
                    if (biome === BIOMES.MESA && y > WATER_LEVEL) {
                        const noiseVal = hash(x, y, SEED) + hash(z, y, SEED);
                        const band = (y + Math.floor(noiseVal * 2)) % 9;
                        if (band === 0 || band === 1) block = BLOCKS.RED_SANDSTONE;
                        else if (band === 4) block = BLOCKS.DIRT;
                        else block = BLOCKS.RED_SAND;
                    }
                    
                    if (y > 230) { 
                        if (y === groundHeight) block = BLOCKS.SNOW;
                        else if (y > groundHeight - 3) block = BLOCKS.SNOW;
                    }

                    if (y < groundHeight - 4 && y > 4) {
                         const caveScale = 0.06;
                         const caveNoise = noise.noise2D(wx * caveScale, (y + wz) * caveScale) + 
                                         noise.noise2D((wx + y) * caveScale, wz * caveScale);
                         const threshold = y < 40 ? 1.25 : 1.35;
                         if (caveNoise > threshold) block = BLOCKS.AIR;
                    }

                    if (block !== BLOCKS.AIR) chunkBuffer[idx] = block;
                } else if (y <= WATER_LEVEL) {
                    chunkBuffer[idx] = BLOCKS.WATER;
                }
            }
        }
    }

    const TREE_MARGIN = 6; 
    for (let x = -TREE_MARGIN; x < CHUNK_SIZE + TREE_MARGIN; x++) {
        for (let z = -TREE_MARGIN; z < CHUNK_SIZE + TREE_MARGIN; z++) {
            const wx = worldX + x;
            const wz = worldZ + z;
            
            let h, biome;
            if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
                h = heightMap[x * CHUNK_SIZE + z];
                biome = biomeMap[x * CHUNK_SIZE + z];
            } else {
                const info = getTerrainInfo(wx, wz, noise, WATER_LEVEL, WORLD_HEIGHT);
                h = info.h;
                biome = info.biome;
            }
            
            const r = hash(wx, wz, SEED); 

            if (h < WATER_LEVEL - 1 && biome === BIOMES.OCEAN) {
                 if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
                     if (r > 0.8) safeSetBlock(x, h+1, z, BLOCKS.SEAGRASS);
                     if (h < WATER_LEVEL - 15 && r > 0.99) safeSetBlock(x, h+1, z, BLOCKS.SEA_LANTERN);
                     if (r < 0.1) safeSetBlock(x, h, z, BLOCKS.GRAVEL);
                 }
                 continue; 
            }

            if (h <= WATER_LEVEL || h >= WORLD_HEIGHT - 15) continue;
            if (biome === BIOMES.RIVER) continue;

            let treeType = null;
            let treeChance = 0;

            if (h < 210) {
                if (biome === BIOMES.FOREST) { treeChance = 0.06; treeType = 'OAK'; if (r > 0.7) treeType = 'BIRCH'; }
                else if (biome === BIOMES.PLAINS) { treeChance = 0.002; treeType = 'OAK'; }
                else if (biome === BIOMES.SNOWY) { treeChance = 0.02; treeType = 'SPRUCE'; }
                else if (biome === BIOMES.MOUNTAIN) { treeChance = 0.005; treeType = 'SPRUCE'; }
                else if (biome === BIOMES.JUNGLE) { treeChance = 0.12; treeType = 'JUNGLE'; }
                else if (biome === BIOMES.SAVANNA) { treeChance = 0.005; treeType = 'ACACIA'; }
            }

            if (r < treeChance && treeType) {
                placeTree(x, h + 1, z, treeType);
            }

            if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
                 const idxAbove = getIndex(x, h + 1, z);
                 if (chunkBuffer[idxAbove] !== BLOCKS.AIR) continue;

                 if (biome === BIOMES.DESERT || biome === BIOMES.MESA) {
                     if (r > 0.98) {
                         const ch = 2 + Math.floor((r * 100) % 3);
                         for(let k=0; k<ch; k++) safeSetBlock(x, h+1+k, z, BLOCKS.CACTUS);
                     } else if (r > 0.95) {
                         safeSetBlock(x, h+1, z, BLOCKS.DEAD_BUSH);
                     }
                 }
                 else if (biome === BIOMES.JUNGLE) {
                     if (r > 0.99) safeSetBlock(x, h+1, z, BLOCKS.MELON);
                     else if (r > 0.98) safeSetBlock(x, h+1, z, BLOCKS.BLUE_ORCHID);
                     else if (r > 0.7) safeSetBlock(x, h+1, z, BLOCKS.TALL_GRASS); 
                 }
                 else if (biome === BIOMES.FOREST || biome === BIOMES.PLAINS) {
                     if (r > 0.90) {
                         if (r > 0.98) safeSetBlock(x, h+1, z, BLOCKS.TULIP_RED);
                         else if (r > 0.96) safeSetBlock(x, h+1, z, BLOCKS.TULIP_ORANGE);
                         else if (r > 0.94) safeSetBlock(x, h+1, z, BLOCKS.FLOWER_YELLOW);
                         else if (r > 0.92) safeSetBlock(x, h+1, z, BLOCKS.TALL_GRASS);
                     }
                 }
            }
        }
    }

    const finalHeightMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const finalTopLayer = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    const isIgnoredForMap = (id) => {
        return (
            id === BLOCKS.AIR ||
            // Leaves
            id === BLOCKS.OAK_LEAVES || id === BLOCKS.BIRCH_LEAVES || id === BLOCKS.SPRUCE_LEAVES || 
            id === BLOCKS.JUNGLE_LEAVES || id === BLOCKS.ACACIA_LEAVES ||
            // Logs
            id === BLOCKS.OAK_LOG || id === BLOCKS.BIRCH_LOG || id === BLOCKS.SPRUCE_LOG || 
            id === BLOCKS.JUNGLE_LOG || id === BLOCKS.ACACIA_LOG ||
            // Flora & Decoration
            id === BLOCKS.TALL_GRASS || id === BLOCKS.FLOWER_YELLOW || id === BLOCKS.FLOWER_RED ||
            id === BLOCKS.CACTUS || id === BLOCKS.DEAD_BUSH || 
            (id >= BLOCKS.TULIP_RED && id <= BLOCKS.CORNFLOWER) || 
            id === BLOCKS.MELON || id === BLOCKS.BLUE_ORCHID || id === BLOCKS.SEAGRASS || id === BLOCKS.SEA_LANTERN
        );
    };

    for (let x=0; x<CHUNK_SIZE; x++) {
       for (let z=0; z<CHUNK_SIZE; z++) {
           let y = WORLD_HEIGHT - 1;
           // Optimize down scan by skipping foliage/trees to provide a clean terrain surface
           while(y > 0 && isIgnoredForMap(chunkBuffer[getIndex(x,y,z)])) {
               y--;
           }
           finalHeightMap[x*CHUNK_SIZE+z] = y;
           finalTopLayer[x*CHUNK_SIZE+z] = chunkBuffer[getIndex(x,y,z)];
       }
    }

    let domB = 'plain';
    if (biomeCounts[BIOMES.OCEAN] > 50) domB = 'ocean';
    else if (biomeCounts[BIOMES.DESERT] > 50) domB = 'desert';
    else if (biomeCounts[BIOMES.MESA] > 50) domB = 'desert'; 
    else if (biomeCounts[BIOMES.SNOWY] > 50) domB = 'mountain';
    else if (biomeCounts[BIOMES.FOREST] > 50) domB = 'forest';
    else if (biomeCounts[BIOMES.JUNGLE] > 50) domB = 'forest';
    else if (biomeCounts[BIOMES.MOUNTAIN] > 50) domB = 'mountain';

    const avgH = Math.floor(totalHeight / (CHUNK_SIZE * CHUNK_SIZE));

    return {
        data: chunkBuffer,
        heightMap: finalHeightMap,
        topLayer: finalTopLayer,
        averageHeight: avgH,
        biome: domB,
        trees
    };
}

function computeChunkMesh(ctx, chunkData, neighbors) {
    const { 
        CHUNK_SIZE, WORLD_HEIGHT, BLOCK_DEFINITIONS, TEXTURE_ATLAS_SIZE, ROTATABLE_SIDES_LIST, AO_INTENSITY, BLOCKS 
    } = ctx;

    const LEAF_IDS = new Set([
        BLOCKS.OAK_LEAVES, 
        BLOCKS.BIRCH_LEAVES, 
        BLOCKS.SPRUCE_LEAVES, 
        BLOCKS.ACACIA_LEAVES,
        BLOCKS.JUNGLE_LEAVES
    ]);

    const ROTATABLE_SIDES = new Set(ROTATABLE_SIDES_LIST);

    const opaque = { positions: [], normals: [], uvs: [], indices: [], colors: [] };
    let opaqueCount = 0;
    const foliage = { positions: [], normals: [], uvs: [], indices: [], colors: [] };
    let foliageCount = 0;
    const water = { positions: [], normals: [], uvs: [], indices: [], colors: [] };
    let waterCount = 0;

    const uW = 1 / TEXTURE_ATLAS_SIZE;
    const vH = 1.0;
    const { nx, px, nz, pz } = neighbors;

    const getBlock = (cx, cy, cz) => {
        if (cy < 0 || cy >= WORLD_HEIGHT) return 0; 
        if (cx >= 0 && cx < CHUNK_SIZE && cz >= 0 && cz < CHUNK_SIZE) {
            return chunkData[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz];
        }
        if (cx < 0) return nx ? nx[((cx + CHUNK_SIZE) * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz] : 0;
        if (cx >= CHUNK_SIZE) return px ? px[((cx - CHUNK_SIZE) * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz] : 0;
        if (cz < 0) return nz ? nz[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + (cz + CHUNK_SIZE)] : 0;
        if (cz >= CHUNK_SIZE) return pz ? pz[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + (cz - CHUNK_SIZE)] : 0;
        return 0;
    };

    const getBlockDef = (id) => BLOCK_DEFINITIONS[id] || BLOCK_DEFINITIONS[0];

    const getUVOffset = (type, normal) => {
       const def = getBlockDef(type);
       if (!def) return [0,0];
       const ny = normal[1];
       let idx = def.textures.side;
       if (ny > 0.5) idx = def.textures.top;
       if (ny < -0.5) idx = def.textures.bottom;
       return [idx / TEXTURE_ATLAS_SIZE, 0];
    };

    const isSolidForAO = (bx, by, bz) => {
        const t = getBlock(bx, by, bz);
        const def = getBlockDef(t);
        return def.isSolid && !def.isTransparent; 
    };

    const computeAO = (x, y, z, normal) => {
        const nx = normal[0], ny = normal[1], nz = normal[2];
        const px = x + nx; const py = y + ny; const pz = z + nz;
        const aoValues = [0,0,0,0]; 
        const vertexAO = (s1, s2, c) => {
            if (s1 && s2) return 3; 
            return (s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0);
        };

        if (ny > 0) { 
            const nN = isSolidForAO(px, py, pz-1); 
            const nS = isSolidForAO(px, py, pz+1); 
            const nW = isSolidForAO(px-1, py, pz); 
            const nE = isSolidForAO(px+1, py, pz); 
            const nNW = isSolidForAO(px-1, py, pz-1);
            const nNE = isSolidForAO(px+1, py, pz-1);
            const nSW = isSolidForAO(px-1, py, pz+1);
            const nSE = isSolidForAO(px+1, py, pz+1);
            aoValues[0] = vertexAO(nW, nS, nSW);
            aoValues[1] = vertexAO(nE, nS, nSE);
            aoValues[2] = vertexAO(nW, nN, nNW);
            aoValues[3] = vertexAO(nE, nN, nNE);
        } 
        else if (nz > 0) { 
           const nU = isSolidForAO(px, py+1, pz);
           const nD = isSolidForAO(px, py-1, pz);
           const nL = isSolidForAO(px-1, py, pz);
           const nR = isSolidForAO(px+1, py, pz);
           const nLU = isSolidForAO(px-1, py+1, pz);
           const nRU = isSolidForAO(px+1, py+1, pz);
           const nLD = isSolidForAO(px-1, py-1, pz);
           const nRD = isSolidForAO(px+1, py-1, pz);
           aoValues[0] = vertexAO(nL, nU, nLU); 
           aoValues[1] = vertexAO(nR, nU, nRU); 
           aoValues[2] = vertexAO(nL, nD, nLD); 
           aoValues[3] = vertexAO(nR, nD, nRD); 
        }
        else {
             const nU = isSolidForAO(px, py+1, pz);
             const nD = isSolidForAO(px, py-1, pz);
             const aoTop = nU ? 1 : 0;
             const aoBot = nD ? 1 : 0;
             aoValues[0] = aoTop; aoValues[1] = aoTop;
             aoValues[2] = aoBot; aoValues[3] = aoBot;
        }
        return aoValues.map(idx => AO_INTENSITY[idx]);
    };

    const addQuad = (targetType, pos, corners, norm, uStart, vStart, calcAo = true, rotation = 0) => {
        const target = targetType === 'opaque' ? opaque : (targetType === 'water' ? water : foliage);
        const baseIndex = targetType === 'opaque' ? opaqueCount : (targetType === 'water' ? waterCount : foliageCount);
        
        let aos = [1,1,1,1];
        if (calcAo && targetType === 'opaque') {
            aos = computeAO(pos[0], pos[1], pos[2], norm);
        }

        for (let i = 0; i < 4; i++) {
            const x = pos[0] + corners[i][0];
            const y = pos[1] + corners[i][1];
            const z = pos[2] + corners[i][2];
            target.positions.push(x, y, z);
            target.normals.push(norm[0], norm[1], norm[2]);
            if (targetType !== 'water') {
                const brightness = aos[i];
                target.colors.push(brightness, brightness, brightness);
            }
        }

        const u0 = uStart + 0.001;
        const u1 = uStart + uW - 0.001;
        const v0 = vStart;
        const v1 = vStart + vH;
        
        const perms = [[0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0], [1, 3, 0, 2]];
        const p = perms[rotation % 4];
        const uvSet = [u0, v0, u1, v0, u0, v1, u1, v1];

        target.uvs.push(
            uvSet[p[0]*2], uvSet[p[0]*2+1], 
            uvSet[p[1]*2], uvSet[p[1]*2+1], 
            uvSet[p[2]*2], uvSet[p[2]*2+1], 
            uvSet[p[3]*2], uvSet[p[3]*2+1]
        );
        target.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 1, baseIndex + 3, baseIndex + 2);
        if (targetType === 'opaque') opaqueCount += 4;
        else if (targetType === 'water') waterCount += 4;
        else foliageCount += 4;
    };
    
    const addCross = (x, y, z, uStart, vStart, scale = 1.0) => {
        const u0 = uStart + 0.001;
        const u1 = uStart + uW - 0.001;
        const v0 = vStart;
        const v1 = vStart + vH;
        const ao = 1.0; 
        const offset = (scale - 1.0) / 2;
        const min = -offset;
        const max = 1 + offset;

        foliage.positions.push(
            x + min, y + min, z + min, x + max, y + min, z + max, x + min, y + max, z + min, x + max, y + max, z + max
        );
        foliage.normals.push(0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7);
        foliage.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        foliage.colors.push(ao,ao,ao, ao,ao,ao, ao,ao,ao, ao,ao,ao);
        foliage.indices.push(foliageCount, foliageCount+1, foliageCount+2, foliageCount+1, foliageCount+3, foliageCount+2);
        foliageCount += 4;

        foliage.positions.push(
            x + min, y + min, z + max, x + max, y + min, z + min, x + min, y + max, z + max, x + max, y + max, z + min
        );
        foliage.normals.push(-0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7);
        foliage.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        foliage.colors.push(ao,ao,ao, ao,ao,ao, ao,ao,ao, ao,ao,ao);
        foliage.indices.push(foliageCount, foliageCount+1, foliageCount+2, foliageCount+1, foliageCount+3, foliageCount+2);
        foliageCount += 4;
    };

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const type = chunkData[(x * WORLD_HEIGHT + y) * CHUNK_SIZE + z];
                if (type === 0) continue; 
                
                const typeDef = getBlockDef(type);
                const isSeagrass = type === 34; 
                
                if (LEAF_IDS.has(type)) {
                    const [u, v] = getUVOffset(type, [1, 0, 0]); 
                    addCross(x, y, z, u, v, 1.3);
                }
                if (typeDef.isSprite) {
                    const [u, v] = getUVOffset(type, [0, 1, 0]);
                    addCross(x, y, z, u, v, 1.0);
                    if (!isSeagrass) continue;
                }

                const isBlockWater = type === 6 || isSeagrass; 
                const volumeType = isBlockWater ? 6 : type;
                const isBlockFoliage = typeDef.isTransparent && !isBlockWater && !isSeagrass;
                const targetType = isBlockWater ? 'water' : (isBlockFoliage ? 'foliage' : 'opaque');

                const isFaceVisible = (dx, dy, dz) => {
                    const t = getBlock(x + dx, y + dy, z + dz);
                    const tDef = getBlockDef(t);
                    const tIsWater = t === 6 || t === 34; 
                    if (t === 0) return true;
                    if (isBlockWater) {
                         if (tIsWater) return false;
                         if (tDef.isSolid && !tDef.isTransparent) return false; 
                         return true;
                    }
                    if (tIsWater) return true; 
                    if (tDef.isTransparent && !isBlockFoliage) return true;
                    if (tDef.isSprite) return true; 
                    if (!tDef.isSolid) return true;
                    if (isBlockFoliage && t === type) return false; 
                    return false;
                };

                const [uTop, vTop] = getUVOffset(volumeType, [0, 1, 0]);
                const [uBot, vBot] = getUVOffset(volumeType, [0, -1, 0]);
                const [uSide, vSide] = getUVOffset(volumeType, [1, 0, 0]);
                const rotTop = (x * 13 ^ z * 23) & 3;
                const rotSide = (x * 17 ^ y * 29 ^ z * 7) & 3;
                const canRotateSide = ROTATABLE_SIDES.has(volumeType);
                const effectiveSideRot = canRotateSide ? rotSide : 0;

                if (isFaceVisible(0, 1, 0)) {
                    const wh = isBlockWater ? 0.8 : 1;
                    addQuad(targetType, [x, y, z], [[0, wh, 1], [1, wh, 1], [0, wh, 0], [1, wh, 0]], [0, 1, 0], uTop, vTop, true, rotTop);
                }
                if (isFaceVisible(0, -1, 0)) addQuad(targetType, [x, y, z], [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]], [0, -1, 0], uBot, vBot, true, rotTop);
                if (isFaceVisible(0, 0, 1)) addQuad(targetType, [x, y, z], [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], [0, 0, 1], uSide, vSide, true, effectiveSideRot);
                if (isFaceVisible(0, 0, -1)) addQuad(targetType, [x, y, z], [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, -1], uSide, vSide, true, effectiveSideRot);
                if (isFaceVisible(1, 0, 0)) addQuad(targetType, [x, y, z], [[1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0]], [1, 0, 0], uSide, vSide, true, effectiveSideRot);
                if (isFaceVisible(-1, 0, 0)) addQuad(targetType, [x, y, z], [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]], [-1, 0, 0], uSide, vSide, true, effectiveSideRot);
            }
        }
    }
    
    const toBuffers = (obj) => {
        return {
            positions: new Float32Array(obj.positions),
            normals: new Float32Array(obj.normals),
            uvs: new Float32Array(obj.uvs),
            indices: new Uint32Array(obj.indices),
            colors: new Float32Array(obj.colors)
        };
    };

    return {
        opaque: toBuffers(opaque),
        foliage: toBuffers(foliage),
        water: toBuffers(water)
    };
}

// --- WORKER MAIN ---
let BLOCK_DEFINITIONS = {};
let BLOCKS = {};
let TEXTURE_ATLAS_SIZE = 64;
const ROTATABLE_SIDES_LIST = [1,3,7,20,8,9,5,14,16,27,29,30,6,36]; 
const AO_INTENSITY = [1.0, 0.85, 0.65, 0.45];
let noise = null;

self.onmessage = function(e) {
    const msg = e.data;
    if (msg.type === 'INIT') {
        BLOCKS = msg.blocks;
        TEXTURE_ATLAS_SIZE = msg.atlasSize;
        const defs = msg.blockDefs;
        defs.forEach(d => BLOCK_DEFINITIONS[d.id] = d);
        if(!BLOCK_DEFINITIONS[0]) BLOCK_DEFINITIONS[0] = { textures: {side:0, top:0, bottom:0}, isSolid: false };
    }
    else if (msg.type === 'GENERATE') {
        const { cx, cz, seed } = msg;
        if (!noise) noise = new SimplexNoise(seed);
        
        const ctx = {
            CHUNK_SIZE: 16,
            WORLD_HEIGHT: 384,
            WATER_LEVEL: 64,
            SEED: seed,
            BLOCKS: BLOCKS,
            BIOMES: BIOMES,
            noise: noise,
            getTerrainInfo: getTerrainInfo,
            hash: hash
        };
        
        const result = computeChunk(ctx, cx, cz);

        const transfer = [
            result.data.buffer, 
            result.heightMap.buffer, 
            result.topLayer.buffer
        ];

        self.postMessage({
            type: 'CHUNK',
            chunk: {
                id: cx + ',' + cz,
                x: cx,
                z: cz,
                data: result.data,
                heightMap: result.heightMap,
                topLayer: result.topLayer,
                averageHeight: result.averageHeight,
                biome: result.biome,
                isDirty: false,
                trees: result.trees
            }
        }, transfer);
    }
    else if (msg.type === 'MESH') {
         const { chunkData, neighbors, reqId } = msg;
         const ctx = {
            CHUNK_SIZE: 16,
            WORLD_HEIGHT: 384,
            BLOCK_DEFINITIONS: BLOCK_DEFINITIONS,
            TEXTURE_ATLAS_SIZE: TEXTURE_ATLAS_SIZE,
            ROTATABLE_SIDES_LIST: ROTATABLE_SIDES_LIST,
            AO_INTENSITY: AO_INTENSITY,
            BLOCKS: BLOCKS
        };
        const mesh = computeChunkMesh(ctx, chunkData, neighbors);
        
         const buffers = [];
         const add = (geo) => {
             if (geo.positions.buffer) buffers.push(geo.positions.buffer);
             if (geo.normals.buffer) buffers.push(geo.normals.buffer);
             if (geo.uvs.buffer) buffers.push(geo.uvs.buffer);
             if (geo.indices.buffer) buffers.push(geo.indices.buffer);
             if (geo.colors.buffer) buffers.push(geo.colors.buffer);
         };
         add(mesh.opaque);
         add(mesh.foliage);
         add(mesh.water);

        self.postMessage({
            type: 'MESH',
            reqId,
            mesh
        }, buffers);
    }
};
`;

export class ChunkLoader {
  private worker: Worker | null = null;
  private onChunkLoaded: (chunk: ChunkData) => void;
  private meshCallbacks: Map<number, (data: any) => void>;
  private reqIdCounter: number;
  private seed: number;

  constructor(seed: number, onChunkLoaded: (chunk: ChunkData) => void) {
    this.seed = seed;
    this.onChunkLoaded = onChunkLoaded;
    this.meshCallbacks = new Map();
    this.reqIdCounter = 0;

    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    // Create Worker from Blob
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    this.worker = new Worker(url);
    
    // Initialize the worker with static data
    this.worker.postMessage({
        type: 'INIT',
        blocks: BlockType,
        blockDefs: getAllBlocks(),
        atlasSize: TEXTURE_ATLAS_SIZE
    });

    this.worker.onmessage = (e: MessageEvent) => {
       const msg = e.data;
       if (msg.type === 'CHUNK') {
           const chunk = msg.chunk;
           chunk.data = new Uint8Array(chunk.data);
           chunk.heightMap = new Int16Array(chunk.heightMap);
           chunk.topLayer = new Uint8Array(chunk.topLayer);
           this.onChunkLoaded(chunk);
       } else if (msg.type === 'MESH') {
           const cb = this.meshCallbacks.get(msg.reqId);
           if (cb) {
               this.meshCallbacks.delete(msg.reqId);
               cb(msg.mesh);
           }
       }
    };

    this.worker.onerror = (e) => {
        console.error("Worker Error:", e);
    };
  }

  requestChunk(cx: number, cz: number) {
    if (this.worker) {
        this.worker.postMessage({ type: 'GENERATE', cx, cz, seed: this.seed });
    }
  }

  requestMesh(chunk: ChunkData, neighbors: any): Promise<any> {
      return new Promise((resolve) => {
          if (!this.worker) return; 

          const reqId = this.reqIdCounter++;
          this.meshCallbacks.set(reqId, resolve);

          const nData = {
              nx: neighbors.nx?.data,
              px: neighbors.px?.data,
              nz: neighbors.nz?.data,
              pz: neighbors.pz?.data,
          };

          this.worker.postMessage({
              type: 'MESH',
              reqId,
              chunkData: chunk.data,
              neighbors: nData
          });
      });
  }

  terminate() {
    if (this.worker) {
        this.worker.terminate();
    }
  }
}