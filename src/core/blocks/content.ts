import { blockRegistry } from './registry';
import { BlockType } from './ids';
import { BlockDefinition, BlockCategory } from '@/src/types/blocks';

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

    // Natural Blocks - Darker/Richer Palette for Distant Terrain
    reg(simple(BlockType.DIRT, 'Dirt', 'Nature', 1, '#3B2A22')); // Deep brown
    reg(createBlock(BlockType.GRASS, 'Grass', 'Nature', 3, 2, 1, '#447A38')); // Deep forest green
    reg(simple(BlockType.STONE, 'Stone', 'Nature', 30, '#333333')); // Deep gray
    
    reg(column(BlockType.OAK_LOG, 'Oak Log', 'Wood', 27, 4, '#4A3C2E'));
    reg(simple(BlockType.OAK_LEAVES, 'Oak Leaves', 'Wood', 5, '#2D4A22', { isTransparent: true }));
    
    // Light Blue for better visibility at distance
    reg(simple(BlockType.WATER, 'Water', 'Nature', 6, '#5e9cd9', { isSolid: false, isFluid: true, isTransparent: true }));
    
    reg(simple(BlockType.SAND, 'Sand', 'Nature', 7, '#C2B280'));
    reg(simple(BlockType.BEDROCK, 'Bedrock', 'Nature', 8, '#111111'));
    reg(simple(BlockType.SNOW, 'Snow', 'Nature', 9, '#E0E0E0'));
    
    reg(plant(BlockType.TALL_GRASS, 'Tall Grass', 10, '#3A5025'));
    reg(plant(BlockType.FLOWER_YELLOW, 'Dandelion', 11, '#D4B030'));
    reg(plant(BlockType.FLOWER_RED, 'Poppy', 12, '#B02020'));
    
    reg(column(BlockType.BIRCH_LOG, 'Birch Log', 'Wood', 28, 13, '#C0C0BB'));
    reg(simple(BlockType.BIRCH_LEAVES, 'Birch Leaves', 'Wood', 14, '#4E6535', { isTransparent: true }));
    
    reg(column(BlockType.SPRUCE_LOG, 'Spruce Log', 'Wood', 29, 15, '#2E1C15'));
    reg(simple(BlockType.SPRUCE_LEAVES, 'Spruce Leaves', 'Wood', 16, '#1A2818', { isTransparent: true }));
    
    reg(createBlock(BlockType.CACTUS, 'Cactus', 'Nature', 26, 17, 26, '#304A25', { isTransparent: true }));
    reg(plant(BlockType.DEAD_BUSH, 'Dead Bush', 18, '#4A3E30'));
    
    reg(createBlock(BlockType.SANDSTONE, 'Sandstone', 'Building', 19, 19, 19, '#B0A070'));
    reg(simple(BlockType.GRAVEL, 'Gravel', 'Nature', 20, '#606060'));
    
    reg(plant(BlockType.TULIP_RED, 'Red Tulip', 21, '#B02020'));
    reg(plant(BlockType.TULIP_ORANGE, 'Orange Tulip', 22, '#C06515'));
    reg(plant(BlockType.TULIP_WHITE, 'White Tulip', 23, '#D0D0D0'));
    reg(plant(BlockType.TULIP_PINK, 'Pink Tulip', 24, '#C04560'));
    reg(plant(BlockType.CORNFLOWER, 'Cornflower', 25, '#2B5D93'));
    
    reg(column(BlockType.ACACIA_LOG, 'Acacia Log', 'Wood', 33, 31, '#44362D'));
    reg(simple(BlockType.ACACIA_LEAVES, 'Acacia Leaves', 'Wood', 32, '#4E5F1A', { isTransparent: true }));
    
    reg(column(BlockType.JUNGLE_LOG, 'Jungle Log', 'Wood', 36, 34, '#372B18'));
    reg(simple(BlockType.JUNGLE_LEAVES, 'Jungle Leaves', 'Wood', 35, '#124910', { isTransparent: true }));
    
    reg(simple(BlockType.RED_SAND, 'Red Sand', 'Nature', 37, '#c63D13'));
    reg(createBlock(BlockType.RED_SANDSTONE, 'Red Sandstone', 'Building', 38, 38, 38, '#e42E06'));
    
    reg(createBlock(BlockType.MELON, 'Melon', 'Nature', 40, 39, 40, '#507F22'));
    reg(plant(BlockType.BLUE_ORCHID, 'Blue Orchid', 41, '#1A8C9A'));
    reg(plant(BlockType.SEAGRASS, 'Seagrass', 42, '#2A4F1D'));
    
    reg(simple(BlockType.SEA_LANTERN, 'Sea Lantern', 'Building', 43, '#8DC4C9', { lightLevel: 15 }));
    reg(simple(BlockType.CLAY, 'Clay', 'Nature', 44, '#7D83A8'));
};

registerAll();
