import * as THREE from "three";
import type { Heightfield } from "../core/types";
import { sampleBiomeColor } from "./color";

export interface MeshBuildOptions {
  worldSize: number;
}

const colorScratch = new THREE.Color();

export function buildHeightfieldMesh(field: Heightfield, options: MeshBuildOptions): THREE.BufferGeometry {
  const { width, depth, data } = field;
  const { worldSize } = options;

  const geometry = new THREE.BufferGeometry();
  const vertexCount = width * depth;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  const halfSize = worldSize / 2;
  const stepX = worldSize / (width - 1);
  const stepZ = worldSize / (depth - 1);
  const cellSize = Math.max(stepX, stepZ);

  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const h = data[i];
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const range = Math.max(maxH - minH, 1e-6);

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const idx = z * width + x;
      const h = data[idx];

      const vi = idx * 3;
      positions[vi] = x * stepX - halfSize;
      positions[vi + 1] = h;
      positions[vi + 2] = z * stepZ - halfSize;

      const hL = data[z * width + Math.max(x - 1, 0)];
      const hR = data[z * width + Math.min(x + 1, width - 1)];
      const hD = data[Math.max(z - 1, 0) * width + x];
      const hU = data[Math.min(z + 1, depth - 1) * width + x];
      const slope = (Math.abs(hR - hL) + Math.abs(hU - hD)) / (2 * cellSize);

      const normalizedHeight = (h - minH) / range;
      const color = sampleBiomeColor(normalizedHeight, slope, colorScratch);
      colors[vi] = color.r;
      colors[vi + 1] = color.g;
      colors[vi + 2] = color.b;
    }
  }

  const indices: number[] = [];
  for (let z = 0; z < depth - 1; z++) {
    for (let x = 0; x < width - 1; x++) {
      const a = z * width + x;
      const b = z * width + x + 1;
      const c = (z + 1) * width + x;
      const d = (z + 1) * width + x + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return geometry;
}
