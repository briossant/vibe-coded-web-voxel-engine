export interface TreeInstance {
  x: number;
  y: number;
  z: number;
  type: number; // 0: OAK, 1: BIRCH, 2: SPRUCE, 3: JUNGLE, 4: ACACIA
}

export interface ChunkData {
  id: string; // format "x,z"
  x: number;
  z: number;
  data: Uint8Array; // Flat array for voxel data
  heightMap: Int16Array; // 16x16 surface height map
  topLayer: Uint8Array; // 16x16 surface block ID map
  averageHeight: number; // Pre-calculated for fast LOD2 rendering
  biome: string; // For DistantTerrain material selection
  isDirty: boolean;
  trees: TreeInstance[];
}
