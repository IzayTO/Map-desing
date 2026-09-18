import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

const viewport = document.querySelector("#viewport");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");

const fatalError = document.querySelector("#fatalError");
const fatalMessage = document.querySelector("#fatalMessage");

const controlsPanel = document.querySelector("#controlsPanel");
const panelToggle = document.querySelector("#panelToggle");

const gridOpacityInput = document.querySelector("#gridOpacity");
const gridOpacityValue = document.querySelector("#gridOpacityValue");

const groundOpacityInput = document.querySelector("#groundOpacity");
const groundOpacityValue = document.querySelector("#groundOpacityValue");

const gridToggle = document.querySelector("#gridToggle");
const resetViewButton = document.querySelector("#resetView");
const topViewButton = document.querySelector("#topView");

const state = {
  gridVisible: true,
  gridOpacity: 0.55,
  groundOpacity: 1,
  panelCollapsed: false,
};

let scene;
let camera;
let renderer;
let controls;
let ground;
let grid;

let animationFrame = 0;
let resizeObserver;

const INITIAL_CAMERA = new THREE.Vector3(42, 36, 48);
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0);

function showFatalError(message) {
  if (fatalMessage && message) {
    fatalMessage.textContent = message;
  }

  fatalError?.classList.add("visible");

  if (statusText) {
    statusText.textContent = "Error al iniciar";
  }
}

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");

    const webgl2 =
      window.WebGL2RenderingContext &&
      canvas.getContext("webgl2");

    const webgl1 =
      window.WebGLRenderingContext &&
      (
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      );

    return Boolean(webgl2 || webgl1);
  } catch {
    return false;
  }
}

function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xefefe9);

  camera = new THREE.PerspectiveCamera(
    40,
    1,
    0.1,
    2000
  );

  camera.position.copy(INITIAL_CAMERA);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  viewport.appendChild(renderer.domElement);

  createGround();
  createGrid();
  createOriginMarker();
  createControls();

  resizeViewport();
  installEvents();

  statusDot?.classList.add("ready");

  if (statusText) {
    statusText.textContent = "Escena 3D funcionando";
  }

  animate();
}

function createGround() {
  const geometry = new THREE.PlaneGeometry(140, 140);

  const material = new THREE.MeshBasicMaterial({
    color: 0xf8f8f5,
    transparent: true,
    opacity: state.groundOpacity,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  ground = new THREE.Mesh(
    geometry,
    material
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.018;
  ground.name = "Ground";

  scene.add(ground);
}

function createGrid() {
  grid = new THREE.GridHelper(
    140,
    70,
    0x747474,
    0xc9c9c4
  );

  const materials = Array.isArray(grid.material)
    ? grid.material
    : [grid.material];

  for (const material of materials) {
    material.transparent = true;
    material.opacity = state.gridOpacity;
    material.depthWrite = false;
  }

  grid.visible = state.gridVisible;
  grid.name = "Grid";

  scene.add(grid);
}

function createOriginMarker() {
  const geometry = new THREE.RingGeometry(
    0.28,
    0.43,
    40
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0x222222,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });

  const ring = new THREE.Mesh(
    geometry,
    material
  );

  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.018;
  ring.name = "OriginMarker";

  scene.add(ring);
}

function createControls() {
  controls = new MapControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;
  controls.dampingFactor = 0.075;

  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;

  controls.zoomToCursor = true;

  controls.panSpeed = 0.95;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 0.8;

  controls.minDistance = 7;
  controls.maxDistance = 180;

  controls.minPolarAngle = Math.PI * 0.055;
  controls.maxPolarAngle = Math.PI * 0.495;

  controls.target.copy(INITIAL_TARGET);
  controls.update();
  controls.saveState();
}

function resizeViewport() {
  if (!viewport || !renderer || !camera) {
    return;
  }

  const width = Math.max(
    1,
    viewport.clientWidth
  );

  const height = Math.max(
    1,
    viewport.clientHeight
  );

  renderer.setSize(
    width,
    height,
    false
  );

  camera.aspect =
    width / height;

  camera.updateProjectionMatrix();
}

function animate() {
  animationFrame =
    requestAnimationFrame(animate);

  controls?.update();

  renderer?.render(
    scene,
    camera
  );
}

function setGridOpacity(value) {
  state.gridOpacity = value;

  if (!grid) {
    return;
  }

  const materials = Array.isArray(grid.material)
    ? grid.material
    : [grid.material];

  for (const material of materials) {
    material.opacity = value;
  }
}

function setGroundOpacity(value) {
  state.groundOpacity = value;

  if (ground?.material) {
    ground.material.opacity = value;
  }
}

function setGridVisible(visible) {
  state.gridVisible = visible;

  if (grid) {
    grid.visible = visible;
  }

  gridToggle?.setAttribute(
    "aria-checked",
    String(visible)
  );
}

function setPanelCollapsed(collapsed) {
  state.panelCollapsed = collapsed;

  controlsPanel?.classList.toggle(
    "collapsed",
    collapsed
  );

  panelToggle?.setAttribute(
    "aria-label",
    collapsed
      ? "Expandir panel"
      : "Contraer panel"
  );
}

function resetView() {
  if (!camera || !controls) {
    return;
  }

  camera.position.copy(INITIAL_CAMERA);
  controls.target.copy(INITIAL_TARGET);
  controls.update();
}

function setTopView() {
  if (!camera || !controls) {
    return;
  }

  camera.position.set(
    0.001,
    62,
    0.001
  );

  controls.target.set(
    0,
    0,
    0
  );

  camera.lookAt(
    controls.target
  );

  controls.update();
}

function installEvents() {
  resizeObserver =
    new ResizeObserver(resizeViewport);

  resizeObserver.observe(viewport);

  gridOpacityInput?.addEventListener(
    "input",
    (event) => {
      const percentage =
        Number(event.target.value);

      setGridOpacity(
        percentage / 100
      );

      if (gridOpacityValue) {
        gridOpacityValue.textContent =
          `${percentage}%`;
      }
    }
  );

  groundOpacityInput?.addEventListener(
    "input",
    (event) => {
      const percentage =
        Number(event.target.value);

      setGroundOpacity(
        percentage / 100
      );

      if (groundOpacityValue) {
        groundOpacityValue.textContent =
          `${percentage}%`;
      }
    }
  );

  gridToggle?.addEventListener(
    "click",
    () => {
      setGridVisible(
        !state.gridVisible
      );
    }
  );

  panelToggle?.addEventListener(
    "click",
    () => {
      setPanelCollapsed(
        !state.panelCollapsed
      );
    }
  );

  resetViewButton?.addEventListener(
    "click",
    resetView
  );

  topViewButton?.addEventListener(
    "click",
    setTopView
  );

  window.addEventListener(
    "keydown",
    (event) => {
      const noModifier =
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;

      if (
        event.key.toLowerCase() === "r" &&
        noModifier
      ) {
        resetView();
      }
    }
  );

  window.addEventListener(
    "pagehide",
    cleanup,
    { once: true }
  );
}

function cleanup() {
  cancelAnimationFrame(animationFrame);

  resizeObserver?.disconnect();
  controls?.dispose();

  if (scene) {
    scene.traverse((object) => {
      object.geometry?.dispose?.();

      if (object.material) {
        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        for (const material of materials) {
          material.dispose?.();
        }
      }
    });
  }

  renderer?.dispose();
}

try {
  if (!viewport) {
    throw new Error(
      "No se encontró el área #viewport."
    );
  }

  if (!canUseWebGL()) {
    throw new Error(
      "Este navegador no pudo iniciar WebGL. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari."
    );
  }

  createScene();
} catch (error) {
  console.error(
    "[Resort Map Builder]",
    error
  );

  showFatalError(
    error instanceof Error
      ? error.message
      : "Ocurrió un error inesperado al iniciar el plano."
  );
}
