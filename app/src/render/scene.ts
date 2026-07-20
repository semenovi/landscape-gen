import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private terrainMesh: THREE.Mesh | null = null;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene.background = new THREE.Color("#0e1620");
    this.scene.fog = new THREE.Fog("#0e1620", 120, 320);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(70, 55, 70);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight("#bcd4f2", "#3a3226", 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#fff4dd", 1.4);
    sun.position.set(60, 90, 40);
    this.scene.add(sun);

    window.addEventListener("resize", this.onResize);
  }

  setTerrain(mesh: THREE.Mesh): void {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      const material = this.terrainMesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
    this.terrainMesh = mesh;
    this.scene.add(mesh);
  }

  private onResize = (): void => {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  start(): void {
    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
