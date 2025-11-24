import { BlockType } from '../blocks.js';

// We define the context that will be passed to the worker function.
// This allows TypeScript to check types while we still serialize the function for the worker.
export interface GenerationContext {
    CHUNK_SIZE: number;
    WORLD_HEIGHT: number;
    WATER_LEVEL: number;
    SEED: number;
    BLOCKS: typeof BlockType;
    BIOMES: { [key: string]: number };
    
    // Mesh Context
    BLOCK_DEFINITIONS: any;
    TEXTURE_ATLAS_SIZE: number;
    AO_INTENSITY: number[];
    ROTATABLE_SIDES_LIST: number[];

    // Functions injected from TerrainMath
    getTerrainInfo: (wx: number, wz: number, noise: any, wl: number, wh: number) => { h: number, biome: number, isRiver: boolean };
    noise: any; // SimplexNoise instance
    hash: (x: number, z: number, seed: number) => number;
}

// This function contains the entire logic for generating a single chunk.
// It is pure (mostly) and relies on the passed context for constants and helpers.
export function computeChunk(ctx: GenerationContext, cx: number, cz: number) {
    const { 
        CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, SEED, 
        BLOCKS, BIOMES, noise, getTerrainInfo, hash 
    } = ctx;

    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;
    
    const chunkBuffer = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const heightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const trees: { x: number, y: number, z: number, type: number }[] = [];
    
    chunkBuffer.fill(BLOCKS.AIR);
    
    let totalHeight = 0;
    const biomeCounts: Record<number, number> = {};

    const getIndex = (x: number, y: number, z: number) => (x * WORLD_HEIGHT + y) * CHUNK_SIZE + z;

    // 3D Hash Helper
    const hash3 = (x: number, y: number, z: number) => hash(x + y * 31, z, SEED);

    function safeSetBlock(x: number, y: number, z: number, block: number) {
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) {
            const idx = getIndex(x, y, z);
            const current = chunkBuffer[idx];
            
            const isCurrentFoliage = current === BLOCKS.WATER || current === BLOCKS.TALL_GRASS || (current >= BLOCKS.FLOWER_YELLOW && current <= BLOCKS.SEAGRASS) || 
                                     current === BLOCKS.OAK_LEAVES || current === BLOCKS.BIRCH_LEAVES || current === BLOCKS.SPRUCE_LEAVES || 
                                     current === BLOCKS.JUNGLE_LEAVES || current === BLOCKS.ACACIA_LEAVES;
            
            const isNewLog = block === BLOCKS.OAK_LOG || block === BLOCKS.BIRCH_LOG || block === BLOCKS.SPRUCE_LOG || 
                             block === BLOCKS.ACACIA_LOG || block === BLOCKS.JUNGLE_LOG;

            // Logic:
            // 1. Always overwrite AIR.
            // 2. Always overwrite Water/Plants (Foliage).
            // 3. If current is Leaves, only overwrite if we are placing Logs. (Branches cutting through leaves).
            
            if (current === BLOCKS.AIR || isCurrentFoliage) {
                const isCurrentLeaf = current === BLOCKS.OAK_LEAVES || current === BLOCKS.BIRCH_LEAVES || 
                                      current === BLOCKS.SPRUCE_LEAVES || current === BLOCKS.JUNGLE_LEAVES || current === BLOCKS.ACACIA_LEAVES;
                
                if (isCurrentLeaf && !isNewLog) {
                    return; // Keep existing leaves unless it's a log
                }
                chunkBuffer[idx] = block;
            }
        }
    }

    // Helper: Draw line of blocks (for branches)
    function placeLogLine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, block: number) {
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

    // Helper: Place sphere/blob of leaves
    function placeLeafBlob(cx: number, cy: number, cz: number, radius: number, block: number, density: number = 1.0) {
        const rSq = radius * radius;
        const ir = Math.ceil(radius);
        for (let x = -ir; x <= ir; x++) {
            for (let y = -ir; y <= ir; y++) {
                for (let z = -ir; z <= ir; z++) {
                    const dSq = x*x + y*y + z*z;
                    if (dSq <= rSq) {
                        // Random fluff removal for "natural" look
                        if (dSq >= rSq - 2 && hash3(cx+x, cy+y, cz+z) > density) continue;
                        safeSetBlock(cx+x, cy+y, cz+z, block);
                    }
                }
            }
        }
    }

    // Helper: Disk/Diamond layer for Spruce/Pine
    function placeLeafLayer(cx: number, cy: number, cz: number, r: number, type: number) {
        const rSq = r * r;
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                const d = Math.abs(i) + Math.abs(j);
                const d2 = i*i + j*j;
                // Diamond/Circle hybrid shape
                if (d <= r * 1.2 && d2 <= rSq + 1) {
                    safeSetBlock(cx + i, cy, cz + j, type);
                }
            }
        }
    }

    function placeTree(x: number, y: number, z: number, typeStr: string) {
        const rVal = hash3(x, y, z);
        
        let logType: number = BLOCKS.OAK_LOG;
        let leafType: number = BLOCKS.OAK_LEAVES;
        let treeTypeIdx = 0;
        
        if (typeStr === 'BIRCH') { logType = BLOCKS.BIRCH_LOG; leafType = BLOCKS.BIRCH_LEAVES; treeTypeIdx = 1; }
        else if (typeStr === 'SPRUCE') { logType = BLOCKS.SPRUCE_LOG; leafType = BLOCKS.SPRUCE_LEAVES; treeTypeIdx = 2; }
        else if (typeStr === 'JUNGLE') { logType = BLOCKS.JUNGLE_LOG; leafType = BLOCKS.JUNGLE_LEAVES; treeTypeIdx = 3; }
        else if (typeStr === 'ACACIA') { logType = BLOCKS.ACACIA_LOG; leafType = BLOCKS.ACACIA_LEAVES; treeTypeIdx = 4; }

        // Store for LOD
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
            trees.push({ x, y, z, type: treeTypeIdx });
        }

        // --- ADVANCED TREE ALGORITHMS ---

        if (typeStr === 'OAK') {
            const isBig = rVal > 0.65; 
            
            if (isBig) {
                // FANCY BIG OAK
                const height = 7 + Math.floor(rVal * 6); // 7-12
                
                // Trunk
                placeLogLine(x, y, z, x, y+height-2, z, logType);
                
                // Roots
                if (hash3(x, y, z+1) > 0.4) safeSetBlock(x+1, y, z, logType);
                if (hash3(x, y, z-1) > 0.4) safeSetBlock(x-1, y, z, logType);
                if (hash3(x+1, y, z) > 0.4) safeSetBlock(x, y, z+1, logType);
                if (hash3(x-1, y, z) > 0.4) safeSetBlock(x, y, z-1, logType);

                // Branches
                const numBranches = 3 + Math.floor(hash3(x, height, z) * 3); // 3-5
                for (let b = 0; b < numBranches; b++) {
                    // Branch start height (top 50% of tree)
                    const startH = Math.floor(height * 0.4) + Math.floor(hash3(x, b, z) * (height * 0.4));
                    
                    // Direction
                    const angle = hash3(b, y, x) * Math.PI * 2;
                    const len = 3 + hash3(z, b, y) * 3; // 3-6 length
                    const lift = 1 + hash3(x, z, b) * 3; // 1-4 upward
                    
                    const bx = x + Math.cos(angle) * len;
                    const bz = z + Math.sin(angle) * len;
                    const by = y + startH + lift;
                    
                    placeLogLine(x, y + startH, z, Math.floor(bx), Math.floor(by), Math.floor(bz), logType);
                    placeLeafBlob(Math.floor(bx), Math.floor(by), Math.floor(bz), 2.5, leafType, 0.7);
                }
                // Top Canopy
                placeLeafBlob(x, y+height, z, 3.5, leafType, 0.6);
            } else {
                // STANDARD OAK
                const height = 5 + Math.floor(rVal * 3);
                // Trunk
                placeLogLine(x, y, z, x, y+height-1, z, logType);
                
                // Main foliage blob
                placeLeafBlob(x, y+height, z, 2.8, leafType, 0.8);
                // Lower varied blobs
                placeLeafBlob(x+1, y+height-2, z, 2.0, leafType, 0.8);
                placeLeafBlob(x-1, y+height-2, z, 2.0, leafType, 0.8);
                placeLeafBlob(x, y+height-2, z+1, 2.0, leafType, 0.8);
            }
        }
        else if (typeStr === 'BIRCH') {
             // TALL & SLENDER
             const height = 7 + Math.floor(rVal * 5); // 7-11
             
             // Trunk
             placeLogLine(x, y, z, x, y+height, z, logType);
             
             // Layered Canopy (Cylindrical feel)
             const canopyStart = Math.floor(height * 0.5);
             
             // Top
             placeLeafBlob(x, y+height+1, z, 1.5, leafType, 0.9);
             
             for (let i = canopyStart; i <= height; i += 2) {
                 const r = 1.8 + hash3(x, i, z) * 0.8;
                 placeLeafBlob(x, y+i, z, r, leafType, 0.75);
             }
        }
        else if (typeStr === 'SPRUCE') {
            // CONICAL & LAYERED
            const height = 10 + Math.floor(rVal * 14); // 10-23
            
            // Trunk
            placeLogLine(x, y, z, x, y+height-1, z, logType);

            // Layers
            let maxR = 3.5 + hash3(x,y,z);
            const startLeaf = 3;
            
            for (let ly = startLeaf; ly < height; ly++) {
                // Normalized height
                const nh = (ly - startLeaf) / (height - startLeaf);
                // Radius tapers as we go up
                const r = Math.max(0.5, maxR * (1.0 - nh));
                
                // Whorls: Only place layers every 2nd block, or random
                if (ly % 2 === 0 || ly === height-1) {
                    const ri = Math.ceil(r);
                    placeLeafLayer(x, y + ly, z, ri, leafType);
                }
            }
            // Pointy Top
            safeSetBlock(x, y+height, z, leafType);
            safeSetBlock(x, y+height+1, z, leafType);
        }
        else if (typeStr === 'ACACIA') {
             const height = 5 + Math.floor(rVal * 4);
             // Forked Trunk
             const forkH = Math.max(2, Math.floor(height * 0.6));
             placeLogLine(x, y, z, x, y+forkH, z, logType);
             
             const numBranches = 2 + (hash3(x,z,y) > 0.5 ? 1 : 0);
             
             for(let i=0; i<numBranches; i++) {
                 // Angle spread
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
            // MEGA JUNGLE TREE
            const height = 22 + Math.floor(rVal * 15);
            
            // 2x2 Trunk (approx)
            for(let i=0; i<height; i++) {
                safeSetBlock(x, y+i, z, logType);
                safeSetBlock(x+1, y+i, z, logType);
                safeSetBlock(x, y+i, z+1, logType);
                safeSetBlock(x+1, y+i, z+1, logType);
            }
            
            // Huge Top Canopy
            placeLeafBlob(x, y+height, z, 6.5, leafType, 0.7);
            
            // Occasional side bushes / vines
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

    // 1. BASE TERRAIN PASS
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
                    let block: number = BLOCKS.STONE;
                    
                    // Surface Blocks
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
                    // Subsurface (Dirt depth varies)
                    else if (y > groundHeight - 4) {
                        if (biome === BIOMES.DESERT || biome === BIOMES.BEACH) block = BLOCKS.SANDSTONE;
                        else if (biome === BIOMES.MESA) block = BLOCKS.RED_SANDSTONE;
                        else if (biome === BIOMES.SNOWY) block = BLOCKS.STONE;
                        else if (biome === BIOMES.MOUNTAIN) block = BLOCKS.STONE;
                        else if (biome === BIOMES.RIVER) block = BLOCKS.GRAVEL;
                        else block = BLOCKS.DIRT;
                    }
                    
                    // Mesa Banding Pattern
                    if (biome === BIOMES.MESA && y > WATER_LEVEL) {
                        const noiseVal = hash(x, y, SEED) + hash(z, y, SEED);
                        const band = (y + Math.floor(noiseVal * 2)) % 9;
                        if (band === 0 || band === 1) block = BLOCKS.RED_SANDSTONE;
                        else if (band === 4) block = BLOCKS.DIRT;
                        else block = BLOCKS.RED_SAND;
                    }
                    
                    // Snow Capping on High Peaks
                    if (y > 230) { 
                        if (y === groundHeight) block = BLOCKS.SNOW;
                        else if (y > groundHeight - 3) block = BLOCKS.SNOW;
                    }

                    // Caves
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

    // 2. DECORATION PASS (Trees, Flowers, Ores)
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

            // Underwater Decorations
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

            // Tree Probabilities
            let treeType: string | null = null;
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

            // Small Decorations (Grass, Flowers) - Only inside current chunk
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

    // 3. COMPUTE FINAL HEIGHTMAP & TOPLAYER for Distant Terrain (LOD)
    const finalHeightMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const finalTopLayer = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let x=0; x<CHUNK_SIZE; x++) {
       for (let z=0; z<CHUNK_SIZE; z++) {
           // Find top block
           let y = WORLD_HEIGHT - 1;
           let blk = chunkBuffer[getIndex(x,y,z)];
           
           // Optimized search down
           while(y > 0 && blk === BLOCKS.AIR) {
               y--;
               blk = chunkBuffer[getIndex(x,y,z)];
           }
           
           finalHeightMap[x*CHUNK_SIZE+z] = y;
           finalTopLayer[x*CHUNK_SIZE+z] = blk;
       }
    }

    // Determine dominant biome
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

export function computeChunkMesh(ctx: GenerationContext, chunkData: Uint8Array, neighbors: any) {
    const { 
        CHUNK_SIZE, WORLD_HEIGHT, BLOCK_DEFINITIONS, TEXTURE_ATLAS_SIZE, ROTATABLE_SIDES_LIST, AO_INTENSITY, BLOCKS 
    } = ctx;

    const LEAF_IDS = new Set<number>([
        BLOCKS.OAK_LEAVES, 
        BLOCKS.BIRCH_LEAVES, 
        BLOCKS.SPRUCE_LEAVES, 
        BLOCKS.ACACIA_LEAVES,
        BLOCKS.JUNGLE_LEAVES
    ]);

    const ROTATABLE_SIDES = new Set(ROTATABLE_SIDES_LIST);

    const opaque = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
    let opaqueCount = 0;
    
    const foliage = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
    let foliageCount = 0;
    
    const water = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
    let waterCount = 0;

    const uW = 1 / TEXTURE_ATLAS_SIZE;
    const vH = 1.0;

    const { nx, px, nz, pz } = neighbors;

    // Helper to get block from local or neighbor data
    const getBlock = (cx: number, cy: number, cz: number) => {
        if (cy < 0 || cy >= WORLD_HEIGHT) return 0; // AIR
        if (cx >= 0 && cx < CHUNK_SIZE && cz >= 0 && cz < CHUNK_SIZE) {
            return chunkData[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz];
        }
        if (cx < 0) return nx ? nx[((cx + CHUNK_SIZE) * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz] : 0;
        if (cx >= CHUNK_SIZE) return px ? px[((cx - CHUNK_SIZE) * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz] : 0;
        if (cz < 0) return nz ? nz[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + (cz + CHUNK_SIZE)] : 0;
        if (cz >= CHUNK_SIZE) return pz ? pz[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + (cz - CHUNK_SIZE)] : 0;
        return 0;
    };

    const getBlockDef = (id: number) => BLOCK_DEFINITIONS[id] || BLOCK_DEFINITIONS[0];

    const getUVOffset = (type: number, normal: number[]) => {
       const def = getBlockDef(type);
       if (!def) return [0,0];
       const ny = normal[1];
       let idx = def.textures.side;
       if (ny > 0.5) idx = def.textures.top;
       if (ny < -0.5) idx = def.textures.bottom;
       return [idx / TEXTURE_ATLAS_SIZE, 0];
    };

    const isSolidForAO = (bx: number, by: number, bz: number) => {
        const t = getBlock(bx, by, bz);
        const def = getBlockDef(t);
        return def.isSolid && !def.isTransparent; 
    };

    const computeAO = (x: number, y: number, z: number, normal: number[]) => {
        const nx = normal[0], ny = normal[1], nz = normal[2];
        const px = x + nx; const py = y + ny; const pz = z + nz;
        const aoValues = [0,0,0,0]; 
        const vertexAO = (s1: boolean, s2: boolean, c: boolean) => {
            if (s1 && s2) return 3; 
            return (s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0);
        };

        if (ny > 0) { // TOP
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
        else if (nz > 0) { // FRONT
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

    const addQuad = (
        targetType: 'opaque' | 'foliage' | 'water',
        pos: number[], 
        corners: number[][], 
        norm: number[], 
        uStart: number, vStart: number,
        calcAo: boolean = true,
        rotation: number = 0 // 0 to 3
    ) => {
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
                target.colors!.push(brightness, brightness, brightness);
            }
        }

        const u0 = uStart + 0.001;
        const u1 = uStart + uW - 0.001;
        const v0 = vStart;
        const v1 = vStart + vH;
        
        const perms = [
            [0, 1, 2, 3], // 0 deg
            [2, 0, 3, 1], // 90 deg
            [3, 2, 1, 0], // 180 deg
            [1, 3, 0, 2]  // 270 deg
        ];
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
    
    // Modified addCross with Scale parameter for bushy leaves
    const addCross = (x: number, y: number, z: number, uStart: number, vStart: number, scale: number = 1.0) => {
        const u0 = uStart + 0.001;
        const u1 = uStart + uW - 0.001;
        const v0 = vStart;
        const v1 = vStart + vH;
        const ao = 1.0; 

        // Calculate offsets based on scale (centered at +0.5)
        const offset = (scale - 1.0) / 2;
        const min = -offset;
        const max = 1 + offset;

        // Plane 1 (Diagonal A)
        foliage.positions.push(
            x + min, y + min, z + min, 
            x + max, y + min, z + max, 
            x + min, y + max, z + min, 
            x + max, y + max, z + max
        );
        foliage.normals.push(0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7);
        foliage.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        foliage.colors!.push(ao,ao,ao, ao,ao,ao, ao,ao,ao, ao,ao,ao);
        foliage.indices.push(foliageCount, foliageCount+1, foliageCount+2, foliageCount+1, foliageCount+3, foliageCount+2);
        foliageCount += 4;

        // Plane 2 (Diagonal B)
        foliage.positions.push(
            x + min, y + min, z + max, 
            x + max, y + min, z + min, 
            x + min, y + max, z + max, 
            x + max, y + max, z + min
        );
        foliage.normals.push(-0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7);
        foliage.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        foliage.colors!.push(ao,ao,ao, ao,ao,ao, ao,ao,ao, ao,ao,ao);
        foliage.indices.push(foliageCount, foliageCount+1, foliageCount+2, foliageCount+1, foliageCount+3, foliageCount+2);
        foliageCount += 4;
    };

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const type = chunkData[(x * WORLD_HEIGHT + y) * CHUNK_SIZE + z];
                if (type === 0) continue; // AIR
                
                const typeDef = getBlockDef(type);
                const isSeagrass = type === 34; 
                
                // 1. Render 'Bushy' Cross for Leaves
                // We render this IN ADDITION to the block volume for a very dense, bushy look
                if (LEAF_IDS.has(type)) {
                    const [u, v] = getUVOffset(type, [1, 0, 0]); // Use side texture
                    // Scale 1.3 makes the leaves stick out and overlap neighbors slightly
                    addCross(x, y, z, u, v, 1.3);
                }
                
                // 2. Render Sprites (Flowers, Grass)
                if (typeDef.isSprite) {
                    const [u, v] = getUVOffset(type, [0, 1, 0]);
                    addCross(x, y, z, u, v, 1.0);
                    if (!isSeagrass) continue;
                }

                // 3. Volume Rendering (Cubes)
                const isBlockWater = type === 6 || isSeagrass; 
                const volumeType = isBlockWater ? 6 : type;
                const isBlockFoliage = typeDef.isTransparent && !isBlockWater && !isSeagrass;
                const targetType = isBlockWater ? 'water' : (isBlockFoliage ? 'foliage' : 'opaque');

                const isFaceVisible = (dx: number, dy: number, dz: number) => {
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
    
    // Convert standard arrays to TypedArrays for Transferable support
    const toBuffers = (obj: any) => {
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