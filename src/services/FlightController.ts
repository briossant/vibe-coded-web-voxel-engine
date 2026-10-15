import * as THREE from 'three';
import type { DroneConfig, PIDGains, AxisRates } from '@/src/config/droneConfig';
import type { ControlInputs } from './InputManager';

// ─── PID controller ─────────────────────────────────────────────────────────
// D on measurement (gyro) — prevents derivative kick on stick inputs.
class PIDController {
  private kP: number;
  private kI: number;
  private kD: number;
  private kFF: number;
  private iLimit: number;
  private integral = 0;
  private prevMeasurement = 0;
  private prevSetpoint    = 0;

  constructor(gains: PIDGains) {
    this.kP = gains.kP; this.kI = gains.kI;
    this.kD = gains.kD; this.kFF = gains.kFF;
    this.iLimit = gains.iLimit;
  }

  update(setpoint: number, measurement: number, dt: number): number {
    const error = setpoint - measurement;
    this.integral = clamp(this.integral + this.kI * error * dt, -this.iLimit, this.iLimit);
    const dMeas    = dt > 0 ? (measurement - this.prevMeasurement) / dt : 0;
    const dSetpoint = dt > 0 ? (setpoint - this.prevSetpoint) / dt : 0;
    this.prevMeasurement = measurement;
    this.prevSetpoint    = setpoint;
    return this.kP * error + this.integral - this.kD * dMeas + this.kFF * dSetpoint;
  }

  reset(): void { this.integral = 0; this.prevMeasurement = 0; this.prevSetpoint = 0; }
}

// ─── Rates curve ─────────────────────────────────────────────────────────────
function applyRates(stick: number, r: AxisRates): number {
  const curved = (1 - r.expo) * stick + r.expo * stick * stick * stick;
  return curved * r.rcRate * (Math.PI / 180);
}

// ─── FC output (no heap allocation — caller-supplied targets) ────────────────
export interface FCOutput {
  thrustForceLocal: THREE.Vector3; // local +Y total thrust
  torqueLocal:      THREE.Vector3; // local frame torque (N·m)
  motorThrottles:   readonly [number, number, number, number];
}

export class FlightController {
  private config: DroneConfig;
  private pidRoll:  PIDController;
  private pidPitch: PIDController;
  private pidYaw:   PIDController;
  private motorThrottles: [number, number, number, number] = [0, 0, 0, 0];

  // Pre-allocated scratch — zero heap allocation per update() call
  private readonly _localAngVel   = new THREE.Vector3();
  private readonly _thrustOut     = new THREE.Vector3();
  private readonly _torqueOut     = new THREE.Vector3();
  private readonly _invQ          = new THREE.Quaternion();

  constructor(config: DroneConfig) {
    this.config   = config;
    this.pidRoll  = new PIDController(config.pid.roll);
    this.pidPitch = new PIDController(config.pid.pitch);
    this.pidYaw   = new PIDController(config.pid.yaw);
  }

  /**
   * Sign conventions (FC frame, positive = pilot-positive):
   *   roll  > 0 → roll RIGHT  (right side down)
   *   pitch > 0 → pitch FWD   (nose down)
   *   yaw   > 0 → yaw RIGHT   (CW from above)
   *
   * Returns references to internal pre-allocated vectors — copy before next call if you need to keep them.
   */
  update(
    dt: number,
    inputs: ControlInputs,
    droneQuat: THREE.Quaternion,
    worldAngVel: THREE.Vector3,
  ): FCOutput {
    const cfg = this.config;

    // ── 1. Local angular velocity ─────────────────────────────────────────
    this._invQ.copy(droneQuat).invert();
    this._localAngVel.copy(worldAngVel).applyQuaternion(this._invQ);

    // Map Three.js local axes to FC convention.
    // Body frame: forward = -Z, up = +Y, right = +X (right-handed).
    //   +X rotation → nose UP        → pilot pitch-down is -X
    //   +Y rotation → CCW from above → pilot yaw-right  is -Y
    //   +Z rotation → roll LEFT      → pilot roll-right is -Z
    const currentRoll  = -this._localAngVel.z;
    const currentPitch = -this._localAngVel.x;
    const currentYaw   = -this._localAngVel.y;

    // ── 2. Setpoints from stick + expo ────────────────────────────────────
    const targetRoll  = applyRates(inputs.roll,  cfg.rates.roll);
    const targetPitch = applyRates(inputs.pitch, cfg.rates.pitch);
    const targetYaw   = applyRates(inputs.yaw,   cfg.rates.yaw);

    // ── 3. PID ────────────────────────────────────────────────────────────
    const rollCorr  = this.pidRoll.update(targetRoll,  currentRoll,  dt);
    const pitchCorr = this.pidPitch.update(targetPitch, currentPitch, dt);
    const yawCorr   = this.pidYaw.update(targetYaw,   currentYaw,   dt);

    // ── 4. Motor mixing — X-frame props-out ───────────────────────────────
    // roll  > 0 → left motors MORE  (M0 FL, M2 RL)
    // pitch > 0 → rear  motors MORE (M2 RL, M3 RR)
    // yaw   > 0 → CCW   motors MORE (M0 FL, M3 RR)
    const t = inputs.thrust;
    const rawM0 = t + rollCorr  - pitchCorr + yawCorr;
    const rawM1 = t - rollCorr  - pitchCorr - yawCorr;
    const rawM2 = t + rollCorr  + pitchCorr - yawCorr;
    const rawM3 = t - rollCorr  + pitchCorr + yawCorr;

    // ── 5. Motor lag (first-order filter) ─────────────────────────────────
    const alpha = dt / cfg.motorTimeConstant;
    const mo = this.motorThrottles;
    mo[0] = clamp(mo[0] + (clamp(rawM0, 0, 1) - mo[0]) * alpha, 0, 1);
    mo[1] = clamp(mo[1] + (clamp(rawM1, 0, 1) - mo[1]) * alpha, 0, 1);
    mo[2] = clamp(mo[2] + (clamp(rawM2, 0, 1) - mo[2]) * alpha, 0, 1);
    mo[3] = clamp(mo[3] + (clamp(rawM3, 0, 1) - mo[3]) * alpha, 0, 1);

    // ── 6. Motor forces (linear throttle → thrust) ────────────────────────
    const maxF = cfg.maxThrustPerMotor;
    const F0 = maxF * mo[0];
    const F1 = maxF * mo[1];
    const F2 = maxF * mo[2];
    const F3 = maxF * mo[3];
    const totalThrust = F0 + F1 + F2 + F3;

    // Arm diagonal component (motors at 45° on X frame)
    const A = cfg.armLength * Math.SQRT1_2;

    // Differential-thrust torques (local frame, three.js axes):
    //   torque.x = A*(front − rear)   : + = nose up
    //   torque.z = A*(right − left)   : + = roll left
    //   torque.y = kQ*(CW − CCW spin) : reaction opposes prop spin, so
    //     motors spinning +Y (M0, M3) push the body toward −Y (yaw right)
    const pitchTorque = A * ((F0 + F1) - (F2 + F3));
    const rollTorque  = A * ((F1 + F3) - (F0 + F2));
    const yawTorque   = cfg.kQ * ((F1 + F2) - (F0 + F3));

    this._thrustOut.set(0, totalThrust, 0);
    this._torqueOut.set(pitchTorque, yawTorque, rollTorque);

    return {
      thrustForceLocal: this._thrustOut,
      torqueLocal:      this._torqueOut,
      motorThrottles:   mo,
    };
  }

  reset(): void {
    this.motorThrottles = [0, 0, 0, 0];
    this.pidRoll.reset(); this.pidPitch.reset(); this.pidYaw.reset();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
