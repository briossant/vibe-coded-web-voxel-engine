
/**
 * PURE MATH & GENERATION LOGIC
 * This file must be self-contained or only import standard math libraries.
 * It is used by both the Main Thread (Physics) and the Web Worker (Generation).
 */

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

  // Standard Fractal Brownian Motion
  fbm(x: number, y: number, octaves: number, lacunarity: number = 2.0, gain: number = 0.5): number {
    let total = 0; let amplitude = 1; let frequency = 1; let maxValue = 0;
    for(let i = 0; i < octaves; i++) {
        total += this.noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude; amplitude *= gain; frequency *= lacunarity;
    }
    return total / maxValue;
  }

  // Ridged Noise: Produces sharp peaks (volcanoes, mountains)
  ridged(x: number, y: number, octaves: number, lacunarity: number = 2.0, gain: number = 0.5): number {
    let total = 0; let amplitude = 1; let frequency = 1; let maxValue = 0;
    for(let i = 0; i < octaves; i++) {
        let n = this.noise2D(x * frequency, y * frequency);
        n = 1.0 - Math.abs(n); // Invert so 0 becomes 1 (sharp peak at zero crossing)
        n = n * n; // Sharpen
        total += n * amplitude;
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
export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

// Biome Constants
export const BIOMES = {
    OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, 
    SNOWY: 5, MOUNTAIN: 6, JUNGLE: 7, SAVANNA: 8, MESA: 9, RIVER: 10
};

// --- CORE GENERATION ---
export function getTerrainInfo(wx: number, wz: number, noiseInstance: SimplexNoise, waterLevel: number, worldHeight: number) {
    // Use offsets to decorrelate the different noise channels
    const nx = wx + SEED_OFFSET;
    const nz = wz + SEED_OFFSET;

    // 1. Domain Warping for Organic Shapes
    // We warp the coordinate space for the "Continent" and "River" noise to avoid grid-like patterns.
    const warpFreq = 0.002;
    const warpAmp = 60.0;
    const qx = noiseInstance.fbm(nx * warpFreq, nz * warpFreq, 2);
    const qz = noiseInstance.fbm((nx + 521) * warpFreq, (nz + 132) * warpFreq, 2);
    
    const warpedX = nx + qx * warpAmp;
    const warpedZ = nz + qz * warpAmp;

    // 2. Macro Noise Layers
    // Continentalness: Defines Oceans vs Land vs Inland. Low freq.
    const continentalness = noiseInstance.fbm(warpedX * 0.001, warpedZ * 0.001, 2); 
    
    // Erosion: Defines Mountainous vs Flat. Mid freq.
    // High erosion = Flat/Smooth, Low erosion = Mountainous/Rough
    const erosion = noiseInstance.fbm(warpedX * 0.0025, warpedZ * 0.0025, 2);

    // Peaks & Valleys (PV): Local detail. High freq.
    const pv = noiseInstance.fbm(nx * 0.008, nz * 0.008, 3);

    // Temperature & Humidity
    const temperature = noiseInstance.fbm(nx * 0.0005, nz * 0.0005, 2); 
    const humidity = noiseInstance.fbm((nx + 600) * 0.0005, (nz + 600) * 0.0005, 2); 

    // 3. River Generation (Smooth "Trough")
    // We use a very low frequency for the river path to make it wind gracefully.
    const riverNoise = noiseInstance.noise2D(warpedX * 0.0004, warpedZ * 0.0004);
    const riverVal = Math.abs(riverNoise); 
    // Dynamic river width based on terrain roughness (narrower in mountains, wider in plains)
    const riverWidthBase = 0.03;
    const riverWidthVar = smoothstep(-0.5, 0.5, erosion) * 0.02; 
    const riverEdge = riverWidthBase + riverWidthVar;

    // riverFactor: 0 = center of river, 1 = bank/land
    // We use smoothstep to create a gradual bank
    const riverFactor = smoothstep(riverEdge * 0.6, riverEdge, riverVal);
    const isRiver = riverFactor < 0.9;

    // 4. Height Calculation - Spline/Lerp Approach
    
    // Base Continent Height
    // We explicitly define height targets for continentalness values and lerp between them
    let baseHeight = 0;
    if (continentalness < -0.2) {
        // Ocean / Deep Ocean
        baseHeight = lerp(waterLevel - 30, waterLevel - 5, smoothstep(-0.8, -0.2, continentalness));
    } else if (continentalness < 0.0) {
        // Coast / Beach
        baseHeight = lerp(waterLevel - 5, waterLevel + 2, smoothstep(-0.2, 0.0, continentalness));
    } else {
        // Land / Inland
        // Can go quite high if deep inland
        baseHeight = lerp(waterLevel + 2, waterLevel + 60, smoothstep(0.0, 1.0, continentalness));
    }

    // Terrain Shaping
    // Calculate two potential terrain shapes: "Rough/Mountain" and "Smooth/Hill"
    
    // Mountain Shape: Uses Ridged noise for jagged peaks
    // We boost the scale significantly to utilize the new world height
    const mountainShape = noiseInstance.ridged(nx * 0.004, nz * 0.004, 5) * 220;
    
    // Hill Shape: Uses standard FBM for rolling hills
    const hillShape = pv * 30;

    // Blending Factor: Based on Erosion
    // High erosion -> Flat/Hilly. Low erosion -> Mountainous.
    // We use smoothstep to avoid hard chunk borders ("walls").
    const mountainMix = smoothstep(0.3, -0.3, erosion); // 0.0 = All Hills, 1.0 = All Mountains
    
    // Also dampen mountains near coastlines so we don't have Mt Everest on the beach
    const coastDampen = smoothstep(-0.1, 0.2, continentalness);

    const terrainRoughness = lerp(hillShape, mountainShape, mountainMix) * coastDampen;

    let h = baseHeight + terrainRoughness;

    // 5. Apply River Trough
    // We carve the terrain down towards the river bed level.
    const riverBedHeight = waterLevel - 4;
    if (isRiver) {
        // If riverFactor is 0 (center), height is riverBedHeight.
        // If riverFactor is 1 (land), height is h.
        // We curve the mix to make banks steeper or flatter
        const carveMix = Math.pow(riverFactor, 0.5); // Square root makes a rounder bottom
        h = lerp(riverBedHeight, h, carveMix);
    }

    // 6. Micro Details
    // Add small noise to everything to break up linear interpolation smoothness
    h += noiseInstance.noise2D(nx * 0.1, nz * 0.1) * 1.5;

    // Clamp strictly to valid range to avoid array index errors, but with a buffer
    const height = Math.floor(Math.max(2, Math.min(worldHeight - 2, h)));

    // 7. Biome determination
    let biome = BIOMES.PLAINS;

    // Determine biome based on altitude, temperature, humidity
    if (height < waterLevel) {
        biome = BIOMES.OCEAN;
        if (isRiver && height < waterLevel - 1) biome = BIOMES.RIVER;
    } else if (height < waterLevel + 2 && continentalness < 0.1) {
        if (temperature > 0.3) biome = BIOMES.BEACH;
        else biome = BIOMES.BEACH; // Stony shore?
    } else {
        // Altitude based biomes
        if (height > 240) {
            biome = BIOMES.SNOWY; // Peaks
        } else if (height > 160) {
            if (temperature < 0) biome = BIOMES.SNOWY;
            else biome = BIOMES.MOUNTAIN;
        } else {
            // Standard biomes
            if (temperature > 0.5) {
                // HOT
                if (humidity > 0.3) biome = BIOMES.JUNGLE;
                else if (humidity > -0.1) biome = BIOMES.SAVANNA;
                else if (humidity > -0.6) biome = BIOMES.MESA;
                else biome = BIOMES.DESERT;
            } else if (temperature > -0.3) {
                // TEMPERATE
                if (humidity > 0.2) biome = BIOMES.FOREST;
                else if (humidity > -0.4) biome = BIOMES.PLAINS;
                else biome = BIOMES.SAVANNA;
            } else {
                // COLD
                biome = BIOMES.SNOWY;
            }
        }
    }
    
    // River override surface check
    if (isRiver && height >= waterLevel) {
        biome = BIOMES.RIVER;
    }

    return { h: height, biome, isRiver };
}
