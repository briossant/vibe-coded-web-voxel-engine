
import { ChunkData } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } from '../constants';
import { BlockType } from '../blocks';
import { getTerrainInfo as calcTerrain, SimplexNoise } from './TerrainMath';
import { noise } from '../utils/noise';

// We use the shared instance from utils/noise which is reseeded by App.tsx
// This ensures we are synced with the Seed state.

// Unified terrain height function used for physics/player positioning
export const getTerrainHeight = (worldX: number, worldZ: number): number => {
    const { h } = calcTerrain(worldX, worldZ, noise, WATER_LEVEL, WORLD_HEIGHT);
    return h;
};

export const getBlockIndex = (x: number, y: number, z: number) => {
  return (x * WORLD_HEIGHT + y) * CHUNK_SIZE + z;
};

export const getBlockFromChunk = (chunk: ChunkData, x: number, y: number, z: number): number => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return BlockType.AIR; 
  }
  return chunk.data[getBlockIndex(x, y, z)];
};
