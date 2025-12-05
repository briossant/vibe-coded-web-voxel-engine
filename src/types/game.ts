import { Vector3 } from './common';
import { ChunkData } from './world';

export interface GameState {
  // chunks: Map<string, ChunkData>; // Moved to internal Game state
  chunkCount: number; // For HUD
  
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
  
  selectedBlock?: number;
  setSelectedBlock?: (blockId: number) => void;

  setPlayerPosition: (pos: Vector3) => void;
  toggleMenu: () => void;
  toggleDebug: () => void;
  updateRenderDistance: (dist: number) => void;
  updateExtraRenderDistance: (dist: number) => void;
  
  // Accessors
  getChunk: (x: number, z: number) => ChunkData | undefined;
  getBlock: (x: number, y: number, z: number) => number;
  setBlock: (x: number, y: number, z: number, type: number) => void;
}
