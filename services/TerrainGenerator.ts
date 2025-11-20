
import { ChunkData, BlockType } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } from '../constants';
import { noise } from '../utils/noise';

// Large offset to avoid 0,0 symmetry/bias in noise functions
const NOISE_OFFSET = 10000;

// Smooth curve function for mountains (Must match Worker)
function easeInQuart(x: number) {
    return x * x * x * x;
}

// Sigmoid-like function for smooth transitions
function smoothstep(min: number, max: number, value: number) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// Unified terrain height function used for physics/player positioning
// MATCHES ChunkLoader.ts Logic exactly
export const getTerrainHeight = (worldX: number, worldZ: number): number => {
    const nx = worldX + NOISE_OFFSET;
    const nz = worldZ + NOISE_OFFSET;

    // 1. Continentalness: Determines Land vs Ocean
    const continentalness = noise.fbm(nx * 0.001, nz * 0.001, 2); 
    
    // 2. Erosion: Determines Flatness vs Roughness
    const erosion = noise.fbm(nx * 0.002, nz * 0.002, 2);

    // 3. River Noise: 0 at rivers, 1 far away
    const riverNoise = Math.abs(noise.noise2D(nx * 0.0025, nz * 0.0025));
    const isRiver = riverNoise < 0.06;

    // Base Height Calculation
    const coastThreshold = -0.2;
    
    // Unified S-Curve for continental shelf to avoid cliffs
    // We scale the noise input to a height.
    // Sigmoid curve centered around coastThreshold
    const steepness = 4.0; 
    const shelfShape = Math.tanh((continentalness - coastThreshold) * steepness);
    
    let h = WATER_LEVEL + (shelfShape * 40); // -40 to +40 range around water level

    // Apply Surface Noise (Erosion)
    // Add more detail to land, less to deep ocean, but keep it continuous
    const landFactor = smoothstep(-0.4, 0.0, continentalness); // 0 in ocean, 1 on land
    
    const pv = noise.fbm(nx * 0.01, nz * 0.01, 3);
    h += pv * 5;

    // Ocean Floor Detail (Add ridges underwater)
    if (h < WATER_LEVEL) {
        const seabedDetail = noise.noise2D(nx * 0.03, nz * 0.03);
        h += seabedDetail * 3;
    }

    // Big Mountains (only on land)
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

    // Clamping to world bounds
    return Math.floor(Math.max(2, Math.min(WORLD_HEIGHT - 3, h)));
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
