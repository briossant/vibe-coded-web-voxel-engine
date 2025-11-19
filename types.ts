import React from 'react';

export enum BlockType {
  AIR = 0,
  DIRT = 1,
  GRASS = 2,
  STONE = 3,
  OAK_LOG = 4,
  OAK_LEAVES = 5,
  WATER = 6,
  SAND = 7,
  BEDROCK = 8,
  SNOW = 9,
  TALL_GRASS = 10,
  FLOWER_YELLOW = 11,
  FLOWER_RED = 12,
  BIRCH_LOG = 13,
  BIRCH_LEAVES = 14,
  SPRUCE_LOG = 15,
  SPRUCE_LEAVES = 16,
  CACTUS = 17,
  DEAD_BUSH = 18,
  SANDSTONE = 19,
  GRAVEL = 20,
  TULIP_RED = 21,
  TULIP_ORANGE = 22,
  TULIP_WHITE = 23,
  TULIP_PINK = 24,
  CORNFLOWER = 25,
}

export type Vector3 = [number, number, number];

export interface ChunkCoords {
  x: number;
  z: number;
}

export interface TreeInstance {
  x: number;
  y: number;
  z: number;
  type: number; // 0: OAK, 1: BIRCH, 2: SPRUCE
}

export interface ChunkData {
  id: string; // format "x,z"
  x: number;
  z: number;
  data: Uint8Array; // Flat array for voxel data
  averageHeight: number; // Pre-calculated for fast LOD2 rendering
  biome: string; // For DistantTerrain material selection
  isDirty: boolean;
  trees: TreeInstance[];
}

export interface GameState {
  chunks: Map<string, ChunkData>;
  playerPosition: Vector3;
  renderDistance: number;
  seed: number;
  isMenuOpen: boolean;
  debugMode: boolean;
  setPlayerPosition: (pos: Vector3) => void;
  toggleMenu: () => void;
  toggleDebug: () => void;
  updateRenderDistance: (dist: number) => void;
  getBlock: (x: number, y: number, z: number) => BlockType;
  setBlock: (x: number, y: number, z: number, type: BlockType) => void;
}

// Augment the global JSX namespace to recognize React Three Fiber elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      meshStandardMaterial: any;
      instancedMesh: any;
      boxGeometry: any;
      color: any;
      fog: any;
      ambientLight: any;
      directionalLight: any;
      group: any;
      pointLight: any;
      primitive: any;
    }
  }
}