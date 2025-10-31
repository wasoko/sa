struct Uniforms {
  numVectors : u32,
  dim : u32,
  startRow : u32,
  rowsInBatch : u32,
};

@group(0) @binding(0) var<storage, read> vectors : array<f32>;
@group(0) @binding(1) var<storage, read> norms : array<f32>;
@group(0) @binding(2) var<storage, read_write> outMat : array<f32>;
@group(0) @binding(3) var<uniform> uni : Uniforms;

fn indexVec(i : u32, k : u32) -> u32 {
  return i * uni.dim + k;
}

fn indexOut(i : u32, j : u32) -> u32 {
  return i * uni.numVectors + j;
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let j : u32 = gid.x;               // column
  let localRow : u32 = gid.y;        // row within batch
  if (localRow >= uni.rowsInBatch) { return; }
  if (j >= uni.numVectors) { return; }

  let i : u32 = uni.startRow + localRow;
  if (i >= uni.numVectors) { return; }

  var dot : f32 = 0.0;
  for (var k : u32 = 0u; k < uni.dim; k = k + 1u) {
    dot = dot + vectors[indexVec(i, k)] * vectors[indexVec(j, k)];
  }

  let denom : f32 = norms[i] * norms[j];
  let sim : f32 = select(0.0, dot / denom, denom > 0.0);
  outMat[indexOut(i, j)] = sim;
}


