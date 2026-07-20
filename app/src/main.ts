import "./style.css";
import * as THREE from "three";
import GUI from "lil-gui";

import { defaultsFromSpecs } from "./core/types";
import type { ParamSpec } from "./core/types";
import { fbmNoiseGenerator, type FbmParams } from "./algorithms/noise/fbmNoise";
import { thermalErosionPass, type ThermalErosionParams } from "./algorithms/erosion/thermalErosion";
import { drainageNetworkPass, type DrainageNetworkParams } from "./algorithms/hydrology/drainageNetwork";
import { buildHeightfieldMesh } from "./terrain/mesh";
import { SceneManager } from "./render/scene";
import { renderSources } from "./ui/sources";

const config = {
  resolution: 128,
  worldSize: 100,
  erosionEnabled: true,
  hydrologyEnabled: true,
  noise: defaultsFromSpecs<FbmParams>(fbmNoiseGenerator.params),
  erosion: defaultsFromSpecs<ThermalErosionParams>(thermalErosionPass.params),
  hydrology: defaultsFromSpecs<DrainageNetworkParams>(drainageNetworkPass.params),
};

const viewport = document.querySelector<HTMLDivElement>("#viewport");
if (!viewport) throw new Error("#viewport element not found");

const sceneManager = new SceneManager(viewport);

function regenerate(): void {
  const field = fbmNoiseGenerator.generate(config.resolution, config.resolution, config.noise);

  if (config.erosionEnabled) {
    thermalErosionPass.apply(field, config.erosion);
  }

  const hydrology = config.hydrologyEnabled ? drainageNetworkPass.apply(field, config.hydrology) : undefined;

  const geometry = buildHeightfieldMesh(field, { worldSize: config.worldSize, hydrology });
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });

  sceneManager.setTerrain(new THREE.Mesh(geometry, material));
}

let regenerateHandle = 0;
function scheduleRegenerate(): void {
  window.clearTimeout(regenerateHandle);
  regenerateHandle = window.setTimeout(regenerate, 60);
}

function bindParamsToGui(folder: GUI, target: Record<string, number | boolean>, specs: ParamSpec[]): void {
  for (const spec of specs) {
    if (spec.type === "boolean") {
      folder.add(target, spec.key).name(spec.label).onChange(scheduleRegenerate);
    } else {
      const step = spec.step ?? 1;
      folder.add(target, spec.key, spec.min, spec.max, step).name(spec.label).onChange(scheduleRegenerate);
    }
  }
}

const gui = new GUI({ title: "Параметры генерации" });

const gridFolder = gui.addFolder("Сетка");
gridFolder.add(config, "resolution", 32, 256, 8).name("Разрешение (N×N)").onChange(scheduleRegenerate);
gridFolder.add(config, "worldSize", 20, 200, 5).name("Размер сцены").onChange(scheduleRegenerate);

const noiseFolder = gui.addFolder(fbmNoiseGenerator.meta.name);
bindParamsToGui(noiseFolder, config.noise, fbmNoiseGenerator.params);

const erosionFolder = gui.addFolder(thermalErosionPass.meta.name);
erosionFolder.add(config, "erosionEnabled").name("Включить эрозию").onChange(scheduleRegenerate);
bindParamsToGui(erosionFolder, config.erosion, thermalErosionPass.params);

const hydrologyFolder = gui.addFolder(drainageNetworkPass.meta.name);
hydrologyFolder.add(config, "hydrologyEnabled").name("Включить реки и озёра").onChange(scheduleRegenerate);
bindParamsToGui(hydrologyFolder, config.hydrology, drainageNetworkPass.params);

const sourcesContainer = document.querySelector<HTMLDivElement>("#sources");
if (!sourcesContainer) throw new Error("#sources element not found");
renderSources(sourcesContainer, [fbmNoiseGenerator.meta, thermalErosionPass.meta, drainageNetworkPass.meta]);

regenerate();
sceneManager.start();
