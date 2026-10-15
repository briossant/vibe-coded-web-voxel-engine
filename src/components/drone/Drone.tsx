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
const PHYSICS_DT = 1 / 240; // fixed physics timestep, decoupled from render fps
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

function collidesAt(
  pos: THREE.Vector3,
  getBlock: (x: number, y: number, z: number) => number,
): boolean {
  for (const [dx, dy, dz] of COLLISION_OFFSETS) {
    const bx = Math.floor(pos.x + dx);
    const by = Math.floor(pos.y + dy);
    const bz = Math.floor(pos.z + dz);
    if (isSolid(getBlock(bx, by, bz))) return true;
  }
  return false;
}

const RESTITUTION = 0.25;

// Moves pos by vel*dt one axis at a time; on contact the axis move is
// reverted and its velocity component bounced. Returns ground contact.
function moveWithCollision(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  angVel: THREE.Vector3,
  dt: number,
  getBlock: (x: number, y: number, z: number) => number,
): boolean {
  let hit = false;
  let grounded = false;

  pos.x += vel.x * dt;
  if (collidesAt(pos, getBlock)) { pos.x -= vel.x * dt; vel.x *= -RESTITUTION; hit = true; }

  pos.y += vel.y * dt;
  if (collidesAt(pos, getBlock)) {
    pos.y -= vel.y * dt;
    if (vel.y < 0) grounded = true;
    vel.y *= -RESTITUTION;
    hit = true;
  }

  pos.z += vel.z * dt;
  if (collidesAt(pos, getBlock)) { pos.z -= vel.z * dt; vel.z *= -RESTITUTION; hit = true; }

  if (hit) angVel.multiplyScalar(Math.max(0, 1 - 12 * dt));
  if (grounded) {
    // Ground friction on the horizontal plane
    const f = Math.max(0, 1 - 8 * dt);
    vel.x *= f; vel.z *= f;
    if (Math.abs(vel.y) < 0.3) vel.y = 0;
  }
  return grounded;
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
const _localAngVel = new THREE.Vector3();
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
  const accumulatorRef    = useRef(0);

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

    const pos    = posRef.current;
    const vel    = velRef.current;
    const quat   = quatRef.current;
    const angVel = angVelRef.current;

    const inputs = im.getControls();

    // ── Fixed-timestep substepping ────────────────────────────────────────
    // PID, motor lag filter and integration all run at a constant 240 Hz so
    // flight behaviour is identical at 30 fps and 144 fps.
    accumulatorRef.current = Math.min(accumulatorRef.current + rawDt, 0.1);

    while (accumulatorRef.current >= PHYSICS_DT) {
      accumulatorRef.current -= PHYSICS_DT;
      const dt = PHYSICS_DT;

      if (isArmedRef.current) {
        const { thrustForceLocal, torqueLocal, motorThrottles } = fc.update(dt, inputs, quat, angVel);

        // Copy motor throttles (FC returns its own internal array)
        const mo = motorThrottlesRef.current;
        mo[0] = motorThrottles[0]; mo[1] = motorThrottles[1];
        mo[2] = motorThrottles[2]; mo[3] = motorThrottles[3];

        // ── Thrust force (world frame) ────────────────────────────────────
        _thrust.copy(thrustForceLocal).applyQuaternion(quat);
        _thrust.y -= GRAVITY * cfg.mass;

        // Linear + quadratic drag
        const speed = vel.length();
        if (speed > 0.01) {
          const dragMag = cfg.linearDragCoeff * speed + cfg.quadraticDragCoeff * speed * speed;
          _thrust.addScaledVector(vel, -dragMag);
        }
        vel.addScaledVector(_thrust, dt / cfg.mass);

        // ── Torques (diagonal inertia tensor in local frame) ──────────────
        // Rigid body dynamics (Euler's equations) from PDF Page 5.
        _invQ.copy(quat).invert();
        _localAngVel.copy(angVel).applyQuaternion(_invQ);

        const Ix = cfg.inertiaRollPitch;
        const Iy = cfg.inertiaYaw;
        const Iz = cfg.inertiaRollPitch;

        // Gyroscopic torque: omega x (I * omega)
        // For Ix=Iz, this simplifies to:
        //   tau_gyro_x = omega_y * omega_z * (Iz - Iy)
        //   tau_gyro_y = 0
        //   tau_gyro_z = omega_x * omega_y * (Iy - Ix)
        const gyroX = _localAngVel.y * _localAngVel.z * (Iz - Iy);
        const gyroZ = _localAngVel.x * _localAngVel.y * (Iy - Ix);

        _localTorq.copy(torqueLocal);
        _localTorq.x = (_localTorq.x - gyroX) / Ix;
        _localTorq.y = (_localTorq.y) / Iy;
        _localTorq.z = (_localTorq.z - gyroZ) / Iz;

        _localTorq.applyQuaternion(quat); // world angular acceleration
        angVel.addScaledVector(_localTorq, dt);
        angVel.multiplyScalar(Math.max(0, 1 - cfg.angularDragCoeff * dt * 60));

      } else {
        vel.y -= GRAVITY * dt;
        const speed = vel.length();
        if (speed > 0.01) vel.addScaledVector(vel, -cfg.linearDragCoeff * dt);
        angVel.multiplyScalar(Math.max(0, 1 - cfg.angularDragCoeff * dt * 60));
      }

      moveWithCollision(pos, vel, angVel, dt, getBlock);
      integrateRotation(quat, angVel, dt);
    }

    // ── NaN / Infinity safety ───────────────────────────────────────────
    if (isNaN(pos.x) || isNaN(vel.x) || isNaN(quat.x) || !isFinite(pos.x)) {
      console.warn('Drone: Physics explosion detected! Resetting...');
      handleReset();
      return;
    }

    if (pos.y < -5) {
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
        position:       pos.clone(),
        velocity:       vel.clone(),
        euler:          _euler.clone(),
        isArmed:        isArmedRef.current,
        motorThrottles: [...motorThrottlesRef.current],
        controlInputs:  { ...inputs },
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
