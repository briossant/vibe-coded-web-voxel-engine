

import { blockRegistry, BlockDefinition, BlockCategory } from './services/BlockRegistry.js';

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

const simple = (id: number, name: string, category: BlockCategory, tex: number, color: string, opts = {}) => 
  createBlock(id, name, category, tex, tex, tex, color, opts);

const column = (id: number, name: string, category: BlockCategory, top: number, side: number, color: string) => 
  createBlock(id, name, category, top, side, top, color);

const plant = (id: number, name: string, tex: number, color: string) => 
  createBlock(id, name, 'Plants', tex, tex, tex, color, { isSolid: false, isSprite: true, isTransparent: true });

// Register Blocks
const registerAll = () => {
    const reg = (d: BlockDefinition) => blockRegistry.register(d);

    // Natural Blocks - Desaturated Palette
    reg(simple(BlockType.DIRT, 'Dirt', 'Nature', 1, '#5C4E40'));
    reg(createBlock(BlockType.GRASS, 'Grass', 'Nature', 3, 2, 1, '#4C6436'));
    reg(simple(BlockType.STONE, 'Stone', 'Nature', 30, '#666666'));
    
    reg(column(BlockType.OAK_LOG, 'Oak Log', 'Wood', 27, 4, '#4A3C2E'));
    reg(simple(BlockType.OAK_LEAVES, 'Oak Leaves', 'Wood', 5, '#3A5F2D', { isTransparent: true }));
    
    reg(simple(BlockType.WATER, 'Water', 'Nature', 6, '#104E8B', { isSolid: false, isFluid: true, isTransparent: true }));
    
    reg(simple(BlockType.SAND, 'Sand', 'Nature', 7, '#C2B280'));
    reg(simple(BlockType.BEDROCK, 'Bedrock', 'Nature', 8, '#222222'));
    reg(simple(BlockType.SNOW, 'Snow', 'Nature', 9, '#F0F0F0'));
    
    reg(plant(BlockType.TALL_GRASS, 'Tall Grass', 10, '#4C6436'));
    reg(plant(BlockType.FLOWER_YELLOW, 'Dandelion', 11, '#EBC347'));
    reg(plant(BlockType.FLOWER_RED, 'Poppy', 12, '#C9342D'));
    
    reg(column(BlockType.BIRCH_LOG, 'Birch Log', 'Wood', 28, 13, '#D9D9D5'));
    reg(simple(BlockType.BIRCH_LEAVES, 'Birch Leaves', 'Wood', 14, '#5E7545', { isTransparent: true }));
    
    reg(column(BlockType.SPRUCE_LOG, 'Spruce Log', 'Wood', 29, 15, '#332721'));
    reg(simple(BlockType.SPRUCE_LEAVES, 'Spruce Leaves', 'Wood', 16, '#263624', { isTransparent: true }));
    
    reg(createBlock(BlockType.CACTUS, 'Cactus', 'Nature', 26, 17, 26, '#3E5E33', { isTransparent: true }));
    reg(plant(BlockType.DEAD_BUSH, 'Dead Bush', 18, '#5C4E40'));
    
    reg(createBlock(BlockType.SANDSTONE, 'Sandstone', 'Building', 19, 19, 19, '#C2B280'));
    reg(simple(BlockType.GRAVEL, 'Gravel', 'Nature', 20, '#757575'));
    
    reg(plant(BlockType.TULIP_RED, 'Red Tulip', 21, '#C9342D'));
    reg(plant(BlockType.TULIP_ORANGE, 'Orange Tulip', 22, '#D97E25'));
    reg(plant(BlockType.TULIP_WHITE, 'White Tulip', 23, '#E0E0E0'));
    reg(plant(BlockType.TULIP_PINK, 'Pink Tulip', 24, '#D45D79'));
    reg(plant(BlockType.CORNFLOWER, 'Cornflower', 25, '#3B6DA3'));
    
    reg(column(BlockType.ACACIA_LOG, 'Acacia Log', 'Wood', 33, 31, '#54463D'));
    reg(simple(BlockType.ACACIA_LEAVES, 'Acacia Leaves', 'Wood', 32, '#5E6F2A', { isTransparent: true }));
    
    reg(column(BlockType.JUNGLE_LOG, 'Jungle Log', 'Wood', 36, 34, '#473B28'));
    reg(simple(BlockType.JUNGLE_LEAVES, 'Jungle Leaves', 'Wood', 35, '#225920', { isTransparent: true }));
    
    reg(simple(BlockType.RED_SAND, 'Red Sand', 'Nature', 37, '#A64D23'));
    reg(createBlock(BlockType.RED_SANDSTONE, 'Red Sandstone', 'Building', 38, 38, 38, '#943E16'));
    
    reg(createBlock(BlockType.MELON, 'Melon', 'Nature', 40, 39, 40, '#608F32'));
    reg(plant(BlockType.BLUE_ORCHID, 'Blue Orchid', 41, '#2A9CAA'));
    reg(plant(BlockType.SEAGRASS, 'Seagrass', 42, '#3A5F2D'));
    
    reg(simple(BlockType.SEA_LANTERN, 'Sea Lantern', 'Building', 43, '#9DD4D9', { lightLevel: 15 }));
    reg(simple(BlockType.CLAY, 'Clay', 'Nature', 44, '#8D93B8'));
};

registerAll();

export const getBlockDef = (id: number) => blockRegistry.get(id);
export const getAllBlocks = () => blockRegistry.getAll();
// Legacy support for ChunkLoader logic until fully refactored, though ChunkLoader should use registry now
export const BLOCK_DEFINITIONS = new Proxy({}, {
    get: (target, prop) => blockRegistry.get(Number(prop))
});