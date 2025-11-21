import React from 'react';

export type Vector3 = [number, number, number];

export interface ChunkCoords {
  x: number;
  z: number;
}

export interface TreeInstance {
  x: number;
  y: number;
  z: number;
  type: number; // 0: OAK, 1: BIRCH, 2: SPRUCE, 3: JUNGLE, 4: ACACIA
}

export interface ChunkData {
  id: string; // format "x,z"
  x: number;
  z: number;
  data: Uint8Array; // Flat array for voxel data
  heightMap: Int16Array; // 16x16 surface height map
  topLayer: Uint8Array; // 16x16 surface block ID map
  averageHeight: number; // Pre-calculated for fast LOD2 rendering
  biome: string; // For DistantTerrain material selection
  isDirty: boolean;
  trees: TreeInstance[];
}

export interface GameState {
  chunks: Map<string, ChunkData>;
  playerPosition: Vector3;
  renderDistance: number;
  extraRenderDistance: number; // Distance for low-res distant terrain
  seed: number;
  isMenuOpen: boolean;
  debugMode: boolean;
  
  // Inventory & Hotbar State
  isInventoryOpen: boolean;
  setInventoryOpen: (isOpen: boolean) => void;
  hotbar: number[];
  setHotbar: (slots: number[]) => void;
  activeHotbarSlot: number;
  setActiveHotbarSlot: (slot: number) => void;
  
  // Added missing properties
  selectedBlock?: number;
  setSelectedBlock?: (blockId: number) => void;

  setPlayerPosition: (pos: Vector3) => void;
  toggleMenu: () => void;
  toggleDebug: () => void;
  updateRenderDistance: (dist: number) => void;
  updateExtraRenderDistance: (dist: number) => void;
  getBlock: (x: number, y: number, z: number) => number;
  setBlock: (x: number, y: number, z: number, type: number) => void;
}

export type BlockCategory = 'Nature' | 'Wood' | 'Plants' | 'Building' | 'Misc';

// New Registry Types
export interface BlockDefinition {
  id: number;
  name: string;
  category: BlockCategory;
  isSolid: boolean;
  isTransparent: boolean; // glass, water, leaves
  isFluid: boolean; // water
  isSprite: boolean; // flowers, grass
  lightLevel?: number;
  textures: {
    top: number;
    side: number;
    bottom: number;
  };
  mapColor: string; // Hex for distant terrain/minimap
}

// Augment the global JSX namespace to recognize React Three Fiber elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      meshStandardMaterial: any;
      instancedMesh: any;
      boxGeometry: any;
      primitive: any;
      ambientLight: any;
      directionalLight: any;
      hemisphereLight: any;
      color: any;
      fogExp2: any;
      [elemName: string]: any;
    }
  }
}

// Augment React's internal JSX namespace for compatibility with strict configurations
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      meshStandardMaterial: any;
      instancedMesh: any;
      boxGeometry: any;
      primitive: any;
      ambientLight: any;
      directionalLight: any;
      hemisphereLight: any;
      color: any;
      fogExp2: any;
      [elemName: string]: any;
    }
  }
}