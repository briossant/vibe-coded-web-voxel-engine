
import { BlockDefinition, BlockCategory } from './types';

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
  CLAY: 36,
} as const;

// Helper to create simple blocks
const createBlock = (
  id: number, 
  name: string, 
  category: BlockCategory,
  texTop: number, 
  texSide: number, 
  texBot: number, 
  color: string,
  opts: Partial<BlockDefinition> = {}
): BlockDefinition => ({
  id,
  name,
  category,
  isSolid: true,
  isTransparent: false,
  isFluid: false,
  isSprite: false,
  textures: { top: texTop, side: texSide, bottom: texBot },
  mapColor: color,
  ...opts
});

// Helper for simple 1-texture blocks
const simple = (id: number, name: string, category: BlockCategory, tex: number, color: string, opts = {}) => 
  createBlock(id, name, category, tex, tex, tex, color, opts);

// Helper for column blocks (logs)
const column = (id: number, name: string, category: BlockCategory, top: number, side: number, color: string) => 
  createBlock(id, name, category, top, side, top, color);

// Helper for plant sprites
const plant = (id: number, name: string, tex: number, color: string) => 
  createBlock(id, name, 'Plants', tex, tex, tex, color, { isSolid: false, isSprite: true, isTransparent: true });

// DEFINITIONS
// Colors updated to be more natural/earthy and less saturated to match high-res rendering better
export const BLOCK_DEFINITIONS: Record<number, BlockDefinition> = {
  [BlockType.AIR]: { id: 0, name: 'Air', category: 'Misc', isSolid: false, isTransparent: true, isFluid: false, isSprite: false, textures: {top:0,side:0,bottom:0}, mapColor: '#000000' },
  
  // Natural Blocks - Desaturated Palette
  [BlockType.DIRT]: simple(BlockType.DIRT, 'Dirt', 'Nature', 1, '#5C4E40'), // Darker, less red
  [BlockType.GRASS]: createBlock(BlockType.GRASS, 'Grass', 'Nature', 3, 2, 1, '#4C6436'), // Desaturated earthy green
  [BlockType.STONE]: simple(BlockType.STONE, 'Stone', 'Nature', 30, '#666666'), // Neutral grey
  
  [BlockType.OAK_LOG]: column(BlockType.OAK_LOG, 'Oak Log', 'Wood', 27, 4, '#4A3C2E'),
  [BlockType.OAK_LEAVES]: simple(BlockType.OAK_LEAVES, 'Oak Leaves', 'Wood', 5, '#3A5F2D', { isTransparent: true }),
  
  [BlockType.WATER]: simple(BlockType.WATER, 'Water', 'Nature', 6, '#104E8B', { isSolid: false, isFluid: true, isTransparent: true }), // Deeper, richer blue
  
  [BlockType.SAND]: simple(BlockType.SAND, 'Sand', 'Nature', 7, '#C2B280'), // Pale desert sand
  [BlockType.BEDROCK]: simple(BlockType.BEDROCK, 'Bedrock', 'Nature', 8, '#222222'),
  [BlockType.SNOW]: simple(BlockType.SNOW, 'Snow', 'Nature', 9, '#F0F0F0'),
  
  [BlockType.TALL_GRASS]: plant(BlockType.TALL_GRASS, 'Tall Grass', 10, '#4C6436'),
  [BlockType.FLOWER_YELLOW]: plant(BlockType.FLOWER_YELLOW, 'Dandelion', 11, '#EBC347'),
  [BlockType.FLOWER_RED]: plant(BlockType.FLOWER_RED, 'Poppy', 12, '#C9342D'),
  
  [BlockType.BIRCH_LOG]: column(BlockType.BIRCH_LOG, 'Birch Log', 'Wood', 28, 13, '#D9D9D5'),
  [BlockType.BIRCH_LEAVES]: simple(BlockType.BIRCH_LEAVES, 'Birch Leaves', 'Wood', 14, '#5E7545', { isTransparent: true }),
  
  [BlockType.SPRUCE_LOG]: column(BlockType.SPRUCE_LOG, 'Spruce Log', 'Wood', 29, 15, '#332721'),
  [BlockType.SPRUCE_LEAVES]: simple(BlockType.SPRUCE_LEAVES, 'Spruce Leaves', 'Wood', 16, '#263624', { isTransparent: true }),
  
  [BlockType.CACTUS]: createBlock(BlockType.CACTUS, 'Cactus', 'Nature', 26, 17, 26, '#3E5E33', { isTransparent: true }), 
  [BlockType.DEAD_BUSH]: plant(BlockType.DEAD_BUSH, 'Dead Bush', 18, '#5C4E40'),
  
  [BlockType.SANDSTONE]: createBlock(BlockType.SANDSTONE, 'Sandstone', 'Building', 19, 19, 19, '#C2B280'),
  [BlockType.GRAVEL]: simple(BlockType.GRAVEL, 'Gravel', 'Nature', 20, '#757575'),
  
  [BlockType.TULIP_RED]: plant(BlockType.TULIP_RED, 'Red Tulip', 21, '#C9342D'),
  [BlockType.TULIP_ORANGE]: plant(BlockType.TULIP_ORANGE, 'Orange Tulip', 22, '#D97E25'),
  [BlockType.TULIP_WHITE]: plant(BlockType.TULIP_WHITE, 'White Tulip', 23, '#E0E0E0'),
  [BlockType.TULIP_PINK]: plant(BlockType.TULIP_PINK, 'Pink Tulip', 24, '#D45D79'),
  [BlockType.CORNFLOWER]: plant(BlockType.CORNFLOWER, 'Cornflower', 25, '#3B6DA3'),
  
  [BlockType.ACACIA_LOG]: column(BlockType.ACACIA_LOG, 'Acacia Log', 'Wood', 33, 31, '#54463D'),
  [BlockType.ACACIA_LEAVES]: simple(BlockType.ACACIA_LEAVES, 'Acacia Leaves', 'Wood', 32, '#5E6F2A', { isTransparent: true }),
  
  [BlockType.JUNGLE_LOG]: column(BlockType.JUNGLE_LOG, 'Jungle Log', 'Wood', 36, 34, '#473B28'),
  [BlockType.JUNGLE_LEAVES]: simple(BlockType.JUNGLE_LEAVES, 'Jungle Leaves', 'Wood', 35, '#225920', { isTransparent: true }),
  
  [BlockType.RED_SAND]: simple(BlockType.RED_SAND, 'Red Sand', 'Nature', 37, '#A64D23'),
  [BlockType.RED_SANDSTONE]: createBlock(BlockType.RED_SANDSTONE, 'Red Sandstone', 'Building', 38, 38, 38, '#943E16'),
  
  [BlockType.MELON]: createBlock(BlockType.MELON, 'Melon', 'Nature', 40, 39, 40, '#608F32'),
  [BlockType.BLUE_ORCHID]: plant(BlockType.BLUE_ORCHID, 'Blue Orchid', 41, '#2A9CAA'),
  [BlockType.SEAGRASS]: plant(BlockType.SEAGRASS, 'Seagrass', 42, '#3A5F2D'),
  
  [BlockType.SEA_LANTERN]: simple(BlockType.SEA_LANTERN, 'Sea Lantern', 'Building', 43, '#9DD4D9', { lightLevel: 15 }),
  [BlockType.CLAY]: simple(BlockType.CLAY, 'Clay', 'Nature', 44, '#8D93B8'),
};

export const getBlockDef = (id: number) => BLOCK_DEFINITIONS[id] || BLOCK_DEFINITIONS[BlockType.AIR];
