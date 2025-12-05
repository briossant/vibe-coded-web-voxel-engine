import './content'; // Ensure blocks are registered
import { blockRegistry } from './registry';

export { BlockType } from './ids';
export { blockRegistry } from './registry';

export const getBlockDef = (id: number) => blockRegistry.get(id);
export const getAllBlocks = () => blockRegistry.getAll();

// Legacy support
export const BLOCK_DEFINITIONS = new Proxy({}, {
    get: (target, prop) => blockRegistry.get(Number(prop))
});
