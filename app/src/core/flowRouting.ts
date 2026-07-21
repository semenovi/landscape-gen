export const D8_NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

export interface FlowRouting {
  flowTarget: Int32Array;
  accumulation: Float32Array;
}

export function computeD8FlowRouting(width: number, depth: number, heights: Float32Array): FlowRouting {
  const n = width * depth;
  const flowTarget = new Int32Array(n).fill(-1);

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const idx = z * width + x;
      let steepest = 0;
      let target = -1;

      for (const [dx, dz] of D8_NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;
        const nIdx = nz * width + nx;
        const dist = Math.hypot(dx, dz);
        const drop = (heights[idx] - heights[nIdx]) / dist;
        if (drop > steepest) {
          steepest = drop;
          target = nIdx;
        }
      }

      flowTarget[idx] = target;
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => heights[b] - heights[a]);
  const accumulation = new Float32Array(n).fill(1);
  for (const idx of order) {
    const target = flowTarget[idx];
    if (target >= 0) accumulation[target] += accumulation[idx];
  }

  return { flowTarget, accumulation };
}
