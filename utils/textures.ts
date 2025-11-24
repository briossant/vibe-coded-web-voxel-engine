
import * as THREE from 'three';
import { getBlockDef } from '../blocks';
import { TEXTURE_ATLAS_SIZE } from '../constants';

const TILE_SIZE = 32;
const S = 2; // Scale factor from original 16px designs

// Re-export for compatibility if needed, though direct import from constants is preferred
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

  // Helper for noise generation
  const fill = (idx: number, color: string, noiseIntensity: number = 0.1) => {
      const x = idx * TILE_SIZE;
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, TILE_SIZE, TILE_SIZE);
      
      // Add High Res Noise (1px grains)
      for(let i=0; i<TILE_SIZE; i++) {
        for(let j=0; j<TILE_SIZE; j++) {
             if (Math.random() > 0.5) {
                 ctx.fillStyle = `rgba(0,0,0,${noiseIntensity})`;
             } else {
                 ctx.fillStyle = `rgba(255,255,255,${noiseIntensity/2})`;
             }
             ctx.fillRect(x + i, j, 1, 1);
        }
      }
      
      // Border definition for blockiness
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.strokeRect(x+0.5, 0.5, TILE_SIZE-1, TILE_SIZE-1);
  };

  const flower = (idx: number, stemColor: string, petalColor: string, centerColor: string = '#FFFF00') => {
      const x = idx * TILE_SIZE;
      ctx.clearRect(x, 0, TILE_SIZE, TILE_SIZE);
      // Scale positions by S to maintain shape at higher res
      ctx.fillStyle = stemColor; 
      ctx.fillRect(x + 7*S, 8*S, 2*S, 8*S); 
      ctx.fillStyle = petalColor;
      ctx.fillRect(x + 5*S, 3*S, 6*S, 6*S); 
      ctx.fillStyle = centerColor;
      ctx.fillRect(x + 7*S, 5*S, 2*S, 2*S); 
  };
  
  // High resolution leaves with 1px details
  const leaves = (idx: number, colorHex: string) => {
      const x = idx * TILE_SIZE;
      ctx.clearRect(x, 0, TILE_SIZE, TILE_SIZE);
      
      for(let i=0; i<TILE_SIZE; i++) {
          for(let j=0; j<TILE_SIZE; j++) {
              // 65% fill rate for high res bushy look
              if(Math.random() < 0.65) {
                  ctx.fillStyle = colorHex;
                  ctx.fillRect(x + i, j, 1, 1);
                  
                  // Add detailed shading per pixel
                  const shade = Math.random();
                  if (shade > 0.8) {
                       ctx.fillStyle = 'rgba(255,255,255,0.15)';
                       ctx.fillRect(x + i, j, 1, 1);
                  } else if (shade < 0.3) {
                       ctx.fillStyle = 'rgba(0,0,0,0.15)';
                       ctx.fillRect(x + i, j, 1, 1);
                  }
              }
          }
      }
  };

  // -- PALETTE UPDATES (Less Saturation, More Earthy) --
  
  // 0: Error
  // Use transparent/empty instead of magenta to prevent purple bleeding in mipmaps
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // 1: Dirt (Darker brown)
  fill(1, '#5D4037', 0.15); 
  // 2: Grass Side
  fill(2, '#5D4037', 0.15);
  ctx.fillStyle = '#558B2F'; // Less neon green
  ctx.fillRect(2 * TILE_SIZE, 0, TILE_SIZE, 4 * S);
  // 3: Grass Top
  fill(3, '#558B2F', 0.1);
  // 4: Oak Log Side
  fill(4, '#4E342E', 0.2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(4*TILE_SIZE + 4*S, 0, 2*S, 16*S); 
  ctx.fillRect(4*TILE_SIZE + 10*S, 0, 2*S, 16*S);
  
  // 5: Oak Leaf (Bushy)
  leaves(5, '#33691E'); 
  
  // 6: Water
  fill(6, '#4FC3F7', 0.05);
  
  // 7: Sand
  fill(7, '#E6EE9C', 0.1); 
  // 8: Bedrock
  fill(8, '#212121', 0.4);
  // 9: Snow
  fill(9, '#FAFAFA', 0.05);

  // 10: Tall Grass
  const x10 = 10 * TILE_SIZE;
  ctx.clearRect(x10, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#558B2F';
  ctx.fillRect(x10 + 6*S, 2*S, 2*S, 14*S); 
  ctx.fillRect(x10 + 2*S, 6*S, 2*S, 10*S); 
  ctx.fillRect(x10 + 10*S, 5*S, 2*S, 11*S); 
  
  // 11: Flower Yellow
  flower(11, '#33691E', '#FDD835', '#FBC02D');
  // 12: Flower Red
  flower(12, '#33691E', '#E53935', '#B71C1C');

  // 13: Birch Log Side
  fill(13, '#ECEFF1', 0.1);
  ctx.fillStyle = '#263238';
  for(let i=0;i<6;i++) ctx.fillRect(13*TILE_SIZE + Math.random()*(12*S), Math.random()*(16*S), 3*S, 1*S);

  // 14: Birch Leaves (Bushy)
  leaves(14, '#7CB342');

  // 15: Spruce Log Side
  fill(15, '#3E2723', 0.2);
  
  // 16: Spruce Leaves (Bushy)
  leaves(16, '#1B5E20');

  // 17: Cactus Side
  fill(17, '#43A047', 0.1);
  ctx.fillStyle = '#2E7D32'; 
  ctx.fillRect(17*TILE_SIZE + 2*S, 0, 2*S, 16*S);
  ctx.fillRect(17*TILE_SIZE + 7*S, 0, 2*S, 16*S);
  ctx.fillRect(17*TILE_SIZE + 12*S, 0, 2*S, 16*S);

  // 18: Dead Bush
  const x18 = 18 * TILE_SIZE;
  ctx.clearRect(x18, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(x18 + 7*S, 10*S, 2*S, 6*S);
  ctx.fillRect(x18 + 4*S, 6*S, 8*S, 1*S);

  // 19: Sandstone
  fill(19, '#FFCC80', 0.1);
  ctx.fillStyle = '#EF6C00';
  ctx.fillRect(19*TILE_SIZE, 14*S, 16*S, 2*S);

  // 20: Gravel
  fill(20, '#9E9E9E', 0.3);
  
  // Flowers
  flower(21, '#33691E', '#D32F2F', '#FFC107'); // Red
  flower(22, '#33691E', '#F57C00', '#FFEB3B'); // Orange
  flower(23, '#33691E', '#F5F5F5', '#9E9E9E'); // White
  flower(24, '#33691E', '#EC407A', '#F8BBD0'); // Pink
  flower(25, '#33691E', '#2196F3', '#1565C0'); // Cornflower

  // 26: Cactus Top
  fill(26, '#43A047', 0.1);
  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(26*TILE_SIZE+2*S, 2*S, 12*S, 12*S);

  // 27: Log Top (Oak)
  fill(27, '#4E342E', 0.1);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(27*TILE_SIZE+2*S, 2*S, 12*S, 12*S);
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(27*TILE_SIZE+5*S, 5*S, 6*S, 6*S);

  // 28: Log Top (Birch)
  fill(28, '#ECEFF1', 0.1);
  ctx.fillStyle = '#CFD8DC'; 
  ctx.fillRect(28*TILE_SIZE+2*S, 2*S, 12*S, 12*S);

  // 29: Log Top (Spruce)
  fill(29, '#3E2723', 0.1);
  ctx.fillStyle = '#4E342E'; 
  ctx.fillRect(29*TILE_SIZE+2*S, 2*S, 12*S, 12*S);

  // 30: Stone
  fill(30, '#757575', 0.2);

  // 31: Acacia Log Side
  fill(31, '#6D4C41', 0.15);
  
  // 32: Acacia Leaves (Bushy)
  leaves(32, '#7CB342');

  // 33: Acacia Top
  fill(33, '#6D4C41', 0.1);
  ctx.fillStyle = '#FF7043';
  ctx.fillRect(33*TILE_SIZE+3*S, 3*S, 10*S, 10*S);

  // 34: Jungle Log Side
  fill(34, '#5D4037', 0.2);

  // 35: Jungle Leaves (Bushy)
  leaves(35, '#1B5E20');
  
  // 36: Jungle Top
  fill(36, '#5D4037', 0.1);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(36*TILE_SIZE+2*S, 2*S, 12*S, 12*S);

  // 37: Red Sand
  fill(37, '#BF360C', 0.15);

  // 38: Red Sandstone
  fill(38, '#D84315', 0.15);

  // 39: Melon Side
  fill(39, '#388E3C', 0.1);
  
  // 40: Melon Top
  fill(40, '#388E3C', 0.1);

  // 41: Blue Orchid
  flower(41, '#33691E', '#00BCD4', '#E0F7FA');

  // 42: Seagrass
  const x42 = 42 * TILE_SIZE;
  ctx.clearRect(x42, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#33691E';
  ctx.fillRect(x42 + 4*S, 4*S, 2*S, 12*S);
  ctx.fillRect(x42 + 8*S, 2*S, 2*S, 14*S);

  // 43: Sea Lantern
  fill(43, '#E0F7FA', 0.05);
  ctx.fillStyle = '#00BCD4';
  ctx.fillRect(43*TILE_SIZE + 2*S, 2*S, 12*S, 12*S);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(43*TILE_SIZE + 5*S, 5*S, 6*S, 6*S);
  
  // 44: Clay
  fill(44, '#9FA8DA', 0.15);

  const tex = new THREE.CanvasTexture(canvas);
  // Use LinearMipmapLinearFilter (Trilinear) to smooth out distant noise
  tex.minFilter = THREE.LinearMipmapLinearFilter; 
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
