
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
    const warpFreq = 0.002;
    const warpAmp = 60.0;
    const qx = noiseInstance.fbm(nx * warpFreq, nz * warpFreq, 2);
    const qz = noiseInstance.fbm((nx + 521) * warpFreq, (nz + 132) * warpFreq, 2);
    
    const warpedX = nx + qx * warpAmp;
    const warpedZ = nz + qz * warpAmp;

    // 2. Macro Noise Layers
    const continentalness = noiseInstance.fbm(warpedX * 0.001, warpedZ * 0.001, 2); 
    const erosion = noiseInstance.fbm(warpedX * 0.0025, warpedZ * 0.0025, 2);
    const pv = noiseInstance.fbm(nx * 0.008, nz * 0.008, 3);
    const temperature = noiseInstance.fbm(nx * 0.0005, nz * 0.0005, 2); 
    const humidity = noiseInstance.fbm((nx + 600) * 0.0005, (nz + 600) * 0.0005, 2); 

    // 3. River Generation
    // We add specific high-frequency warping for the rivers so they meander more organically
    const riverWarpX = noiseInstance.noise2D(nx * 0.006, nz * 0.006) * 35;
    const riverWarpZ = noiseInstance.noise2D(nx * 0.006 + 123, nz * 0.006 + 456) * 35;

    // River noise map
    const riverNoise = noiseInstance.noise2D((warpedX + riverWarpX) * 0.0006, (warpedZ + riverWarpZ) * 0.0006);
    const riverVal = Math.abs(riverNoise); 
    
    // Valley Mask: Creates a wide flattened area around rivers to form valleys
    // We widen the valley significantly (0.14) compared to the river channel
    const valleyWidth = 0.14; 
    const riverValleyMask = smoothstep(0.025, valleyWidth, riverVal); 
    
    // Square the mask to keep the valley floor wide and flat, rising sharply only at the edges
    const effectiveValleyMask = riverValleyMask * riverValleyMask;

    // 4. Height Calculation - Spline/Lerp Approach
    let baseHeight = waterLevel;
    let landOffset = 0;

    if (continentalness < -0.2) {
        // Ocean / Deep Ocean
        landOffset = lerp(-30, -5, smoothstep(-0.8, -0.2, continentalness));
    } else if (continentalness < 0.0) {
        // Coast / Beach
        landOffset = lerp(-5, 2, smoothstep(-0.2, 0.0, continentalness));
    } else {
        // Land / Inland
        landOffset = lerp(2, 60, smoothstep(0.0, 1.0, continentalness));
    }

    // Apply Valley Mask to Land Offset
    // We dampen the continental height contribution near rivers
    if (landOffset > 0) {
        landOffset *= effectiveValleyMask;
    }
    baseHeight += landOffset;

    // Mountain/Hill Generation
    const mountainShape = noiseInstance.ridged(nx * 0.004, nz * 0.004, 5) * 220;
    const hillShape = pv * 30;

    // Blending Factor: Based on Erosion
    const mountainMix = smoothstep(0.3, -0.3, erosion); 
    const coastDampen = smoothstep(-0.1, 0.2, continentalness);

    // Apply Valley Mask to Roughness:
    // This flattens mountains and hills in the river path
    const terrainRoughness = lerp(hillShape, mountainShape, mountainMix) * coastDampen * effectiveValleyMask;

    let h = baseHeight + terrainRoughness;

    // CRITICAL FIX: Force Valley Flattening
    // Even if the math above produced a hill, if we are in the valley mask, blend h towards water level.
    // This guarantees rivers cut through mountains properly.
    const valleyFloorHeight = waterLevel + 2;
    h = lerp(valleyFloorHeight, h, effectiveValleyMask);

    // 5. River Carving
    
    // Fade out rivers in the ocean so we don't carve trenches in the seabed
    const oceanFade = smoothstep(-0.4, -0.1, continentalness); 

    // River Channel Definition
    const riverWidthBase = 0.02;
    const riverWidthVar = smoothstep(-0.5, 0.5, erosion) * 0.015; 
    const riverEdge = riverWidthBase + riverWidthVar;

    const riverFactor = smoothstep(riverEdge * 0.6, riverEdge, riverVal);
    
    // Determine if this point is actually in the water channel
    const isRiver = riverFactor < 0.95 && oceanFade > 0.1;

    if (isRiver) {
        // Carve the specific channel
        const riverBedHeight = waterLevel - 6;
        
        // Calculate carving mix: 0 = Full Carve (Center), 1 = No Carve (Bank)
        // Use smoothstep for softer underwater slopes
        let mix = smoothstep(0.0, 1.0, riverFactor);
        
        // Blend based on ocean fade
        mix = lerp(1.0, mix, oceanFade);

        h = lerp(riverBedHeight, h, mix);
    }

    // 6. Micro Details
    h += noiseInstance.noise2D(nx * 0.1, nz * 0.1) * 1.5;

    const height = Math.floor(Math.max(2, Math.min(worldHeight - 2, h)));

    // 7. Biome determination
    let biome = BIOMES.PLAINS;

    if (height < waterLevel) {
        biome = BIOMES.OCEAN;
        if (isRiver && height < waterLevel - 1) biome = BIOMES.RIVER;
    } else if (height < waterLevel + 2 && continentalness < 0.1) {
        if (temperature > 0.3) biome = BIOMES.BEACH;
        else biome = BIOMES.BEACH; 
    } else {
        // Altitude based biomes
        if (height > 240) {
            biome = BIOMES.SNOWY; 
        } else if (height > 160) {
            if (temperature < 0) biome = BIOMES.SNOWY;
            else biome = BIOMES.MOUNTAIN;
        } else {
            // Standard biomes
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
    
    // Override biome for river banks/valley, but only if low enough
    if (isRiver && height >= waterLevel) {
        // We still mark it as RIVER here for generation logic to see,
        // but logic there will decide if it's Sand or Grass based on height
        biome = BIOMES.RIVER;
    }

    return { h: height, biome, isRiver };
}
