import { createNoise2D } from "simplex-noise";
import type { Heightfield, HeightfieldGenerator, ParamSpec } from "../../core/types";
import { mulberry32 } from "../../core/random";
import { computeD8FlowRouting } from "../../core/flowRouting";

export interface UpliftStreamPowerParams extends Record<string, number | boolean> {
  seed: number;
  iterations: number;
  upliftRate: number;
  upliftVariation: number;
  upliftScale: number;
  erodibility: number;
  areaExponent: number;
  slopeExponent: number;
  initialRoughness: number;
}

const params: ParamSpec[] = [
  { key: "seed", label: "Seed", type: "int", min: 0, max: 999999, step: 1, default: 7 },
  { key: "iterations", label: "Итерации подъёма", type: "int", min: 10, max: 300, step: 5, default: 120 },
  { key: "upliftRate", label: "Скорость поднятия", type: "number", min: 0.02, max: 1, step: 0.01, default: 0.25 },
  { key: "upliftVariation", label: "Неоднородность поднятия", type: "number", min: 0, max: 1, step: 0.05, default: 0.75 },
  { key: "upliftScale", label: "Масштаб карты поднятия", type: "number", min: 0.5, max: 8, step: 0.1, default: 2.5 },
  { key: "erodibility", label: "Эродируемость (K)", type: "number", min: 0.05, max: 3, step: 0.05, default: 0.9 },
  { key: "areaExponent", label: "Показатель площади (m)", type: "number", min: 0.2, max: 1, step: 0.05, default: 0.5 },
  { key: "slopeExponent", label: "Показатель уклона (n)", type: "number", min: 0.5, max: 2, step: 0.05, default: 1 },
  { key: "initialRoughness", label: "Начальная шероховатость", type: "number", min: 0, max: 2, step: 0.05, default: 0.4 },
];

function isBoundaryCell(x: number, z: number, width: number, depth: number): boolean {
  return x === 0 || x === width - 1 || z === 0 || z === depth - 1;
}

export const upliftStreamPowerGenerator: HeightfieldGenerator<UpliftStreamPowerParams> = {
  meta: {
    id: "tectonic-uplift-stream-power",
    name: "Тектоническое поднятие и сток (stream power)",
    authors: "G. Cordonnier, J. Braun, M-P. Cani, B. Benes, E. Galin, A. Peytavie, E. Guerin",
    year: 2016,
    venue:
      'Cordonnier, Braun, Cani, Benes, Galin, Peytavie & Guerin, "Large Scale Terrain Generation from ' +
      'Tectonic Uplift and Fluvial Erosion", Computer Graphics Forum (Eurographics), 35(2), 165-175, 2016',
    url: "https://doi.org/10.1111/cgf.12820",
    note:
      "На каждом шаге рельеф поднимается по карте поднятия (в оригинальной статье её рисует художник, " +
      "здесь она процедурная, на основе низкочастотного шума), затем реки (D8 сток по накопленной площади " +
      "водосбора) срезают его по степенному закону stream power, K умножить на A в степени m умножить на " +
      "S в степени n. Границы сетки закреплены на нулевой высоте как базис. Однородное поднятие при " +
      "фиксированной квадратной границе сходится к симметричному куполу, поэтому карта поднятия сделана " +
      "неоднородной, это и даёт отдельные хребты и массивы вместо одной пирамиды.",
  },
  params,
  generate(width, depth, p): Heightfield {
    const roughnessRng = mulberry32(p.seed);
    const upliftNoise = createNoise2D(mulberry32(p.seed ^ 0x9e3779b9));
    const n = width * depth;
    const data = new Float32Array(n);
    const upliftMap = new Float32Array(n);

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;
        data[idx] = isBoundaryCell(x, z, width, depth) ? 0 : (roughnessRng() - 0.5) * p.initialRoughness;

        const nx = (x / width) * p.upliftScale;
        const nz = (z / depth) * p.upliftScale;
        const raw = upliftNoise(nx, nz);
        upliftMap[idx] = Math.max(0.05, 1 + p.upliftVariation * raw);
      }
    }

    for (let iter = 0; iter < p.iterations; iter++) {
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          if (isBoundaryCell(x, z, width, depth)) continue;
          const idx = z * width + x;
          data[idx] += p.upliftRate * upliftMap[idx];
        }
      }

      const { flowTarget, accumulation } = computeD8FlowRouting(width, depth, data);

      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          if (isBoundaryCell(x, z, width, depth)) continue;
          const idx = z * width + x;
          const target = flowTarget[idx];
          if (target < 0) continue;

          const drop = data[idx] - data[target];
          if (drop <= 0) continue;

          const erosion = p.erodibility * Math.pow(accumulation[idx], p.areaExponent) * Math.pow(drop, p.slopeExponent);
          data[idx] -= Math.min(erosion, drop);
        }
      }
    }

    return { width, depth, data };
  },
};
