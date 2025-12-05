# Project Analysis & Roadmap: Minecraft Vibe Coding

## 1. Executive Summary
**Current State**: High-quality Tech Demo / Voxel Engine Sandbox.
**Goal**: Transform into a polished, public-ready Voxel Game.

The project currently possesses a robust rendering engine and infinite terrain generation system built on React Three Fiber and Vite. The core mechanics (movement, placing/breaking blocks, chunk loading) are functional. However, it lacks the "Game Loop" elements (persistence, progression, menus) and "Juice" (audio, particles, advanced visual effects) that define a complete product.

---

## 2. Feature Gap Analysis

### A. Core Gameplay (The "Loop")
| Feature | Current Status | Gap / Recommendation |
| :--- | :--- | :--- |
| **Persistence** | ❌ None | **Critical**. Needs a `SaveManager` to serialize chunks/player state to `IndexedDB` or `localStorage`. |
| **Inventory System** | ⚠️ Basic (Creative) | Needs Survival elements: Stacking items, Crafting grid, Drag-and-Drop UI. |
| **Game Modes** | ⚠️ Creative Only | Implement **Survival Mode** (Health, Hunger, Breath, Fall Damage). |
| **Physics** | ✅ AABB Collision | Good start. Needs "Block Selection" wireframe highlight to assist interaction precision. |
| **Multiplayer** | ❌ None | Out of scope for now? If desired, requires massive refactor (Client/Server authoritative model). |

### B. Visuals & Immersion (The "Vibe")
| Feature | Current Status | Gap / Recommendation |
| :--- | :--- | :--- |
| **Lighting** | ⚠️ Basic Three.js | Needs **Ambient Occlusion (AO)** (vertex colors or SSAO) for depth. Day/Night cycle with sky gradients. |
| **Shadows** | ⚠️ Minimal | Implement Cascaded Shadow Maps (CSM) for sun movement. |
| **Animation** | ❌ Static Camera | Add **Player Arms/Tool model** bobbing while walking. Block break cracking animation. |
| **Particles** | ❌ None | Add particles for: Block breaking, Water splashes, Rain/Snow. |
| **Biomes** | ⚠️ Single/Noise | Needs distinct biome definitions (Desert, Snow, Forest) with specific tree/block palettes. |

### C. User Interface (UI/UX)
| Feature | Current Status | Gap / Recommendation |
| :--- | :--- | :--- |
| **Menus** | ❌ None | Needs **Main Menu** (Start, Settings, Credits) and **Pause Menu** (Resume, Quit). |
| **HUD** | ✅ Functional Debug | Remove debug sliders from HUD. Add Health/Hunger bars. Make Hotbar look more "gamified". |
| **Settings** | ⚠️ HUD Sliders | Create a dedicated Settings Modal (FOV, Keybinds, Audio Volume, Graphics Quality). |
| **Input** | ✅ Keyboard/Mouse | Consider Controller support for broader appeal. |

### D. Audio (The "Feel")
| Feature | Current Status | Gap / Recommendation |
| :--- | :--- | :--- |
| **SFX** | ❌ None | **High Priority**. Footsteps (varies by block), Block break/place, Water splash. |
| **Music** | ❌ None | Ambient background music that shifts with day/night or biomes. |

---

## 3. Technical Roadmap

### Phase 1: The "Save & Polish" Update
*Goal: Make the game playable for more than 5 minutes.*
1.  **Persistence**: Implement `IndexedDB` storage for modified chunks.
2.  **Block Highlight**: Add a wireframe box around the targeted block.
3.  **Audio**: Add a simple `SoundManager` and basic SFX (pop, click, step).
4.  **Day/Night Cycle**: simple sky color interpolation and sun rotation.

### Phase 2: The "Survival" Update
*Goal: Introduce stakes and progression.*
1.  **Player Stats**: Health, Hunger, Oxygen.
2.  **Physics Upgrade**: Fall damage, drowning logic.
3.  **Crafting**: Simple 2x2 grid in inventory to make new blocks/tools.
4.  **UI Overhaul**: Proper Main Menu and Pause Screen.

### Phase 3: The "Beauty" Update
*Goal: Visual fidelity.*
1.  **Ambient Occlusion**: Calculate vertex lighting in the Chunk Mesher.
2.  **Biomes**: Refine `TerrainGenerator` to support multi-noise biome blending.
3.  **Particles**: React-based or Shader-based particle system.

---

## 4. Immediate Next Steps (Recommended)
1.  **Refactor `Game.tsx` state**: Move "Debug" controls out of the HUD and into a proper Settings overlay or "Debug Menu" (toggleable with F3).
2.  **Implement Block Highlighting**: It is currently hard to tell *exactly* which block you are looking at.
3.  **Add Sound**: This provides the biggest "delight" upgrade for the lowest effort.
