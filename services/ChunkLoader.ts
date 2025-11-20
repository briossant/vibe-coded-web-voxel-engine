
import { ChunkData } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } from '../constants';
import { BlockType } from '../blocks';
import * as TerrainMath from './TerrainMath';
import { computeChunk } from './GenerationLogic';

// We assemble the worker code by extracting functions from their source modules.
// This guarantees logic parity between main thread (physics) and worker (gen)
// and allows us to write the worker logic in a real TypeScript file (GenerationLogic.ts).

const assembleWorker = (seed: number) => `
const CHUNK_SIZE = ${CHUNK_SIZE};
const WORLD_HEIGHT = ${WORLD_HEIGHT};
const WATER_LEVEL = ${WATER_LEVEL};
const SEED = ${seed};

// --- INJECTED MATH MODULES ---
const SEED_OFFSET = ${TerrainMath.SEED_OFFSET};
const F2 = ${TerrainMath.F2};
const G2 = ${TerrainMath.G2};

// Inject functions by stringifying them
${TerrainMath.mulberry32.toString()}
${TerrainMath.hash.toString()}
${TerrainMath.SimplexNoise.toString()}
${TerrainMath.easeInQuart.toString()}
${TerrainMath.smoothstep.toString()}
${TerrainMath.getTerrainInfo.toString()}

// --- INJECTED GENERATION LOGIC ---
// We inject the main compute function from GenerationLogic.ts
${computeChunk.toString()}

// --- INJECTED CONSTANTS ---
const BLOCKS = ${JSON.stringify(BlockType)};
const BIOMES = ${JSON.stringify(TerrainMath.BIOMES)};

// Initialize Noise
const noise = new SimplexNoise(SEED);

self.onmessage = function(e) {
    const { cx, cz } = e.data;
    
    // Construct the context object expected by computeChunk
    const ctx = {
        CHUNK_SIZE,
        WORLD_HEIGHT,
        WATER_LEVEL,
        SEED,
        BLOCKS,
        BIOMES,
        noise,
        getTerrainInfo, // Available in scope from injection above
        hash            // Available in scope from injection above
    };

    // Run the generation logic
    const result = computeChunk(ctx, cx, cz);

    self.postMessage({
        id: cx + ',' + cz,
        x: cx,
        z: cz,
        data: result.data,
        averageHeight: result.averageHeight,
        biome: result.biome,
        isDirty: false,
        trees: result.trees
    }, [result.data.buffer]);
};
`;

export class ChunkLoader {
  private worker: Worker;
  private onChunkLoaded: (chunk: ChunkData) => void;

  constructor(seed: number, onChunkLoaded: (chunk: ChunkData) => void) {
    this.onChunkLoaded = onChunkLoaded;
    const code = assembleWorker(seed);
    const blob = new Blob([code], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = (e: MessageEvent) => {
       const chunk = e.data as ChunkData;
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
