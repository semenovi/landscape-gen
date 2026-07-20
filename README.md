# landscape-gen

Client-side (no backend) 3D landscape generation in the browser, based on
algorithms from the terrain synthesis reviews in this repo: `review.pdf`
(general survey of the field) and `review_3d.md` (extension on
representations that support overhangs and caves).

Live prototype: `app/`, TypeScript plus [three.js](https://threejs.org/),
builds to static files and targets GitHub Pages.

## Architecture

The generation pipeline is split into explicit stages so that new algorithms
from the review can be plugged in without rewriting the rest:

```
HeightfieldGenerator (noise/fBm, ...)
  then ErosionPass[] (thermal, hydraulic, tectonic uplift, ...)
  then mesher: heightfield to geometry (grid mesh with per-vertex color today,
       voxel/marching cubes planned)
  then three.js render
```

- `src/core/types.ts`: interfaces for `HeightfieldGenerator` and
  `ErosionPass`. Every module carries an `AlgorithmMeta` (authors, year,
  venue, link) and a `ParamSpec[]` (parameter description). The GUI controls
  and the sources panel in the UI are both built from these, so wiring in a
  new algorithm does not require maintaining a separate citation list.
- `src/algorithms/noise/fbmNoise.ts`: base height layer, fBm over simplex
  noise (Perlin 1985, Gustavson 2005, Musgrave, Kolb and Mace 1989).
- `src/algorithms/erosion/thermalErosion.ts`: thermal erosion by angle of
  repose (Musgrave, Kolb and Mace, SIGGRAPH 1989).
- `src/terrain/mesh.ts`: heightfield to `THREE.BufferGeometry` with
  per-vertex color (biome coloring by height and slope lives in
  `src/terrain/color.ts`). This is a 2.5D representation, one height per
  column. The next step per `review_3d.md` is replacing this mesher with a
  voxel/SDF plus marching cubes stage to support overhangs and caves.
- `src/render/scene.ts`: scene, camera, lighting, orbit controls.
- `src/ui/sources.ts`: renders the "Sources" panel in the UI from the
  `AlgorithmMeta` of the modules currently wired in.

### Adding a new algorithm

1. Implement a `HeightfieldGenerator` or `ErosionPass` (use the existing
   modules as a template), fill in `meta` with a link to the paper.
2. Register the module and its parameters in `src/main.ts`
   (`bindParamsToGui`, and add `meta` to the list passed to `renderSources`).

Further candidates from the review: hydraulic erosion (virtual pipes, Mei et
al. 2007), tectonic uplift plus stream power (Cordonnier et al. 2016), a
multi-layered heightmap for overhangs (Nilles et al., VMV 2024), voxel/SDF
meshing (Marching Cubes or Dual Contouring on WebGPU compute).

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
