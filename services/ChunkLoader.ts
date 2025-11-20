
import { ChunkData } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } from '../constants';

// Worker code must be self-contained. 
// We redefine constants inside the string to avoid string interpolation issues with large objects.
const GET_WORKER_CODE = (seed: number) => `
const CHUNK_SIZE = ${CHUNK_SIZE};
const WORLD_HEIGHT = ${WORLD_HEIGHT};
const WATER_LEVEL = ${WATER_LEVEL};
const SEED = ${seed};

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

// Updated hash function to include SEED for unique object placement
function hash(x, z) {
    let h = 0xdeadbeef;
    h = Math.imul(h ^ x, 0x85ebca6b);
    h = Math.imul(h ^ z, 0xc2b2ae35);
    h = Math.imul(h ^ SEED, 0x12345678); // Mix in seed
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
const ACACIA_LOG = 26;
const ACACIA_LEAVES = 27;
const JUNGLE_LOG = 28;
const JUNGLE_LEAVES = 29;
const RED_SAND = 30;
const RED_SANDSTONE = 31;
const MELON = 32;
const BLUE_ORCHID = 33;
const SEAGRASS = 34;
const SEA_LANTERN = 35;

// Biome IDs
const B_OCEAN = 0;
const B_BEACH = 1;
const B_PLAINS = 2;
const B_FOREST = 3;
const B_DESERT = 4;
const B_SNOWY = 5;
const B_MOUNTAIN = 6;
const B_JUNGLE = 7;
const B_SAVANNA = 8;
const B_MESA = 9;
const B_RIVER = 10;

const noise = new SimplexNoise(${seed});

// Large offset to avoid 0,0 symmetry/bias in noise functions
const NOISE_OFFSET = 10000;

const getIndex = (x, y, z) => (x * WORLD_HEIGHT + y) * CHUNK_SIZE + z;

// Smooth curve function for mountains
function easeInQuart(x) {
    return x * x * x * x;
}

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

function getTerrainInfo(wx, wz) {
    // Offset input coordinates
    const nx = wx + NOISE_OFFSET;
    const nz = wz + NOISE_OFFSET;

    // 1. Continentalness: Determines Land vs Ocean
    const continentalness = noise.fbm(nx * 0.001, nz * 0.001, 2); 
    
    // 2. Erosion: Determines Flatness vs Roughness
    const erosion = noise.fbm(nx * 0.002, nz * 0.002, 2);

    // 3. Temperature & Humidity for Biomes
    const temperature = noise.fbm(nx * 0.0015, nz * 0.0015, 2); 
    const humidity = noise.fbm((nx + 5000) * 0.0015, (nz + 5000) * 0.0015, 2); 

    // 4. River Noise: 0 at rivers, 1 far away
    const riverNoise = Math.abs(noise.noise2D(nx * 0.0025, nz * 0.0025));
    const isRiver = riverNoise < 0.06;

    // Base Height Calculation
    const coastThreshold = -0.2;
    
    // Unified S-Curve for continental shelf to avoid cliffs
    const steepness = 4.0; 
    const shelfShape = Math.tanh((continentalness - coastThreshold) * steepness);
    
    let h = WATER_LEVEL + (shelfShape * 40); 

    // Apply Surface Noise (Erosion)
    const landFactor = smoothstep(-0.4, 0.0, continentalness);
    const pv = noise.fbm(nx * 0.01, nz * 0.01, 3);
    h += pv * 5;

    // Ocean Floor Detail
    if (h < WATER_LEVEL) {
        const seabedDetail = noise.noise2D(nx * 0.03, nz * 0.03);
        h += seabedDetail * 3;
    }

    // Big Mountains
    if (erosion > 0.3) {
        const mountainHeight = easeInQuart((erosion - 0.3) * 2.5);
        h += mountainHeight * 80 * landFactor;
    }

    // Carve Rivers
    if (isRiver && h > WATER_LEVEL) {
        // Smooth interpolation to river bed
        const depth = (0.06 - riverNoise) / 0.06; // 0 to 1
        h = h * (1 - depth) + (WATER_LEVEL - 2) * depth;
    }

    // Clamp
    const height = Math.floor(Math.max(2, Math.min(WORLD_HEIGHT - 3, h)));

    // Biome Determination
    let biome = B_PLAINS;

    if (height <= WATER_LEVEL) {
        biome = B_OCEAN;
        if (isRiver) biome = B_RIVER;
    } else if (height <= WATER_LEVEL + 2) {
         if (temperature > 0.5) biome = B_DESERT;
         else if (temperature > 0.0) biome = B_BEACH;
         else biome = B_SNOWY; // Frozen beach
    } else if (height > 95 && temperature < 0.5) {
        biome = B_MOUNTAIN;
    } else {
        // Land Biomes Table
        if (temperature > 0.6) {
            // HOT
            if (humidity > 0.4) biome = B_JUNGLE;
            else if (humidity > -0.2) biome = B_SAVANNA;
            else if (humidity > -0.6) biome = B_MESA;
            else biome = B_DESERT;
        } else if (temperature > 0.0) {
            // TEMPERATE
            if (humidity > 0.2) biome = B_FOREST;
            else if (humidity > -0.5) biome = B_PLAINS;
            else biome = B_SAVANNA; // Dry plains
        } else {
            // COLD
            biome = B_SNOWY;
        }
    }

    return { h: height, biome, isRiver };
}

self.onmessage = function(e) {
    const { cx, cz } = e.data;
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;
    
    const chunkBuffer = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const heightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const trees = []; // Store tree instances
    
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
                    
                    // Surface Blocks
                    if (y === groundHeight) {
                         switch(biome) {
                            case B_OCEAN: block = SAND; break;
                            case B_BEACH: block = SAND; break;
                            case B_DESERT: block = SAND; break;
                            case B_SNOWY: block = SNOW; break;
                            case B_MOUNTAIN: block = SNOW; break; // Snow caps
                            case B_FOREST: block = GRASS; break;
                            case B_JUNGLE: block = GRASS; break;
                            case B_SAVANNA: block = DIRT; break; 
                            case B_MESA: block = RED_SAND; break;
                            case B_RIVER: block = SAND; break;
                            default: block = GRASS; break;
                        }
                    } 
                    // Subsurface (Dirt/Sand layers)
                    else if (y > groundHeight - 4) {
                        if (biome === B_DESERT || biome === B_BEACH) block = SANDSTONE;
                        else if (biome === B_MESA) block = RED_SANDSTONE;
                        else if (biome === B_SNOWY || biome === B_MOUNTAIN) block = STONE;
                        else block = DIRT;
                    }
                    // Deep layers (Mesa Banding)
                    else if (biome === B_MESA && y > WATER_LEVEL) {
                        // Terracotta banding effect
                        // Offset noise here too for consistency
                        const band = (y + Math.floor(noise.noise2D((wx+NOISE_OFFSET)*0.05, (wz+NOISE_OFFSET)*0.05)*3)) % 9;
                        if (band === 0 || band === 1) block = RED_SANDSTONE; // darker
                        else if (band === 4) block = DIRT; // brown band
                        else block = RED_SAND; // normal red sand
                    }

                    // Caves
                    if (y < groundHeight - 4 && y > 4) {
                         const cave = noise.noise2D((wx+NOISE_OFFSET) * 0.06, y * 0.06) + noise.noise2D((wz+NOISE_OFFSET) * 0.06, y * 0.06);
                         if (cave > 1.3) block = AIR;
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
            
            // Don't overwrite solid blocks with leaves/logs usually, but we want trees to pierce other trees
            if (current === AIR || current === WATER || current === TALL_GRASS || current >= FLOWER_YELLOW) {
                chunkBuffer[idx] = block;
            }
        }
    }

    function placeTree(x, y, z, type) {
        let typeIdx = 0; // OAK
        
        if (type === 'BIRCH') typeIdx = 1;
        if (type === 'SPRUCE') typeIdx = 2;
        if (type === 'JUNGLE') typeIdx = 3;
        if (type === 'ACACIA') typeIdx = 4;

        // Record tree instance
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
            trees.push({ x, y, z, type: typeIdx });
        }

        if (type === 'OAK' || type === 'BIRCH') {
            const h = type === 'BIRCH' ? 6 : 5;
            const log = type === 'BIRCH' ? BIRCH_LOG : LOG;
            const leaves = type === 'BIRCH' ? BIRCH_LEAVES : LEAVES;
            for (let i = 0; i < h; i++) safeSetBlock(x, y + i, z, log);
            placeLeafLayer(x, y+h-2, z, 2, leaves);
            placeLeafLayer(x, y+h-1, z, 2, leaves);
            placeLeafLayer(x, y+h, z, 1, leaves);
            placeLeafLayer(x, y+h+1, z, 1, leaves);
        } 
        else if (type === 'SPRUCE') {
             const h = 7;
             for(let i=0; i<h; i++) safeSetBlock(x, y + i, z, SPRUCE_LOG);
             for(let i=2; i<h; i++) {
                 const r = Math.floor((h-i)*0.4) + 1;
                 placeLeafLayer(x, y+i, z, r, SPRUCE_LEAVES);
             }
             placeLeafLayer(x, y+h, z, 1, SPRUCE_LEAVES);
        }
        else if (type === 'JUNGLE') {
            const h = 10 + Math.floor(Math.random() * 5);
            for (let i = 0; i < h; i++) safeSetBlock(x, y + i, z, JUNGLE_LOG);
            placeLeafLayer(x, y+h-2, z, 3, JUNGLE_LEAVES);
            placeLeafLayer(x, y+h-1, z, 3, JUNGLE_LEAVES);
            placeLeafLayer(x, y+h, z, 2, JUNGLE_LEAVES);
            safeSetBlock(x, y+h, z, JUNGLE_LOG); // Top log
        }
        else if (type === 'ACACIA') {
            const h = 5 + Math.floor(Math.random() * 2);
            for (let i = 0; i < h; i++) safeSetBlock(x, y + i, z, ACACIA_LOG);
            
            safeSetBlock(x+1, y+h-1, z, ACACIA_LOG);
            safeSetBlock(x+2, y+h, z, ACACIA_LOG);
            placeLeafLayer(x+2, y+h+1, z, 2, ACACIA_LEAVES);

            safeSetBlock(x-1, y+h-2, z, ACACIA_LOG);
            safeSetBlock(x-2, y+h-1, z, ACACIA_LOG);
            placeLeafLayer(x-2, y+h, z, 2, ACACIA_LEAVES);
        }
    }

    function placeLeafLayer(cx, cy, cz, r, type) {
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                if (Math.abs(i) === r && Math.abs(j) === r && r > 1) {
                     if (Math.random() > 0.5) continue; // corner rounding
                }
                safeSetBlock(cx + i, cy, cz + j, type);
            }
        }
    }

    // 2. Tree & Decoration Pass
    const TREE_MARGIN = 4;
    for (let x = -TREE_MARGIN; x < CHUNK_SIZE + TREE_MARGIN; x++) {
        for (let z = -TREE_MARGIN; z < CHUNK_SIZE + TREE_MARGIN; z++) {
            const wx = worldX + x;
            const wz = worldZ + z;
            
            let h, biome;
            if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
                h = heightMap[x * CHUNK_SIZE + z];
                biome = biomeMap[x * CHUNK_SIZE + z];
            } else {
                const info = getTerrainInfo(wx, wz);
                h = info.h;
                biome = info.biome;
            }
            
            const r = hash(wx, wz); 

            // --- UNDERWATER DECORATION ---
            if (h < WATER_LEVEL - 1 && biome === B_OCEAN) {
                // Seagrass
                 if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
                     if (r > 0.8) {
                         safeSetBlock(x, h+1, z, SEAGRASS);
                     }
                     // Rare Sea Lanterns in deep water
                     if (h < WATER_LEVEL - 15 && r > 0.99) {
                         safeSetBlock(x, h+1, z, SEA_LANTERN);
                     }
                     // Gravel patches
                     if (r < 0.1) {
                         safeSetBlock(x, h, z, GRAVEL);
                     }
                 }
                 continue; // Skip trees if underwater
            }

            if (h <= WATER_LEVEL || h >= WORLD_HEIGHT - 15) continue;

            // --- TREES ---
            let treeType = null;
            let treeChance = 0;

            if (biome === B_FOREST) { treeChance = 0.08; treeType = 'OAK'; if (r > 0.7) treeType = 'BIRCH'; }
            else if (biome === B_PLAINS) { treeChance = 0.002; treeType = 'OAK'; }
            else if (biome === B_SNOWY) { treeChance = 0.02; treeType = 'SPRUCE'; }
            else if (biome === B_MOUNTAIN) { treeChance = 0.01; treeType = 'SPRUCE'; }
            else if (biome === B_JUNGLE) { treeChance = 0.15; treeType = 'JUNGLE'; }
            else if (biome === B_SAVANNA) { treeChance = 0.005; treeType = 'ACACIA'; }

            if (r < treeChance && treeType) {
                placeTree(x, h + 1, z, treeType);
            }

            // --- LAND DECORATIONS ---
            if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
                 const idxAbove = getIndex(x, h + 1, z);
                 if (chunkBuffer[idxAbove] !== AIR) continue;

                 // Cactus
                 if (biome === B_DESERT || biome === B_MESA) {
                     if (r > 0.98) {
                         const ch = 2 + Math.floor(r * 100) % 3;
                         for(let k=0; k<ch; k++) safeSetBlock(x, h+1+k, z, CACTUS);
                     } else if (r > 0.95) {
                         safeSetBlock(x, h+1, z, DEAD_BUSH);
                     }
                 }
                 // Jungle Melons
                 else if (biome === B_JUNGLE) {
                     if (r > 0.99) safeSetBlock(x, h+1, z, MELON);
                     else if (r > 0.98) safeSetBlock(x, h+1, z, BLUE_ORCHID);
                     else if (r > 0.7) safeSetBlock(x, h+1, z, TALL_GRASS); // Dense grass
                 }
                 // Flowers
                 else if (biome === B_FOREST || biome === B_PLAINS) {
                     if (r > 0.90) {
                         if (r > 0.98) safeSetBlock(x, h+1, z, TULIP_RED);
                         else if (r > 0.96) safeSetBlock(x, h+1, z, TULIP_ORANGE);
                         else if (r > 0.94) safeSetBlock(x, h+1, z, FLOWER_YELLOW);
                         else if (r > 0.92) safeSetBlock(x, h+1, z, TALL_GRASS);
                     }
                 }
            }
        }
    }

    let domB = 'plain';
    if (biomeCounts[B_OCEAN] > 50) domB = 'ocean';
    else if (biomeCounts[B_DESERT] > 50) domB = 'desert';
    else if (biomeCounts[B_MESA] > 50) domB = 'desert'; 
    else if (biomeCounts[B_SNOWY] > 50) domB = 'mountain';
    else if (biomeCounts[B_FOREST] > 50) domB = 'forest';
    else if (biomeCounts[B_JUNGLE] > 50) domB = 'forest';

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
