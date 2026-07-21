import type { ErosionPass, Heightfield, ParamSpec } from "../../core/types";
import { mulberry32 } from "../../core/random";

export interface HydraulicErosionParams extends Record<string, number | boolean> {
  seed: number;
  dropletCount: number;
  maxLifetime: number;
  inertia: number;
  capacity: number;
  erosionRate: number;
  depositionRate: number;
  evaporation: number;
  gravity: number;
}

const params: ParamSpec[] = [
  { key: "seed", label: "Seed", type: "int", min: 0, max: 999999, step: 1, default: 4242 },
  { key: "dropletCount", label: "Число капель", type: "int", min: 200, max: 20000, step: 100, default: 4000 },
  { key: "maxLifetime", label: "Шагов на каплю", type: "int", min: 8, max: 128, step: 1, default: 40 },
  { key: "inertia", label: "Инерция потока", type: "number", min: 0, max: 0.95, step: 0.01, default: 0.3 },
  { key: "capacity", label: "Ёмкость наносов", type: "number", min: 1, max: 20, step: 0.5, default: 8 },
  { key: "erosionRate", label: "Скорость размыва", type: "number", min: 0.05, max: 1, step: 0.05, default: 0.35 },
  { key: "depositionRate", label: "Скорость отложения", type: "number", min: 0.05, max: 1, step: 0.05, default: 0.3 },
  { key: "evaporation", label: "Испарение", type: "number", min: 0.001, max: 0.2, step: 0.001, default: 0.02 },
  { key: "gravity", label: "Гравитация", type: "number", min: 1, max: 20, step: 0.5, default: 9 },
];

const MIN_SLOPE = 0.01;
const MIN_WATER = 0.01;

interface HeightSample {
  height: number;
  gradX: number;
  gradZ: number;
  x0: number;
  z0: number;
  fx: number;
  fz: number;
}

function sampleHeight(data: Float32Array, width: number, depth: number, x: number, z: number): HeightSample {
  const x0 = Math.min(Math.max(Math.floor(x), 0), width - 2);
  const z0 = Math.min(Math.max(Math.floor(z), 0), depth - 2);
  const fx = x - x0;
  const fz = z - z0;

  const h00 = data[z0 * width + x0];
  const h10 = data[z0 * width + x0 + 1];
  const h01 = data[(z0 + 1) * width + x0];
  const h11 = data[(z0 + 1) * width + x0 + 1];

  const height = h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
  const gradX = (h10 - h00) * (1 - fz) + (h11 - h01) * fz;
  const gradZ = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;

  return { height, gradX, gradZ, x0, z0, fx, fz };
}

function distribute(data: Float32Array, width: number, sample: HeightSample, amount: number): void {
  const { x0, z0, fx, fz } = sample;
  data[z0 * width + x0] += amount * (1 - fx) * (1 - fz);
  data[z0 * width + x0 + 1] += amount * fx * (1 - fz);
  data[(z0 + 1) * width + x0] += amount * (1 - fx) * fz;
  data[(z0 + 1) * width + x0 + 1] += amount * fx * fz;
}

export const hydraulicErosionPass: ErosionPass<HydraulicErosionParams> = {
  meta: {
    id: "hydraulic-erosion-droplet",
    name: "Гидравлическая эрозия (капли)",
    authors: "F. K. Musgrave, B. Kolb, S. Mace; Y. Mei, P. Decaudin, X. Hu",
    year: 1989,
    venue:
      'Упрощённая, покаплевая реализация классической линии гидравлической эрозии в CG: ' +
      'Musgrave, Kolb & Mace, "The Synthesis and Rendering of Eroded Fractal Terrains", SIGGRAPH 1989 ' +
      "(первая гидравлическая модель в компьютерной графике); Mei, Decaudin & Hu, " +
      '"Fast Hydraulic Erosion Simulation and Visualization on GPU", Pacific Graphics 2007 ' +
      "(современная сеточная формулировка virtual pipes, которую этот режим приближает одиночными агентами).",
    url: "https://dl.acm.org/doi/10.1145/74333.74337",
    note:
      "Каждая капля стекает по градиенту высоты, набирает наносы пропорционально скорости и уклону, " +
      "либо размывает, либо откладывает материал в зависимости от текущей загрузки. В отличие от " +
      "термальной эрозии, работает с направленным потоком и способна прорезать долины и русла, " +
      "а не только осыпать крутые склоны.",
  },
  params,
  apply(field: Heightfield, p: HydraulicErosionParams) {
    const { width, depth, data } = field;
    const rng = mulberry32(p.seed);
    const gravityScale = 0.05;

    for (let d = 0; d < p.dropletCount; d++) {
      let posX = rng() * (width - 1);
      let posZ = rng() * (depth - 1);
      let dirX = 0;
      let dirZ = 0;
      let speed = 1;
      let water = 1;
      let sediment = 0;

      for (let step = 0; step < p.maxLifetime; step++) {
        const sample = sampleHeight(data, width, depth, posX, posZ);

        dirX = dirX * p.inertia - sample.gradX * (1 - p.inertia);
        dirZ = dirZ * p.inertia - sample.gradZ * (1 - p.inertia);
        const dirLength = Math.hypot(dirX, dirZ);
        if (dirLength < 1e-8) break;
        dirX /= dirLength;
        dirZ /= dirLength;

        const newX = posX + dirX;
        const newZ = posZ + dirZ;
        if (newX < 0 || newX > width - 1 || newZ < 0 || newZ > depth - 1) break;

        const newSample = sampleHeight(data, width, depth, newX, newZ);
        const heightDiff = newSample.height - sample.height;
        const capacity = Math.max(-heightDiff, MIN_SLOPE) * speed * water * p.capacity;

        if (heightDiff > 0 || sediment > capacity) {
          const depositAmount = heightDiff > 0 ? Math.min(heightDiff, sediment) : (sediment - capacity) * p.depositionRate;
          sediment -= depositAmount;
          distribute(data, width, sample, depositAmount);
        } else {
          const erodeAmount = Math.min((capacity - sediment) * p.erosionRate, -heightDiff);
          distribute(data, width, sample, -erodeAmount);
          sediment += erodeAmount;
        }

        speed = Math.sqrt(Math.max(0, speed * speed - heightDiff * p.gravity * gravityScale));
        water *= 1 - p.evaporation;

        posX = newX;
        posZ = newZ;
        if (water < MIN_WATER) break;
      }
    }
  },
};
