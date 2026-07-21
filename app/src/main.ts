import "./style.css";
import * as THREE from "three";

import { defaultsFromSpecs } from "./core/types";
import type { ErosionPass, HeightfieldGenerator, ParamSpec } from "./core/types";
import { fbmNoiseGenerator, type FbmParams } from "./algorithms/noise/fbmNoise";
import { upliftStreamPowerGenerator, type UpliftStreamPowerParams } from "./algorithms/tectonic/upliftStreamPower";
import { thermalErosionPass, type ThermalErosionParams } from "./algorithms/erosion/thermalErosion";
import { hydraulicErosionPass, type HydraulicErosionParams } from "./algorithms/erosion/hydraulicErosion";
import { drainageNetworkPass, type DrainageNetworkParams } from "./algorithms/hydrology/drainageNetwork";
import { buildHeightfieldMesh } from "./terrain/mesh";
import { SceneManager } from "./render/scene";
import { renderSources } from "./ui/sources";
import { buildStackCard, buildSectionHeading, buildParamRow } from "./ui/stackPanel";

interface ErosionStackEntry {
  pass: ErosionPass;
  enabled: boolean;
  params: Record<string, number | boolean>;
}

interface GeneratorOption {
  generator: HeightfieldGenerator;
  params: Record<string, number | boolean>;
}

const gridConfig = {
  resolution: 128,
  worldSize: 100,
};

const generatorOptions: GeneratorOption[] = [
  { generator: fbmNoiseGenerator as HeightfieldGenerator, params: defaultsFromSpecs<FbmParams>(fbmNoiseGenerator.params) },
  {
    generator: upliftStreamPowerGenerator as HeightfieldGenerator,
    params: defaultsFromSpecs<UpliftStreamPowerParams>(upliftStreamPowerGenerator.params),
  },
];
let activeGeneratorIndex = 0;

const erosionStack: ErosionStackEntry[] = [
  {
    pass: thermalErosionPass as ErosionPass,
    enabled: true,
    params: defaultsFromSpecs<ThermalErosionParams>(thermalErosionPass.params),
  },
  {
    pass: hydraulicErosionPass as ErosionPass,
    enabled: false,
    params: defaultsFromSpecs<HydraulicErosionParams>(hydraulicErosionPass.params),
  },
];

const hydrologyConfig = {
  enabled: true,
  params: defaultsFromSpecs<DrainageNetworkParams>(drainageNetworkPass.params),
};

const viewport = document.querySelector<HTMLDivElement>("#viewport");
if (!viewport) throw new Error("#viewport element not found");
const sceneManager = new SceneManager(viewport);

function regenerate(): void {
  const active = generatorOptions[activeGeneratorIndex];
  const field = active.generator.generate(gridConfig.resolution, gridConfig.resolution, active.params);

  for (const entry of erosionStack) {
    if (entry.enabled) entry.pass.apply(field, entry.params);
  }

  const hydrology = hydrologyConfig.enabled ? drainageNetworkPass.apply(field, hydrologyConfig.params) : undefined;

  const geometry = buildHeightfieldMesh(field, { worldSize: gridConfig.worldSize, hydrology });
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

const stackPanelElement = document.querySelector<HTMLDivElement>("#stack-panel");
if (!stackPanelElement) throw new Error("#stack-panel element not found");
const stackPanel: HTMLDivElement = stackPanelElement;

const gridParamSpecs: ParamSpec[] = [
  { key: "resolution", label: "Разрешение (N на N)", type: "int", min: 32, max: 256, step: 8, default: gridConfig.resolution },
  { key: "worldSize", label: "Размер сцены", type: "number", min: 20, max: 200, step: 5, default: gridConfig.worldSize },
];

function buildGridControls(): HTMLElement {
  const card = document.createElement("div");
  card.className = "stack-card";

  const body = document.createElement("div");
  body.className = "stack-card-body";
  body.style.display = "flex";

  for (const spec of gridParamSpecs) {
    body.appendChild(buildParamRow(spec, gridConfig, scheduleRegenerate));
  }

  card.appendChild(body);
  return card;
}

function buildGeneratorSelect(): HTMLElement {
  const select = document.createElement("select");
  select.className = "stack-select";

  generatorOptions.forEach((option, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = option.generator.meta.name;
    select.appendChild(opt);
  });

  select.value = String(activeGeneratorIndex);
  select.addEventListener("change", () => {
    activeGeneratorIndex = Number(select.value);
    renderStackPanel();
    scheduleRegenerate();
  });

  return select;
}

function renderStackPanel(): void {
  stackPanel.innerHTML = "";

  stackPanel.appendChild(buildSectionHeading("Сетка"));
  stackPanel.appendChild(buildGridControls());

  stackPanel.appendChild(buildSectionHeading("Базовый объект"));
  stackPanel.appendChild(buildGeneratorSelect());
  const activeGenerator = generatorOptions[activeGeneratorIndex];
  stackPanel.appendChild(
    buildStackCard({
      meta: activeGenerator.generator.meta,
      specs: activeGenerator.generator.params,
      values: activeGenerator.params,
      onChange: scheduleRegenerate,
    }),
  );

  stackPanel.appendChild(buildSectionHeading("Модификаторы: эрозия"));
  erosionStack.forEach((entry, index) => {
    stackPanel.appendChild(
      buildStackCard({
        meta: entry.pass.meta,
        specs: entry.pass.params,
        values: entry.params,
        onChange: scheduleRegenerate,
        enabled: {
          value: entry.enabled,
          onToggle: (value) => {
            entry.enabled = value;
            scheduleRegenerate();
          },
        },
        startExpanded: entry.enabled,
        onMoveUp:
          index > 0
            ? () => {
                [erosionStack[index - 1], erosionStack[index]] = [erosionStack[index], erosionStack[index - 1]];
                renderStackPanel();
                scheduleRegenerate();
              }
            : undefined,
        onMoveDown:
          index < erosionStack.length - 1
            ? () => {
                [erosionStack[index], erosionStack[index + 1]] = [erosionStack[index + 1], erosionStack[index]];
                renderStackPanel();
                scheduleRegenerate();
              }
            : undefined,
      }),
    );
  });

  stackPanel.appendChild(buildSectionHeading("Модификатор: гидрология"));
  stackPanel.appendChild(
    buildStackCard({
      meta: drainageNetworkPass.meta,
      specs: drainageNetworkPass.params,
      values: hydrologyConfig.params,
      onChange: scheduleRegenerate,
      enabled: {
        value: hydrologyConfig.enabled,
        onToggle: (value) => {
          hydrologyConfig.enabled = value;
          scheduleRegenerate();
        },
      },
      startExpanded: false,
      note:
        "Работает поверх уже готового рельефа (заполняет впадины, считает сток), а не генерирует его " +
        "с нуля. Автономным режимом генерации быть не может, поэтому оформлен как модификатор в конце стека.",
    }),
  );
}

const sourcesContainer = document.querySelector<HTMLDivElement>("#sources");
if (!sourcesContainer) throw new Error("#sources element not found");
renderSources(sourcesContainer, [
  fbmNoiseGenerator.meta,
  upliftStreamPowerGenerator.meta,
  thermalErosionPass.meta,
  hydraulicErosionPass.meta,
  drainageNetworkPass.meta,
]);

renderStackPanel();
regenerate();
sceneManager.start();
