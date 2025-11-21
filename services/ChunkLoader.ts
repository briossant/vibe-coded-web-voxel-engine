
import { ChunkData } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } from '../constants';
import { BlockType, BLOCK_DEFINITIONS } from '../blocks';
import * as TerrainMath from './TerrainMath';
import { computeChunk, computeChunkMesh } from './GenerationLogic';
import { TEXTURE_ATLAS_SIZE } from '../utils/textures';

// Blocks that look good with random rotation on their side faces
const ROTATABLE_SIDES = [
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.SAND,
  BlockType.GRAVEL,
  BlockType.BEDROCK,
  BlockType.SNOW,
  BlockType.OAK_LEAVES,
  BlockType.BIRCH_LEAVES,
  BlockType.SPRUCE_LEAVES,
  BlockType.ACACIA_LEAVES,
  BlockType.JUNGLE_LEAVES,
  BlockType.RED_SAND,
  BlockType.WATER,
  BlockType.CLAY
];

const AO_INTENSITY = [1.0, 0.85, 0.65, 0.45];

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
${TerrainMath.lerp.toString()}
${TerrainMath.getTerrainInfo.toString()}

// --- INJECTED GENERATION LOGIC ---
${computeChunk.toString()}
${computeChunkMesh.toString()}

// --- INJECTED CONSTANTS ---
const BLOCKS = ${JSON.stringify(BlockType)};
const BLOCK_DEFINITIONS = ${JSON.stringify(BLOCK_DEFINITIONS)};
const BIOMES = ${JSON.stringify(TerrainMath.BIOMES)};
const TEXTURE_ATLAS_SIZE = ${TEXTURE_ATLAS_SIZE};
const ROTATABLE_SIDES_LIST = ${JSON.stringify(ROTATABLE_SIDES)};
const AO_INTENSITY = ${JSON.stringify(AO_INTENSITY)};

// Initialize Noise
const noise = new SimplexNoise(SEED);

self.onmessage = function(e) {
    const msg = e.data;
    
    const ctx = {
        CHUNK_SIZE,
        WORLD_HEIGHT,
        WATER_LEVEL,
        SEED,
        BLOCKS,
        BLOCK_DEFINITIONS,
        BIOMES,
        TEXTURE_ATLAS_SIZE,
        ROTATABLE_SIDES_LIST,
        AO_INTENSITY,
        noise,
        getTerrainInfo,
        hash
    };

    if (msg.type === 'GENERATE') {
        const { cx, cz } = msg;
        const result = computeChunk(ctx, cx, cz);
        self.postMessage({
            type: 'CHUNK',
            chunk: {
                id: cx + ',' + cz,
                x: cx,
                z: cz,
                data: result.data,
                averageHeight: result.averageHeight,
                biome: result.biome,
                isDirty: false,
                trees: result.trees
            }
        }, [result.data.buffer]);
    } 
    else if (msg.type === 'MESH') {
        const { chunkData, neighbors, reqId } = msg;
        
        // chunkData is a Uint8Array
        // neighbors contains { nx, px, nz, pz } which are Uint8Array or null
        const mesh = computeChunkMesh(ctx, chunkData, neighbors);
        
        const buffers = [];
        // Helper to collect buffers for transfer
        const add = (geo) => {
             if (geo.positions.buffer) buffers.push(geo.positions.buffer);
             if (geo.normals.buffer) buffers.push(geo.normals.buffer);
             if (geo.uvs.buffer) buffers.push(geo.uvs.buffer);
             if (geo.indices.buffer) buffers.push(geo.indices.buffer);
             if (geo.colors.buffer) buffers.push(geo.colors.buffer);
        };
        add(mesh.opaque);
        add(mesh.foliage);
        add(mesh.water);

        self.postMessage({
            type: 'MESH',
            reqId,
            mesh
        }, buffers);
    }
};
`;

export class ChunkLoader {
  private worker: Worker;
  private onChunkLoaded: (chunk: ChunkData) => void;
  private meshCallbacks: Map<number, (data: any) => void>;
  private reqIdCounter: number;

  constructor(seed: number, onChunkLoaded: (chunk: ChunkData) => void) {
    this.onChunkLoaded = onChunkLoaded;
    this.meshCallbacks = new Map();
    this.reqIdCounter = 0;

    const code = assembleWorker(seed);
    const blob = new Blob([code], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = (e: MessageEvent) => {
       const msg = e.data;
       if (msg.type === 'CHUNK') {
           const chunk = msg.chunk;
           chunk.data = new Uint8Array(chunk.data); 
           this.onChunkLoaded(chunk);
       } else if (msg.type === 'MESH') {
           const cb = this.meshCallbacks.get(msg.reqId);
           if (cb) {
               this.meshCallbacks.delete(msg.reqId);
               cb(msg.mesh);
           }
       }
    };
  }

  requestChunk(cx: number, cz: number) {
    this.worker.postMessage({ type: 'GENERATE', cx, cz });
  }

  requestMesh(chunk: ChunkData, neighbors: any): Promise<any> {
      return new Promise((resolve) => {
          const reqId = this.reqIdCounter++;
          this.meshCallbacks.set(reqId, resolve);

          const nData = {
              nx: neighbors.nx?.data,
              px: neighbors.px?.data,
              nz: neighbors.nz?.data,
              pz: neighbors.pz?.data,
          };

          this.worker.postMessage({
              type: 'MESH',
              reqId,
              chunkData: chunk.data,
              neighbors: nData
          });
      });
  }

  terminate() {
    this.worker.terminate();
  }
}
