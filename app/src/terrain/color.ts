import * as THREE from "three";

const STOPS: ReadonlyArray<{ t: number; color: THREE.Color }> = [
  { t: 0.0, color: new THREE.Color("#3f6b8f") },
  { t: 0.12, color: new THREE.Color("#d9c48a") },
  { t: 0.22, color: new THREE.Color("#5b8a3f") },
  { t: 0.55, color: new THREE.Color("#4d6b35") },
  { t: 0.75, color: new THREE.Color("#8a8578") },
  { t: 1.0, color: new THREE.Color("#f4f7fa") },
];

const ROCK = new THREE.Color("#736a5e");
const scratch = new THREE.Color();

export function sampleBiomeColor(t: number, slope: number, out: THREE.Color = scratch): THREE.Color {
  const clamped = Math.min(Math.max(t, 0), 1);

  let matched = false;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const localT = (clamped - a.t) / (b.t - a.t || 1);
      out.copy(a.color).lerp(b.color, localT);
      matched = true;
      break;
    }
  }
  if (!matched) out.copy(STOPS[STOPS.length - 1].color);

  const slopeFactor = Math.min(slope / 1.2, 1);
  out.lerp(ROCK, slopeFactor * 0.6);
  return out;
}
