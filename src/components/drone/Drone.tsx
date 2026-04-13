import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { InputManager } from '@/src/services/InputManager';
import { FlightController } from '@/src/services/FlightController';
import { DEFAULT_DRONE_CONFIG } from '@/src/config/droneConfig';
import { BlockType } from '@/src/core/blocks';
import { getBlockDef } from '@/src/core/blocks';
import { MAX_RENDER_DISTANCE, CHUNK_SIZE } from '@/src/constants';

const DEG2RAD = Math.PI / 180;
const GRAVITY  = 9.81;
const cfg = DEFAULT_DRONE_CONFIG;

// ─── Collision ───────────────────────────────────────────────────────────────
const COLLISION_RADIUS = 0.18;

// Pre-allocated at module level — never recreated
const COLLISION_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [ COLLISION_RADIUS, 0, 0], [-COLLISION_RADIUS, 0, 0],
  [0,  COLLISION_RADIUS, 0], [0, -COLLISION_RADIUS, 0],
  [0, 0,  COLLISION_RADIUS], [0, 0, -COLLISION_RADIUS],
  [ COLLISION_RADIUS,  COLLISION_RADIUS,  COLLISION_RADIUS],
  [-COLLISION_RADIUS,  COLLISION_RADIUS,  COLLISION_RADIUS],
  [ COLLISION_RADIUS, -COLLISION_RADIUS,  COLLISION_RADIUS],
  [ COLLISION_RADIUS,  COLLISION_RADIUS, -COLLISION_RADIUS],
  [-COLLISION_RADIUS, -COLLISION_RADIUS,  COLLISION_RADIUS],
  [ COLLISION_RADIUS, -COLLISION_RADIUS, -COLLISION_RADIUS],
  [-COLLISION_RADIUS,  COLLISION_RADIUS, -COLLISION_RADIUS],
  [-COLLISION_RADIUS, -COLLISION_RADIUS, -COLLISION_RADIUS],
];

function isSolid(blockId: number): boolean {
  if (blockId === BlockType.AIR) return false;
  try { return getBlockDef(blockId).isSolid; }
  catch { return true; }
}

function checkVoxelCollision(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  angVel: THREE.Vector3,
  getBlock: (x: number, y: number, z: number) => number,
): boolean {
  for (const [dx, dy, dz] of COLLISION_OFFSETS) {
    const bx = Math.floor(pos.x + dx);
    const by = Math.floor(pos.y + dy);
    const bz = Math.floor(pos.z + dz);
    if (isSolid(getBlock(bx, by, bz))) {
      vel.multiplyScalar(-0.15);
      angVel.multiplyScalar(0.3);
      pos.y = Math.max(pos.y, by + 1 + COLLISION_RADIUS);
      return true;
    }
  }
  return false;
}

// ─── Quaternion integration (module-level scratch — no allocation per frame) ─
const _rotAxis = new THREE.Vector3();
const _dq      = new THREE.Quaternion();

function integrateRotation(quat: THREE.Quaternion, worldAngVel: THREE.Vector3, dt: number): void {
  const angle = worldAngVel.length() * dt;
  if (angle < 1e-6) return;
  _rotAxis.copy(worldAngVel).normalize();
  _dq.setFromAxisAngle(_rotAxis, angle);
  quat.premultiply(_dq).normalize();
}

// ─── Drone visual ─────────────────────────────────────────────────────────────
const PROP_POSITIONS: readonly [number, number, number][] = [
  [-0.09, 0, -0.09],
  [ 0.09, 0, -0.09],
  [-0.09, 0,  0.09],
  [ 0.09, 0,  0.09],
];

const DroneVisual: React.FC<{ motorThrottlesRef: React.RefObject<number[]> }> = ({ motorThrottlesRef }) => {
  const propRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];

  useFrame((_, dt) => {
    for (let i = 0; i < 4; i++) {
      const mesh = propRefs[i].current;
      if (!mesh) continue;
      const t   = motorThrottlesRef.current?.[i] ?? 0;
      const dir = (i === 0 || i === 3) ? 1 : -1;
      mesh.rotation.y += dir * t * dt * 80;
    }
  });

  return (
    <group>
      <mesh>
        <boxGeometry args={[0.055, 0.022, 0.055]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.018, -0.038]}>
        <boxGeometry args={[0.022, 0.022, 0.018]} />
        <meshStandardMaterial color="#111" roughness={0.8} />
      </mesh>
      {PROP_POSITIONS.map(([px, , pz], i) => (
        <group key={i}>
          <mesh
            position={[px * 0.5, 0, pz * 0.5]}
            rotation={[0, Math.atan2(px, pz) + Math.PI / 2, 0]}
          >
            <boxGeometry args={[0.175, 0.01, 0.013]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.7} />
          </mesh>
          <mesh position={[px, 0.012, pz]}>
            <cylinderGeometry args={[0.013, 0.013, 0.018, 10]} />
            <meshStandardMaterial color="#444" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh ref={propRefs[i]} position={[px, 0.024, pz]}>
            <boxGeometry args={[0.127, 0.003, 0.016]} />
            <meshStandardMaterial color="#ccc" transparent opacity={0.75} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface DroneState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  euler: THREE.Euler;
  isArmed: boolean;
  motorThrottles: readonly number[];
  controlInputs: { roll: number; pitch: number; yaw: number; thrust: number };
}

interface DroneProps {
  getBlock: (x: number, y: number, z: number) => number;
  onPositionChange: (pos: [number, number, number]) => void;
  onStateUpdate: (state: DroneState) => void;
  onArmToggleReady: (fn: () => void) => void; // lets parent call arm toggle
  spawnY: number;
}

// Module-level scratch for the physics loop — allocated once, reused every frame
const _thrust     = new THREE.Vector3();
const _torqueW    = new THREE.Vector3();
const _localTorq  = new THREE.Vector3();
const _invQ       = new THREE.Quaternion();
const _euler      = new THREE.Euler();
const _posChange: [number, number, number] = [0, 0, 0];

// ─── Main Drone component ─────────────────────────────────────────────────────
const Drone: React.FC<DroneProps> = ({ getBlock, onPositionChange, onStateUpdate, onArmToggleReady, spawnY }) => {
  const groupRef = useRef<THREE.Group>(null);

  const posRef    = useRef(new THREE.Vector3(0, spawnY, 0));
  const velRef    = useRef(new THREE.Vector3());
  const quatRef   = useRef(new THREE.Quaternion());
  const angVelRef = useRef(new THREE.Vector3());
  const isArmedRef        = useRef(false);
  const motorThrottlesRef = useRef<number[]>([0, 0, 0, 0]);
  const frameCountRef     = useRef(0);

  const flightControllerRef = useRef<FlightController | null>(null);
  const inputManagerRef     = useRef<InputManager | null>(null);

  const handleArmToggle = useCallback(() => {
    isArmedRef.current = !isArmedRef.current;
    if (!isArmedRef.current) {
      motorThrottlesRef.current = [0, 0, 0, 0];
      flightControllerRef.current?.reset();
    }
    console.log(`Drone: ${isArmedRef.current ? 'ARMED' : 'DISARMED'}`);
  }, []);

  // Expose arm toggle to parent (for OSD button)
  useEffect(() => { onArmToggleReady(handleArmToggle); }, [handleArmToggle, onArmToggleReady]);

  const handleReset = useCallback(() => {
    isArmedRef.current = false;
    posRef.current.set(0, spawnY, 0);
    velRef.current.set(0, 0, 0);
    quatRef.current.identity();
    angVelRef.current.set(0, 0, 0);
    motorThrottlesRef.current = [0, 0, 0, 0];
    flightControllerRef.current?.reset();
    console.log('Drone: reset');
  }, [spawnY]);

  useEffect(() => {
    const fc = new FlightController(cfg);
    const im = new InputManager(cfg, handleArmToggle, handleReset);
    flightControllerRef.current = fc;
    inputManagerRef.current     = im;
    im.initialize();
    return () => { im.dispose(); flightControllerRef.current = null; inputManagerRef.current = null; };
  }, [handleArmToggle, handleReset]);

  useFrame((_, rawDt) => {
    const im = inputManagerRef.current;
    const fc = flightControllerRef.current;
    if (!im || !fc) return;

    const dt  = Math.min(rawDt, 0.04);
    const pos    = posRef.current;
    const vel    = velRef.current;
    const quat   = quatRef.current;
    const angVel = angVelRef.current;

    const inputs = im.getControls();

    if (isArmedRef.current) {
      const { thrustForceLocal, torqueLocal, motorThrottles } = fc.update(dt, inputs, quat, angVel);

      // Copy motor throttles (FC returns its own internal array)
      const mo = motorThrottlesRef.current;
      mo[0] = motorThrottles[0]; mo[1] = motorThrottles[1];
      mo[2] = motorThrottles[2]; mo[3] = motorThrottles[3];

      // ── Thrust force (world frame) ──────────────────────────────────────
      _thrust.copy(thrustForceLocal).applyQuaternion(quat);
      _thrust.y -= GRAVITY * cfg.mass;

      // Linear + quadratic drag
      const speed = vel.length();
      if (speed > 0.01) {
        const dragMag = cfg.linearDragCoeff * speed + cfg.quadraticDragCoeff * speed * speed;
        _thrust.addScaledVector(vel, -dragMag);
      }
      vel.addScaledVector(_thrust, dt / cfg.mass);

      // ── Torques (diagonal inertia tensor in local frame) ────────────────
      _torqueW.copy(torqueLocal).applyQuaternion(quat);
      _invQ.copy(quat).invert();
      _localTorq.copy(_torqueW).applyQuaternion(_invQ);
      _localTorq.x /= cfg.inertiaRollPitch;
      _localTorq.y /= cfg.inertiaYaw;
      _localTorq.z /= cfg.inertiaRollPitch;
      _localTorq.applyQuaternion(quat); // back to world
      angVel.addScaledVector(_localTorq, dt);
      angVel.multiplyScalar(Math.max(0, 1 - cfg.angularDragCoeff * dt * 60));

    } else {
      vel.y -= GRAVITY * dt;
      const speed = vel.length();
      if (speed > 0.01) vel.addScaledVector(vel, -cfg.linearDragCoeff * dt);
      angVel.multiplyScalar(Math.max(0, 1 - cfg.angularDragCoeff * dt * 60));
    }

    pos.addScaledVector(vel, dt);
    integrateRotation(quat, angVel, dt);
    checkVoxelCollision(pos, vel, angVel, getBlock);

    if (pos.y < 0) {
      pos.y = 0;
      vel.set(0, 0, 0);
      angVel.set(0, 0, 0);
      if (isArmedRef.current) handleArmToggle();
    }

    const grp = groupRef.current;
    if (grp) { grp.position.copy(pos); grp.quaternion.copy(quat); }

    // Notify parent of chunk-relevant position change
    _posChange[0] = pos.x; _posChange[1] = pos.y; _posChange[2] = pos.z;
    onPositionChange(_posChange);

    // OSD update at ~10 Hz
    if (++frameCountRef.current % 6 === 0) {
      _euler.setFromQuaternion(quat, 'YXZ');
      onStateUpdate({
        position:       pos,
        velocity:       vel,
        euler:          _euler,
        isArmed:        isArmedRef.current,
        motorThrottles: motorThrottlesRef.current,
        controlInputs:  inputs,
      });
    }
  });

  return (
    <group ref={groupRef}>
      <DroneVisual motorThrottlesRef={motorThrottlesRef} />
      <PerspectiveCamera
        makeDefault
        fov={cfg.fpvFov}
        near={0.05}
        far={MAX_RENDER_DISTANCE * CHUNK_SIZE}
        position={[0, 0.04, 0.06]}
        rotation={[-cfg.fpvTilt * DEG2RAD, 0, 0]}
      />
    </group>
  );
};

export default Drone;
