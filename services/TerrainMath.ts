
/**
 * PURE MATH & GENERATION LOGIC
 * This file must be self-contained or only import standard math libraries.
 * It is used by both the Main Thread (Physics) and the Web Worker (Generation).
 */

// Re-declare constants inside this context if needed, or pass them in.
// For the worker injection strategy, we will rely on the fact that these functions
// are pure and we will stringify them.

export const SEED_OFFSET = 10000;

export const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
export const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

// Mulberry32 PRNG
export function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

export function hash(x: number, z: number, seed: number) {
    let h = 0xdeadbeef;
    h = Math.imul(h ^ x, 0x85ebca6b);
    h = Math.imul(h ^ z, 0xc2b2ae35);
    h = Math.imul(h ^ seed, 0x12345678);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

// Standalone SimplexNoise implementation for portability
export class SimplexNoise {
  private p: Uint8Array;
  private perm: Uint8Array;
  private permMod12: Uint8Array;
  private grad3: Float32Array;

  constructor(seed: number = 12345) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    this.grad3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
    this.reseed(seed);
  }

  reseed(seed: number) {
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

  noise2D(xin: number, yin: number): number {
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

  fbm(x: number, y: number, octaves: number, lacunarity: number = 2.0, gain: number = 0.5): number {
    let total = 0; let amplitude = 1; let frequency = 1; let maxValue = 0;
    for(let i = 0; i < octaves; i++) {
        total += this.noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude; amplitude *= gain; frequency *= lacunarity;
    }
    return total / maxValue;
  }
}

// Math Helpers
export function easeInQuart(x: number) { return x * x * x * x; }
export function smoothstep(min: number, max: number, value: number) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// Biome Constants
export const BIOMES = {
    OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, 
    SNOWY: 5, MOUNTAIN: 6, JUNGLE: 7, SAVANNA: 8, MESA: 9, RIVER: 10
};

// The Core Generation Function
// Returns height, biome, and river status
export function getTerrainInfo(wx: number, wz: number, noiseInstance: SimplexNoise, waterLevel: number, worldHeight: number) {
    const nx = wx + SEED_OFFSET;
    const nz = wz + SEED_OFFSET;

    // 1. Continentalness: Determines Land vs Ocean
    const continentalness = noiseInstance.fbm(nx * 0.001, nz * 0.001, 2); 
    
    // 2. Erosion: Determines Flatness vs Roughness
    const erosion = noiseInstance.fbm(nx * 0.002, nz * 0.002, 2);

    // 3. Temperature & Humidity for Biomes
    const temperature = noiseInstance.fbm(nx * 0.0005, nz * 0.0005, 2); 
    const humidity = noiseInstance.fbm((nx + 5000) * 0.0005, (nz + 5000) * 0.0005, 2); 

    // 4. River Generation
    const riverPathNoise = Math.abs(noiseInstance.noise2D(nx * 0.0008, nz * 0.0008));
    const riverWidthNoise = noiseInstance.noise2D(nx * 0.0001, nz * 0.0001); 
    const riverThreshold = 0.04 + (riverWidthNoise * 0.02); 
    const isRiver = riverPathNoise < riverThreshold;

    // Base Height
    const coastThreshold = -0.2;
    const steepness = 4.0; 
    const shelfShape = Math.tanh((continentalness - coastThreshold) * steepness);
    
    let h = waterLevel + (shelfShape * 40); 

    // Surface Noise
    const landFactor = smoothstep(-0.4, 0.0, continentalness);
    const pv = noiseInstance.fbm(nx * 0.01, nz * 0.01, 3);
    h += pv * 5;

    // Ocean Floor Detail
    if (h < waterLevel) {
        const seabedDetail = noiseInstance.noise2D(nx * 0.03, nz * 0.03);
        h += seabedDetail * 3;
    }

    // Big Mountains
    if (erosion > 0.3) {
        const mountainHeight = easeInQuart((erosion - 0.3) * 2.5);
        h += mountainHeight * 90 * landFactor;
    }

    // Carve Rivers
    if (isRiver && h > waterLevel - 5) {
         const riverFactor = riverPathNoise / riverThreshold; 
         const bankShape = smoothstep(0, 1, riverFactor);
         const riverBedHeight = waterLevel - 2;
         h = (h * bankShape) + (riverBedHeight * (1 - bankShape));
    }

    // Clamp
    const height = Math.floor(Math.max(2, Math.min(worldHeight - 3, h)));

    // Biome Determination
    let biome = BIOMES.PLAINS;

    if (height <= waterLevel) {
        biome = BIOMES.OCEAN;
        if (isRiver && height >= waterLevel - 4) biome = BIOMES.RIVER;
    } else if (height <= waterLevel + 2) {
         if (temperature > 0.5) biome = BIOMES.DESERT;
         else if (temperature > 0.0) biome = BIOMES.BEACH;
         else biome = BIOMES.SNOWY;
    } 
    else if (height > 95) {
        biome = BIOMES.SNOWY;
    } else if (height > 80) {
        if (temperature > 0.5) biome = BIOMES.MESA;
        else biome = BIOMES.MOUNTAIN;
    } 
    else {
        if (temperature > 0.6) { // HOT
            if (humidity > 0.4) biome = BIOMES.JUNGLE;
            else if (humidity > -0.2) biome = BIOMES.SAVANNA;
            else if (humidity > -0.6) biome = BIOMES.MESA;
            else biome = BIOMES.DESERT;
        } else if (temperature > 0.0) { // TEMPERATE
            if (humidity > 0.2) biome = BIOMES.FOREST;
            else if (humidity > -0.5) biome = BIOMES.PLAINS;
            else biome = BIOMES.SAVANNA;
        } else { // COLD
            biome = BIOMES.SNOWY;
        }
    }
    
    if (isRiver && height > waterLevel) {
        biome = BIOMES.RIVER;
    }

    return { h: height, biome, isRiver };
}
