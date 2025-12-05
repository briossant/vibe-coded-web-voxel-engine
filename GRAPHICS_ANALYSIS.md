# Graphic Polish Analysis

## Why it feels "off"

You are correctly identifying that the "feel" is wrong. This is a common "Uncanny Valley" problem in Voxel engines. The combination of **Smooth Lighting** + **Blurry Textures** + **Simple Geometry** looks like a "Unity asset flip" rather than a cohesive aesthetic style.

### 1. Texture Filtering (The #1 Culprit) 🚨
**Diagnosis:** The textures are using `NearestMipmapLinearFilter`. This attempts to smooth out the texture when viewed at an angle or distance. 
**Effect:** This makes the ground look blurry, muddy, and "cheap" rather than crisp and pixelated.
**Fix:** Switch to `NearestFilter` for *both* minification and magnification. This forces hard edges on pixels at all distances, giving that signature crisp look.

### 2. Ambient Occlusion (AO) 🌑
**Diagnosis:** The world is lit by a global light, but corners where blocks meet are just as bright as flat faces. 
**Effect:** The world looks flat and lacks depth. Blocks don't feel like they are "touching" each other; they feel like they are floating in a grid.
**Fix:** Implement **Vertex-Based Ambient Occlusion**.
- Calculate which neighbors are solid.
- If a vertex is surrounded by solid blocks (e.g., a corner), darken that vertex color.
- This creates natural soft shadows in corners without expensive raytracing.

### 3. Lighting Model 💡
**Diagnosis:** You are using standard Three.js smooth shading (`meshStandardMaterial`).
**Effect:** Light wraps around cubes smoothly, making them look like plastic. Minecraft uses a specific logic where each *face* has a uniform brightness level (unless affected by AO/smooth lighting engine).
**Fix:**
- Ensure face normals are calculated correctly (flat shading).
- The AO implementation will help significantly here.

### 4. Fog Integration 🌫️
**Diagnosis:** The fog is a simple exponential fog. It might not blend perfectly with the skybox or chunk loading edge.
**Effect:** The "edge of the world" is visible and breaks immersion.
**Fix:** Tune the fog color to match the sky color at the horizon exactly.

---

## Action Plan (Immediate)

I have already applied **Fix #1 (Texture Filtering)** in the previous step. This should instantly make the game look 50% better.

**Next Steps:**
1.  **Implement Vertex AO in `generation.worker.ts`**: This is complex but essential. We need to calculate an `ao` value (0-3) for every vertex of every face during mesh generation and bake it into the `color` attribute.
2.  **Tune Lighting**: Adjust ambient vs. directional light ratios.

Shall I proceed with implementing **Vertex Ambient Occlusion**? This involves modifying the worker to check neighbors 2 layers deep (or carefully checking local neighbors) to darken corners.
