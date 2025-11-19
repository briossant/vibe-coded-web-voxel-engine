

import { ChunkData } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } from '../constants';

// Worker code must be self-contained. 
// We redefine constants inside the string to avoid string interpolation issues with large objects.
const GET_WORKER_CODE = (seed: number) => `
const CHUNK_SIZE = ${CHUNK_SIZE};
const WORLD_HEIGHT = ${WORLD_HEIGHT};
const WATER_LEVEL = ${WATER_LEVEL};

// --- NOISE UTILS ---
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

function hash(x, z) {
    let h = 0xdeadbeef;
    h = Math.imul(h ^ x, 0x85ebca6b);
    h = Math.imul(h ^ z, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

class SimplexNoise {
  constructor(seed = 12345) {
    const random = mulberry32(seed);
    this.p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) { this.p[i] = i; }
    for (let i = 255; i > 0; i--) {
      const r = Math.floor(random() * (i + 1));
      const t = this.p[i]; this.p[i] = this.p[r]; this.p[r] = t;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
    this.grad3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
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
}

// --- CONSTANTS ---
const AIR = 0;
const DIRT = 1;
const GRASS = 2;
const STONE = 3;
const LOG = 4;
const LEAVES = 5;
const WATER = 6;
const SAND = 7;
const BEDROCK = 8;
const SNOW = 9;
const TALL_GRASS = 10;
const FLOWER_YELLOW = 11;
const FLOWER_RED = 12;
const BIRCH_LOG = 13;
const BIRCH_LEAVES = 14;
const SPRUCE_LOG = 15;
const SPRUCE_LEAVES = 16;
const CACTUS = 17;
const DEAD_BUSH = 18;
const SANDSTONE = 19;
const GRAVEL = 20;
const TULIP_RED = 21;
const TULIP_ORANGE = 22;
const TULIP_WHITE = 23;
const TULIP_PINK = 24;
const CORNFLOWER = 25;

// Biomes
const B_OCEAN = 0;
const B_BEACH = 1;
const B_PLAIN = 2;
const B_FOREST = 3;
const B_DESERT = 4;
const B_SNOWY = 5;
const B_MOUNTAIN = 6;

const noise = new SimplexNoise(${seed});

const getIndex = (x, y, z) => (x * WORLD_HEIGHT + y) * CHUNK_SIZE + z;

function getTerrainInfo(wx, wz) {
    const continentalness = noise.fbm(wx * 0.002, wz * 0.002, 2); 
    const erosion = Math.abs(noise.fbm(wx * 0.005, wz * 0.005, 2));
    const pv = noise.noise2D(wx * 0.03, wz * 0.03);
    const temperature = noise.fbm(wx * 0.002, wz * 0.002, 2); 
    const humidity = noise.fbm((wx + 500) * 0.002, (wz + 500) * 0.002, 2); 

    let h = WATER_LEVEL;
    h += continentalness * 40;

    const mountainBase = Math.max(0, continentalness + 0.1); 
    const mountainFactor = erosion * erosion * erosion; 
    
    h += mountainBase * mountainFactor * 100;
    h += pv * 3;

    const height = Math.floor(Math.max(2, Math.min(WORLD_HEIGHT - 3, h)));

    let biome = B_PLAIN;
    if (height < WATER_LEVEL - 2) {
        biome = B_OCEAN;
    } else if (height <= WATER_LEVEL + 1) {
        if (temperature > 0.5) biome = B_DESERT;
        else biome = B_BEACH;
    } else if (height > 85) {
        if (temperature > 0.5) biome = B_MOUNTAIN;
        else biome = B_SNOWY;
    } else {
        if (temperature > 0.4) {
            if (humidity < -0.2) biome = B_DESERT;
            else biome = B_FOREST;
        } else if (temperature < -0.3) {
            biome = B_SNOWY;
        } else {
            if (humidity > 0.1) biome = B_FOREST;
            else biome = B_PLAIN;
        }
    }
    return { h: height, biome };
}

self.onmessage = function(e) {
    const { cx, cz } = e.data;
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;
    
    const chunkBuffer = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const heightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const trees = []; // Store tree instances {x, y, z, type}
    
    chunkBuffer.fill(AIR);
    let totalHeight = 0;
    const biomeCounts = {};

    // 1. Terrain Pass
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = worldX + x;
            const wz = worldZ + z;

            const { h: groundHeight, biome } = getTerrainInfo(wx, wz);

            heightMap[x * CHUNK_SIZE + z] = groundHeight;
            totalHeight += groundHeight;
            biomeMap[x * CHUNK_SIZE + z] = biome;
            biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;

            for (let y = 0; y < WORLD_HEIGHT; y++) {
                const idx = getIndex(x, y, z);

                if (y === 0) {
                    chunkBuffer[idx] = BEDROCK;
                    continue;
                }

                if (y <= groundHeight) {
                    let block = STONE;
                    if (y === groundHeight) {
                         switch(biome) {
                            case B_OCEAN: block = SAND; break;
                            case B_BEACH: block = SAND; break;
                            case B_DESERT: block = SAND; break;
                            case B_SNOWY: block = SNOW; break;
                            case B_MOUNTAIN: block = STONE; break;
                            case B_FOREST: block = GRASS; break;
                            default: block = GRASS; break;
                        }
                    } else if (y > groundHeight - 4) {
                        if (biome === B_DESERT || biome === B_BEACH) block = (biome === B_DESERT) ? SANDSTONE : SAND;
                        else if (biome === B_SNOWY) block = STONE;
                        else block = DIRT;
                    }

                    if (y < groundHeight - 4 && y > 4) {
                         const cave = noise.noise2D(wx * 0.05, y * 0.05) + noise.noise2D(wz * 0.05, y * 0.05);
                         if (cave > 1.4) block = AIR;
                    }

                    if (block !== AIR) chunkBuffer[idx] = block;
                } else if (y <= WATER_LEVEL) {
                    chunkBuffer[idx] = WATER;
                }
            }
        }
    }

    function safeSetBlock(x, y, z, block) {
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) {
            const idx = getIndex(x, y, z);
            const current = chunkBuffer[idx];
            
            if (block === LEAVES || block === BIRCH_LEAVES || block === SPRUCE_LEAVES) {
                 if (current === AIR) chunkBuffer[idx] = block;
            } else {
                if (current !== BEDROCK) chunkBuffer[idx] = block;
            }
        }
    }

    function placeTree(x, y, z, type) {
        let h = 5;
        let log = LOG;
        let leaves = LEAVES;
        let typeIdx = 0; // OAK

        if (type === 'BIRCH') { h = 6; log = BIRCH_LOG; leaves = BIRCH_LEAVES; typeIdx = 1; }
        if (type === 'SPRUCE') { h = 7; log = SPRUCE_LOG; leaves = SPRUCE_LEAVES; typeIdx = 2; }

        // Record tree instance if the root is within this chunk's bounds
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
            trees.push({ x, y, z, type: typeIdx });
        }

        for (let i = 0; i < h; i++) {
            safeSetBlock(x, y + i, z, log);
        }

        if (type === 'SPRUCE') {
             for(let i=2; i<h; i++) {
                 const r = Math.floor((h-i)*0.4) + 1;
                 placeLeafLayer(x, y+i, z, r, leaves);
             }
             placeLeafLayer(x, y+h, z, 1, leaves);
        } else {
            placeLeafLayer(x, y+h-2, z, 2, leaves);
            placeLeafLayer(x, y+h-1, z, 2, leaves);
            placeLeafLayer(x, y+h, z, 1, leaves);
            placeLeafLayer(x, y+h+1, z, 1, leaves);
        }
    }

    function placeLeafLayer(cx, cy, cz, r, type) {
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                if (Math.abs(i) === r && Math.abs(j) === r && r > 1) continue; 
                safeSetBlock(cx + i, cy, cz + j, type);
            }
        }
    }

    // 2. Tree Pass (Extended Bounds)
    const TREE_MARGIN = 3;
    for (let x = -TREE_MARGIN; x < CHUNK_SIZE + TREE_MARGIN; x++) {
        for (let z = -TREE_MARGIN; z < CHUNK_SIZE + TREE_MARGIN; z++) {
            const wx = worldX + x;
            const wz = worldZ + z;
            
            let h, biome;
            
            // Use cached data if available
            if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
                h = heightMap[x * CHUNK_SIZE + z];
                biome = biomeMap[x * CHUNK_SIZE + z];
            } else {
                const info = getTerrainInfo(wx, wz);
                h = info.h;
                biome = info.biome;
            }

            if (h <= WATER_LEVEL || h >= WORLD_HEIGHT - 8) continue;

            // Valid surface check (approximate for neighbors based on biome)
            let validSurface = (biome === B_PLAIN || biome === B_FOREST || biome === B_SNOWY);
            if (!validSurface) continue;

            const r = hash(wx, wz); 
            let treeType = null;
            let treeChance = 0;

            if (biome === B_FOREST) { treeChance = 0.05; treeType = 'OAK'; if (r > 0.6) treeType = 'BIRCH'; }
            else if (biome === B_PLAIN) { treeChance = 0.003; treeType = 'OAK'; }
            else if (biome === B_SNOWY) { treeChance = 0.02; treeType = 'SPRUCE'; }

            if (r < treeChance && treeType) {
                placeTree(x, h + 1, z, treeType);
            } 
        }
    }

    // 3. Small Vegetation Pass (Internal Only)
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = worldX + x;
            const wz = worldZ + z;
            const h = heightMap[x * CHUNK_SIZE + z];
            const biome = biomeMap[x * CHUNK_SIZE + z];
            
            if (h <= WATER_LEVEL || h >= WORLD_HEIGHT - 8) continue;
            
            const idxSurface = getIndex(x, h, z);
            const surface = chunkBuffer[idxSurface];
            
            if (surface === AIR || surface === WATER || surface === BEDROCK) continue;

            const r = hash(wx, wz); 

            if (surface === GRASS || surface === SNOW || surface === DIRT) {
                 if (r < 0.2 && chunkBuffer[getIndex(x, h + 1, z)] === AIR) {
                     const idxAbove = getIndex(x, h + 1, z);
                     if (biome === B_FOREST || biome === B_PLAIN) {
                         if (r < 0.02) chunkBuffer[idxAbove] = FLOWER_YELLOW;
                         else if (r < 0.04) chunkBuffer[idxAbove] = FLOWER_RED;
                         else if (r < 0.05) chunkBuffer[idxAbove] = TULIP_PINK;
                         else if (r < 0.10) chunkBuffer[idxAbove] = TALL_GRASS;
                     }
                }
            }
            else if (surface === SAND && biome === B_DESERT) {
                if (r < 0.01) {
                    const ch = 2 + Math.floor(r * 100) % 3;
                    for(let k=0; k<ch; k++) {
                        if (h+1+k < WORLD_HEIGHT) chunkBuffer[getIndex(x, h+1+k, z)] = CACTUS;
                    }
                } else if (r < 0.04) {
                    if (h+1 < WORLD_HEIGHT) chunkBuffer[getIndex(x, h+1, z)] = DEAD_BUSH;
                }
            }
        }
    }

    let maxC = 0;
    let domB = 'plain';
    for(const [b, c] of Object.entries(biomeCounts)) {
        if (c > maxC) {
            maxC = c;
            const bi = parseInt(b);
            if (bi === B_OCEAN) domB = 'ocean';
            else if (bi === B_DESERT) domB = 'desert';
            else if (bi === B_SNOWY) domB = 'mountain'; 
            else if (bi === B_MOUNTAIN) domB = 'mountain';
            else if (bi === B_FOREST) domB = 'forest';
        }
    }

    const avgH = Math.floor(totalHeight / (CHUNK_SIZE * CHUNK_SIZE));

    self.postMessage({
        id: cx + ',' + cz,
        x: cx,
        z: cz,
        data: chunkBuffer,
        averageHeight: avgH,
        biome: domB,
        isDirty: false,
        trees: trees
    }, [chunkBuffer.buffer]);
};
`;

export class ChunkLoader {
  private worker: Worker;
  private onChunkLoaded: (chunk: ChunkData) => void;

  constructor(seed: number, onChunkLoaded: (chunk: ChunkData) => void) {
    this.onChunkLoaded = onChunkLoaded;
    const code = GET_WORKER_CODE(seed);
    const blob = new Blob([code], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = (e: MessageEvent) => {
       const chunk = e.data as ChunkData;
       // Ensure data is typed correctly from worker transfer
       // When transferred, it arrives as Uint8Array if typed array was transferred
       chunk.data = new Uint8Array(chunk.data); 
       this.onChunkLoaded(chunk);
    };
  }

  requestChunk(cx: number, cz: number) {
    this.worker.postMessage({ cx, cz });
  }

  terminate() {
    this.worker.terminate();
  }
}
