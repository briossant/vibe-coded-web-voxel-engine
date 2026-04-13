import type { DroneConfig } from '@/src/config/droneConfig';

export interface ControlInputs {
  roll: number;    // -1..1
  pitch: number;   // -1..1
  yaw: number;     // -1..1
  thrust: number;  // 0..1
}

// Fired once per leading edge of the button press
export type ArmToggleCallback = () => void;
export type ResetCallback     = () => void;

export class InputManager {
  private keys: Record<string, boolean> = {};
  private controls: ControlInputs = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };

  private activeGamepadIndex: number | null = null;
  private prevButtonStates: Record<number, boolean> = {};

  private pollingId: ReturnType<typeof setInterval> | null = null;

  private onArmToggle: ArmToggleCallback;
  private onReset: ResetCallback;

  private config: DroneConfig;

  constructor(config: DroneConfig, onArmToggle: ArmToggleCallback, onReset: ResetCallback) {
    this.config = config;
    this.onArmToggle = onArmToggle;
    this.onReset = onReset;
  }

  initialize(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup',   this.handleKeyUp);
    window.addEventListener('gamepadconnected',    this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);

    // Detect already-connected gamepads (page was loaded with one plugged in)
    for (const gp of navigator.getGamepads()) {
      if (gp && this.activeGamepadIndex === null) {
        this.activeGamepadIndex = gp.index;
        console.log(`InputManager: auto-selected gamepad ${gp.index} — "${gp.id}"`);
      }
    }

    // Independent ~60 Hz poll so gamepad reads aren't tied to render fps
    this.pollingId = setInterval(this.poll, 1000 / 60);
    console.log('InputManager: initialized');
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup',   this.handleKeyUp);
    window.removeEventListener('gamepadconnected',    this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    if (this.pollingId !== null) clearInterval(this.pollingId);
    this.pollingId = null;
    this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };
    console.log('InputManager: disposed');
  }

  getControls(): ControlInputs {
    return { ...this.controls };
  }

  hasGamepad(): boolean {
    return this.activeGamepadIndex !== null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private poll = (): void => {
    const gpUsed = this.pollGamepad();
    if (!gpUsed) this.pollKeyboard();
  };

  private pollGamepad = (): boolean => {
    if (this.activeGamepadIndex === null) return false;
    const gp = navigator.getGamepads()[this.activeGamepadIndex];
    if (!gp || !gp.connected) {
      this.activeGamepadIndex = null;
      this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };
      return false;
    }

    const { gamepadAxisMapping: map, gamepadInvertAxes: inv, gamepadDeadzone: dz } = this.config;

    const applyAxis = (rawVal: number, invert: boolean): number => {
      const v = invert ? -rawVal : rawVal;
      return Math.abs(v) > dz ? v : 0;
    };

    const thrustRaw = applyAxis(gp.axes[map.thrust] ?? 0, inv.thrust);
    // Thrust stick: raw [-1, 1] → [0, 1] (bottom of stick = 0 throttle)
    const thrustMapped = (thrustRaw + 1) / 2;

    this.controls.roll   = clamp(applyAxis(gp.axes[map.roll]  ?? 0, inv.roll),  -1, 1);
    this.controls.pitch  = clamp(applyAxis(gp.axes[map.pitch] ?? 0, inv.pitch), -1, 1);
    this.controls.yaw    = clamp(applyAxis(gp.axes[map.yaw]   ?? 0, inv.yaw),   -1, 1);
    this.controls.thrust = clamp(thrustMapped <= dz * 0.5 ? 0 : thrustMapped,    0, 1);

    // Arm: any of A(0), B(1), RB(5), Start(9) — covers Xbox, PS, and most RC transmitters
    // Reset: LB(4) or Select(8)
    const ARM_BUTTONS   = [0, 1, 5, 9];
    const RESET_BUTTONS = [4, 8];

    for (const btn of ARM_BUTTONS) {
      const pressed = gp.buttons[btn]?.pressed ?? false;
      if (pressed && !this.prevButtonStates[btn]) { this.onArmToggle(); break; }
      this.prevButtonStates[btn] = pressed;
    }
    for (const btn of RESET_BUTTONS) {
      const pressed = gp.buttons[btn]?.pressed ?? false;
      if (pressed && !this.prevButtonStates[btn]) { this.onReset(); break; }
      this.prevButtonStates[btn] = pressed;
    }

    const hasInput = Math.abs(this.controls.roll)  > 0
                  || Math.abs(this.controls.pitch) > 0
                  || Math.abs(this.controls.yaw)   > 0
                  || this.controls.thrust           > 0.01;
    return hasInput;
  };

  private pollKeyboard = (): void => {
    const k = this.keys;

    this.controls.roll  = k['a'] || k['A'] || k['ArrowLeft']  ? -1
                        : k['d'] || k['D'] || k['ArrowRight'] ?  1 : 0;
    this.controls.pitch = k['w'] || k['W'] || k['ArrowUp']    ?  1
                        : k['s'] || k['S'] || k['ArrowDown']  ? -1 : 0;
    this.controls.yaw   = k['q'] || k['Q'] ? -1 : k['e'] || k['E'] ? 1 : 0;

    const inc = 0.008; // throttle per poll tick (~0.5/s increase)
    if (k['Shift'])   this.controls.thrust = Math.min(1, this.controls.thrust + inc);
    if (k['Control']) this.controls.thrust = Math.max(0, this.controls.thrust - inc);
    if (k[' '])       this.controls.thrust = 0;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.key] = true;

    // Arm/disarm: Enter or backtick (easy to reach, doesn't conflict with gameplay keys)
    if (e.key === 'Enter' || e.key === '`') {
      e.preventDefault();
      this.onArmToggle();
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.onReset();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.key] = false;
  };

  private handleGamepadConnected = (e: Event): void => {
    const gp = (e as GamepadEvent).gamepad;
    console.log(`InputManager: gamepad connected — "${gp.id}" (index ${gp.index})`);
    if (this.activeGamepadIndex === null) {
      this.activeGamepadIndex = gp.index;
    }
  };

  private handleGamepadDisconnected = (e: Event): void => {
    const gp = (e as GamepadEvent).gamepad;
    if (this.activeGamepadIndex === gp.index) {
      this.activeGamepadIndex = null;
      this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };
      console.log('InputManager: active gamepad disconnected — falling back to keyboard');
    }
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
