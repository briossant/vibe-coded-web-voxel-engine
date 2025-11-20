
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

const GameScene: React.FC<GameSceneProps> = ({ gameState, setChunks }) => {
  const [playerPos, setPlayerPos] = useState<Vector3>(() => {
     const safeY = getTerrainHeight(0, 0) + 10;
     return [0, safeY, 0];
  });

  // New state for underwater effect
  const [isUnderwater, setIsUnderwater] = useState(false);
  
  const loaderRef = useRef<ChunkLoader | null>(null);
  const pendingChunks = useRef<Set<string>>(new Set());
  
  const spiralRef = useRef({ x: 0, y: 0, dx: 0, dy: -1 });
  const chunkScanRef = useRef<{ cx: number, cz: number, index: number }>({ cx: 0, cz: 0, index: 0 });

  const lightRef = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ camera }) => {
      if (lightRef.current) {
          const cx = camera.position.x;
          const cz = camera.position.z;
          lightRef.current.position.set(cx + 50, 120, cz + 50);
          lightRef.current.target.position.set(cx, 0, cz);
          lightRef.current.target.updateMatrixWorld();
      }
  });

  useEffect(() => {
    loaderRef.current = new ChunkLoader(gameState.seed, (chunk) => {
        setChunks(prev => new Map(prev).set(chunk.id, chunk));
        pendingChunks.current.delete(chunk.id);
    });
    return () => loaderRef.current?.terminate();
  }, [setChunks, gameState.seed]);

  useFrame(() => {
      if (!loaderRef.current) return;

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
                    loaderRef.current.requestChunk(targetCX, targetCZ);
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

          if (dist < 2) {
              high.push({ chunk, lod: 0 });
          } else if (dist < 5) {
              high.push({ chunk, lod: 1 });
          } else if (dist < 8) {
              high.push({ chunk, lod: 2 });
          } else if (dist < 16) {
              high.push({ chunk, lod: 3 });
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
        sunPosition={[100, 40, 100]} 
        inclination={0.6} 
        azimuth={0.25} 
        rayleigh={isUnderwater ? 0.5 : 2} 
      />
      <Stars radius={200} depth={50} count={5000} factor={4} fade />
      
      <fogExp2 attach="fog" args={[isUnderwater ? '#00334d' : '#c6e6ff', isUnderwater ? 0.08 : 2.5 / (gameState.renderDistance * CHUNK_SIZE)]} />
      
      <hemisphereLight args={['#c6e6ff', '#5d4037', 0.5]} />
      <ambientLight intensity={0.3} />
      <primitive object={lightTarget} />
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        position={[50, 100, 50]}
        intensity={1.4}
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-far={300}
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

// Game Wrapper to handle State Lifting for HUD
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
