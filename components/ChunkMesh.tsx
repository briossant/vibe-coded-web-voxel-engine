
import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ChunkData } from '../types';
import { CHUNK_SIZE } from '../constants';
import { globalTexture } from '../utils/textures';
import { ChunkLoader } from '../services/ChunkLoader';

interface ChunkMeshProps {
  chunk: ChunkData;
  lodLevel: number; 
  neighbors?: {
      nx?: ChunkData; px?: ChunkData; nz?: ChunkData; pz?: ChunkData;
  };
  chunkLoader: ChunkLoader;
}

// --- Shared Materials (Optimization: Instancing) ---

export const sharedStandardMaterial = new THREE.MeshStandardMaterial({
    map: globalTexture,
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
});

export const sharedFoliageMaterial = new THREE.MeshStandardMaterial({
    map: globalTexture,
    vertexColors: true,
    alphaTest: 0.3,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.8,
});

export const sharedWaterMaterial = new THREE.ShaderMaterial({
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
            
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vec3 pos = worldPosition.xyz;
            
            float wave = sin(pos.x * 0.5 + uTime) * 0.1 + cos(pos.z * 0.4 + uTime * 0.8) * 0.1;
            
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
    `,
    transparent: true
});

const ChunkMesh: React.FC<ChunkMeshProps> = ({ chunk, lodLevel, neighbors, chunkLoader }) => {
  const [geometryData, setGeometryData] = useState<{ opaque: THREE.BufferGeometry, foliage: THREE.BufferGeometry, water: THREE.BufferGeometry } | null>(null);

  useEffect(() => {
      let isMounted = true;
      
      chunkLoader.requestMesh(chunk, neighbors || {}).then((data: any) => {
          if (!isMounted) return;

          const createGeo = (d: any, hasColor: boolean) => {
              const geo = new THREE.BufferGeometry();
              // positions are Int16 from worker now (Optimization)
              geo.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
              geo.setAttribute('normal', new THREE.BufferAttribute(d.normals, 3));
              geo.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2));
              if (hasColor) geo.setAttribute('color', new THREE.BufferAttribute(d.colors, 3));
              geo.setIndex(new THREE.BufferAttribute(d.indices, 1));
              return geo;
          };

          setGeometryData({
              opaque: createGeo(data.opaque, true),
              foliage: createGeo(data.foliage, true),
              water: createGeo(data.water, false)
          });
      });

      return () => { 
          isMounted = false;
          // Geometries are automatically disposed by React Three Fiber if attached to a primitive,
          // but since we are managing state manually, explicit disposal is good practice if we were unmounting often.
          // However, React handles the mesh unmount. We let GC handle the geometry objects created here.
      };
  }, [chunk, neighbors, chunkLoader]);

  if (!geometryData) return null;

  return (
    <group position={[chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE]}>
        <mesh 
            geometry={geometryData.opaque}
            material={sharedStandardMaterial}
            castShadow={lodLevel === 0}
            receiveShadow={lodLevel === 0}
        />

        <mesh 
            geometry={geometryData.foliage}
            material={sharedFoliageMaterial}
            castShadow={lodLevel === 0}
            receiveShadow={lodLevel === 0}
        />

        <mesh 
            geometry={geometryData.water}
            material={sharedWaterMaterial}
            receiveShadow={lodLevel === 0}
        />
    </group>
  );
};

// Equality check for React.memo
const arePropsEqual = (prev: ChunkMeshProps, next: ChunkMeshProps) => {
    return prev.chunk === next.chunk && 
           prev.lodLevel === next.lodLevel &&
           // Deep check neighbors IDs only
           prev.neighbors?.nx?.id === next.neighbors?.nx?.id &&
           prev.neighbors?.px?.id === next.neighbors?.px?.id &&
           prev.neighbors?.nz?.id === next.neighbors?.nz?.id &&
           prev.neighbors?.pz?.id === next.neighbors?.pz?.id;
};

export default React.memo(ChunkMesh, arePropsEqual);
