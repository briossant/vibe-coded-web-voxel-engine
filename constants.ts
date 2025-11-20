

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const WATER_LEVEL = 40;
export const DEFAULT_RENDER_DISTANCE = 64; 
export const MAX_RENDER_DISTANCE = 256;

export const TEXTURE_COLORS: Record<number, string> = {
  0: 'transparent',
  1: '#5d4037', // Dirt
  2: '#388e3c', // Grass
  3: '#757575', // Stone
  4: '#3e2723', // Oak Log
  5: '#2e7d32', // Oak Leaf
  6: '#0288d1', // Water
  7: '#fbc02d', // Sand
  8: '#212121', // Bedrock
  9: '#ECEFF1', // Snow
  10: '#4CAF50', // Tall Grass
  11: '#FFEB3B', // Flower Yellow
  12: '#F44336', // Flower Red
  13: '#eceff1', // Birch Log (White)
  14: '#4caf50', // Birch Leaf
  15: '#3e2723', // Spruce Log (Dark)
  16: '#1b5e20', // Spruce Leaf (Dark Green)
  17: '#43a047', // Cactus
  18: '#5d4037', // Dead Bush
  19: '#ffcc80', // Sandstone
  20: '#9e9e9e', // Gravel
  21: '#F44336', // Tulip Red
  22: '#ff9800', // Tulip Orange
  23: '#f5f5f5', // Tulip White
  24: '#e91e63', // Tulip Pink
  25: '#2196f3', // Cornflower
  26: '#6D4C41', // Acacia Log
  27: '#7CB342', // Acacia Leaves
  28: '#5D4037', // Jungle Log
  29: '#1B5E20', // Jungle Leaves
  30: '#D84315', // Red Sand
  31: '#BF360C', // Red Sandstone
  32: '#388E3C', // Melon
  33: '#00BCD4', // Blue Orchid
};

// Physics & Movement
export const GRAVITY = 32.0;
export const JUMP_FORCE = 10.0;
export const MOVE_SPEED = 8.0;        // Max running speed
export const SPRINT_SPEED = 15.0;     // Max sprinting speed
export const MOVE_ACCELERATION = 60.0; // How fast we reach max speed
export const MOVE_DECELERATION = 10.0; // Friction on ground
export const AIR_CONTROL = 0.3;       // Multiplier for control while in air
export const AIR_DRAG = 1.0;          // Friction in air