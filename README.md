# Vibe-Coded Web Voxel Engine

A fully-functional web-based voxel engine (Minecraft-style) built entirely through AI-assisted development.

## The Story

I always wanted to make my own voxel engine/Minecraft clone, and with the release of Gemini 3 Pro, I felt like it was a great project to test the model's capabilities.

**Here's the result: entirely vibe-coded.** I didn't write a single line of code myself. I didn't even use an IDE—everything was created at [Google AI Studio](https://aistudio.google.com/apps).

Gemini 3 Pro really impressed me on this project, but I've now pretty much reached the limit. To continue it further, I will have to dig into the code myself.

### The Bigger Question

Even though Gemini coded it, this project was entirely within my skill set—I could have done it myself (with a LOT more time). So my question now is: **Is someone stranger to this domain, or even a non-programmer, able to do the same?**

## Features

This voxel engine includes:

- **Infinite procedurally-generated terrain** using Perlin noise
- **Multi-scale rendering system** with dual render distances (high-res nearby, low-res distant)
- **GPU-accelerated rendering** via React Three Fiber and Three.js
- **Block placement and destruction** with inventory system
- **Predictive chunk management** for smooth exploration
- **Multiple block types**: grass, dirt, stone, wood, leaves, sand, water, and flowers
- **First-person camera controls** with collision detection
- **Underwater effects** and environmental rendering
- **HUD with hotbar** and inventory management
- **Debug mode** with FPS counter and chunk visualization

## Technical Stack

- **React** 19.2.0 - UI framework
- **Three.js** 0.181.2 - 3D graphics library
- **React Three Fiber** - React renderer for Three.js
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)

### Installation & Running

1. **Clone the repository**
   ```bash
   git clone https://github.com/briossant/vibe-coded-web-voxel-engine.git
   cd vibe-coded-web-voxel-engine
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

### Building for Production

```bash
npm run build
npm run preview
```

## Controls

- **WASD** - Move forward/left/backward/right
- **Space** - Jump
- **Left Click** - Destroy block
- **Right Click** - Place block
- **1-9** - Select hotbar slot
- **E** - Open/close inventory
- **Escape** - Toggle menu
- **F3** - Toggle debug mode

## Project Structure

- `App.tsx` - Main application component with game state
- `components/` - React components for game elements
  - `Game.tsx` - Main game scene and chunk management
  - `Player.tsx` - First-person controls and physics
  - `ChunkMesh.tsx` - Chunk rendering and optimization
  - `HUD.tsx` - Heads-up display with hotbar
  - `Inventory.tsx` - Inventory UI
- `services/` - Core engine services (chunk generation, terrain, etc.)
- `utils/` - Utility functions (noise generation, etc.)
- `blocks.ts` - Block type definitions
- `types.ts` - TypeScript type definitions

## Development Notes

This project was created entirely through conversations with Gemini 3 Pro at Google AI Studio. No traditional IDE was used, and no code was manually written by a human developer. It represents an experiment in AI-assisted software development and explores the boundaries of what's possible with current AI models.

View the original AI Studio app: https://ai.studio/apps/drive/1ye7Id33vb8xNIuV1KT_UYl6pX08vhFji

## License

This project is open source and available for educational and experimental purposes.

## Acknowledgments

Built with ✨ and Gemini 3 Pro AI
