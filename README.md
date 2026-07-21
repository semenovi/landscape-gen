# landscape-gen

Client-side (no backend) 3D landscape generation in the browser, based on
algorithms from the terrain synthesis reviews in this repo: `review.pdf`
(general survey of the field) and `review_3d.md` (extension on
representations that support overhangs and caves).

Live prototype: `app/`, TypeScript plus [three.js](https://threejs.org/),
builds to static files and targets GitHub Pages.

## Architecture

The generation pipeline follows a modifier-stack model: a single base
object, then an ordered, toggleable stack of modifiers, then a fixed
post-process, then the mesher:

```
HeightfieldGenerator, the base object, selectable (fBm noise, or tectonic
       uplift plus stream power)
  then an ordered ErosionPass[] stack, each entry independently enabled
       and reorderable (thermal, hydraulic today)
  then HydrologyPass, a fixed post-process modifier (drainage network:
       rivers and lakes). Reads the terrain produced above, cannot run
       standalone, so it is not a separate generation mode.
  then mesher: heightfield to geometry (grid mesh with per-vertex color
       today, voxel/marching cubes planned)
  then three.js render
```

- `src/core/types.ts`: interfaces for `HeightfieldGenerator`, `ErosionPass`
  and `HydrologyPass`. Every module carries an `AlgorithmMeta` (authors,
  year, venue, link) and a `ParamSpec[]` (parameter description). Both the
  modifier-stack UI and the sources panel are built from these, so wiring in
  a new algorithm does not require maintaining a separate citation list.
- `src/algorithms/noise/fbmNoise.ts`: base height layer, fBm over simplex
  noise (Perlin 1985, Gustavson 2005, Musgrave, Kolb and Mace 1989).
- `src/algorithms/tectonic/upliftStreamPower.ts`: alternative base object.
  Repeatedly uplifts the interior of the grid and lets a D8 drainage network
  cut it back down by the stream-power law (erosion proportional to drainage
  area to the power m, times slope to the power n), with the grid boundary
  pinned at zero as a fixed base level. No input heightfield is needed: the
  terrain, including a hydrologically consistent river network, emerges from
  the uplift/erosion cycle itself (Cordonnier et al., Eurographics 2016).
- `src/algorithms/erosion/thermalErosion.ts`: thermal erosion by angle of
  repose (Musgrave, Kolb and Mace, SIGGRAPH 1989).
- `src/algorithms/erosion/hydraulicErosion.ts`: droplet-based hydraulic
  erosion. Each droplet flows downhill, picks up and deposits sediment based
  on slope and speed, carving valleys rather than just sliding material to
  the nearest lower neighbor like the thermal pass does. A simplified,
  single-agent approximation of the classic hydraulic erosion line (Musgrave,
  Kolb and Mace, 1989; Mei, Decaudin and Hu, 2007).
- `src/algorithms/hydrology/drainageNetwork.ts`: depression filling
  (Priority-Flood, Barnes, Lehman and Mulla 2014) to form lakes, then D8
  flow accumulation (O'Callaghan and Mark, 1984) to route drainage and carve
  a river network where accumulated flow exceeds a threshold.
- `src/core/flowRouting.ts`: the shared D8 flow-direction and flow-
  accumulation routine, used by both `drainageNetwork.ts` and
  `upliftStreamPower.ts`.
- `src/terrain/mesh.ts`: heightfield to `THREE.BufferGeometry` with
  per-vertex color (biome coloring by height and slope lives in
  `src/terrain/color.ts`; lake and river coloring uses the `HydrologyResult`
  from the drainage pass). This is a 2.5D representation, one height per
  column. The next step per `review_3d.md` is replacing this mesher with a
  voxel/SDF plus marching cubes stage to support overhangs and caves.
- `src/render/scene.ts`: scene, camera, lighting, orbit controls.
- `src/ui/stackPanel.ts`: builds the modifier-stack cards (enable checkbox,
  name, "by Author, Year" byline linking to the paper, reorder buttons,
  collapsible parameter sliders). `src/main.ts` owns the `erosionStack`
  array and the `generatorOptions` list, and re-renders this panel on
  reorder or generator switch.
- `src/ui/sources.ts`: renders the "Sources" panel in the UI from the
  `AlgorithmMeta` of the modules currently wired in.

### Adding a new algorithm

1. Implement a `HeightfieldGenerator`, `ErosionPass` or `HydrologyPass` (use
   the existing modules as a template), fill in `meta` with a link to the
   paper.
2. Register it in `src/main.ts`: push it onto `generatorOptions` for a
   `HeightfieldGenerator`, onto `erosionStack` for an `ErosionPass`, or wire
   it in directly next to `drainageNetworkPass` for a `HydrologyPass`, then
   add its `meta` to the list passed to `renderSources`.

Further candidates from the review: a multi-layered heightmap for overhangs
(Nilles et al., VMV 2024), voxel/SDF meshing (Marching Cubes or Dual
Contouring on WebGPU compute).

## Local development

```bash
cd app
npm install
npm run dev
```

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds `app/` (`GITHUB_PAGES=true npm run
build`, base path `/landscape-gen/`) and publishes `app/dist` via
`actions/deploy-pages`. One-time setup: in the repository settings, set
Pages Source to GitHub Actions.
