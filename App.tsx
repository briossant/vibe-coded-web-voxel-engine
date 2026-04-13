import React, { useState, useCallback, useMemo, useRef } from 'react';
import Game from '@/src/components/engine/Game';
import OSD from '@/src/components/ui/OSD';
import type { DroneState } from '@/src/components/drone/Drone';
import { GameState, Vector3 } from '@/src/types/game';
import { noise } from '@/src/utils/noise';

const App: React.FC = () => {
  const [seed] = useState(() => Math.floor(Math.random() * 2147483647));

  const [chunkCount, setChunkCount] = useState(0);
  const [dronePosition, setDronePosition] = useState<Vector3>([0, 80, 0]);
  const [renderDistance, setRenderDistance] = useState(6);
  const [extraRenderDistance, setExtraRenderDistance] = useState(16);

  const droneStateRef  = useRef<DroneState | null>(null);
  const armToggleRef   = useRef<(() => void) | null>(null);
  const handleArmToggleReady = useCallback((fn: () => void) => { armToggleRef.current = fn; }, []);
  const handleArmToggle      = useCallback(() => { armToggleRef.current?.(); }, []);

  useMemo(() => { noise.reseed(seed); }, [seed]);

  const noopGetBlock = useCallback(() => 0, []);
  const noopGetChunk = useCallback(() => undefined, []);

  const gameState: GameState = {
    chunkCount,
    dronePosition,
    renderDistance,
    extraRenderDistance,
    seed,
    debugMode: true,
    setDronePosition,
    updateRenderDistance: setRenderDistance,
    updateExtraRenderDistance: setExtraRenderDistance,
    getChunk: noopGetChunk,
    getBlock: noopGetBlock,
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 3D world */}
      <div className="absolute inset-0 z-0">
        <Game
          gameState={gameState}
          onChunkCountChange={setChunkCount}
          droneStateRef={droneStateRef}
          onArmToggleReady={handleArmToggleReady}
        />
      </div>

      {/* HUD / OSD overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <OSD droneStateRef={droneStateRef} onArmToggle={handleArmToggle} />
      </div>

      {/* Debug info — top-right corner */}
      <div
        className="absolute top-3 right-3 z-10 pointer-events-none text-xs font-mono"
        style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}
      >
        <div>chunks: {chunkCount}</div>
        <div>seed: {seed}</div>
        <div>
          rd:{' '}
          <input
            type="range" min="2" max="12" value={renderDistance}
            onChange={e => setRenderDistance(+e.target.value)}
            className="pointer-events-auto w-16 h-1 align-middle"
            style={{ accentColor: '#4af' }}
          />
          {renderDistance}
        </div>
      </div>
    </div>
  );
};

export default App;
