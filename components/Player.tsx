
import React, { useRef, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { Vector3, BlockType } from '../types';
import { 
    GRAVITY, 
    JUMP_FORCE, 
    MOVE_SPEED, 
    SPRINT_SPEED,
    MOVE_ACCELERATION, 
    MOVE_DECELERATION, 
    AIR_CONTROL,
    AIR_DRAG
} from '../constants';

interface PlayerProps {
  position: Vector3;
  onPositionChange: (pos: Vector3) => void;
  getBlock: (x: number, y: number, z: number) => BlockType;
  setBlock: (x: number, y: number, z: number, type: BlockType) => void;
}

// Constants for player dimensions
const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.6;

const Player: React.FC<PlayerProps> = ({ position, onPositionChange, getBlock, setBlock }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  // Physics State
  const pos = useRef(new THREE.Vector3(...position));
  const vel = useRef(new THREE.Vector3(0, 0, 0));
  const isGrounded = useRef(false);
  
  // Input State
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
  });

  // Initialize camera position
  useEffect(() => {
      pos.current.set(...position);
      camera.position.copy(pos.current).y += EYE_HEIGHT;
  }, []);

  // --- Raycasting for Block Interaction (Mining/Placing) ---
  const raycast = (origin: THREE.Vector3, dir: THREE.Vector3, range: number) => {
      let x = Math.floor(origin.x);
      let y = Math.floor(origin.y);
      let z = Math.floor(origin.z);
      
      const stepX = Math.sign(dir.x);
      const stepY = Math.sign(dir.y);
      const stepZ = Math.sign(dir.z);
      
      const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
      const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
      const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

      let tMaxX = !isFinite(tDeltaX) ? Infinity : (stepX > 0 ? (Math.floor(origin.x) + 1 - origin.x) * tDeltaX : (origin.x - Math.floor(origin.x)) * tDeltaX);
      let tMaxY = !isFinite(tDeltaY) ? Infinity : (stepY > 0 ? (Math.floor(origin.y) + 1 - origin.y) * tDeltaY : (origin.y - Math.floor(origin.y)) * tDeltaY);
      let tMaxZ = !isFinite(tDeltaZ) ? Infinity : (stepZ > 0 ? (Math.floor(origin.z) + 1 - origin.z) * tDeltaZ : (origin.z - Math.floor(origin.z)) * tDeltaZ);
      
      let face = { x: 0, y: 0, z: 0 };

      for (let i = 0; i < range * 3; i++) {
          const block = getBlock(x, y, z);
          if (block !== BlockType.AIR && block !== BlockType.WATER) {
              return { x, y, z, face };
          }
          
          if (tMaxX < tMaxY) {
              if (tMaxX < tMaxZ) {
                  x += stepX; tMaxX += tDeltaX; face = { x: -stepX, y: 0, z: 0 };
              } else {
                  z += stepZ; tMaxZ += tDeltaZ; face = { x: 0, y: 0, z: -stepZ };
              }
          } else {
              if (tMaxY < tMaxZ) {
                  y += stepY; tMaxY += tDeltaY; face = { x: 0, y: -stepY, z: 0 };
              } else {
                  z += stepZ; tMaxZ += tDeltaZ; face = { x: 0, y: 0, z: -stepZ };
              }
          }
      }
      return null;
  };

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
        if (!controlsRef.current?.isLocked) return;
        
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const result = raycast(camera.position, dir, 6);
        
        if (result) {
            if (e.button === 0) { 
                setBlock(result.x, result.y, result.z, BlockType.AIR);
            } else if (e.button === 2) { 
                const nx = result.x + result.face.x;
                const ny = result.y + result.face.y;
                const nz = result.z + result.face.z;
                
                // AABB check to prevent self-placement
                const pMinX = pos.current.x - PLAYER_WIDTH/2;
                const pMaxX = pos.current.x + PLAYER_WIDTH/2;
                const pMinY = pos.current.y;
                const pMaxY = pos.current.y + PLAYER_HEIGHT;
                const pMinZ = pos.current.z - PLAYER_WIDTH/2;
                const pMaxZ = pos.current.z + PLAYER_WIDTH/2;

                const bMinX = nx; const bMaxX = nx + 1;
                const bMinY = ny; const bMaxY = ny + 1;
                const bMinZ = nz; const bMaxZ = nz + 1;

                const intersect = (pMinX < bMaxX && pMaxX > bMinX) &&
                                  (pMinY < bMaxY && pMaxY > bMinY) &&
                                  (pMinZ < bMaxZ && pMaxZ > bMinZ);

                if (!intersect) {
                    setBlock(nx, ny, nz, BlockType.STONE);
                }
            }
        }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [camera, getBlock, setBlock]);

  // --- Input Management ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = true; break;
        case 'KeyA': keys.current.left = true; break;
        case 'KeyS': keys.current.backward = true; break;
        case 'KeyD': keys.current.right = true; break;
        case 'Space': keys.current.jump = true; break;
        case 'ShiftLeft': keys.current.sprint = true; break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = false; break;
        case 'KeyA': keys.current.left = false; break;
        case 'KeyS': keys.current.backward = false; break;
        case 'KeyD': keys.current.right = false; break;
        case 'Space': keys.current.jump = false; break;
        case 'ShiftLeft': keys.current.sprint = false; break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp); };
  }, []);

  // --- Physics Logic ---

  // Helper: Check if a box at (x,y,z) collides with any solid block
  const checkBoxCollision = (p: THREE.Vector3) => {
      const halfW = PLAYER_WIDTH / 2;
      const minX = Math.floor(p.x - halfW);
      const maxX = Math.floor(p.x + halfW);
      const minY = Math.floor(p.y);
      const maxY = Math.floor(p.y + PLAYER_HEIGHT - 0.01); // epsilon to avoid head hitting block above when standing exactly on integer
      const minZ = Math.floor(p.z - halfW);
      const maxZ = Math.floor(p.z + halfW);

      for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
              for (let z = minZ; z <= maxZ; z++) {
                  const block = getBlock(x, y, z);
                  if (block !== BlockType.AIR && 
                      block !== BlockType.WATER && 
                      block !== BlockType.TALL_GRASS &&
                      block !== BlockType.FLOWER_YELLOW &&
                      block !== BlockType.FLOWER_RED &&
                      block !== BlockType.DEAD_BUSH &&
                      !(block >= BlockType.TULIP_RED && block <= BlockType.CORNFLOWER)) {
                      return true;
                  }
              }
          }
      }
      return false;
  };

  useFrame((state, delta) => {
    if (!controlsRef.current?.isLocked) return;
    
    // Clamp delta to prevent physics explosions on lag spikes
    const dt = Math.min(delta, 0.1);

    // 1. Calculate Desired Move Direction
    const forwardInput = Number(keys.current.forward) - Number(keys.current.backward);
    const sideInput = Number(keys.current.right) - Number(keys.current.left);
    
    const moveDir = new THREE.Vector3();
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    camForward.y = 0; camForward.normalize();
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    camRight.y = 0; camRight.normalize();
    
    moveDir.addScaledVector(camForward, forwardInput);
    moveDir.addScaledVector(camRight, sideInput);
    if (moveDir.lengthSq() > 1) moveDir.normalize();

    // 2. Apply Physics Forces
    
    // Gravity
    vel.current.y -= GRAVITY * dt;

    // Jumping
    if (isGrounded.current && keys.current.jump) {
        vel.current.y = JUMP_FORCE;
        isGrounded.current = false;
    }

    // Horizontal Movement (Inertia-based)
    const currentSpeedXZ = new THREE.Vector2(vel.current.x, vel.current.z);
    
    // Friction/Drag
    const friction = isGrounded.current ? MOVE_DECELERATION : AIR_DRAG;
    currentSpeedXZ.multiplyScalar(Math.max(0, 1 - friction * dt));

    // Acceleration
    const accel = isGrounded.current ? MOVE_ACCELERATION : (MOVE_ACCELERATION * AIR_CONTROL);
    if (moveDir.lengthSq() > 0) {
        currentSpeedXZ.x += moveDir.x * accel * dt;
        currentSpeedXZ.y += moveDir.z * accel * dt;
        
        // Cap speed based on sprint state
        const maxSpeed = keys.current.sprint ? SPRINT_SPEED : MOVE_SPEED;
        if (currentSpeedXZ.length() > maxSpeed) {
            currentSpeedXZ.normalize().multiplyScalar(maxSpeed);
        }
    }

    vel.current.x = currentSpeedXZ.x;
    vel.current.z = currentSpeedXZ.y;

    // 3. Collision Resolution (Independent Axis - "Wall Sliding")
    
    // Try X
    pos.current.x += vel.current.x * dt;
    if (checkBoxCollision(pos.current)) {
        pos.current.x -= vel.current.x * dt;
        vel.current.x = 0;
    }

    // Try Z
    pos.current.z += vel.current.z * dt;
    if (checkBoxCollision(pos.current)) {
        pos.current.z -= vel.current.z * dt;
        vel.current.z = 0;
    }

    // Try Y
    pos.current.y += vel.current.y * dt;
    if (checkBoxCollision(pos.current)) {
        const falling = vel.current.y < 0;
        pos.current.y -= vel.current.y * dt;
        vel.current.y = 0;

        if (falling) {
            isGrounded.current = true;
            // Snap to integer grid to prevent micro-bouncing
            pos.current.y = Math.round(pos.current.y); 
        }
    } else {
        isGrounded.current = false;
    }

    // 4. World Bounds / Respawn
    if (pos.current.y < -10) {
        pos.current.set(0, 80, 0);
        vel.current.set(0, 0, 0);
    }

    // 5. Update Camera & React State
    camera.position.copy(pos.current);
    camera.position.y += EYE_HEIGHT;

    // Subtle Dynamic FOV based on speed
    if (camera instanceof THREE.PerspectiveCamera) {
        const speed = Math.sqrt(vel.current.x**2 + vel.current.z**2);
        const targetFov = 70 + Math.min(speed * 1.5, 20);
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 5);
        camera.updateProjectionMatrix();
    }

    onPositionChange([pos.current.x, pos.current.y, pos.current.z]);
  });

  return <PointerLockControls ref={controlsRef} />;
};

export default Player;
