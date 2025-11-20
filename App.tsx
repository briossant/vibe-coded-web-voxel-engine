
import React, { useState, useCallback, useMemo } from 'react';
import Game from './components/Game';
import HUD from './components/HUD';
import { GameState, ChunkData, Vector3, BlockType } from './types';
import { DEFAULT_RENDER_DISTANCE } from './constants';
import { noise } from './utils/noise';

const App: React.FC = () => {
  // Generate a random seed on first load
  const [seed] = useState(() => Math.floor(Math.random() * 2147483647));
  
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map());
  const [playerPosition, setPlayerPosition] = useState<Vector3>([0, 80, 0]);
  const [renderDistance, setRenderDistance] = useState<number>(DEFAULT_RENDER_DISTANCE);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isUnderwater, setIsUnderwater] = useState<boolean>(false);

  // Reseed the global noise utility synchronously so initial renders (like Player physics)
  // use the correct seed immediately.
  useMemo(() => {
    noise.reseed(seed);
  }, [seed]);

  const toggleDebug = useCallback(() => setDebugMode(prev => !prev), []);
  const toggleMenu = useCallback(() => setIsMenuOpen(prev => !prev), []);

  // Placeholders, the real logic is inside Game.tsx for performance context
  const noopGetBlock = (x: number, y: number, z: number) => BlockType.AIR;
  const noopSetBlock = (x: number, y: number, z: number, type: BlockType) => {};

  // GameState object to pass down
  const gameState: GameState = {
    chunks,
    playerPosition,
    renderDistance,
    seed,
    isMenuOpen,
    debugMode,
    setPlayerPosition,
    toggleMenu,
    toggleDebug,
    updateRenderDistance: setRenderDistance,
    getBlock: noopGetBlock, // Overridden in Game
    setBlock: noopSetBlock  // Overridden in Game
  };

  // Extended State for HUD
  const hudState = { ...gameState, isUnderwater };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 3D Layer */}
      <div className="absolute inset-0 z-0">
        <Game gameState={gameState} setChunks={setChunks} setIsUnderwater={setIsUnderwater} />
      </div>
      
      {/* UI Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <HUD gameState={hudState} />
      </div>
    </div>
  );
};

export default App;
