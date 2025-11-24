

export type BlockCategory = 'Nature' | 'Wood' | 'Plants' | 'Building' | 'Misc';

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

export class BlockRegistry {
  private defs: Map<number, BlockDefinition> = new Map();

  constructor() {
     // Register AIR by default to ensure safety
     this.register({ 
         id: 0, name: 'Air', category: 'Misc', 
         isSolid: false, isTransparent: true, isFluid: false, isSprite: false, 
         textures: {top:0,side:0,bottom:0}, mapColor: '#000000' 
     });
  }

  register(def: BlockDefinition) {
    this.defs.set(def.id, def);
  }

  get(id: number): BlockDefinition {
    return this.defs.get(id) || this.defs.get(0)!;
  }
  
  getAll(): BlockDefinition[] {
      return Array.from(this.defs.values());
  }
}

export const blockRegistry = new BlockRegistry();