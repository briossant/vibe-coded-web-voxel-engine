
import { ChunkData, BlockType } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } from '../constants';
import { noise } from '../utils/noise';

// Unified terrain height function used for physics/player positioning
// Must match the worker logic in ChunkLoader.ts EXACTLY to prevent desync
export const getTerrainHeight = (worldX: number, worldZ: number): number => {
    // 1. Continentalness (Large scale: Ocean vs Land)
    const continentalness = noise.fbm(worldX * 0.002, worldZ * 0.002, 2);

    // 2. Erosion (Roughness/Mountains)
    const erosion = Math.abs(noise.fbm(worldX * 0.005, worldZ * 0.005, 2));

    // 3. Local Detail (Bumps)
    const pv = noise.noise2D(worldX * 0.03, worldZ * 0.03);

    let height = WATER_LEVEL;

    // Base height from continentalness
    // Continentalness -1..1 maps to roughly -40..+40
    height += continentalness * 40;

    // Mountain generation
    // Only on land (continentalness > 0ish)
    const mountainBase = Math.max(0, continentalness + 0.1); 
    // Cubed erosion for sharp peaks
    const mountainFactor = erosion * erosion * erosion; 
    
    height += mountainBase * mountainFactor * 100;
    
    // Local detail
    height += pv * 3;

    // Clamping to world bounds
    return Math.floor(Math.max(2, Math.min(WORLD_HEIGHT - 3, height)));
};

export const getBlockIndex = (x: number, y: number, z: number) => {
  return (x * WORLD_HEIGHT + y) * CHUNK_SIZE + z;
};

export const getBlockFromChunk = (chunk: ChunkData, x: number, y: number, z: number): BlockType => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return BlockType.AIR; 
  }
  return chunk.data[getBlockIndex(x, y, z)];
};
