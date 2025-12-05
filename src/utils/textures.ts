import * as THREE from 'three';
import { getBlockDef } from '@/src/core/blocks';
import { TEXTURE_ATLAS_SIZE } from '@/src/constants';

const TILE_SIZE = 32;
const S = 2; // Scale factor from original 16px designs

// Re-export for compatibility if needed
export { TEXTURE_ATLAS_SIZE };

const createAtlas = () => {
  // WORKER SAFETY CHECK: Workers do not have access to document/canvas.
  if (typeof document === 'undefined') {
      return { tex: null as any, url: '' };
  }

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * TEXTURE_ATLAS_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { tex: new THREE.Texture(), url: '' };

  // --- TEXTURE GENERATION STYLE: CLEAN / MINIMALIST ---
  // We are removing high-frequency noise to prevent aliasing artifacts at distance.
  // Instead of random 1px noise, we use larger "patches" or gradients.

  const fill = (idx: number, color: string, noiseIntensity: number = 0.03) => {
      const x = idx * TILE_SIZE;
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, TILE_SIZE, TILE_SIZE);
      
      // Add subtle texture variations (larger grains)
      // 4x4 pixel blocks for noise instead of 1x1 to reduce high freq aliasing
      const grainSize = 4; 
      for(let i=0; i<TILE_SIZE; i+=grainSize) {
        for(let j=0; j<TILE_SIZE; j+=grainSize) {
             if (Math.random() > 0.5) {
                 ctx.fillStyle = `rgba(0,0,0,${noiseIntensity})`;
             } else {
                 ctx.fillStyle = `rgba(255,255,255,${noiseIntensity/2})`;
             }
             ctx.fillRect(x + i, j, grainSize, grainSize);
        }
      }
      
      // Subtle border
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x+1, 1, TILE_SIZE-2, TILE_SIZE-2);
  };

  const flower = (idx: number, stemColor: string, petalColor: string, centerColor: string = '#FFFF00') => {
      const x = idx * TILE_SIZE;
      ctx.clearRect(x, 0, TILE_SIZE, TILE_SIZE);
      // Stem
      ctx.fillStyle = stemColor; 
      ctx.fillRect(x + 14, 16, 4, 16); 
      // Petals
      ctx.fillStyle = petalColor;
      ctx.fillRect(x + 10, 6, 12, 12); 
      // Center
      ctx.fillStyle = centerColor;
      ctx.fillRect(x + 14, 10, 4, 4); 
  };
  
  const leaves = (idx: number, colorHex: string) => {
      const x = idx * TILE_SIZE;
      ctx.fillStyle = colorHex; // Opaque background for cleaner look
      ctx.fillRect(x, 0, TILE_SIZE, TILE_SIZE);
      
      // Add simple pattern
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for(let i=0; i<TILE_SIZE; i+=8) {
          for(let j=0; j<TILE_SIZE; j+=8) {
              if ((i+j)%16 === 0) ctx.fillRect(x+i, j, 8, 8);
          }
      }
  };

  // -- PALETTE UPDATES (Clean, Vibrant but Matte) --
  
  // 0: Error
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // 1: Dirt
  fill(1, '#795548', 0.05); 
  // 2: Grass Side
  fill(2, '#795548', 0.05);
  ctx.fillStyle = '#7CB342'; // Cleaner green
  ctx.fillRect(2 * TILE_SIZE, 0, TILE_SIZE, 10); // Top 10px
  // 3: Grass Top
  fill(3, '#7CB342', 0.04);
  // 4: Oak Log Side
  fill(4, '#6D4C41', 0.05);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; // Bark lines
  ctx.fillRect(4*TILE_SIZE + 8, 0, 4, 32); 
  ctx.fillRect(4*TILE_SIZE + 20, 0, 4, 32);
  
  // 5: Oak Leaf
  leaves(5, '#558B2F'); 
  
  // 6: Water
  fill(6, '#29B6F6', 0.0); // Flat blue for water
  
  // 7: Sand
  fill(7, '#FFF59D', 0.05); 
  // 8: Bedrock
  fill(8, '#212121', 0.1);
  // 9: Snow
  fill(9, '#FFFFFF', 0.02);

  // 10: Tall Grass
  const x10 = 10 * TILE_SIZE;
  ctx.clearRect(x10, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#7CB342';
  ctx.fillRect(x10 + 12, 4, 4, 28); 
  ctx.fillRect(x10 + 4, 12, 4, 20); 
  
  // 11: Flower Yellow
  flower(11, '#558B2F', '#FFEB3B', '#FBC02D');
  // 12: Flower Red
  flower(12, '#558B2F', '#E53935', '#B71C1C');

  // 13: Birch Log Side
  fill(13, '#ECEFF1', 0.02);
  ctx.fillStyle = '#37474F'; // Dark spots
  for(let i=0;i<4;i++) ctx.fillRect(13*TILE_SIZE + Math.random()*24, Math.random()*28, 6, 2);

  // 14: Birch Leaves
  leaves(14, '#9CCC65');

  // 15: Spruce Log Side
  fill(15, '#3E2723', 0.05);
  
  // 16: Spruce Leaves
  leaves(16, '#33691E');

  // 17: Cactus Side
  fill(17, '#66BB6A', 0.05);
  ctx.fillStyle = '#2E7D32'; 
  ctx.fillRect(17*TILE_SIZE + 4, 0, 4, 32);
  ctx.fillRect(17*TILE_SIZE + 14, 0, 4, 32);
  ctx.fillRect(17*TILE_SIZE + 24, 0, 4, 32);

  // 18: Dead Bush
  const x18 = 18 * TILE_SIZE;
  ctx.clearRect(x18, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(x18 + 14, 20, 4, 12);
  ctx.fillRect(x18 + 8, 12, 16, 2);

  // 19: Sandstone
  fill(19, '#FFE0B2', 0.04);
  ctx.fillStyle = '#FFB74D';
  ctx.fillRect(19*TILE_SIZE, 28, 32, 4);

  // 20: Gravel
  fill(20, '#BDBDBD', 0.15); // Gravel is naturally noisy
  
  // Flowers
  flower(21, '#558B2F', '#E57373', '#FFC107'); 
  flower(22, '#558B2F', '#FFB74D', '#FFEB3B'); 
  flower(23, '#558B2F', '#F5F5F5', '#9E9E9E'); 
  flower(24, '#558B2F', '#F06292', '#F8BBD0'); 
  flower(25, '#558B2F', '#42A5F5', '#1565C0'); 

  // 26: Cactus Top
  fill(26, '#66BB6A', 0.05);
  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(26*TILE_SIZE+4, 4, 24, 24);

  // 27: Log Top (Oak)
  fill(27, '#6D4C41', 0.05);
  ctx.fillStyle = '#A1887F';
  ctx.fillRect(27*TILE_SIZE+4, 4, 24, 24);

  // 28: Log Top (Birch)
  fill(28, '#ECEFF1', 0.02);
  ctx.fillStyle = '#CFD8DC'; 
  ctx.fillRect(28*TILE_SIZE+4, 4, 24, 24);

  // 29: Log Top (Spruce)
  fill(29, '#3E2723', 0.05);
  ctx.fillStyle = '#5D4037'; 
  ctx.fillRect(29*TILE_SIZE+4, 4, 24, 24);

  // 30: Stone
  fill(30, '#9E9E9E', 0.05);

  // 31: Acacia Log Side
  fill(31, '#8D6E63', 0.05);
  
  // 32: Acacia Leaves
  leaves(32, '#AED581');

  // 33: Acacia Top
  fill(33, '#8D6E63', 0.05);
  ctx.fillStyle = '#FFAB91';
  ctx.fillRect(33*TILE_SIZE+6, 6, 20, 20);

  // 34: Jungle Log Side
  fill(34, '#5D4037', 0.05);

  // 35: Jungle Leaves
  leaves(35, '#2E7D32');
  
  // 36: Jungle Top
  fill(36, '#5D4037', 0.05);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(36*TILE_SIZE+4, 4, 24, 24);

  // 37: Red Sand
  fill(37, '#FF7043', 0.05);

  // 38: Red Sandstone
  fill(38, '#FF5722', 0.05);

  // 39: Melon Side
  fill(39, '#66BB6A', 0.05);
  
  // 40: Melon Top
  fill(40, '#66BB6A', 0.05);

  // 41: Blue Orchid
  flower(41, '#558B2F', '#26C6DA', '#E0F7FA');

  // 42: Seagrass
  const x42 = 42 * TILE_SIZE;
  ctx.clearRect(x42, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#558B2F';
  ctx.fillRect(x42 + 8, 8, 4, 24);
  ctx.fillRect(x42 + 16, 4, 4, 28);

  // 43: Sea Lantern
  fill(43, '#E0F7FA', 0.01);
  ctx.fillStyle = '#4DD0E1';
  ctx.fillRect(43*TILE_SIZE + 4, 4, 24, 24);
  
  // 44: Clay
  fill(44, '#9FA8DA', 0.05);

  const tex = new THREE.CanvasTexture(canvas);
  // RESTORE MIPMAPS with Nearest Mag Filter
  // This prevents the "shimmering noise" at distance while keeping close-ups blocky.
  // The cleaner textures generated above will reduce the "mushy" look.
  tex.minFilter = THREE.NearestMipmapLinearFilter; 
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  
  return { tex, url: canvas.toDataURL() };
};

const { tex, url } = createAtlas();
export const globalTexture = tex;
export const textureUrl = url;

export const getUVOffset = (type: number, normal: number[]): [number, number] => {
   const def = getBlockDef(type);
   const ny = normal[1];
   
   let idx = def.textures.side;
   if (ny > 0.5) idx = def.textures.top;
   if (ny < -0.5) idx = def.textures.bottom;
   
   return [idx / TEXTURE_ATLAS_SIZE, 0];
};