
import { BlockType } from '../blocks';

// We define the context that will be passed to the worker function.
// This allows TypeScript to check types while we still serialize the function for the worker.
export interface GenerationContext {
    CHUNK_SIZE: number;
    WORLD_HEIGHT: number;
    WATER_LEVEL: number;
    SEED: number;
    BLOCKS: typeof BlockType;
    BIOMES: { [key: string]: number };
    
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

    function safeSetBlock(x: number, y: number, z: number, block: number) {
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) {
            const idx = getIndex(x, y, z);
            const current = chunkBuffer[idx];
            // Don't overwrite solid blocks with foliage/water if we are doing decoration passes
            if (current === BLOCKS.AIR || current === BLOCKS.WATER || current === BLOCKS.TALL_GRASS || current >= BLOCKS.FLOWER_YELLOW) {
                chunkBuffer[idx] = block;
            }
        }
    }

    // --- TREE PLACEMENT LOGIC ---
    function placeLeafLayer(cx: number, cy: number, cz: number, r: number, type: number) {
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                // Round off the corners slightly for r > 1
                if (Math.abs(i) === r && Math.abs(j) === r && r > 1) {
                     if (hash(cx + i, cz + j, cy) > 0.5) continue; 
                }
                safeSetBlock(cx + i, cy, cz + j, type);
            }
        }
    }

    function placeTree(x: number, y: number, z: number, typeStr: string) {
        let typeIdx = 0; 
        if (typeStr === 'BIRCH') typeIdx = 1;
        else if (typeStr === 'SPRUCE') typeIdx = 2;
        else if (typeStr === 'JUNGLE') typeIdx = 3;
        else if (typeStr === 'ACACIA') typeIdx = 4;

        // Record tree for InstancedMesh rendering (optimization)
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
            trees.push({ x, y, z, type: typeIdx });
        }

        // Voxel Structure Generation
        if (typeStr === 'OAK' || typeStr === 'BIRCH') {
            const h = typeStr === 'BIRCH' ? 6 : 5;
            const log = typeStr === 'BIRCH' ? BLOCKS.BIRCH_LOG : BLOCKS.OAK_LOG;
            const leaves = typeStr === 'BIRCH' ? BLOCKS.BIRCH_LEAVES : BLOCKS.OAK_LEAVES;
            
            for (let i = 0; i < h; i++) safeSetBlock(x, y + i, z, log);
            placeLeafLayer(x, y+h-2, z, 2, leaves);
            placeLeafLayer(x, y+h-1, z, 2, leaves);
            placeLeafLayer(x, y+h, z, 1, leaves);
            placeLeafLayer(x, y+h+1, z, 1, leaves);
        } 
        else if (typeStr === 'SPRUCE') {
             const h = 7 + Math.floor(hash(x, z, SEED) * 5);
             for(let i=0; i<h; i++) safeSetBlock(x, y + i, z, BLOCKS.SPRUCE_LOG);
             for(let i=2; i<h; i++) {
                 const r = Math.floor((h-i)*0.35) + 1;
                 placeLeafLayer(x, y+i, z, r, BLOCKS.SPRUCE_LEAVES);
             }
             placeLeafLayer(x, y+h, z, 1, BLOCKS.SPRUCE_LEAVES);
        }
        else if (typeStr === 'JUNGLE') {
            const h = 12 + Math.floor(hash(x, z, SEED) * 10); // Taller jungle trees
            for (let i = 0; i < h; i++) safeSetBlock(x, y + i, z, BLOCKS.JUNGLE_LOG);
            placeLeafLayer(x, y+h-2, z, 3, BLOCKS.JUNGLE_LEAVES);
            placeLeafLayer(x, y+h-1, z, 3, BLOCKS.JUNGLE_LEAVES);
            placeLeafLayer(x, y+h, z, 2, BLOCKS.JUNGLE_LEAVES);
            safeSetBlock(x, y+h, z, BLOCKS.JUNGLE_LOG);
        }
        else if (typeStr === 'ACACIA') {
            const h = 5 + Math.floor(hash(x, z, SEED) * 3);
            for (let i = 0; i < h; i++) safeSetBlock(x, y + i, z, BLOCKS.ACACIA_LOG);
            
            // Branches
            safeSetBlock(x+1, y+h-1, z, BLOCKS.ACACIA_LOG);
            safeSetBlock(x+2, y+h, z, BLOCKS.ACACIA_LOG);
            placeLeafLayer(x+2, y+h+1, z, 2, BLOCKS.ACACIA_LEAVES);

            safeSetBlock(x-1, y+h-2, z, BLOCKS.ACACIA_LOG);
            safeSetBlock(x-2, y+h-1, z, BLOCKS.ACACIA_LOG);
            placeLeafLayer(x-2, y+h, z, 2, BLOCKS.ACACIA_LEAVES);
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
                                // Improved River Banking:
                                // Only place sand/gravel very close to water level.
                                // Higher up on the river valley slopes, use Grass.
                                if (y <= WATER_LEVEL + 2) {
                                    // Erosion mix: 30% chance of gravel near water
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
                        // Simple noise for banding variation
                        const noiseVal = hash(x, y, SEED) + hash(z, y, SEED);
                        const band = (y + Math.floor(noiseVal * 2)) % 9;
                        if (band === 0 || band === 1) block = BLOCKS.RED_SANDSTONE;
                        else if (band === 4) block = BLOCKS.DIRT;
                        else block = BLOCKS.RED_SAND;
                    }
                    
                    // Snow Capping on High Peaks regardless of biome
                    if (y > 230) { // Raised snow level for new height
                        if (y === groundHeight) block = BLOCKS.SNOW;
                        else if (y > groundHeight - 3) block = BLOCKS.SNOW; // Deep snow
                    }

                    // Caves (Simplex Worms)
                    // Optimized 3D-ish noise check
                    if (y < groundHeight - 4 && y > 4) {
                         // Create 3D noise feel by using y in input
                         const caveScale = 0.06;
                         // Perturb Y slightly to make caves non-vertical
                         const caveNoise = noise.noise2D(wx * caveScale, (y + wz) * caveScale) + 
                                         noise.noise2D((wx + y) * caveScale, wz * caveScale);
                         // Increase threshold slightly deeper down
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
    const TREE_MARGIN = 4; // Look outside chunk to spawn trees that overlap
    for (let x = -TREE_MARGIN; x < CHUNK_SIZE + TREE_MARGIN; x++) {
        for (let z = -TREE_MARGIN; z < CHUNK_SIZE + TREE_MARGIN; z++) {
            const wx = worldX + x;
            const wz = worldZ + z;
            
            let h, biome;
            // Optimization: Use cached map for internal, calc for margin
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

            // Trees don't spawn too high up (treeline)
            if (h < 210) {
                if (biome === BIOMES.FOREST) { treeChance = 0.08; treeType = 'OAK'; if (r > 0.7) treeType = 'BIRCH'; }
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

    // Determine dominant biome for distant terrain LOD color
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
        averageHeight: avgH,
        biome: domB,
        trees
    };
}
