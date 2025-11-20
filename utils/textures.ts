
import * as THREE from 'three';
import { BlockType } from '../types';

// Texture Atlas: 16x16 pixels, 64 tiles wide (Expanded size)
export const TEXTURE_ATLAS_SIZE = 64;
const TILE_SIZE = 16;

const createAtlas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * TEXTURE_ATLAS_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Helper to draw background
  const fill = (idx: number, color: string, noise: boolean = true) => {
      const x = idx * TILE_SIZE;
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, TILE_SIZE, TILE_SIZE);
      
      if (noise) {
        for(let i=0; i<40; i++) {
            const rx = Math.floor(Math.random() * TILE_SIZE);
            const ry = Math.floor(Math.random() * TILE_SIZE);
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
            ctx.fillRect(x + rx, ry, 1, 1);
        }
      }
      // Subtle Border
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.strokeRect(x+0.5, 0.5, TILE_SIZE-1, TILE_SIZE-1);
  };

  // Helper for flowers
  const flower = (idx: number, stemColor: string, petalColor: string, centerColor: string) => {
      const x = idx * TILE_SIZE;
      ctx.clearRect(x, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = stemColor; 
      ctx.fillRect(x + 7, 8, 2, 8); // stem
      ctx.fillStyle = petalColor;
      ctx.fillRect(x + 5, 3, 6, 6); // petal blob
      ctx.fillStyle = centerColor;
      ctx.fillRect(x + 7, 5, 2, 2); // center
  };

  // 0: Error
  fill(0, '#ff00ff', false);
  // 1: Dirt
  fill(1, '#795548'); 
  // 2: Grass Side
  fill(2, '#795548');
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(2 * TILE_SIZE, 0, TILE_SIZE, 4);
  // 3: Grass Top
  fill(3, '#4CAF50');
  // 4: Oak Log Side
  fill(4, '#5D4037');
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(4*TILE_SIZE + 4, 0, 2, 16); 
  ctx.fillRect(4*TILE_SIZE + 10, 0, 2, 16);
  // 5: Oak Leaf
  fill(5, '#2E7D32', true);
  // 6: Water (Transparent)
  fill(6, 'rgba(33, 150, 243, 0.6)', false);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(6*TILE_SIZE + 2, 2, 4, 2);
  // 7: Sand
  fill(7, '#fbc02d');
  // 8: Bedrock
  fill(8, '#212121');
  // 9: Snow
  fill(9, '#ECEFF1');

  // 10: Tall Grass
  const x10 = 10 * TILE_SIZE;
  ctx.clearRect(x10, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(x10 + 6, 2, 2, 14); 
  ctx.fillRect(x10 + 2, 6, 2, 10); 
  ctx.fillRect(x10 + 10, 5, 2, 11); 
  
  // 11: Flower Yellow
  flower(11, '#2E7D32', '#FFEB3B', '#FBC02D');
  // 12: Flower Red
  flower(12, '#2E7D32', '#F44336', '#B71C1C');

  // 13: Birch Log Side
  fill(13, '#ECEFF1', true);
  ctx.fillStyle = '#263238';
  for(let i=0;i<6;i++) ctx.fillRect(13*TILE_SIZE + Math.random()*12, Math.random()*16, 3, 1); // spots

  // 14: Birch Leaves
  fill(14, '#66BB6A', true);

  // 15: Spruce Log Side
  fill(15, '#3E2723', false);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; // Darker bark
  ctx.fillRect(15*TILE_SIZE + 3, 0, 2, 16); 
  ctx.fillRect(15*TILE_SIZE + 11, 0, 3, 16);

  // 16: Spruce Leaves
  fill(16, '#1B5E20', true);

  // 17: Cactus Side
  fill(17, '#43A047', false);
  ctx.fillStyle = '#2E7D32'; // ribs
  ctx.fillRect(17*TILE_SIZE + 2, 0, 2, 16);
  ctx.fillRect(17*TILE_SIZE + 7, 0, 2, 16);
  ctx.fillRect(17*TILE_SIZE + 12, 0, 2, 16);
  ctx.fillStyle = '#1B5E20'; // spines
  for(let i=0;i<10;i++) ctx.fillRect(17*TILE_SIZE + Math.random()*16, Math.random()*16, 1, 1);

  // 18: Dead Bush
  const x18 = 18 * TILE_SIZE;
  ctx.clearRect(x18, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(x18 + 7, 10, 2, 6); // stem
  ctx.fillRect(x18 + 4, 6, 8, 1); // branches
  ctx.fillRect(x18 + 2, 4, 1, 4);
  ctx.fillRect(x18 + 13, 3, 1, 5);

  // 19: Sandstone
  fill(19, '#ffcc80', true);
  ctx.fillStyle = '#E65100';
  ctx.fillRect(19*TILE_SIZE, 14, 16, 2); // bottom stripe

  // 20: Gravel
  fill(20, '#9E9E9E', true);
  ctx.fillStyle = '#616161';
  for(let i=0;i<10;i++) ctx.fillRect(20*TILE_SIZE + Math.random()*14, Math.random()*14, 2, 2); // rocks

  // 21-25 Flowers
  flower(21, '#2E7D32', '#D32F2F', '#FFC107'); // Red Tulip
  flower(22, '#2E7D32', '#F57C00', '#FFEB3B'); // Orange Tulip
  flower(23, '#2E7D32', '#F5F5F5', '#9E9E9E'); // White Tulip
  flower(24, '#2E7D32', '#EC407A', '#F8BBD0'); // Pink Tulip
  flower(25, '#2E7D32', '#2196F3', '#1565C0'); // Cornflower

  // 26: Cactus Top
  fill(26, '#43A047', false);
  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(26*TILE_SIZE+2,2,12,12); // inner ring

  // 27: Log Top (Oak)
  fill(27, '#5D4037', false);
  ctx.fillStyle = '#8D6E63'; // rings
  ctx.fillRect(27*TILE_SIZE+2,2,12,12);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(27*TILE_SIZE+5,5,6,6);

  // 28: Log Top (Birch)
  fill(28, '#ECEFF1', false);
  ctx.fillStyle = '#CFD8DC'; 
  ctx.fillRect(28*TILE_SIZE+2,2,12,12);

  // 29: Log Top (Spruce)
  fill(29, '#3E2723', false);
  ctx.fillStyle = '#4E342E'; 
  ctx.fillRect(29*TILE_SIZE+2,2,12,12);

  // 30: Stone
  fill(30, '#757575');

  // 31: Acacia Log Side
  fill(31, '#6D4C41'); // Grayish brown
  ctx.fillStyle = '#3E2723';
  ctx.fillRect(31*TILE_SIZE + 2, 0, 10, 16); // Stripped bark effect
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(31*TILE_SIZE + 4, 2, 2, 12);

  // 32: Acacia Leaves
  fill(32, '#7CB342', true);

  // 33: Acacia Top
  fill(33, '#6D4C41', false);
  ctx.fillStyle = '#FF7043'; // Orange core
  ctx.fillRect(33*TILE_SIZE+3,3,10,10);

  // 34: Jungle Log Side
  fill(34, '#5D4037');
  ctx.fillStyle = '#3E2723'; // Horizontal texture
  for(let i=0; i<6; i++) ctx.fillRect(34*TILE_SIZE, i*3, 16, 1);

  // 35: Jungle Leaves
  fill(35, '#1B5E20', true);
  ctx.fillStyle = '#33691E'; // Berries
  for(let i=0;i<5;i++) ctx.fillRect(35*TILE_SIZE+Math.random()*14,Math.random()*14,2,2);

  // 36: Jungle Top
  fill(36, '#5D4037', false);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(36*TILE_SIZE+2,2,12,12);

  // 37: Red Sand
  fill(37, '#D84315', true);

  // 38: Red Sandstone
  fill(38, '#BF360C');
  ctx.fillStyle = '#D84315';
  ctx.fillRect(38*TILE_SIZE, 0, 16, 4);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(38*TILE_SIZE, 8, 16, 2);

  // 39: Melon Side
  fill(39, '#388E3C'); // Green
  ctx.fillStyle = '#1B5E20'; // Stripes
  ctx.fillRect(39*TILE_SIZE+4, 0, 2, 16);
  ctx.fillRect(39*TILE_SIZE+10, 0, 2, 16);

  // 40: Melon Top
  fill(40, '#388E3C');
  ctx.fillStyle = '#1B5E20';
  ctx.fillRect(40*TILE_SIZE+7, 7, 2, 2); // Stem connector

  // 41: Blue Orchid
  flower(41, '#2E7D32', '#00BCD4', '#E0F7FA');

  // 42: Seagrass
  const x42 = 42 * TILE_SIZE;
  ctx.clearRect(x42, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#4CAF50'; // Brighter green for underwater
  ctx.fillRect(x42 + 4, 4, 2, 12);
  ctx.fillRect(x42 + 8, 2, 2, 14);
  ctx.fillRect(x42 + 12, 5, 2, 11);

  // 43: Sea Lantern
  fill(43, '#E0F7FA', false);
  ctx.fillStyle = '#00BCD4'; // Cyan border/inset
  ctx.fillRect(43*TILE_SIZE + 2, 2, 12, 12);
  ctx.fillStyle = '#FFFFFF'; // Bright center
  ctx.fillRect(43*TILE_SIZE + 5, 5, 6, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export const globalTexture = createAtlas();

export const getUVOffset = (type: BlockType, normal: number[]): [number, number] => {
   let idx = 0;
   const ny = normal[1];

   switch(type) {
       case BlockType.DIRT: idx = 1; break;
       case BlockType.GRASS: idx = ny > 0.5 ? 3 : (ny < -0.5 ? 1 : 2); break;
       case BlockType.STONE: idx = 30; break;
       case BlockType.OAK_LOG: idx = (ny > 0.5 || ny < -0.5) ? 27 : 4; break;
       case BlockType.OAK_LEAVES: idx = 5; break;
       case BlockType.WATER: idx = 6; break;
       case BlockType.SAND: idx = 7; break;
       case BlockType.BEDROCK: idx = 8; break;
       case BlockType.SNOW: idx = 9; break;
       case BlockType.TALL_GRASS: idx = 10; break;
       case BlockType.FLOWER_YELLOW: idx = 11; break;
       case BlockType.FLOWER_RED: idx = 12; break;
       case BlockType.BIRCH_LOG: idx = (ny > 0.5 || ny < -0.5) ? 28 : 13; break;
       case BlockType.BIRCH_LEAVES: idx = 14; break;
       case BlockType.SPRUCE_LOG: idx = (ny > 0.5 || ny < -0.5) ? 29 : 15; break;
       case BlockType.SPRUCE_LEAVES: idx = 16; break;
       case BlockType.CACTUS: idx = (ny > 0.5 || ny < -0.5) ? 26 : 17; break;
       case BlockType.DEAD_BUSH: idx = 18; break;
       case BlockType.SANDSTONE: idx = 19; break;
       case BlockType.GRAVEL: idx = 20; break;
       case BlockType.TULIP_RED: idx = 21; break;
       case BlockType.TULIP_ORANGE: idx = 22; break;
       case BlockType.TULIP_WHITE: idx = 23; break;
       case BlockType.TULIP_PINK: idx = 24; break;
       case BlockType.CORNFLOWER: idx = 25; break;
       
       case BlockType.ACACIA_LOG: idx = (ny > 0.5 || ny < -0.5) ? 33 : 31; break;
       case BlockType.ACACIA_LEAVES: idx = 32; break;
       case BlockType.JUNGLE_LOG: idx = (ny > 0.5 || ny < -0.5) ? 36 : 34; break;
       case BlockType.JUNGLE_LEAVES: idx = 35; break;
       case BlockType.RED_SAND: idx = 37; break;
       case BlockType.RED_SANDSTONE: idx = 38; break;
       case BlockType.MELON: idx = (ny > 0.5 || ny < -0.5) ? 40 : 39; break;
       case BlockType.BLUE_ORCHID: idx = 41; break;
       case BlockType.SEAGRASS: idx = 42; break;
       case BlockType.SEA_LANTERN: idx = 43; break;

       default: idx = 0;
   }
   
   return [idx / TEXTURE_ATLAS_SIZE, 0];
};
