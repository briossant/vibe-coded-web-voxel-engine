import React from 'react';
import { GameState } from '../types';
import { MAX_RENDER_DISTANCE } from '../constants';
import { textureUrl } from '../utils/textures';
import { getBlockDef } from '../blocks';

interface HUDProps {
  gameState: GameState & { isUnderwater: boolean };
}

const HUD: React.FC<HUDProps> = ({ gameState }) => {
  const { 
      playerPosition, 
      renderDistance, 
      updateRenderDistance, 
      updateExtraRenderDistance,
      extraRenderDistance,
      toggleDebug, 
      debugMode, 
      seed, 
      isUnderwater,
      hotbar,
      activeHotbarSlot,
      setActiveHotbarSlot
  } = gameState;

  return (
    <>
        {/* Underwater Overlay */}
        <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
            style={{ 
                backgroundColor: '#005577', 
                opacity: isUnderwater ? 0.5 : 0,
                zIndex: 5 
            }}
        />

        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10">
        {/* Top Left: Debug Info */}
        <div className="flex flex-col gap-2 items-start pointer-events-auto">
            <h1 className="text-white font-bold text-xl drop-shadow-md">NeuroVoxel v0.6 (Creative Mode)</h1>
            <div className="bg-black/50 p-3 rounded text-white text-xs font-mono backdrop-blur-sm border border-white/10">
            <p>POS: {playerPosition.map(n => n.toFixed(1)).join(', ')}</p>
            <p>Chunks Loaded: {gameState.chunks.size}</p>
            <p className="text-gray-400">Seed: <span className="text-yellow-400">{seed}</span></p>
            <div className="mt-2 flex gap-2">
                <button 
                    onClick={toggleDebug}
                    className="bg-white/20 hover:bg-white/40 px-2 py-1 rounded transition"
                >
                    {debugMode ? 'Hide Stats' : 'Show Stats'}
                </button>
            </div>
            
            {/* Render Distance Sliders */}
            <div className="mt-2">
                <label className="block text-[10px] text-gray-300">Render Distance ({renderDistance})</label>
                <input 
                    type="range" 
                    min="8" max="64" 
                    value={renderDistance} 
                    onChange={(e) => updateRenderDistance(parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                />
            </div>
            
             <div className="mt-2">
                <label className="block text-[10px] text-gray-300">Extra Render Distance ({extraRenderDistance})</label>
                <input 
                    type="range" 
                    min="0" max="64" 
                    value={extraRenderDistance} 
                    onChange={(e) => updateExtraRenderDistance(parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                />
            </div>
            </div>
        </div>

        {/* Center: Crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-1 h-4 bg-white/80 absolute left-1.5 -top-1.5"></div>
            <div className="w-4 h-1 bg-white/80 absolute -left-0 top-0"></div>
        </div>

        {/* Bottom: Hotbar & Hints */}
        <div className="flex flex-col items-center w-full pointer-events-auto pb-6">
            {/* Hotbar */}
            <div className="bg-black/60 p-1 rounded flex gap-1 border border-white/20 backdrop-blur-md mb-2">
                {hotbar.map((blockId, index) => {
                    const def = getBlockDef(blockId);
                    const isActive = activeHotbarSlot === index;
                    return (
                        <div 
                            key={index}
                            onClick={() => setActiveHotbarSlot(index)}
                            className={`w-10 h-10 border-2 flex items-center justify-center cursor-pointer transition-transform ${
                                isActive ? 'border-white bg-white/20 scale-110 z-10' : 'border-transparent hover:bg-white/10'
                            }`}
                        >
                            {blockId !== 0 && (
                                <div 
                                    className="w-8 h-8 image-pixelated"
                                    style={{
                                        backgroundImage: `url(${textureUrl})`,
                                        backgroundSize: '6400% 100%',
                                        backgroundPosition: `calc(-${def.textures.side} * 100%) 0`
                                    }}
                                />
                            )}
                            {/* Number key hint */}
                            <span className="absolute top-0 left-1 text-[8px] text-white drop-shadow-md">{index + 1}</span>
                        </div>
                    );
                })}
            </div>

            <div className="text-white/70 text-xs text-center font-sans">
                <p className="bg-black/30 inline-block px-4 py-1 rounded-full backdrop-blur-sm">
                WASD Move • E Inventory • 1-9 Select Item • CLICK Mine/Place
                </p>
            </div>
        </div>
        </div>
    </>
  );
};

export default HUD;