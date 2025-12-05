import { ChunkData } from '@/src/types/world';
import { TEXTURE_ATLAS_SIZE } from '@/src/constants';

export class ChunkLoader {
  private worker: Worker | null = null;
  private onChunkLoaded: (chunk: ChunkData) => void;
  private meshCallbacks: Map<number, (data: any) => void>;
  private reqIdCounter: number;
  private seed: number;

  constructor(seed: number, onChunkLoaded: (chunk: ChunkData) => void) {
    this.seed = seed;
    this.onChunkLoaded = onChunkLoaded;
    this.meshCallbacks = new Map();
    this.reqIdCounter = 0;

    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    // Use Vite's worker import
    this.worker = new Worker(new URL('./workers/generation.worker.ts', import.meta.url), {
        type: 'module'
    });

    this.worker.onmessage = (e: MessageEvent) => {
       const msg = e.data;
       if (msg.type === 'CHUNK') {
           const chunk = msg.chunk;
           chunk.data = new Uint8Array(chunk.data);
           chunk.heightMap = new Int16Array(chunk.heightMap);
           chunk.topLayer = new Uint8Array(chunk.topLayer);
           this.onChunkLoaded(chunk);
       } else if (msg.type === 'MESH') {
           const cb = this.meshCallbacks.get(msg.reqId);
           if (cb) {
               this.meshCallbacks.delete(msg.reqId);
               cb(msg.mesh);
           }
       }
    };

    this.worker.onerror = (e) => {
        console.error("Worker Error:", e);
    };
  }

  requestChunk(cx: number, cz: number) {
    if (this.worker) {
        this.worker.postMessage({ type: 'GENERATE', cx, cz, seed: this.seed });
    }
  }

  requestMesh(chunk: ChunkData, neighbors: any): Promise<any> {
      return new Promise((resolve) => {
          if (!this.worker) return; 

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
    if (this.worker) {
        this.worker.terminate();
    }
  }
}