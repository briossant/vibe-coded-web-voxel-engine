




export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 384;
export const WATER_LEVEL = 64;
export const DEFAULT_RENDER_DISTANCE = 32; 
export const MAX_RENDER_DISTANCE = 128;

// Physics & Movement
export const GRAVITY = 32.0;
export const JUMP_FORCE = 10.0;
export const MOVE_SPEED = 8.0;        // Max running speed
export const SPRINT_SPEED = 15.0;     // Max sprinting speed
export const MOVE_ACCELERATION = 60.0; // How fast we reach max speed
export const MOVE_DECELERATION = 10.0; // Friction on ground
export const AIR_CONTROL = 0.3;       // Multiplier for control while in air
export const AIR_DRAG = 1.0;          // Friction in air