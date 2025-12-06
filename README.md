# WebGPU Cosine Similarity Graph (TypeScript + Vite + Three.js)

Minimal webapp that computes cosine similarity on the GPU using WebGPU compute shaders and renders a simple similarity graph with Three.js. Includes a bottom-right progress bar overlay showing compute progress.

## Requirements

- Chromium-based browser with WebGPU enabled
  - Chrome 113+ (you may need `chrome://flags/#enable-unsafe-webgpu`)
  - Edge 113+
- Node.js 18+

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL. If WebGPU is unavailable, the app falls back to a CPU implementation (slower) and still reports progress.

## Tuning

You can tweak dataset size and dimension near the top of `src/main.ts`:

```ts
const n = 128; // number of vectors/nodes
const d = 64;  // embedding dimension
```

