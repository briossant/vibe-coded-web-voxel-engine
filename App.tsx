import React, {useState, useCallback, useMemo, useEffect} from 'react';
import Game from './components/Game';
import HUD from './components/HUD';
import Inventory from './components/Inventory';
import {GameState, Vector3} from './types';
import {BlockType} from './blocks';
import {noise} from './utils/noise';

const App: React.FC = () => {
    // Generate a random seed on first load
    const [seed] = useState(() => Math.floor(Math.random() * 2147483647));

    // Chunk state moved to Game.tsx. App only needs to know count for debug overlay.
    const [chunkCount, setChunkCount] = useState(0);

    const [playerPosition, setPlayerPosition] = useState<Vector3>([0, 80, 0]);

    // Dual Render Distance Settings
    const [renderDistance, setRenderDistance] = useState<number>(16); // High Res default 6
    const [extraRenderDistance, setExtraRenderDistance] = useState<number>(16); // Low Res default 16

    const [debugMode, setDebugMode] = useState<boolean>(true); // Default to true for FPS counter
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
        BlockType.WATER,
        BlockType.TULIP_RED,
        BlockType.CORNFLOWER
    ].map(id => id || BlockType.STONE).slice(0, 9));

    const [activeHotbarSlot, setActiveHotbarSlot] = useState<number>(0);

    // Reseed the global noise utility synchronously
    useMemo(() => {
        noise.reseed(seed);
    }, [seed]);

    const toggleDebug = useCallback(() => setDebugMode(prev => !prev), []);
    const toggleMenu = useCallback(() => setIsMenuOpen(prev => !prev), []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyE') {
                if (document.activeElement?.tagName === 'INPUT') return;
                setInventoryOpen(prev => !prev);
            }
            if (e.code === 'Escape') {
                setInventoryOpen(false);
            }
            if (!isInventoryOpen && e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                setActiveHotbarSlot(index);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isInventoryOpen]);

    const handleBlockSelect = useCallback((blockId: number) => {
        setHotbar(prev => {
            const next = [...prev];
            next[activeHotbarSlot] = blockId;
            return next;
        });
    }, [activeHotbarSlot]);

    const noopGetBlock = (x: number, y: number, z: number) => BlockType.AIR;
    const noopSetBlock = (x: number, y: number, z: number, type: number) => {};
    const noopGetChunk = (x: number, z: number) => undefined;

    const gameState: GameState = {
        chunkCount,
        playerPosition,
        renderDistance,
        extraRenderDistance,
        seed,
        isMenuOpen,
        debugMode,
        setPlayerPosition,
        toggleMenu,
        toggleDebug,
        updateRenderDistance: setRenderDistance,
        updateExtraRenderDistance: setExtraRenderDistance,
        getChunk: noopGetChunk, // Overridden in Game
        getBlock: noopGetBlock, // Overridden in Game
        setBlock: noopSetBlock,  // Overridden in Game

        isInventoryOpen,
        setInventoryOpen,
        hotbar,
        setHotbar,
        activeHotbarSlot,
        setActiveHotbarSlot,
        selectedBlock: hotbar[activeHotbarSlot],
        setSelectedBlock: handleBlockSelect
    };

    const hudState = {...gameState, isUnderwater};

    return (
        <div className="relative w-full h-screen bg-black">
            <div className="absolute inset-0 z-0">
                <Game
                    gameState={gameState}
                    setIsUnderwater={setIsUnderwater}
                    onChunkCountChange={setChunkCount}
                />
            </div>

            <div className="absolute inset-0 z-10 pointer-events-none">
                <HUD gameState={hudState} />
            </div>

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
