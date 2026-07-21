import { createNoise2D } from "simplex-noise";
import type { HeightfieldGenerator, ParamSpec } from "../../core/types";
import { mulberry32 } from "../../core/random";

export interface FbmParams extends Record<string, number | boolean> {
  seed: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  amplitude: number;
}

const params: ParamSpec[] = [
  { key: "seed", label: "Seed", type: "int", min: 0, max: 999999, step: 1, default: 1337 },
  { key: "scale", label: "Масштаб шума", type: "number", min: 0.5, max: 20, step: 0.1, default: 4 },
  { key: "octaves", label: "Октавы", type: "int", min: 1, max: 8, step: 1, default: 5 },
  { key: "persistence", label: "Persistence (затухание амплитуды)", type: "number", min: 0.1, max: 0.9, step: 0.01, default: 0.5 },
  { key: "lacunarity", label: "Lacunarity (рост частоты)", type: "number", min: 1.5, max: 3, step: 0.05, default: 2.0 },
  { key: "amplitude", label: "Высота (амплитуда)", type: "number", min: 1, max: 60, step: 1, default: 18 },
];

export const fbmNoiseGenerator: HeightfieldGenerator<FbmParams> = {
  meta: {
    id: "fbm-simplex-noise",
    name: "Fractal Brownian Motion (симплекс-шум)",
    authors: "K. Perlin; A. Gustavson (симплекс-вариант); F. K. Musgrave, B. Kolb, S. Mace (композиция октав)",
    year: 1985,
    venue:
      'Perlin, "An Image Synthesizer", SIGGRAPH 1985; Gustavson, "Simplex noise demystified", 2005; ' +
      'Musgrave, Kolb & Mace, "The Synthesis and Rendering of Eroded Fractal Terrains", SIGGRAPH 1989',
    url: "https://dl.acm.org/doi/10.1145/325165.325247",
    note:
      "Суммирование октав градиентного шума (fBm), базовый процедурный слой высот: быстро и бесконечно " +
      "масштабируемо, но без гидрологической причинности (см. Galin et al. 2019 STAR).",
  },
  params,
  generate(width, depth, p) {
    const rng = mulberry32(p.seed);
    const noise2D = createNoise2D(rng);
    const data = new Float32Array(width * depth);

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        let amplitude = 1;
        let frequency = 1;
        let sum = 0;
        let norm = 0;
        for (let o = 0; o < p.octaves; o++) {
          const nx = (x / width) * p.scale * frequency;
          const nz = (z / depth) * p.scale * frequency;
          sum += noise2D(nx, nz) * amplitude;
          norm += amplitude;
          amplitude *= p.persistence;
          frequency *= p.lacunarity;
        }
        data[z * width + x] = (sum / (norm || 1)) * p.amplitude;
      }
    }

    return { width, depth, data };
  },
};
