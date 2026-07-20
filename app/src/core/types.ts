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

export interface HydrologyResult {
  filledHeight: Float32Array;
  flowAccumulation: Float32Array;
  lakeDepth: Float32Array;
  riverMask: Uint8Array;
}

export interface HydrologyPass<P extends Record<string, number | boolean> = Record<string, number | boolean>> {
  meta: AlgorithmMeta;
  params: ParamSpec[];
  apply(field: Heightfield, params: P): HydrologyResult;
}

export function defaultsFromSpecs<T extends Record<string, number | boolean>>(specs: ParamSpec[]): T {
  const out: Record<string, number | boolean> = {};
  for (const spec of specs) out[spec.key] = spec.default;
  return out as T;
}
