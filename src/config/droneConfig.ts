// All drone flight parameters — tune these to change the feel

export interface PIDGains {
  kP: number;
  kI: number;
  kD: number;  // applied on measurement (gyro), not error — prevents derivative kick
  kFF: number; // feedforward: responds to stick velocity
  iLimit: number; // anti-windup clamp (N·m)
}

export interface AxisRates {
  rcRate: number;  // deg/s at full stick (before expo)
  expo: number;    // 0–1: 0 = linear, 1 = heavy centre softening
}

export interface DroneConfig {
  // Physical
  mass: number;             // kg
  armLength: number;        // m, motor-to-motor diagonal / 2
  motorTimeConstant: number;// s, first-order motor spin-up/down lag
  maxThrustPerMotor: number;// N, thrust at 100% throttle

  // Inertia (simplified diagonal tensor)
  inertiaRollPitch: number; // kg·m², about roll & pitch axes
  inertiaYaw: number;       // kg·m², about yaw axis

  // Motor thrust-to-torque ratio (reaction yaw authority)
  kQ: number;

  // Aerodynamic drag coefficients
  linearDragCoeff: number;    // velocity-proportional (low-speed)
  quadraticDragCoeff: number; // velocity²-proportional (high-speed)
  angularDragCoeff: number;   // angular velocity damping

  // Rate curves (per axis)
  rates: {
    roll:  AxisRates;
    pitch: AxisRates;
    yaw:   AxisRates;
  };

  // PID gains (per axis)
  pid: {
    roll:  PIDGains;
    pitch: PIDGains;
    yaw:   PIDGains;
  };

  // FPV camera
  fpvFov: number;  // degrees
  fpvTilt: number; // degrees, positive = camera tilts up (nose-down feel)

  // Input
  gamepadDeadzone: number;
  gamepadAxisMapping: { roll: number; pitch: number; yaw: number; thrust: number };
  // true = invert that axis
  gamepadInvertAxes: { roll: boolean; pitch: boolean; yaw: boolean; thrust: boolean };
}

// ─── Default: 5" freestyle quad feel ───────────────────────────────────────
export const DEFAULT_DRONE_CONFIG: DroneConfig = {
  mass: 0.65,
  armLength: 0.12,
  // 50ms motor lag — snappier response than 80ms, still realistic for 2306
  motorTimeConstant: 0.05,
  // 10 N/motor → 40 N total → TWR ≈ 6.3
  // With linear thrust curve, hover is at ~16% throttle (lots of headroom above)
  maxThrustPerMotor: 10.0,

  inertiaRollPitch: 0.003,
  inertiaYaw: 0.006,

  kQ: 0.016,

  linearDragCoeff: 0.15,
  quadraticDragCoeff: 0.025,
  angularDragCoeff: 0.12,

  rates: {
    // 300 deg/s max with heavy expo — slow & predictable centre, full authority at edges
    // Increase rcRate once comfortable; this is a good learning starting point
    roll:  { rcRate: 300, expo: 0.70 },
    pitch: { rcRate: 300, expo: 0.70 },
    yaw:   { rcRate: 160, expo: 0.50 },
  },

  // PID gains — D on measurement (no derivative kick on stick moves)
  pid: {
    roll:  { kP: 0.10, kI: 0.05, kD: 0.006, kFF: 0.04, iLimit: 0.10 },
    pitch: { kP: 0.12, kI: 0.06, kD: 0.007, kFF: 0.04, iLimit: 0.10 },
    yaw:   { kP: 0.20, kI: 0.08, kD: 0.001, kFF: 0.02, iLimit: 0.08 },
  },

  fpvFov: 110,
  fpvTilt: 30,

  gamepadDeadzone: 0.05,

  // Standard Gamepad API axes for Xbox / PS / most USB controllers in Mode 2:
  //   Axis 0 = Left  stick X → Yaw
  //   Axis 1 = Left  stick Y → Thrust   (up = −1 on most controllers)
  //   Axis 2 = Right stick X → Roll
  //   Axis 3 = Right stick Y → Pitch    (forward = +1)
  //
  // If an axis feels inverted, flip the matching bool below.
  // If sticks feel swapped, change the axis numbers.
  gamepadAxisMapping: { yaw: 0, thrust: 1, roll: 2, pitch: 3 },
  gamepadInvertAxes:  { roll: false, pitch: false, thrust: false, yaw: false },
};
