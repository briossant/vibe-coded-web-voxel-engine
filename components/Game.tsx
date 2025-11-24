
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, Stats, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Vector3, ChunkData, GameState } from '../types';
import { BlockType } from '../blocks';
import { getBlockFromChunk, getTerrainHeight } from '../services/TerrainGenerator';
import ChunkMesh, { sharedWaterMaterial } from './ChunkMesh';
import DistantTerrain from './DistantTerrain';
import Player from './Player';
import { CHUNK_SIZE, WORLD_HEIGHT, MAX_RENDER_DISTANCE } from '../constants';
import { ChunkLoader } from '../services/ChunkLoader';
import { globalTexture } from '../utils/textures';

interface GameProps {
  gameState: GameState;
  setIsUnderwater: (val: boolean) => void;
  onChunkCountChange: (count: number) => void;
}

interface GameSceneProps {
  gameState: GameState & { setIsUnderwater: (val: boolean) => void };
  onChunkCountChange: (count: number) => void;
}

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
            vec2 pos = vWorldPos.xz * uCloudScale;
            pos.x += uTime * uCloudSpeed;
            pos.y += uTime * uCloudSpeed * 0.5;
            float n = fbm(pos);
            float alpha = smoothstep(0.4, 0.8, n);
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
        if (meshRef.current) meshRef.current.position.set(camera.position.x, 280, camera.position.z);
        if (meshRef2.current) meshRef2.current.position.set(camera.position.x, 310, camera.position.z);
    });

    const planeSize = MAX_RENDER_DISTANCE * CHUNK_SIZE * 2.5;

    return (
        <>
            <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[planeSize, planeSize]} />
                <shaderMaterial ref={materialRef} attach="material" {...CloudShaderMaterial} transparent depthWrite={false} uniforms-uCloudScale-value={0.006} uniforms-uOpacity-value={0.8} />
            </mesh>
            <mesh ref={meshRef2} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[planeSize, planeSize]} />
                <shaderMaterial ref={materialRef2} attach="material" {...CloudShaderMaterial} transparent depthWrite={false} uniforms-uCloudScale-value={0.003} uniforms-uOpacity-value={0.5} uniforms-uCloudSpeed-value={0.01} />
            </mesh>
        </>
    );
};

const SkyBox = () => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame(({ camera }) => {
        if (groupRef.current) groupRef.current.position.copy(camera.position);
    });
    return (
        <group ref={groupRef}>
            <Stars radius={200} depth={50} count={5000} factor={4} fade />
        </group>
    );
};

const TextureManager = () => {
    const { gl } = useThree();
    useEffect(() => {
        const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
        globalTexture.anisotropy = maxAnisotropy;
        globalTexture.needsUpdate = true;
    }, [gl]);
    return null;
};

const GameScene: React.FC<GameSceneProps> = ({ gameState, onChunkCountChange }) => {
  const [playerPos, setPlayerPos] = useState<Vector3>(() => [0, getTerrainHeight(0, 0) + 10, 0]);
  const [isUnderwater, setIsUnderwater] = useState(false);
  
  // Point 3: Ref-based state management for chunks to avoid App-wide re-renders
  // We use a Map Ref for storage and a version number state to trigger local re-renders.
  const chunksRef = useRef<Map<string, ChunkData>>(new Map());
  const [chunkVersion, setChunkVersion] = useState(0); 
  
  const pendingChunks = useRef<Set<string>>(new Set());
  const spiralRef = useRef({ x: 0, y: 0, dx: 0, dy: -1 });
  const chunkScanRef = useRef<{ cx: number, cz: number, index: number }>({ cx: 0, cz: 0, index: 0 });
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

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

        let deleted = false;
        // Optimization: Don't scan entire map every single chunk load if map is huge.
        // But map size is ~1000 items, iteration is fast in JS (microsecond scale).
        for (const [key, val] of chunksRef.current) {
             // Simple Manhattan distance check for speed first or just simple rectangular bounds
             if (Math.abs(val.x - cx) > limit || Math.abs(val.z - cz) > limit) {
                 chunksRef.current.delete(key);
                 deleted = true;
             }
        }
        
        // Update App debug info (throttled/batched by React nature, effectively)
        onChunkCountChange(chunksRef.current.size);

        // Force component update to render new meshes
        setChunkVersion(v => v + 1);
    });
  }, [gameState.seed, onChunkCountChange]);

  useEffect(() => {
      return () => chunkLoader.terminate();
  }, [chunkLoader]);

  useFrame(({ camera, clock }) => {
      // Light Following
      if (lightRef.current) {
          const cx = camera.position.x;
          const cz = camera.position.z;
          lightRef.current.position.set(cx + 60, 140, cz + 40);
          lightRef.current.target.position.set(cx, 0, cz);
          lightRef.current.target.updateMatrixWorld();
      }

      // GLOBAL Uniform Update for Water (Optimization)
      // Instead of updating every single chunk mesh, we update the shared material once per frame.
      sharedWaterMaterial.uniforms.uTime.value = clock.getElapsedTime();
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
      // Increased request rate since we now have a worker pool
      const MAX_REQUESTS_PER_FRAME = 8; 
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
      <TextureManager />
      <color attach="background" args={['#87CEEB']} />
      <Sky 
        distance={450000} sunPosition={[100, 50, 100]} inclination={0.49} azimuth={0.25} 
        rayleigh={isUnderwater ? 1 : 0.2} mieCoefficient={0.005} mieDirectionalG={0.7}
      />
      <SkyBox />
      <fogExp2 attach="fog" args={[isUnderwater ? '#00334d' : '#B3D9FF', isUnderwater ? 0.08 : 0.0015]} />
      <CloudLayer />
      <hemisphereLight args={['#E3F2FD', '#3E2723', 0.7]} />
      <ambientLight intensity={0.4} />
      <primitive object={lightTarget} />
      <directionalLight
        ref={lightRef} target={lightTarget} position={[50, 100, 50]} intensity={1.2}
        castShadow shadow-bias={-0.0001} shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} shadow-camera-far={350}
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
    <Canvas shadows camera={{ fov: 70, near: 0.1, far: MAX_RENDER_DISTANCE * CHUNK_SIZE }}>
      <GameScene gameState={enhancedGameState} onChunkCountChange={onChunkCountChange} />
      {gameState.debugMode && <Stats />}
    </Canvas>
  );
};

export default Game;
