import * as THREE from 'three';
import { computeCosineSimilarityBatched } from './webgpu';

type Edge = { i: number; j: number; w: number; };
export const canvas = document.getElementById('three') as HTMLCanvasElement;
const progressE = document.getElementById('progress') as HTMLDivElement;
const progressBarE = document.getElementById('progress-bar') as HTMLDivElement;
export const sttsE = document.getElementById('stts') as HTMLDivElement;
export function setProgress(p: number, label?: string) {
  const pct = Math.max(0, Math.min(1, p));
  progressBarE.style.width = `${(pct * 100).toFixed(1)}%`;
  if (pct===1) progressE.style.display='none'
  if (label) sttsE.textContent = label;
}
function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b0e13, 1);
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', resize);
  resize();
  return renderer;
}
function createScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
  camera.position.set(0, 0, 6);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(3, 5, 2);
  scene.add(ambient, dir);
  return { scene, camera };
}
function generateTestVectors(num: number, dim: number): Float32Array {
  const data = new Float32Array(num * dim);
  const rng = Math.random;
  for (let i = 0; i < num; i++) {
    for (let d = 0; d < dim; d++) {
      data[i * dim + d] = (rng() * 2 - 1);
    }
  }
  return data;
}
function layoutCircle(n: number, radius = 2.2): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
  }
  return pts;
}
function makeGraph(points: THREE.Vector3[], edges: Edge[]): THREE.Object3D {
  const group = new THREE.Group();

  // Nodes
  const geo = new THREE.SphereGeometry(0.03, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9bd5ff, metalness: 0.1, roughness: 0.35 });
  for (const p of points) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p);
    group.add(m);
  }

  // Edges
  const lines: number[] = [];
  const cols: number[] = [];
  for (const e of edges) {
    const a = points[e.i];
    const b = points[e.j];
    lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const c = new THREE.Color().setHSL(0.55, 0.8, THREE.MathUtils.lerp(0.35, 0.7, e.w));
    cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(lines), 3));
  lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cols), 3));
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  const segs = new THREE.LineSegments(lineGeo, lineMat);
  group.add(segs);

  return group;
}
export async function main_animate() {
  const renderer = createRenderer();
  const { scene, camera } = createScene();

  const n = 128; // number of vectors/nodes
  const d = 64; // dimension
  const vectors = generateTestVectors(n, d);

  setProgress(0, 'Checking WebGPU…');
  const supported = !!(navigator as any).gpu;
  if (!supported) {
    setProgress(0, 'WebGPU not supported. Enable chrome://flags/#enable-unsafe-webgpu');
  }

  setProgress(0.02, 'Computing cosine similarity…');
  const threshold = 0.8;
  const maxEdgesPerNode = 6;
  const batchSize = 16;

  const onProgress = (done: number, total: number) => {
    const p = total > 0 ? done / total : 0;
    setProgress(0.02 + p * 0.96, `Cosine similarity ${(p * 100).toFixed(0)}%`);
  };

  let edges: Edge[] = [];
  try {
    const sim = await computeCosineSimilarityBatched(vectors, n, d, batchSize, onProgress);
    // Build edges: for each node, keep up to K highest above threshold
    for (let i = 0; i < n; i++) {
      const row = sim.slice(i * n, (i + 1) * n);
      const idx = Array.from({ length: n }, (_, j) => j)
        .filter(j => j !== i && row[j] >= threshold)
        .sort((a, b) => row[b] - row[a])
        .slice(0, maxEdgesPerNode);
      for (const j of idx) edges.push({ i, j, w: row[j] });
    }
  } catch (err) {
    console.error(err);
    sttsE.textContent = 'Falling back to CPU compute…';
    // Simple CPU fallback
    const norms = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let k = 0; k < d; k++) { const v = vectors[i * d + k]; acc += v * v; }
      norms[i] = Math.sqrt(acc) || 1e-8;
    }
    const sim = new Float32Array(n * n);
    let done = 0; const total = n * n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let dot = 0;
        for (let k = 0; k < d; k++) dot += vectors[i * d + k] * vectors[j * d + k];
        sim[i * n + j] = dot / (norms[i] * norms[j]);
        done++;
        if ((done % (n * 8)) === 0) onProgress(done, total);
      }
    }
    onProgress(total, total);
    for (let i = 0; i < n; i++) {
      const row = sim.slice(i * n, (i + 1) * n);
      const idx = Array.from({ length: n }, (_, j) => j)
        .filter(j => j !== i && row[j] >= threshold)
        .sort((a, b) => row[b] - row[a])
        .slice(0, maxEdgesPerNode);
      for (const j of idx) edges.push({ i, j, w: row[j] });
    }
  }

  setProgress(1, 'Rendering…');
  const pts = layoutCircle(n, 2.6);
  scene.add(makeGraph(pts, edges));

  const clock = new THREE.Clock();
  function animate() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    scene.rotation.z += clock.getDelta() * 0.1;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  setTimeout(() => { sttsE.textContent = 'Done'; }, 800);
}
