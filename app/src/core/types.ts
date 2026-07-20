export interface AlgorithmMeta {
  id: string;
  name: string;
  authors: string;
  year: number;
  venue: string;
  url: string;
  note?: string;
}

export type ParamType = "number" | "int" | "boolean";

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean;
}

export interface Heightfield {
  width: number;
  depth: number;
  data: Float32Array;
}

export interface HeightfieldGenerator<P extends Record<string, number | boolean> = Record<string, number | boolean>> {
  meta: AlgorithmMeta;
  params: ParamSpec[];
  generate(width: number, depth: number, params: P): Heightfield;
}

export interface ErosionPass<P extends Record<string, number | boolean> = Record<string, number | boolean>> {
  meta: AlgorithmMeta;
  params: ParamSpec[];
  apply(field: Heightfield, params: P): void;
}

export function defaultsFromSpecs<T extends Record<string, number | boolean>>(specs: ParamSpec[]): T {
  const out: Record<string, number | boolean> = {};
  for (const spec of specs) out[spec.key] = spec.default;
  return out as T;
}
