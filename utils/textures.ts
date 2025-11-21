
import * as THREE from 'three';
import { getBlockDef } from '../blocks';

// Texture Atlas: 16x16 pixels, 64 tiles wide
export const TEXTURE_ATLAS_SIZE = 64;
const TILE_SIZE = 16;

const createAtlas = () => {
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
      
      // Add noise
      for(let i=0; i<8; i++) {
        for(let j=0; j<8; j++) {
             if (Math.random() > 0.5) {
                 ctx.fillStyle = `rgba(0,0,0,${noiseIntensity})`;
                 ctx.fillRect(x + i*2, j*2, 2, 2);
             } else {
                 ctx.fillStyle = `rgba(255,255,255,${noiseIntensity/2})`;
                 ctx.fillRect(x + i*2, j*2, 2, 2);
             }
        }
      }
      
      // Border definition for blockiness
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.strokeRect(x+0.5, 0.5, TILE_SIZE-1, TILE_SIZE-1);
  };

  const flower = (idx: number, stemColor: string, petalColor: string, centerColor: string = '#FFFF00') => {
      const x = idx * TILE_SIZE;
      ctx.clearRect(x, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = stemColor; 
      ctx.fillRect(x + 7, 8, 2, 8); 
      ctx.fillStyle = petalColor;
      ctx.fillRect(x + 5, 3, 6, 6); 
      ctx.fillStyle = centerColor;
      ctx.fillRect(x + 7, 5, 2, 2); 
  };

  // -- PALETTE UPDATES (Less Saturation, More Earthy) --
  
  // 0: Error
  fill(0, '#ff00ff', 0);
  // 1: Dirt (Darker brown)
  fill(1, '#5D4037', 0.15); 
  // 2: Grass Side
  fill(2, '#5D4037', 0.15);
  ctx.fillStyle = '#558B2F'; // Less neon green
  ctx.fillRect(2 * TILE_SIZE, 0, TILE_SIZE, 4);
  // 3: Grass Top
  fill(3, '#558B2F', 0.1);
  // 4: Oak Log Side
  fill(4, '#4E342E', 0.2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(4*TILE_SIZE + 4, 0, 2, 16); 
  ctx.fillRect(4*TILE_SIZE + 10, 0, 2, 16);
  // 5: Oak Leaf
  fill(5, '#33691E', 0.3); // Darker green
  // 6: Water (Handled by shader mostly, but texture used for fallback)
  fill(6, '#4FC3F7', 0.05);
  
  // 7: Sand
  fill(7, '#E6EE9C', 0.1); // Less orange, more pale
  // 8: Bedrock
  fill(8, '#212121', 0.4);
  // 9: Snow
  fill(9, '#FAFAFA', 0.05);

  // 10: Tall Grass
  const x10 = 10 * TILE_SIZE;
  ctx.clearRect(x10, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#558B2F';
  ctx.fillRect(x10 + 6, 2, 2, 14); 
  ctx.fillRect(x10 + 2, 6, 2, 10); 
  ctx.fillRect(x10 + 10, 5, 2, 11); 
  
  // 11: Flower Yellow
  flower(11, '#33691E', '#FDD835', '#FBC02D');
  // 12: Flower Red
  flower(12, '#33691E', '#E53935', '#B71C1C');

  // 13: Birch Log Side
  fill(13, '#ECEFF1', 0.1);
  ctx.fillStyle = '#263238';
  for(let i=0;i<6;i++) ctx.fillRect(13*TILE_SIZE + Math.random()*12, Math.random()*16, 3, 1);

  // 14: Birch Leaves
  fill(14, '#7CB342', 0.2); // Lighter green

  // 15: Spruce Log Side
  fill(15, '#3E2723', 0.2);
  // 16: Spruce Leaves
  fill(16, '#1B5E20', 0.3); // Dark pine green

  // 17: Cactus Side
  fill(17, '#43A047', 0.1);
  ctx.fillStyle = '#2E7D32'; 
  ctx.fillRect(17*TILE_SIZE + 2, 0, 2, 16);
  ctx.fillRect(17*TILE_SIZE + 7, 0, 2, 16);
  ctx.fillRect(17*TILE_SIZE + 12, 0, 2, 16);

  // 18: Dead Bush
  const x18 = 18 * TILE_SIZE;
  ctx.clearRect(x18, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(x18 + 7, 10, 2, 6);
  ctx.fillRect(x18 + 4, 6, 8, 1);

  // 19: Sandstone
  fill(19, '#FFCC80', 0.1);
  ctx.fillStyle = '#EF6C00';
  ctx.fillRect(19*TILE_SIZE, 14, 16, 2);

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
  ctx.fillRect(26*TILE_SIZE+2,2,12,12);

  // 27: Log Top (Oak)
  fill(27, '#4E342E', 0.1);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(27*TILE_SIZE+2,2,12,12);
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(27*TILE_SIZE+5,5,6,6);

  // 28: Log Top (Birch)
  fill(28, '#ECEFF1', 0.1);
  ctx.fillStyle = '#CFD8DC'; 
  ctx.fillRect(28*TILE_SIZE+2,2,12,12);

  // 29: Log Top (Spruce)
  fill(29, '#3E2723', 0.1);
  ctx.fillStyle = '#4E342E'; 
  ctx.fillRect(29*TILE_SIZE+2,2,12,12);

  // 30: Stone
  fill(30, '#757575', 0.2);

  // 31: Acacia Log Side
  fill(31, '#6D4C41', 0.15);
  
  // 32: Acacia Leaves
  fill(32, '#7CB342', 0.25);

  // 33: Acacia Top
  fill(33, '#6D4C41', 0.1);
  ctx.fillStyle = '#FF7043';
  ctx.fillRect(33*TILE_SIZE+3,3,10,10);

  // 34: Jungle Log Side
  fill(34, '#5D4037', 0.2);

  // 35: Jungle Leaves
  fill(35, '#1B5E20', 0.3); // Dense
  
  // 36: Jungle Top
  fill(36, '#5D4037', 0.1);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(36*TILE_SIZE+2,2,12,12);

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
  ctx.fillRect(x42 + 4, 4, 2, 12);
  ctx.fillRect(x42 + 8, 2, 2, 14);

  // 43: Sea Lantern
  fill(43, '#E0F7FA', 0.05);
  ctx.fillStyle = '#00BCD4';
  ctx.fillRect(43*TILE_SIZE + 2, 2, 12, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(43*TILE_SIZE + 5, 5, 6, 6);
  
  // 44: Clay
  fill(44, '#9FA8DA', 0.15);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
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
