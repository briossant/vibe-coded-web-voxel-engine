import React, { useRef, useState, useEffect } from 'react';
import type { DroneState } from '@/src/components/drone/Drone';

interface OSDProps {
  droneStateRef: React.RefObject<DroneState | null>;
  onArmToggle: () => void;
}

// The OSD reads from a ref (not React state) and self-updates at 10 Hz
// to avoid coupling the render loop to React re-renders.
const OSD: React.FC<OSDProps> = ({ droneStateRef, onArmToggle }) => {
  const [snapshot, setSnapshot] = useState<DroneState | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (droneStateRef.current) setSnapshot({ ...droneStateRef.current });
    }, 100); // 10 Hz
    return () => clearInterval(id);
  }, [droneStateRef]);

  const armed = snapshot?.isArmed ?? false;
  const pos   = snapshot?.position;
  const vel   = snapshot?.velocity;
  const euler = snapshot?.euler;
  const inp   = snapshot?.controlInputs;
  const mot   = snapshot?.motorThrottles;

  const speed   = vel ? vel.length() : 0;
  const alt     = pos?.y.toFixed(1) ?? '--';
  const roll    = euler ? (euler.z * 180 / Math.PI).toFixed(1) : '--';
  const pitch   = euler ? (euler.x * 180 / Math.PI).toFixed(1) : '--';
  const yaw     = euler ? (euler.y * 180 / Math.PI).toFixed(1) : '--';

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: 'monospace' }}>

      {/* ── Arm status — top centre (click to arm/disarm) ───────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <button
          onClick={onArmToggle}
          style={{
            color:           armed ? '#22ff44' : '#ffaa22',
            backgroundColor: 'rgba(0,0,0,0.55)',
            border:          `1px solid ${armed ? '#22ff44' : '#ffaa22'}`,
            borderRadius:    4,
            padding:         '3px 14px',
            fontSize:        13,
            fontWeight:      'bold',
            fontFamily:      'monospace',
            letterSpacing:   '0.1em',
            cursor:          'pointer',
          }}
        >
          {armed ? '● ARMED' : '○ ARM'}
        </button>
      </div>

      {/* ── Crosshair — dead centre ─────────────────────────────────────── */}
      <div className="absolute top-1/2 left-1/2" style={{ transform: 'translate(-50%,-50%)' }}>
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="10" y1="2"  x2="10" y2="7"  stroke="white" strokeWidth="1.5" opacity="0.8"/>
          <line x1="10" y1="13" x2="10" y2="18" stroke="white" strokeWidth="1.5" opacity="0.8"/>
          <line x1="2"  y1="10" x2="7"  y2="10" stroke="white" strokeWidth="1.5" opacity="0.8"/>
          <line x1="13" y1="10" x2="18" y2="10" stroke="white" strokeWidth="1.5" opacity="0.8"/>
          <circle cx="10" cy="10" r="1" fill="white" opacity="0.8" />
        </svg>
      </div>

      {/* ── Telemetry — top left ────────────────────────────────────────── */}
      <div
        className="absolute top-4 left-4 text-xs leading-5"
        style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 0 4px rgba(0,0,0,0.9)' }}
      >
        <div>ALT  <strong>{alt}</strong> m</div>
        <div>SPD  <strong>{speed.toFixed(1)}</strong> m/s</div>
        <div style={{ marginTop: 4 }}>
          R  <strong>{roll}°</strong>&nbsp;
          P  <strong>{pitch}°</strong>&nbsp;
          Y  <strong>{yaw}°</strong>
        </div>
      </div>

      {/* ── Throttle bar — left edge ─────────────────────────────────────── */}
      <div
        className="absolute"
        style={{ left: 24, top: '30%', height: '40%', width: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4 }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            height: `${((inp?.thrust ?? 0) * 100).toFixed(0)}%`,
            backgroundColor: armed ? '#22ff44' : '#888',
            borderRadius: 4,
            transition: 'height 0.05s',
          }}
        />
      </div>

      {/* ── Motor indicators — bottom left ──────────────────────────────── */}
      {mot && (
        <div className="absolute bottom-6 left-4 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: 64 }}>
            {(mot as number[]).map((v, i) => (
              <div
                key={i}
                style={{
                  height: 6,
                  backgroundColor: `hsl(${120 * v},70%,50%)`,
                  borderRadius: 2,
                  opacity: 0.85,
                }}
                title={`M${i}: ${(v * 100).toFixed(0)}%`}
              />
            ))}
          </div>
          <div style={{ marginTop: 2, fontSize: 9, opacity: 0.6 }}>MOTORS</div>
        </div>
      )}

      {/* ── Control surface indicators — bottom right ───────────────────── */}
      {inp && (
        <div className="absolute bottom-6 right-4 text-xs text-right" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <StickIndicator label="R" value={inp.roll}  />
          <StickIndicator label="P" value={inp.pitch} />
          <StickIndicator label="Y" value={inp.yaw}   />
        </div>
      )}

      {/* ── Controls hint — bottom centre ───────────────────────────────── */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center"
        style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}
      >
        ENTER / RB — arm  &nbsp;|&nbsp;  R — reset  &nbsp;|&nbsp;  WASD+QE+Shift/Ctrl — fly (kb)
      </div>
    </div>
  );
};

// Small inline bar showing a -1..1 value
const StickIndicator: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 2 }}>
    <span style={{ opacity: 0.6 }}>{label}</span>
    <div style={{ width: 48, height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, position: 'relative' }}>
      <div style={{
        position: 'absolute',
        left: '50%',
        width: `${Math.abs(value) * 50}%`,
        height: '100%',
        transform: value >= 0 ? 'translateX(0)' : 'translateX(-100%)',
        backgroundColor: Math.abs(value) > 0.05 ? '#4af' : 'transparent',
        borderRadius: 2,
      }} />
    </div>
  </div>
);

export default OSD;
