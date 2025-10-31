import shaderCode from './compute.wgsl?raw';

export async function computeCosineSimilarityBatched(
  vectors: Float32Array,
  numVectors: number,
  dim: number,
  batchSize: number,
  onProgress?: (done: number, total: number) => void
): Promise<Float32Array> {
  if (!('gpu' in navigator)) throw new Error('WebGPU not supported');
  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter');
  const device: GPUDevice = await adapter.requestDevice();

  const module = device.createShaderModule({ code: shaderCode });

  const total = numVectors * numVectors;
  const progress = (done: number) => onProgress && onProgress(done, total);

  // Precompute norms on CPU (simpler for demo)
  const norms = new Float32Array(numVectors);
  for (let i = 0; i < numVectors; i++) {
    let acc = 0;
    for (let k = 0; k < dim; k++) { const v = vectors[i * dim + k]; acc += v * v; }
    norms[i] = Math.sqrt(acc) || 1e-8;
  }

  const simOut = new Float32Array(total);

  // GPU buffers that stay resident
  const vecBuffer = device.createBuffer({
    size: vectors.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });
  device.queue.writeBuffer(vecBuffer, 0, vectors.buffer, vectors.byteOffset, vectors.byteLength);

  const normsBuffer = device.createBuffer({
    size: norms.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });
  device.queue.writeBuffer(normsBuffer, 0, norms.buffer, norms.byteOffset, norms.byteLength);

  const outBuffer = device.createBuffer({
    size: simOut.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const readBuffer = device.createBuffer({
    size: simOut.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Uniforms: [numVectors, dim, startRow, rowsInBatch]
  const uniformBufferSize = 4 * 4;
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });

  const bindGroupLayout = pipeline.getBindGroupLayout(0);

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: vecBuffer } },
      { binding: 1, resource: { buffer: normsBuffer } },
      { binding: 2, resource: { buffer: outBuffer } },
      { binding: 3, resource: { buffer: uniformBuffer } },
    ],
  });

  const rowsPerBatch = Math.max(1, Math.min(batchSize, numVectors));
  let done = 0;

  for (let startRow = 0; startRow < numVectors; startRow += rowsPerBatch) {
    const rowsInBatch = Math.min(rowsPerBatch, numVectors - startRow);
    const uni = new Uint32Array([numVectors, dim, startRow, rowsInBatch]);
    device.queue.writeBuffer(uniformBuffer, 0, uni);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);

    // Workgroup: 16x16 tiles over (columns, rows)
    const wgSizeX = 16;
    const wgSizeY = 16;
    const groupsX = Math.ceil(numVectors / wgSizeX);
    const groupsY = Math.ceil(rowsInBatch / wgSizeY);
    pass.dispatchWorkgroups(groupsX, groupsY);
    pass.end();

    // Copy updated slice of outBuffer back after all batches
    encoder.copyBufferToBuffer(outBuffer, 0, readBuffer, 0, simOut.byteLength);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    new Float32Array(readBuffer.getMappedRange()).slice().forEach((v, idx) => { simOut[idx] = v; });
    readBuffer.unmap();

    done += rowsInBatch * numVectors;
    progress(done);
  }

  return simOut;
}


