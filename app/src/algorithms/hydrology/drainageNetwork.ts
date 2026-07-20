import type { Heightfield, HydrologyPass, HydrologyResult, ParamSpec } from "../../core/types";

export interface DrainageNetworkParams extends Record<string, number | boolean> {
  lakeMinDepth: number;
  riverThreshold: number;
  riverCarveDepth: number;
}

const params: ParamSpec[] = [
  { key: "lakeMinDepth", label: "Мин. глубина озера", type: "number", min: 0.02, max: 2, step: 0.02, default: 0.15 },
  { key: "riverThreshold", label: "Порог русла (доля площади)", type: "number", min: 0.002, max: 0.1, step: 0.001, default: 0.015 },
  { key: "riverCarveDepth", label: "Врез русла", type: "number", min: 0, max: 4, step: 0.1, default: 1.2 },
];

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

class MinHeap {
  private indices: number[] = [];
  private heights: number[] = [];

  get size(): number {
    return this.indices.length;
  }

  push(index: number, height: number): void {
    this.indices.push(index);
    this.heights.push(height);
    let i = this.indices.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heights[parent] <= this.heights[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): { index: number; height: number } {
    const topIndex = this.indices[0];
    const topHeight = this.heights[0];
    const lastIndex = this.indices.length - 1;
    this.indices[0] = this.indices[lastIndex];
    this.heights[0] = this.heights[lastIndex];
    this.indices.pop();
    this.heights.pop();

    let i = 0;
    const n = this.indices.length;
    while (true) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;
      if (left < n && this.heights[left] < this.heights[smallest]) smallest = left;
      if (right < n && this.heights[right] < this.heights[smallest]) smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }

    return { index: topIndex, height: topHeight };
  }

  private swap(a: number, b: number): void {
    const ti = this.indices[a];
    this.indices[a] = this.indices[b];
    this.indices[b] = ti;
    const th = this.heights[a];
    this.heights[a] = this.heights[b];
    this.heights[b] = th;
  }
}

function priorityFloodFill(width: number, depth: number, data: Float32Array): Float32Array {
  const filled = Float32Array.from(data);
  const visited = new Uint8Array(width * depth);
  const heap = new MinHeap();

  for (let x = 0; x < width; x++) {
    heap.push(x, filled[x]);
    visited[x] = 1;
    const bottomIdx = (depth - 1) * width + x;
    heap.push(bottomIdx, filled[bottomIdx]);
    visited[bottomIdx] = 1;
  }
  for (let z = 1; z < depth - 1; z++) {
    const leftIdx = z * width;
    const rightIdx = z * width + width - 1;
    heap.push(leftIdx, filled[leftIdx]);
    visited[leftIdx] = 1;
    heap.push(rightIdx, filled[rightIdx]);
    visited[rightIdx] = 1;
  }

  while (heap.size > 0) {
    const { index, height } = heap.pop();
    const x = index % width;
    const z = (index / width) | 0;

    for (const [dx, dz] of NEIGHBOR_OFFSETS) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;
      const nIdx = nz * width + nx;
      if (visited[nIdx]) continue;

      visited[nIdx] = 1;
      filled[nIdx] = Math.max(data[nIdx], height);
      heap.push(nIdx, filled[nIdx]);
    }
  }

  return filled;
}

function computeFlowAccumulation(width: number, depth: number, filled: Float32Array): Float32Array {
  const n = width * depth;
  const flowTarget = new Int32Array(n).fill(-1);

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const idx = z * width + x;
      let steepest = 0;
      let target = -1;

      for (const [dx, dz] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;
        const nIdx = nz * width + nx;
        const dist = Math.hypot(dx, dz);
        const drop = (filled[idx] - filled[nIdx]) / dist;
        if (drop > steepest) {
          steepest = drop;
          target = nIdx;
        }
      }

      flowTarget[idx] = target;
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => filled[b] - filled[a]);
  const accumulation = new Float32Array(n).fill(1);
  for (const idx of order) {
    const target = flowTarget[idx];
    if (target >= 0) accumulation[target] += accumulation[idx];
  }

  return accumulation;
}

export const drainageNetworkPass: HydrologyPass<DrainageNetworkParams> = {
  meta: {
    id: "hydrology-drainage-network",
    name: "Реки и озёра (D8 сток + Priority-Flood)",
    authors: "J. F. O'Callaghan, D. M. Mark (D8 flow accumulation); R. Barnes, C. Lehman, D. Mulla (Priority-Flood)",
    year: 1984,
    venue:
      'O\'Callaghan & Mark, "The Extraction of Drainage Networks from Digital Elevation Data", ' +
      "Computer Vision, Graphics, and Image Processing, 28(3), 1984, pp. 323-344; " +
      'Barnes, Lehman & Mulla, "Priority-Flood: An Optimal Depression-Filling and Watershed-Labeling ' +
      'Algorithm for Digital Elevation Models", Computers and Geosciences, 62, 2014, pp. 117-127',
    url: "https://arxiv.org/abs/1511.04463",
    note:
      "Впадины заполняются до уровня перелива (Priority-Flood), получая озёра. Сток по самому крутому " +
      "из 8 соседей накапливается вниз по рельефу (D8), клетки с накоплением выше порога считаются руслом " +
      "и слегка врезаются в поверхность. Классическая гидрологическая основа, лежащая под tectonic/stream " +
      "power моделями терейна (Cordonnier et al. 2016).",
  },
  params,
  apply(field: Heightfield, p: DrainageNetworkParams): HydrologyResult {
    const { width, depth, data } = field;
    const n = width * depth;

    const filledHeight = priorityFloodFill(width, depth, data);
    const flowAccumulation = computeFlowAccumulation(width, depth, filledHeight);

    const lakeDepth = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const depthValue = filledHeight[i] - data[i];
      lakeDepth[i] = depthValue > p.lakeMinDepth ? depthValue : 0;
    }

    const riverMask = new Uint8Array(n);
    const thresholdCells = p.riverThreshold * n;
    for (let i = 0; i < n; i++) {
      if (lakeDepth[i] > 0) continue;
      const normalizedFlow = flowAccumulation[i];
      if (normalizedFlow <= thresholdCells) continue;

      riverMask[i] = 1;
      const strength = Math.min(1, normalizedFlow / (thresholdCells * 4) - 0.25);
      data[i] -= p.riverCarveDepth * Math.max(0, strength);
    }

    return { filledHeight, flowAccumulation, lakeDepth, riverMask };
  },
};
