import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Vector3, ChunkData, GameState } from '@/src/types/game';
import { BlockType } from '@/src/core/blocks';
import { getBlockFromChunk, getTerrainHeight } from '@/src/services/TerrainGenerator';
import ChunkMesh from '@/src/components/world/ChunkMesh';
import DistantTerrain from '@/src/components/world/DistantTerrain';
import Drone from '@/src/components/drone/Drone';
import type { DroneState } from '@/src/components/drone/Drone';
import { Scene } from './Scene';
import { CHUNK_SIZE, WORLD_HEIGHT, MAX_RENDER_DISTANCE } from '@/src/constants';
import { ChunkLoader } from '@/src/services/ChunkLoader';

interface GameProps {
  gameState: GameState;
  onChunkCountChange: (count: number) => void;
  droneStateRef: React.RefObject<DroneState | null>;
  onArmToggleReady: (fn: () => void) => void;
}

interface GameSceneProps {
  gameState: GameState;
  onChunkCountChange: (count: number) => void;
  droneStateRef: React.RefObject<DroneState | null>;
  onArmToggleReady: (fn: () => void) => void;
}

const GameScene: React.FC<GameSceneProps> = ({ gameState, onChunkCountChange, droneStateRef, onArmToggleReady }) => {
  const [dronePos, setDronePos] = useState<Vector3>(() => {
    const y = getTerrainHeight(0, 0) + 20;
    return [0, y, 0];
  });

  const chunksRef       = useRef<Map<string, ChunkData>>(new Map());
  const [chunkVersion, setChunkVersion] = useState(0);
  const pendingUpdateRef = useRef(false);
  const pendingChunks    = useRef<Set<string>>(new Set());
  const spiralRef        = useRef({ x: 0, y: 0, dx: 0, dy: -1 });
  const chunkScanRef     = useRef<{ cx: number; cz: number; index: number }>({ cx: 0, cz: 0, index: 0 });

  // Live position, mutated every frame without touching React state
  const dronePosRef = useRef<Vector3>([...dronePos] as Vector3);
  const droneChunkRef = useRef({
    cx: Math.floor(dronePos[0] / CHUNK_SIZE),
    cz: Math.floor(dronePos[2] / CHUNK_SIZE),
  });

  const renderDistRef = useRef(gameState.renderDistance + gameState.extraRenderDistance);
  useEffect(() => {
    renderDistRef.current = gameState.renderDistance + gameState.extraRenderDistance;
  }, [gameState.renderDistance, gameState.extraRenderDistance]);

  const chunkLoader = useMemo(() => new ChunkLoader(gameState.seed, (chunk) => {
    chunksRef.current.set(chunk.id, chunk);
    pendingChunks.current.delete(chunk.id);

    // Amortised GC: evict chunks too far from drone
    const [px, , pz] = dronePosRef.current;
    const cx = Math.floor(px / CHUNK_SIZE);
    const cz = Math.floor(pz / CHUNK_SIZE);
    const limit = renderDistRef.current + 4;
    for (const [key, val] of chunksRef.current) {
      if (Math.abs(val.x - cx) > limit || Math.abs(val.z - cz) > limit) {
        chunksRef.current.delete(key);
      }
    }
    pendingUpdateRef.current = true;
  }), [gameState.seed]);

  useEffect(() => () => chunkLoader.terminate(), [chunkLoader]);

  // Batch React reconciliation to once-per-frame max
  useFrame(() => {
    if (pendingUpdateRef.current) {
      setChunkVersion(v => v + 1);
      onChunkCountChange(chunksRef.current.size);
      pendingUpdateRef.current = false;
    }
  });

  // Spiral chunk loader
  useFrame(() => {
    const [px, , pz] = dronePos;
    const centerCX = Math.floor(px / CHUNK_SIZE);
    const centerCZ = Math.floor(pz / CHUNK_SIZE);
    const maxRadius = gameState.renderDistance + gameState.extraRenderDistance;

    if (chunkScanRef.current.cx !== centerCX || chunkScanRef.current.cz !== centerCZ) {
      chunkScanRef.current = { cx: centerCX, cz: centerCZ, index: 0 };
      spiralRef.current = { x: 0, y: 0, dx: 0, dy: -1 };
    }

    let requested = 0;
    let ops = 0;
    let { x, y, dx, dy } = spiralRef.current;

    while (requested < 4 && ops < 400) {
      ops++;
      if (x * x + y * y <= maxRadius * maxRadius) {
        const id = `${centerCX + x},${centerCZ + y}`;
        if (!chunksRef.current.has(id) && !pendingChunks.current.has(id)) {
          pendingChunks.current.add(id);
          chunkLoader.requestChunk(centerCX + x, centerCZ + y);
          requested++;
        }
      }
      if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
        const tmp = dx; dx = -dy; dy = tmp;
      }
      x += dx; y += dy;
      if (Math.abs(x) > maxRadius + 5 && Math.abs(y) > maxRadius + 5) {
        x = 0; y = 0; dx = 0; dy = -1; break;
      }
    }
    spiralRef.current = { x, y, dx, dy };
  });

  const droneChunkX = Math.floor(dronePos[0] / CHUNK_SIZE);
  const droneChunkZ = Math.floor(dronePos[2] / CHUNK_SIZE);

  const { highDetailChunks, lowDetailChunks } = useMemo(() => {
    const high: { chunk: ChunkData; lod: number }[] = [];
    const low: ChunkData[] = [];
    const highResLimit = gameState.renderDistance;
    for (const chunk of chunksRef.current.values()) {
      const dist = Math.max(Math.abs(chunk.x - droneChunkX), Math.abs(chunk.z - droneChunkZ));
      if (dist <= highResLimit) {
        high.push({ chunk, lod: dist < 4 ? 0 : 1 });
      } else {
        low.push(chunk);
      }
    }
    return { highDetailChunks: high, lowDetailChunks: low };
  }, [chunkVersion, droneChunkX, droneChunkZ, gameState.renderDistance]);

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

  // Called every frame with a reused array — copy values, and only touch
  // React state when the drone crosses a chunk boundary (that is the only
  // granularity chunk streaming / LOD / DistantTerrain care about).
  const handleDronePosChange = useCallback((pos: Vector3) => {
    const ref = dronePosRef.current;
    ref[0] = pos[0]; ref[1] = pos[1]; ref[2] = pos[2];

    const cx = Math.floor(pos[0] / CHUNK_SIZE);
    const cz = Math.floor(pos[2] / CHUNK_SIZE);
    if (cx !== droneChunkRef.current.cx || cz !== droneChunkRef.current.cz) {
      droneChunkRef.current = { cx, cz };
      setDronePos([pos[0], pos[1], pos[2]]);
    }
  }, []);

  const handleDroneStateUpdate = useCallback((state: DroneState) => {
    (droneStateRef as React.MutableRefObject<DroneState | null>).current = state;
  }, [droneStateRef]);

  const spawnY = useMemo(() => getTerrainHeight(0, 0) + 2, []);

  return (
    <>
      <Scene isUnderwater={false} />

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
        playerPosition={dronePos}
        renderDistance={gameState.renderDistance}
      />

      <Drone
        getBlock={getBlock}
        onPositionChange={handleDronePosChange}
        onStateUpdate={handleDroneStateUpdate}
        onArmToggleReady={onArmToggleReady}
        spawnY={spawnY}
      />
    </>
  );
};

const Game: React.FC<GameProps> = ({ gameState, onChunkCountChange, droneStateRef, onArmToggleReady }) => (
  <Canvas
    shadows
    gl={{ toneMapping: THREE.NoToneMapping }}
  >
    <GameScene
      gameState={gameState}
      onChunkCountChange={onChunkCountChange}
      droneStateRef={droneStateRef}
      onArmToggleReady={onArmToggleReady}
    />
    {gameState.debugMode && <Stats className="stats-panel" />}
  </Canvas>
);

export default Game;
