
import { computeChunk, computeChunkMesh } from '../GenerationLogic';
import * as TerrainMath from '../TerrainMath';
import { BlockType } from '../../core/blocks';
import { TEXTURE_ATLAS_SIZE } from '../../constants'; 
import { blockRegistry } from '../BlockRegistry';

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

// Initialize Noise
let noise: any = null;

// Fix for TypeScript perceiving 'self' as Window instead of WorkerGlobalScope
const workerScope = self as unknown as {
    onmessage: ((this: any, ev: MessageEvent) => any) | null;
    postMessage: (message: any, transfer?: Transferable[]) => void;
};

console.log("Worker: Initialized");

workerScope.onmessage = function(e: MessageEvent) {
    const msg = e.data;
    
    if (msg.type === 'GENERATE') {
        const { cx, cz, seed } = msg;

        // Ensure noise is initialized with the correct seed
        if (!noise) {
            noise = new TerrainMath.SimplexNoise(seed);
        }

        const ctx = {
            CHUNK_SIZE: 16,
            WORLD_HEIGHT: 384,
            WATER_LEVEL: 64,
            SEED: seed,
            BLOCKS: BlockType,
            BIOMES: TerrainMath.BIOMES,
            BLOCK_DEFINITIONS: new Proxy({}, { get: (t, p) => blockRegistry.get(Number(p)) }), 
            TEXTURE_ATLAS_SIZE,
            ROTATABLE_SIDES_LIST: ROTATABLE_SIDES,
            AO_INTENSITY,
            noise,
            getTerrainInfo: TerrainMath.getTerrainInfo,
            hash: TerrainMath.hash
        };

        const result = computeChunk(ctx, cx, cz);
        
        const transfer = [
            result.data.buffer, 
            result.heightMap.buffer, 
            result.topLayer.buffer
        ];

        workerScope.postMessage({
            type: 'CHUNK',
            chunk: {
                id: cx + ',' + cz,
                x: cx,
                z: cz,
                data: result.data,
                heightMap: result.heightMap,
                topLayer: result.topLayer,
                averageHeight: result.averageHeight,
                biome: result.biome,
                isDirty: false,
                trees: result.trees
            }
        }, transfer);
    } 
    else if (msg.type === 'MESH') {
        const { chunkData, neighbors, reqId } = msg;
        
        const ctx: any = {
            CHUNK_SIZE: 16,
            WORLD_HEIGHT: 384,
            BLOCK_DEFINITIONS: new Proxy({}, { get: (t, p) => blockRegistry.get(Number(p)) }),
            TEXTURE_ATLAS_SIZE,
            ROTATABLE_SIDES_LIST: ROTATABLE_SIDES,
            AO_INTENSITY,
            BLOCKS: BlockType
        };

        const mesh = computeChunkMesh(ctx, chunkData, neighbors);
        
        const buffers: Transferable[] = [];
        const add = (geo: any) => {
             if (geo.positions.buffer) buffers.push(geo.positions.buffer);
             if (geo.normals.buffer) buffers.push(geo.normals.buffer);
             if (geo.uvs.buffer) buffers.push(geo.uvs.buffer);
             if (geo.indices.buffer) buffers.push(geo.indices.buffer);
             if (geo.colors.buffer) buffers.push(geo.colors.buffer);
        };
        add(mesh.opaque);
        add(mesh.foliage);
        add(mesh.water);

        workerScope.postMessage({
            type: 'MESH',
            reqId,
            mesh
        }, buffers);
    }
};
