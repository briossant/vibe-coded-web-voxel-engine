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
