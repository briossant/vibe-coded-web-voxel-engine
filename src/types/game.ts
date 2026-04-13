import type { Vector3 } from './common';
import type { ChunkData } from './world';

export type { Vector3 };
export type { ChunkData };

export interface GameState {
  chunkCount: number;

  dronePosition: Vector3;
  renderDistance: number;
  extraRenderDistance: number;
  seed: number;
  debugMode: boolean;

  setDronePosition: (pos: Vector3) => void;
  updateRenderDistance: (dist: number) => void;
  updateExtraRenderDistance: (dist: number) => void;

  // Voxel world accessors
  getChunk: (x: number, z: number) => ChunkData | undefined;
  getBlock: (x: number, y: number, z: number) => number;
}
