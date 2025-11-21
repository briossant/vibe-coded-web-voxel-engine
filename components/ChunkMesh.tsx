import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkData } from '../types';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { globalTexture, getUVOffset, TEXTURE_ATLAS_SIZE } from '../utils/textures';
import { getBlockDef, BlockType } from '../blocks';

interface ChunkMeshProps {
  chunk: ChunkData;
  lodLevel: number; 
  neighbors?: {
      nx?: ChunkData; px?: ChunkData; nz?: ChunkData; pz?: ChunkData;
      n_nxnz?: ChunkData; n_pxnz?: ChunkData; n_nxpz?: ChunkData; n_pxpz?: ChunkData;
  };
}

// --- Shader for Water ---
const WaterShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uTexture: { value: globalTexture },
        uSunColor: { value: new THREE.Color('#ffffee') },
    },
    vertexShader: `
        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vViewPosition;
        varying vec3 vNormal;
        
        uniform float uTime;

        void main() {
            vUv = uv;
            
            // Calculate world position for seamless waves across chunks
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vec3 pos = worldPosition.xyz;
            
            // Wave function using world coordinates
            float wave = sin(pos.x * 0.5 + uTime) * 0.1 + cos(pos.z * 0.4 + uTime * 0.8) * 0.1;
            
            // Apply wave to local Y position
            vec3 newPos = position;
            newPos.y += wave * 0.5;
            vElevation = wave;

            vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
            vViewPosition = -mvPosition.xyz;
            vNormal = normalMatrix * normal;
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uSunColor;
        
        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vViewPosition;
        varying vec3 vNormal;

        void main() {
            vec4 texColor = texture2D(uTexture, vUv);
            
            vec3 waterColor = vec3(0.0, 0.4, 0.7);
            vec3 finalColor = mix(waterColor, texColor.rgb, 0.3);

            finalColor += vElevation * 0.1;

            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);
            float fresnelTerm = dot(viewDir, normal);
            fresnelTerm = clamp(1.0 - fresnelTerm, 0.0, 1.0);
            fresnelTerm = pow(fresnelTerm, 3.0);

            finalColor = mix(finalColor, uSunColor, fresnelTerm * 0.6);

            gl_FragColor = vec4(finalColor, 0.75); 
        }
    `
};

const AO_INTENSITY = [1.0, 0.85, 0.65, 0.45]; 

const ChunkMesh: React.FC<ChunkMeshProps> = ({ chunk, lodLevel, neighbors }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
      if (materialRef.current) {
          materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      }
  });

  const { opaque, foliage, water } = useMemo(() => {
    const opaque = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
    let opaqueCount = 0;
    
    const foliage = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
    let foliageCount = 0;
    
    const water = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
    let waterCount = 0;

    const uW = 1 / TEXTURE_ATLAS_SIZE;
    const vH = 1.0;

    const { nx, px, nz, pz } = neighbors || {};

    const getBlock = (cx: number, cy: number, cz: number): number => {
        if (cy < 0 || cy >= WORLD_HEIGHT) return BlockType.AIR;
        if (cx >= 0 && cx < CHUNK_SIZE && cz >= 0 && cz < CHUNK_SIZE) {
            return chunk.data[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz];
        }
        if (cx < 0) return nx ? nx.data[((cx + CHUNK_SIZE) * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz] : BlockType.AIR;
        if (cx >= CHUNK_SIZE) return px ? px.data[((cx - CHUNK_SIZE) * WORLD_HEIGHT + cy) * CHUNK_SIZE + cz] : BlockType.AIR;
        if (cz < 0) return nz ? nz.data[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + (cz + CHUNK_SIZE)] : BlockType.AIR;
        if (cz >= CHUNK_SIZE) return pz ? pz.data[(cx * WORLD_HEIGHT + cy) * CHUNK_SIZE + (cz - CHUNK_SIZE)] : BlockType.AIR;
        return BlockType.AIR;
    };

    const isSolidForAO = (bx: number, by: number, bz: number) => {
        const t = getBlock(bx, by, bz);
        const def = getBlockDef(t);
        return def.isSolid && !def.isTransparent; 
    };

    const computeAO = (x: number, y: number, z: number, normal: number[]): number[] => {
        const nx = normal[0], ny = normal[1], nz = normal[2];
        const px = x + nx; const py = y + ny; const pz = z + nz;
        const aoValues = [0,0,0,0]; 
        const vertexAO = (s1: boolean, s2: boolean, c: boolean) => {
            if (s1 && s2) return 3; 
            return (s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0);
        };

        if (ny > 0) { // TOP
            const nN = isSolidForAO(px, py, pz-1); 
            const nS = isSolidForAO(px, py, pz+1); 
            const nW = isSolidForAO(px-1, py, pz); 
            const nE = isSolidForAO(px+1, py, pz); 
            const nNW = isSolidForAO(px-1, py, pz-1);
            const nNE = isSolidForAO(px+1, py, pz-1);
            const nSW = isSolidForAO(px-1, py, pz+1);
            const nSE = isSolidForAO(px+1, py, pz+1);

            aoValues[0] = vertexAO(nW, nS, nSW);
            aoValues[1] = vertexAO(nE, nS, nSE);
            aoValues[2] = vertexAO(nW, nN, nNW);
            aoValues[3] = vertexAO(nE, nN, nNE);
        } 
        else if (nz > 0) { // FRONT
           const nU = isSolidForAO(px, py+1, pz);
           const nD = isSolidForAO(px, py-1, pz);
           const nL = isSolidForAO(px-1, py, pz);
           const nR = isSolidForAO(px+1, py, pz);
           const nLU = isSolidForAO(px-1, py+1, pz);
           const nRU = isSolidForAO(px+1, py+1, pz);
           const nLD = isSolidForAO(px-1, py-1, pz);
           const nRD = isSolidForAO(px+1, py-1, pz);

           aoValues[0] = vertexAO(nL, nU, nLU); 
           aoValues[1] = vertexAO(nR, nU, nRU); 
           aoValues[2] = vertexAO(nL, nD, nLD); 
           aoValues[3] = vertexAO(nR, nD, nRD); 
        }
        else {
             const nU = isSolidForAO(px, py+1, pz);
             const nD = isSolidForAO(px, py-1, pz);
             const aoTop = nU ? 1 : 0;
             const aoBot = nD ? 1 : 0;
             aoValues[0] = aoTop; aoValues[1] = aoTop;
             aoValues[2] = aoBot; aoValues[3] = aoBot;
        }
        return aoValues.map(idx => AO_INTENSITY[idx]);
    };

    const addQuad = (
        targetType: 'opaque' | 'foliage' | 'water',
        pos: number[], 
        corners: number[][], 
        norm: number[], 
        uStart: number, vStart: number,
        calcAo: boolean = true,
        rotation: number = 0 // 0 to 3
    ) => {
        const target = targetType === 'opaque' ? opaque : (targetType === 'water' ? water : foliage);
        const baseIndex = targetType === 'opaque' ? opaqueCount : (targetType === 'water' ? waterCount : foliageCount);
        
        let aos = [1,1,1,1];
        if (calcAo && targetType === 'opaque') {
            aos = computeAO(pos[0], pos[1], pos[2], norm);
        }

        for (let i = 0; i < 4; i++) {
            const x = pos[0] + corners[i][0];
            const y = pos[1] + corners[i][1];
            const z = pos[2] + corners[i][2];

            target.positions.push(x, y, z);
            target.normals.push(norm[0], norm[1], norm[2]);
            
            if (targetType !== 'water') {
                const brightness = aos[i];
                target.colors!.push(brightness, brightness, brightness);
            }
        }

        const u0 = uStart + 0.001;
        const u1 = uStart + uW - 0.001;
        const v0 = vStart;
        const v1 = vStart + vH;
        
        // UV Permutation for rotation (Standard Quad Order)
        // 0: u0, v0
        // 1: u1, v0
        // 2: u0, v1
        // 3: u1, v1
        // Permutations derived for CW rotation
        const perms = [
            [0, 1, 2, 3], // 0 deg
            [2, 0, 3, 1], // 90 deg
            [3, 2, 1, 0], // 180 deg
            [1, 3, 0, 2]  // 270 deg
        ];
        const p = perms[rotation % 4];
        const uvSet = [u0, v0, u1, v0, u0, v1, u1, v1];

        target.uvs.push(
            uvSet[p[0]*2], uvSet[p[0]*2+1], 
            uvSet[p[1]*2], uvSet[p[1]*2+1], 
            uvSet[p[2]*2], uvSet[p[2]*2+1], 
            uvSet[p[3]*2], uvSet[p[3]*2+1]
        );

        target.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 1, baseIndex + 3, baseIndex + 2);
        
        if (targetType === 'opaque') opaqueCount += 4;
        else if (targetType === 'water') waterCount += 4;
        else foliageCount += 4;
    };
    
    const addCross = (x: number, y: number, z: number, uStart: number, vStart: number) => {
        const u0 = uStart + 0.001;
        const u1 = uStart + uW - 0.001;
        const v0 = vStart;
        const v1 = vStart + vH;
        const ao = 1.0; 

        foliage.positions.push(x, y, z, x+1, y, z+1, x, y+1, z, x+1, y+1, z+1);
        foliage.normals.push(0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7, 0.7,0,0.7);
        foliage.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        foliage.colors!.push(ao,ao,ao, ao,ao,ao, ao,ao,ao, ao,ao,ao);
        foliage.indices.push(foliageCount, foliageCount+1, foliageCount+2, foliageCount+1, foliageCount+3, foliageCount+2);
        foliageCount += 4;

        foliage.positions.push(x, y, z+1, x+1, y, z, x, y+1, z+1, x+1, y+1, z);
        foliage.normals.push(-0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7, -0.7,0,0.7);
        foliage.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
        foliage.colors!.push(ao,ao,ao, ao,ao,ao, ao,ao,ao, ao,ao,ao);
        foliage.indices.push(foliageCount, foliageCount+1, foliageCount+2, foliageCount+1, foliageCount+3, foliageCount+2);
        foliageCount += 4;
    };

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const type = chunk.data[(x * WORLD_HEIGHT + y) * CHUNK_SIZE + z];
                if (type === BlockType.AIR) continue;
                
                const typeDef = getBlockDef(type);
                const isSeagrass = type === BlockType.SEAGRASS;
                
                // 1. Render Sprites
                if (typeDef.isSprite) {
                    const [u, v] = getUVOffset(type, [0, 1, 0]);
                    addCross(x, y, z, u, v);
                    if (!isSeagrass) continue;
                }

                // 2. Volume Rendering
                const isBlockWater = type === BlockType.WATER || isSeagrass;
                const volumeType = isBlockWater ? BlockType.WATER : type;
                const isBlockFoliage = typeDef.isTransparent && !isBlockWater && !isSeagrass;
                const targetType = isBlockWater ? 'water' : (isBlockFoliage ? 'foliage' : 'opaque');

                const isFaceVisible = (dx: number, dy: number, dz: number) => {
                    const t = getBlock(x + dx, y + dy, z + dz);
                    const tDef = getBlockDef(t);
                    
                    const tIsWater = t === BlockType.WATER || t === BlockType.SEAGRASS;

                    if (t === BlockType.AIR) return true;
                    if (isBlockWater) {
                         if (tIsWater) return false;
                         if (tDef.isSolid && !tDef.isTransparent) return false; 
                         return true;
                    }
                    if (tIsWater) return true; 
                    if (tDef.isTransparent && !isBlockFoliage) return true;
                    if (tDef.isSprite) return true; 
                    if (!tDef.isSolid) return true;
                    if (isBlockFoliage && t === type) return false; 
                    return false;
                };

                const [uTop, vTop] = getUVOffset(volumeType, [0, 1, 0]);
                const [uBot, vBot] = getUVOffset(volumeType, [0, -1, 0]);
                const [uSide, vSide] = getUVOffset(volumeType, [1, 0, 0]);

                // Calc random rotation hash for Top/Bottom faces
                const rot = (x * 13 ^ z * 23) & 3;

                if (isFaceVisible(0, 1, 0)) {
                    const wh = isBlockWater ? 0.8 : 1;
                    addQuad(targetType, [x, y, z], [[0, wh, 1], [1, wh, 1], [0, wh, 0], [1, wh, 0]], [0, 1, 0], uTop, vTop, true, rot);
                }
                if (isFaceVisible(0, -1, 0)) addQuad(targetType, [x, y, z], [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]], [0, -1, 0], uBot, vBot, true, rot);
                
                // Sides usually do not rotate
                if (isFaceVisible(0, 0, 1)) addQuad(targetType, [x, y, z], [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], [0, 0, 1], uSide, vSide);
                if (isFaceVisible(0, 0, -1)) addQuad(targetType, [x, y, z], [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, -1], uSide, vSide);
                if (isFaceVisible(1, 0, 0)) addQuad(targetType, [x, y, z], [[1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0]], [1, 0, 0], uSide, vSide);
                if (isFaceVisible(-1, 0, 0)) addQuad(targetType, [x, y, z], [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]], [-1, 0, 0], uSide, vSide);
            }
        }
    }

    const createGeo = (data: any, hasColor: boolean) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        if (hasColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
        geo.setIndex(data.indices);
        return geo;
    };
    
    return { 
        opaque: createGeo(opaque, true), 
        foliage: createGeo(foliage, true),
        water: createGeo(water, false)
    };
  }, [chunk, lodLevel, neighbors]);

  return (
    <group position={[chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE]}>
        <mesh 
            geometry={opaque}
            castShadow={lodLevel === 0}
            receiveShadow={lodLevel === 0}
        >
            <meshStandardMaterial 
                map={globalTexture} 
                vertexColors
                roughness={0.8} 
                metalness={0.1}
            />
        </mesh>

        <mesh 
            geometry={foliage}
            castShadow={lodLevel === 0}
            receiveShadow={lodLevel === 0}
        >
            <meshStandardMaterial 
                map={globalTexture} 
                vertexColors
                alphaTest={0.3}
                transparent={true}
                side={THREE.DoubleSide}
                roughness={0.8}
            />
        </mesh>

        <mesh geometry={water} receiveShadow={lodLevel === 0}>
             <shaderMaterial 
                ref={materialRef}
                attach="material"
                {...WaterShaderMaterial}
                transparent={true}
             />
        </mesh>
    </group>
  );
};

const arePropsEqual = (prev: ChunkMeshProps, next: ChunkMeshProps) => {
    return prev.chunk === next.chunk && 
           prev.lodLevel === next.lodLevel &&
           prev.neighbors?.nx === next.neighbors?.nx &&
           prev.neighbors?.px === next.neighbors?.px &&
           prev.neighbors?.nz === next.neighbors?.nz &&
           prev.neighbors?.pz === next.neighbors?.pz;
};

export default React.memo(ChunkMesh, arePropsEqual);