
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Stats, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Vector3, ChunkData, GameState } from '../types';
import { BlockType } from '../blocks';
import { getBlockFromChunk, getTerrainHeight } from '../services/TerrainGenerator';
import ChunkMesh from './ChunkMesh';
import DistantTerrain from './DistantTerrain';
import Player from './Player';
import { CHUNK_SIZE, WORLD_HEIGHT, MAX_RENDER_DISTANCE } from '../constants';
import { ChunkLoader } from '../services/ChunkLoader';

interface GameProps {
  gameState: GameState;
  setChunks: React.Dispatch<React.SetStateAction<Map<string, ChunkData>>>;
}

interface GameSceneProps {
  gameState: GameState & { setIsUnderwater: (val: boolean) => void };
  setChunks: React.Dispatch<React.SetStateAction<Map<string, ChunkData>>>;
}

// --- Custom Cloud Shader ---
// Uses world position for UVs so clouds stay pinned to the world while the plane follows the player
const CloudShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#ffffff') },
        uCloudScale: { value: 0.008 },
        uCloudSpeed: { value: 0.02 },
        uOpacity: { value: 0.8 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        
        void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uCloudScale;
        uniform float uCloudSpeed;
        uniform float uOpacity;
        varying vec3 vWorldPos;

        // Simple noise function
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i + vec2(0.0, 0.0));
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
            float total = 0.0;
            float amp = 0.5;
            for (int i = 0; i < 5; i++) {
                total += noise(p) * amp;
                p *= 2.1;
                amp *= 0.5;
            }
            return total;
        }

        void main() {
            // Animate noise with time
            vec2 pos = vWorldPos.xz * uCloudScale;
            pos.x += uTime * uCloudSpeed;
            pos.y += uTime * uCloudSpeed * 0.5;

            float n = fbm(pos);

            // Threshold to create cloud shapes
            float alpha = smoothstep(0.4, 0.8, n);
            
            // Discard clear sky for performance
            if (alpha < 0.01) discard;

            gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
    `
};

const CloudLayer = () => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef2 = useRef<THREE.ShaderMaterial>(null);
    const meshRef2 = useRef<THREE.Mesh>(null);

    useFrame(({ clock, camera }) => {
        const t = clock.getElapsedTime();
        if (materialRef.current) materialRef.current.uniforms.uTime.value = t;
        if (materialRef2.current) materialRef2.current.uniforms.uTime.value = t + 100;

        // Keep cloud plane centered on player
        if (meshRef.current) {
            meshRef.current.position.set(camera.position.x, 280, camera.position.z);
        }
        if (meshRef2.current) {
            meshRef2.current.position.set(camera.position.x, 310, camera.position.z);
        }
    });

    const planeSize = MAX_RENDER_DISTANCE * CHUNK_SIZE * 2.5;

    return (
        <>
            {/* Lower Layer */}
            <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[planeSize, planeSize]} />
                <shaderMaterial 
                    ref={materialRef}
                    attach="material"
                    {...CloudShaderMaterial}
                    transparent
                    depthWrite={false} 
                    uniforms-uCloudScale-value={0.006}
                    uniforms-uOpacity-value={0.8}
                />
            </mesh>
            {/* Upper Layer (Parallax) */}
            <mesh ref={meshRef2} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[planeSize, planeSize]} />
                <shaderMaterial 
                    ref={materialRef2}
                    attach="material"
                    {...CloudShaderMaterial}
                    transparent
                    depthWrite={false}
                    uniforms-uCloudScale-value={0.003}
                    uniforms-uOpacity-value={0.5}
                    uniforms-uCloudSpeed-value={0.01}
                />
            </mesh>
        </>
    );
};

// SkyBox Component that follows the camera
const SkyBox = () => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame(({ camera }) => {
        if (groupRef.current) {
            groupRef.current.position.copy(camera.position);
        }
    });
    return (
        <group ref={groupRef}>
            <Stars radius={200} depth={50} count={5000} factor={4} fade />
        </group>
    );
};

const GameScene: React.FC<GameSceneProps> = ({ gameState, setChunks }) => {
  const [playerPos, setPlayerPos] = useState<Vector3>(() => {
     const safeY = getTerrainHeight(0, 0) + 10;
     return [0, safeY, 0];
  });

  // New state for underwater effect
  const [isUnderwater, setIsUnderwater] = useState(false);
  
  const pendingChunks = useRef<Set<string>>(new Set());
  
  const spiralRef = useRef({ x: 0, y: 0, dx: 0, dy: -1 });
  const chunkScanRef = useRef<{ cx: number, cz: number, index: number }>({ cx: 0, cz: 0, index: 0 });

  const lightRef = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  // Instantiate loader once based on seed
  const chunkLoader = useMemo(() => {
    return new ChunkLoader(gameState.seed, (chunk) => {
        setChunks(prev => new Map(prev).set(chunk.id, chunk));
        pendingChunks.current.delete(chunk.id);
    });
  }, [gameState.seed, setChunks]);

  // Cleanup loader
  useEffect(() => {
      return () => chunkLoader.terminate();
  }, [chunkLoader]);

  useFrame(({ camera }) => {
      if (lightRef.current) {
          const cx = camera.position.x;
          const cz = camera.position.z;
          lightRef.current.position.set(cx + 60, 140, cz + 40);
          lightRef.current.target.position.set(cx, 0, cz);
          lightRef.current.target.updateMatrixWorld();
      }
  });

  useFrame(() => {
      const [px, , pz] = playerPos;
      const centerCX = Math.floor(px / CHUNK_SIZE);
      const centerCZ = Math.floor(pz / CHUNK_SIZE);
      const maxRadius = gameState.renderDistance;

      if (chunkScanRef.current.cx !== centerCX || chunkScanRef.current.cz !== centerCZ) {
          chunkScanRef.current = { cx: centerCX, cz: centerCZ, index: 0 };
          spiralRef.current = { x: 0, y: 0, dx: 0, dy: -1 };
      }

      let requestedCount = 0;
      const MAX_REQUESTS_PER_FRAME = 4; 
      const MAX_SCAN_OPS = 400;

      let ops = 0;
      let { x, y, dx, dy } = spiralRef.current;

      while (requestedCount < MAX_REQUESTS_PER_FRAME && ops < MAX_SCAN_OPS) {
          ops++;

          if (x*x + y*y <= maxRadius * maxRadius) {
                const targetCX = centerCX + x;
                const targetCZ = centerCZ + y;
                const id = `${targetCX},${targetCZ}`;

                if (!gameState.chunks.has(id) && !pendingChunks.current.has(id)) {
                    pendingChunks.current.add(id);
                    chunkLoader.requestChunk(targetCX, targetCZ);
                    requestedCount++;
                }
          }

          if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
              const temp = dx;
              dx = -dy;
              dy = temp;
          }
          x += dx;
          y += dy;

          if (Math.abs(x) > maxRadius + 5 && Math.abs(y) > maxRadius + 5) {
               x = 0; y = 0; dx = 0; dy = -1;
               break; 
          }
      }

      spiralRef.current = { x, y, dx, dy };
  });

  useEffect(() => {
     const interval = setInterval(() => {
        const [px, , pz] = playerPos;
        const cx = Math.floor(px / CHUNK_SIZE);
        const cz = Math.floor(pz / CHUNK_SIZE);
        const radius = gameState.renderDistance + 4; 

        setChunks(prev => {
            let changed = false;
            for(const key of prev.keys()) {
                const [kx, kz] = key.split(',').map(Number);
                if (Math.abs(kx - cx) > radius || Math.abs(kz - cz) > radius) {
                     if (!changed) changed = true; 
                }
            }
            
            if (!changed) return prev;

            const next = new Map(prev);
            for(const key of next.keys()) {
                const [kx, kz] = key.split(',').map(Number);
                 if (Math.abs(kx - cx) > radius || Math.abs(kz - cz) > radius) {
                    next.delete(key);
                 }
            }
            return next;
        });
     }, 2000);
     return () => clearInterval(interval);
  }, [playerPos, gameState.renderDistance, setChunks]);

  const playerChunkX = Math.floor(playerPos[0] / CHUNK_SIZE);
  const playerChunkZ = Math.floor(playerPos[2] / CHUNK_SIZE);

  const { highDetailChunks, lowDetailChunks } = useMemo(() => {
      const high: {chunk: ChunkData, lod: number}[] = [];
      const low: ChunkData[] = [];
      
      const cx = playerChunkX;
      const cz = playerChunkZ;

      for (const chunk of gameState.chunks.values()) {
          const dx = Math.abs(chunk.x - cx);
          const dz = Math.abs(chunk.z - cz);
          const dist = Math.max(dx, dz); 
          
          if (dist < 3) { // Increased LOD0 range slightly
              high.push({ chunk, lod: 0 });
          } else if (dist < 16) {
              high.push({ chunk, lod: 1 });
          } else {
              low.push(chunk);
          }
      }

      return { highDetailChunks: high, lowDetailChunks: low };
  }, [gameState.chunks, playerChunkX, playerChunkZ]);

  const getChunk = useCallback((x: number, z: number) => gameState.chunks.get(`${x},${z}`), [gameState.chunks]);

  const getBlock = useCallback((x: number, y: number, z: number): number => {
    if (y < 0 || y >= WORLD_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = gameState.chunks.get(`${cx},${cz}`);
    if (!chunk) return BlockType.AIR;
    
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return getBlockFromChunk(chunk, lx, y, lz);
  }, [gameState.chunks]);

  const setBlock = useCallback((x: number, y: number, z: number, type: number) => {
     if (y < 0 || y >= WORLD_HEIGHT) return;
     const cx = Math.floor(x / CHUNK_SIZE);
     const cz = Math.floor(z / CHUNK_SIZE);
     
     setChunks(prev => {
         const newMap = new Map(prev);
         const key = `${cx},${cz}`;
         const chunk = newMap.get(key);
         if (!chunk) return prev;

         const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
         const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
         const idx = (lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz;

         const newData = new Uint8Array(chunk.data);
         newData[idx] = type;
         
         newMap.set(key, { ...chunk, data: newData, isDirty: !chunk.isDirty });
         return newMap;
     });
  }, [setChunks]);

  const handlePosChange = useCallback((pos: Vector3) => {
     if (Math.abs(pos[0] - playerPos[0]) > 1 || Math.abs(pos[2] - playerPos[2]) > 1) {
         setPlayerPos(pos);
         gameState.setPlayerPosition(pos);
     }
  }, [playerPos, gameState]);

  // Get currently selected block from hotbar
  const selectedBlock = gameState.hotbar[gameState.activeHotbarSlot];

  return (
    <>
      <color attach="background" args={['#87CEEB']} />
      
      <Sky 
        distance={450000} 
        sunPosition={[100, 50, 100]} 
        inclination={0.49} 
        azimuth={0.25} 
        rayleigh={isUnderwater ? 1 : 0.2} // Crisper sky
        mieCoefficient={0.005}
        mieDirectionalG={0.7}
      />
      
      {/* Infinite Stars */}
      <SkyBox />
      
      {/* Improved Fog matching Sky color better */}
      <fogExp2 attach="fog" args={[isUnderwater ? '#00334d' : '#B3D9FF', isUnderwater ? 0.08 : 0.0015]} />
      
      <CloudLayer />

      {/* 
        Lighting Setup:
        - Hemisphere for basic fill (Sky blue vs Ground brown)
        - Directional for sun shadows
      */}
      <hemisphereLight args={['#E3F2FD', '#3E2723', 0.7]} />
      <ambientLight intensity={0.4} />
      <primitive object={lightTarget} />
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        position={[50, 100, 50]}
        intensity={1.2}
        castShadow
        shadow-bias={-0.0001}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-far={350}
      />

      {highDetailChunks.map(({ chunk, lod }) => (
        <ChunkMesh 
            key={chunk.id} 
            chunk={chunk} 
            lodLevel={lod}
            neighbors={{
                nx: getChunk(chunk.x - 1, chunk.z),
                px: getChunk(chunk.x + 1, chunk.z),
                nz: getChunk(chunk.x, chunk.z - 1),
                pz: getChunk(chunk.x, chunk.z + 1),
            }}
            chunkLoader={chunkLoader}
        />
      ))}

      <DistantTerrain chunks={lowDetailChunks} />

      <Player 
        position={playerPos} 
        getBlock={getBlock}
        setBlock={setBlock}
        onPositionChange={handlePosChange}
        setIsUnderwater={gameState.setIsUnderwater} 
        selectedBlock={selectedBlock}
        isInventoryOpen={gameState.isInventoryOpen}
      />
    </>
  );
};

const Game: React.FC<GameProps & { setIsUnderwater: (val: boolean) => void }> = ({ gameState, setChunks, setIsUnderwater }) => {
    const enhancedGameState = { ...gameState, setIsUnderwater };
    
    return (
    <Canvas shadows camera={{ fov: 70, near: 0.1, far: MAX_RENDER_DISTANCE * CHUNK_SIZE }}>
      <GameScene gameState={enhancedGameState} setChunks={setChunks} />
      {gameState.debugMode && <Stats />}
    </Canvas>
  );
};

export default Game;
