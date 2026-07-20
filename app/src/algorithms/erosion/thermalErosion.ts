import type { ErosionPass, Heightfield, ParamSpec } from "../../core/types";

export interface ThermalErosionParams extends Record<string, number | boolean> {
  iterations: number;
  talusAngle: number;
  carryFraction: number;
}

const params: ParamSpec[] = [
  { key: "iterations", label: "Итерации", type: "int", min: 0, max: 60, step: 1, default: 20 },
  { key: "talusAngle", label: "Угол осыпания (Δh / клетка)", type: "number", min: 0.02, max: 2, step: 0.01, default: 0.35 },
  { key: "carryFraction", label: "Доля переноса материала", type: "number", min: 0.05, max: 1, step: 0.05, default: 0.5 },
];

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

export const thermalErosionPass: ErosionPass<ThermalErosionParams> = {
  meta: {
    id: "thermal-erosion-talus",
    name: "Термальная эрозия (talus / angle of repose)",
    authors: "F. K. Musgrave, B. Kolb, S. Mace",
    year: 1989,
    venue: '"The Synthesis and Rendering of Eroded Fractal Terrains", SIGGRAPH 1989, pp. 41-50',
    url: "https://dl.acm.org/doi/10.1145/74333.74337",
    note:
      "Осыпание материала между соседними ячейками при превышении угла естественного откоса, первая " +
      "эрозионная модель в компьютерной графике (Galin et al. 2019 STAR, раздел 2).",
  },
  params,
  apply(field: Heightfield, p: ThermalErosionParams) {
    const { width, depth, data } = field;
    if (p.iterations <= 0) return;
    const next = new Float32Array(data.length);

    for (let iter = 0; iter < p.iterations; iter++) {
      next.set(data);

      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const idx = z * width + x;
          const h = data[idx];
          let maxDrop = 0;
          let targetIdx = -1;

          for (const [dx, dz] of NEIGHBOR_OFFSETS) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;

            const nIdx = nz * width + nx;
            const dist = Math.hypot(dx, dz);
            const drop = h - data[nIdx];
            const normalizedDrop = drop / dist;

            if (normalizedDrop > p.talusAngle && drop > maxDrop) {
              maxDrop = drop;
              targetIdx = nIdx;
            }
          }

          if (targetIdx >= 0) {
            const transfer = maxDrop * p.carryFraction * 0.5;
            next[idx] -= transfer;
            next[targetIdx] += transfer;
          }
        }
      }

      data.set(next);
    }
  },
};
