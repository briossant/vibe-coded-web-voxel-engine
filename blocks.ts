
import { BlockDefinition } from './types';

export const BlockType = {
  AIR: 0,
  DIRT: 1,
  GRASS: 2,
  STONE: 3,
  OAK_LOG: 4,
  OAK_LEAVES: 5,
  WATER: 6,
  SAND: 7,
  BEDROCK: 8,
  SNOW: 9,
  TALL_GRASS: 10,
  FLOWER_YELLOW: 11,
  FLOWER_RED: 12,
  BIRCH_LOG: 13,
  BIRCH_LEAVES: 14,
  SPRUCE_LOG: 15,
  SPRUCE_LEAVES: 16,
  CACTUS: 17,
  DEAD_BUSH: 18,
  SANDSTONE: 19,
  GRAVEL: 20,
  TULIP_RED: 21,
  TULIP_ORANGE: 22,
  TULIP_WHITE: 23,
  TULIP_PINK: 24,
  CORNFLOWER: 25,
  ACACIA_LOG: 26,
  ACACIA_LEAVES: 27,
  JUNGLE_LOG: 28,
  JUNGLE_LEAVES: 29,
  RED_SAND: 30,
  RED_SANDSTONE: 31,
  MELON: 32,
  BLUE_ORCHID: 33,
  SEAGRASS: 34,
  SEA_LANTERN: 35,
} as const;

// Helper to create simple blocks
const createBlock = (
  id: number, 
  name: string, 
  texTop: number, 
  texSide: number, 
  texBot: number, 
  color: string,
  opts: Partial<BlockDefinition> = {}
): BlockDefinition => ({
  id,
  name,
  isSolid: true,
  isTransparent: false,
  isFluid: false,
  isSprite: false,
  textures: { top: texTop, side: texSide, bottom: texBot },
  mapColor: color,
  ...opts
});

// Helper for simple 1-texture blocks
const simple = (id: number, name: string, tex: number, color: string, opts = {}) => 
  createBlock(id, name, tex, tex, tex, color, opts);

// Helper for column blocks (logs)
const column = (id: number, name: string, top: number, side: number, color: string) => 
  createBlock(id, name, top, side, top, color);

// Helper for plant sprites
const plant = (id: number, name: string, tex: number, color: string) => 
  createBlock(id, name, tex, tex, tex, color, { isSolid: false, isSprite: true, isTransparent: true });

// DEFINITIONS
// Texture IDs correlate to the patterns drawn in utils/textures.ts
export const BLOCK_DEFINITIONS: Record<number, BlockDefinition> = {
  [BlockType.AIR]: { id: 0, name: 'Air', isSolid: false, isTransparent: true, isFluid: false, isSprite: false, textures: {top:0,side:0,bottom:0}, mapColor: '#000000' },
  [BlockType.DIRT]: simple(BlockType.DIRT, 'Dirt', 1, '#5d4037'),
  [BlockType.GRASS]: createBlock(BlockType.GRASS, 'Grass', 3, 2, 1, '#388e3c'),
  [BlockType.STONE]: simple(BlockType.STONE, 'Stone', 30, '#757575'),
  
  [BlockType.OAK_LOG]: column(BlockType.OAK_LOG, 'Oak Log', 27, 4, '#3e2723'),
  [BlockType.OAK_LEAVES]: simple(BlockType.OAK_LEAVES, 'Oak Leaves', 5, '#2e7d32', { isTransparent: true }),
  
  [BlockType.WATER]: simple(BlockType.WATER, 'Water', 6, '#0288d1', { isSolid: false, isFluid: true, isTransparent: true }),
  
  [BlockType.SAND]: simple(BlockType.SAND, 'Sand', 7, '#fbc02d'),
  [BlockType.BEDROCK]: simple(BlockType.BEDROCK, 'Bedrock', 8, '#212121'),
  [BlockType.SNOW]: simple(BlockType.SNOW, 'Snow', 9, '#ECEFF1'),
  
  [BlockType.TALL_GRASS]: plant(BlockType.TALL_GRASS, 'Tall Grass', 10, '#4CAF50'),
  [BlockType.FLOWER_YELLOW]: plant(BlockType.FLOWER_YELLOW, 'Dandelion', 11, '#FFEB3B'),
  [BlockType.FLOWER_RED]: plant(BlockType.FLOWER_RED, 'Poppy', 12, '#F44336'),
  
  [BlockType.BIRCH_LOG]: column(BlockType.BIRCH_LOG, 'Birch Log', 28, 13, '#eceff1'),
  [BlockType.BIRCH_LEAVES]: simple(BlockType.BIRCH_LEAVES, 'Birch Leaves', 14, '#4caf50', { isTransparent: true }),
  
  [BlockType.SPRUCE_LOG]: column(BlockType.SPRUCE_LOG, 'Spruce Log', 29, 15, '#3e2723'),
  [BlockType.SPRUCE_LEAVES]: simple(BlockType.SPRUCE_LEAVES, 'Spruce Leaves', 16, '#1b5e20', { isTransparent: true }),
  
  [BlockType.CACTUS]: createBlock(BlockType.CACTUS, 'Cactus', 26, 17, 26, '#43a047', { isTransparent: true }), // Not full solid visually, but physics yes
  [BlockType.DEAD_BUSH]: plant(BlockType.DEAD_BUSH, 'Dead Bush', 18, '#5d4037'),
  
  [BlockType.SANDSTONE]: createBlock(BlockType.SANDSTONE, 'Sandstone', 19, 19, 19, '#ffcc80'),
  [BlockType.GRAVEL]: simple(BlockType.GRAVEL, 'Gravel', 20, '#9e9e9e'),
  
  [BlockType.TULIP_RED]: plant(BlockType.TULIP_RED, 'Red Tulip', 21, '#F44336'),
  [BlockType.TULIP_ORANGE]: plant(BlockType.TULIP_ORANGE, 'Orange Tulip', 22, '#ff9800'),
  [BlockType.TULIP_WHITE]: plant(BlockType.TULIP_WHITE, 'White Tulip', 23, '#f5f5f5'),
  [BlockType.TULIP_PINK]: plant(BlockType.TULIP_PINK, 'Pink Tulip', 24, '#e91e63'),
  [BlockType.CORNFLOWER]: plant(BlockType.CORNFLOWER, 'Cornflower', 25, '#2196f3'),
  
  [BlockType.ACACIA_LOG]: column(BlockType.ACACIA_LOG, 'Acacia Log', 33, 31, '#6D4C41'),
  [BlockType.ACACIA_LEAVES]: simple(BlockType.ACACIA_LEAVES, 'Acacia Leaves', 32, '#7CB342', { isTransparent: true }),
  
  [BlockType.JUNGLE_LOG]: column(BlockType.JUNGLE_LOG, 'Jungle Log', 36, 34, '#5D4037'),
  [BlockType.JUNGLE_LEAVES]: simple(BlockType.JUNGLE_LEAVES, 'Jungle Leaves', 35, '#1B5E20', { isTransparent: true }),
  
  [BlockType.RED_SAND]: simple(BlockType.RED_SAND, 'Red Sand', 37, '#D84315'),
  [BlockType.RED_SANDSTONE]: createBlock(BlockType.RED_SANDSTONE, 'Red Sandstone', 38, 38, 38, '#BF360C'),
  
  [BlockType.MELON]: createBlock(BlockType.MELON, 'Melon', 40, 39, 40, '#388E3C'),
  [BlockType.BLUE_ORCHID]: plant(BlockType.BLUE_ORCHID, 'Blue Orchid', 41, '#00BCD4'),
  [BlockType.SEAGRASS]: plant(BlockType.SEAGRASS, 'Seagrass', 42, '#388E3C'),
  
  [BlockType.SEA_LANTERN]: simple(BlockType.SEA_LANTERN, 'Sea Lantern', 43, '#E0F7FA', { lightLevel: 15 }),
};

export const getBlockDef = (id: number) => BLOCK_DEFINITIONS[id] || BLOCK_DEFINITIONS[BlockType.AIR];
