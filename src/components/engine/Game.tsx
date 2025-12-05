import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Vector3, ChunkData, GameState } from '@/src/types/game';
import { BlockType } from '@/src/core/blocks';
import { getBlockFromChunk, getTerrainHeight } from '@/src/services/TerrainGenerator';
import ChunkMesh from '@/src/components/world/ChunkMesh';
import DistantTerrain from '@/src/components/world/DistantTerrain';
import Player from '@/src/components/player/Player';
import { Scene } from './Scene';
import { CHUNK_SIZE, WORLD_HEIGHT, MAX_RENDER_DISTANCE } from '@/src/constants';
import { ChunkLoader } from '@/src/services/ChunkLoader';

interface GameProps {
  gameState: GameState;
  setIsUnderwater: (val: boolean) => void;
  onChunkCountChange: (count: number) => void;
}

interface GameSceneProps {
  gameState: GameState & { setIsUnderwater: (val: boolean) => void };
  onChunkCountChange: (count: number) => void;
}

const GameScene: React.FC<GameSceneProps> = ({ gameState, onChunkCountChange }) => {
  const [playerPos, setPlayerPos] = useState<Vector3>(() => [0, getTerrainHeight(0, 0) + 10, 0]);
  const [isUnderwater, setIsUnderwater] = useState(false);
  
  // Point 3: Ref-based state management for chunks to avoid App-wide re-renders
  // We use a Map Ref for storage and a version number state to trigger local re-renders.
  const chunksRef = useRef<Map<string, ChunkData>>(new Map());
  const [chunkVersion, setChunkVersion] = useState(0); 
  
  // BATCHING UPDATE REF
  const pendingUpdateRef = useRef(false);

  const pendingChunks = useRef<Set<string>>(new Set());
  const spiralRef = useRef({ x: 0, y: 0, dx: 0, dy: -1 });
  const chunkScanRef = useRef<{ cx: number, cz: number, index: number }>({ cx: 0, cz: 0, index: 0 });

  // Sync player pos ref for loader callback (GC)
  const playerPosRef = useRef(playerPos);
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  
  const renderDistRef = useRef(gameState.renderDistance + gameState.extraRenderDistance);
  useEffect(() => { renderDistRef.current = gameState.renderDistance + gameState.extraRenderDistance; }, [gameState.renderDistance, gameState.extraRenderDistance]);

  const chunkLoader = useMemo(() => {
    return new ChunkLoader(gameState.seed, (chunk) => {
        // Add new chunk
        chunksRef.current.set(chunk.id, chunk);
        pendingChunks.current.delete(chunk.id);

        // Point 5: Garbage Collection Strategy - Amortized inside load loop
        // Check for distant chunks to remove every time we add a new one
        const [px, , pz] = playerPosRef.current;
        const cx = Math.floor(px / CHUNK_SIZE);
        const cz = Math.floor(pz / CHUNK_SIZE);
        const limit = renderDistRef.current + 4; // Buffer

        // Optimization: Don't scan entire map every single chunk load if map is huge.
        // But map size is ~1000 items, iteration is fast in JS (microsecond scale).
        for (const [key, val] of chunksRef.current) {
             // Simple Manhattan distance check for speed first or just simple rectangular bounds
             if (Math.abs(val.x - cx) > limit || Math.abs(val.z - cz) > limit) {
                 chunksRef.current.delete(key);
             }
        }
        
        // Flag for update in next frame instead of setting state immediately
        pendingUpdateRef.current = true;
    });
  }, [gameState.seed]); // Removed onChunkCountChange to avoid recreating loader

  useEffect(() => {
      return () => chunkLoader.terminate();
  }, [chunkLoader]);

  useFrame(({ camera }) => {
      // 2. Batched State Update
      // Only trigger React reconciliation once per frame max
      if (pendingUpdateRef.current) {
          setChunkVersion(v => v + 1);
          onChunkCountChange(chunksRef.current.size);
          pendingUpdateRef.current = false;
      }
  });

  useFrame(() => {
      const [px, , pz] = playerPos;
      const centerCX = Math.floor(px / CHUNK_SIZE);
      const centerCZ = Math.floor(pz / CHUNK_SIZE);
      
      const maxRadius = gameState.renderDistance + gameState.extraRenderDistance;

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
                // Direct Ref check is faster than State Map check
                if (!chunksRef.current.has(id) && !pendingChunks.current.has(id)) {
                    pendingChunks.current.add(id);
                    chunkLoader.requestChunk(targetCX, targetCZ);
                    requestedCount++;
                }
          }
          if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
              const temp = dx; dx = -dy; dy = temp;
          }
          x += dx; y += dy;
          if (Math.abs(x) > maxRadius + 5 && Math.abs(y) > maxRadius + 5) {
               x = 0; y = 0; dx = 0; dy = -1; break; 
          }
      }
      spiralRef.current = { x, y, dx, dy };
  });

  const playerChunkX = Math.floor(playerPos[0] / CHUNK_SIZE);
  const playerChunkZ = Math.floor(playerPos[2] / CHUNK_SIZE);

  const { highDetailChunks, lowDetailChunks } = useMemo(() => {
      const high: {chunk: ChunkData, lod: number}[] = [];
      const low: ChunkData[] = [];
      const cx = playerChunkX;
      const cz = playerChunkZ;
      const highResLimit = gameState.renderDistance;

      // Iterating Map.values() is reasonably fast for N < 5000
      for (const chunk of chunksRef.current.values()) {
          const dx = Math.abs(chunk.x - cx);
          const dz = Math.abs(chunk.z - cz);
          const dist = Math.max(dx, dz); 
          if (dist <= highResLimit) {
              if (dist < 4) high.push({ chunk, lod: 0 });
              else high.push({ chunk, lod: 1 });
          } else {
              low.push(chunk);
          }
      }
      return { highDetailChunks: high, lowDetailChunks: low };
  }, [chunkVersion, playerChunkX, playerChunkZ, gameState.renderDistance]); // Depend on chunkVersion

  const getChunk = useCallback((x: number, z: number) => chunksRef.current.get(`${x},${z}`), []);

  const getBlock = useCallback((x: number, y: number, z: number): number => {
    if (y < 0 || y >= WORLD_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = chunksRef.current.get(`${cx},${cz}`);
    if (!chunk) return BlockType.AIR;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return getBlockFromChunk(chunk, lx, y, lz);
  }, []);

  const setBlock = useCallback((x: number, y: number, z: number, type: number) => {
     if (y < 0 || y >= WORLD_HEIGHT) return;
     const cx = Math.floor(x / CHUNK_SIZE);
     const cz = Math.floor(z / CHUNK_SIZE);
     
     const key = `${cx},${cz}`;
     const chunk = chunksRef.current.get(key);
     if (!chunk) return;

     const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
     const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
     const idx = (lx * WORLD_HEIGHT + y) * CHUNK_SIZE + lz;

     // Update logic needs to be mindful of Immutability if using strict React patterns,
     // but here we are mutating the buffer in place for performance, 
     // then triggering a mesh rebuild.
     
     // Clone array to be safe for history/undo if we added that, but for now in-place is okay 
     // provided we flag dirty.
     chunk.data[idx] = type;
     chunk.isDirty = true;
     
     // Trigger update
     setChunkVersion(v => v + 1);
  }, []);

  const handlePosChange = useCallback((pos: Vector3) => {
     if (Math.abs(pos[0] - playerPos[0]) > 1 || Math.abs(pos[2] - playerPos[2]) > 1) {
         setPlayerPos(pos);
         gameState.setPlayerPosition(pos);
     }
  }, [playerPos, gameState]);

  return (
    <>
      <Scene isUnderwater={isUnderwater} />
      
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

      <DistantTerrain 
          chunks={lowDetailChunks} 
          playerPosition={playerPos}
          renderDistance={gameState.renderDistance}
      />

      <Player 
        position={playerPos} 
        getBlock={getBlock}
        setBlock={setBlock}
        onPositionChange={handlePosChange}
        setIsUnderwater={(val) => { setIsUnderwater(val); gameState.setIsUnderwater(val); }} 
        selectedBlock={gameState.selectedBlock || BlockType.STONE}
        isInventoryOpen={gameState.isInventoryOpen}
      />
    </>
  );
};

const Game: React.FC<GameProps> = ({ gameState, setIsUnderwater, onChunkCountChange }) => {
    const enhancedGameState = { ...gameState, setIsUnderwater };
    return (
    <Canvas shadows camera={{ fov: 70, near: 0.1, far: MAX_RENDER_DISTANCE * CHUNK_SIZE }} gl={{ toneMapping: THREE.NoToneMapping }}>
      <GameScene gameState={enhancedGameState} onChunkCountChange={onChunkCountChange} />
      {gameState.debugMode && <Stats className="stats-panel" />}
    </Canvas>
  );
};

export default Game;
