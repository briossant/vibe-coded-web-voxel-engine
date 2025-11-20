
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Game from './components/Game';
import HUD from './components/HUD';
import Inventory from './components/Inventory';
import { GameState, ChunkData, Vector3 } from './types';
import { BlockType } from './blocks';
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

  // Inventory & Hotbar State
  const [isInventoryOpen, setInventoryOpen] = useState<boolean>(false);
  const [hotbar, setHotbar] = useState<number[]>([
      BlockType.GRASS, 
      BlockType.DIRT, 
      BlockType.STONE, 
      BlockType.OAK_LOG, 
      BlockType.OAK_LEAVES, 
      BlockType.SAND, 
      BlockType.WATER, // Replaced GLASS with WATER placeholder
      BlockType.TULIP_RED, // Replaced TORCH with TULIP_RED placeholder
      BlockType.CORNFLOWER
  ].map(id => id || BlockType.STONE).slice(0, 9)); // Ensure valid IDs
  
  const [activeHotbarSlot, setActiveHotbarSlot] = useState<number>(0);

  // Reseed the global noise utility synchronously so initial renders (like Player physics)
  // use the correct seed immediately.
  useMemo(() => {
    noise.reseed(seed);
  }, [seed]);

  const toggleDebug = useCallback(() => setDebugMode(prev => !prev), []);
  const toggleMenu = useCallback(() => setIsMenuOpen(prev => !prev), []);

  // Handle Hotbar Keys (1-9) and Inventory Key (E)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Prevent default browser actions for F-keys or similar if needed
          
          // Inventory Toggle
          if (e.code === 'KeyE') {
              // If user is typing in search, ignore 'E'? handled in input element, but careful of event bubbling.
              // We can check document.activeElement
              if (document.activeElement?.tagName === 'INPUT') return;

              setInventoryOpen(prev => !prev);
          }
          if (e.code === 'Escape') {
              setInventoryOpen(false);
          }

          // Hotbar Selection
          if (!isInventoryOpen && e.key >= '1' && e.key <= '9') {
              const index = parseInt(e.key) - 1;
              setActiveHotbarSlot(index);
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInventoryOpen]);

  // Update hotbar slot when item is selected in Inventory
  const handleBlockSelect = useCallback((blockId: number) => {
      setHotbar(prev => {
          const next = [...prev];
          next[activeHotbarSlot] = blockId;
          return next;
      });
  }, [activeHotbarSlot]);

  // Placeholders, the real logic is inside Game.tsx for performance context
  const noopGetBlock = (x: number, y: number, z: number) => BlockType.AIR;
  const noopSetBlock = (x: number, y: number, z: number, type: number) => {};

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
    setBlock: noopSetBlock,  // Overridden in Game
    
    // Inventory
    isInventoryOpen,
    setInventoryOpen,
    hotbar,
    setHotbar,
    activeHotbarSlot,
    setActiveHotbarSlot,
    selectedBlock: hotbar[activeHotbarSlot],
    setSelectedBlock: handleBlockSelect // Use selection handler for inventory clicks
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

      {/* Inventory Overlay (Pointer events auto) */}
      {isInventoryOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto">
             <Inventory 
                isOpen={isInventoryOpen} 
                onClose={() => setInventoryOpen(false)} 
                onSelectBlock={handleBlockSelect}
             />
          </div>
      )}
    </div>
  );
};

export default App;
