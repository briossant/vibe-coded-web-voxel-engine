
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkData } from '@/src/types/world';
import { CHUNK_SIZE } from '@/src/constants';
import { globalTexture } from '@/src/utils/textures';
import { ChunkLoader } from '@/src/services/ChunkLoader';
import { WaterShaderMaterial } from '@/src/rendering/shaders/water';

interface ChunkMeshProps {
  chunk: ChunkData;
  lodLevel: number; 
  neighbors?: {
      nx?: ChunkData; px?: ChunkData; nz?: ChunkData; pz?: ChunkData;
  };
  chunkLoader: ChunkLoader;
}



const ChunkMesh: React.FC<ChunkMeshProps> = ({ chunk, lodLevel, neighbors, chunkLoader }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [geometryData, setGeometryData] = useState<{ opaque: THREE.BufferGeometry, foliage: THREE.BufferGeometry, water: THREE.BufferGeometry } | null>(null);

  useFrame(({ clock }) => {
      if (materialRef.current) {
          materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      }
  });

  // Cleanup geometry memory on unmount or update
  useEffect(() => {
    return () => {
      if (geometryData) {
        geometryData.opaque.dispose();
        geometryData.foliage.dispose();
        geometryData.water.dispose();
      }
    };
  }, [geometryData]);

  useEffect(() => {
      let isMounted = true;
      
      chunkLoader.requestMesh(chunk, neighbors || {}).then((data: any) => {
          if (!isMounted) return;

          const createGeo = (d: any, hasColor: boolean) => {
              const geo = new THREE.BufferGeometry();
              // Use TypedArrays directly from worker
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

      return () => { isMounted = false; };
  }, [chunk, neighbors, chunkLoader]);

  if (!geometryData) return null;

  return (
    <group position={[chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE]}>
        <mesh 
            geometry={geometryData.opaque}
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
            geometry={geometryData.foliage}
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

        <mesh geometry={geometryData.water} receiveShadow={lodLevel === 0}>
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
