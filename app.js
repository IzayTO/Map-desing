import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

// --------------------------------------------------
// DOM
// --------------------------------------------------

const viewport = document.querySelector("#viewport");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const selectionStatus = document.querySelector("#selectionStatus");

const fatalError = document.querySelector("#fatalError");
const fatalMessage = document.querySelector("#fatalMessage");

const buildingList = document.querySelector("#buildingList");
const buildingCount = document.querySelector("#buildingCount");
const addBuildingButton = document.querySelector("#addBuilding");

const emptyProperties = document.querySelector("#emptyProperties");
const propertiesContent = document.querySelector("#propertiesContent");
const propertiesTitle = document.querySelector("#propertiesTitle");

const buildingNameInput = document.querySelector("#buildingName");
const widthInput = document.querySelector("#buildingWidth");
const heightInput = document.querySelector("#buildingHeight");
const depthInput = document.querySelector("#buildingDepth");

const positionXInput = document.querySelector("#positionX");
const positionYInput = document.querySelector("#positionY");
const positionZInput = document.querySelector("#positionZ");
const rotationYInput = document.querySelector("#rotationY");

const duplicateButton = document.querySelector("#duplicateBuilding");
const deleteButton = document.querySelector("#deleteBuilding");

const modeButtons = [...document.querySelectorAll("[data-mode]")];

const gridOpacityInput = document.querySelector("#gridOpacity");
const gridOpacityValue = document.querySelector("#gridOpacityValue");
const gridToggle = document.querySelector("#gridToggle");

const resetViewButton = document.querySelector("#resetView");
const topViewButton = document.querySelector("#topView");

// --------------------------------------------------
// CONSTANTES / ESTADO
// --------------------------------------------------

const INITIAL_CAMERA = new THREE.Vector3(42, 36, 48);
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0);

const BUILDING_COLOR = 0xd9d2c5;
const BUILDING_EDGE_COLOR = 0x716d66;
const SELECTED_EDGE_COLOR = 0x171717;

const state = {
  buildings: [],
  selected: null,
  transformMode: "translate",
  gridOpacity: 0.55,
  gridVisible: true,
  nextBuildingNumber: 1,
  pointerDown: null,
};

let scene;
let camera;
let renderer;
let mapControls;
let transformControls;
let transformHelper;
let ground;
let grid;
let selectionBox;

let resizeObserver;
let animationFrame = 0;
let isPageVisible = true;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOrFallback(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function degrees(rad) {
  return THREE.MathUtils.radToDeg(rad);
}

function radians(deg) {
  return THREE.MathUtils.degToRad(deg);
}

function isEditingField() {
  const active = document.activeElement;

  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  );
}

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

    return Boolean(
      (window.WebGL2RenderingContext && canvas.getContext("webgl2")) ||
      (window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
    );
  } catch {
    return false;
  }
}

// --------------------------------------------------
// ESCENA
// --------------------------------------------------

function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xedede7);

  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
  camera.position.copy(INITIAL_CAMERA);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  viewport.appendChild(renderer.domElement);

  createLights();
  createGround();
  createGrid();
  createOriginMarker();
  createMapControls();
  createTransformControls();

  resizeViewport();
  installEvents();

  // Un edificio inicial para poder comprobar inmediatamente la Parte 3.
  createBuilding({
    name: "Edificio 1",
    width: 8,
    height: 3,
    depth: 6,
    x: 0,
    y: 1.5,
    z: 0,
    select: true,
  });

  state.nextBuildingNumber = 2;

  statusDot?.classList.add("ready");

  if (statusText) {
    statusText.textContent = "Constructor 3D funcionando";
  }

  startAnimation();
}

function createLights() {
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xc8c3ba, 2.15);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(22, 38, 26);
  scene.add(keyLight);
}

function createGround() {
  const geometry = new THREE.PlaneGeometry(140, 140);

  const material = new THREE.MeshStandardMaterial({
    color: 0xf8f8f4,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.name = "Ground";

  scene.add(ground);
}

function createGrid() {
  grid = new THREE.GridHelper(140, 70, 0x777777, 0xc7c7c1);

  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];

  for (const material of materials) {
    material.transparent = true;
    material.opacity = state.gridOpacity;
    material.depthWrite = false;
  }

  grid.visible = state.gridVisible;
  scene.add(grid);
}

function createOriginMarker() {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.43, 40),
    new THREE.MeshBasicMaterial({
      color: 0x222222,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );

  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.018;

  scene.add(marker);
}

function createMapControls() {
  mapControls = new MapControls(camera, renderer.domElement);

  mapControls.enableDamping = true;
  mapControls.dampingFactor = 0.075;

  mapControls.enablePan = true;
  mapControls.enableRotate = true;
  mapControls.enableZoom = true;
  mapControls.zoomToCursor = true;

  mapControls.panSpeed = 0.95;
  mapControls.rotateSpeed = 0.58;
  mapControls.zoomSpeed = 0.8;

  mapControls.minDistance = 7;
  mapControls.maxDistance = 180;

  mapControls.minPolarAngle = Math.PI * 0.055;
  mapControls.maxPolarAngle = Math.PI * 0.495;

  mapControls.target.copy(INITIAL_TARGET);
  mapControls.update();
}

function createTransformControls() {
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode(state.transformMode);
  transformControls.setSize(0.92);

  // En r186 el elemento visual se obtiene con getHelper().
  transformHelper = transformControls.getHelper();
  scene.add(transformHelper);

  transformControls.addEventListener("mouseDown", () => {
    mapControls.enabled = false;
  });

  transformControls.addEventListener("mouseUp", () => {
    mapControls.enabled = true;
  });

  transformControls.addEventListener("objectChange", () => {
    normalizeSelectedScale();
    updateSelectionBox();
    updatePropertiesFromSelection();
  });
}

// --------------------------------------------------
// EDIFICIOS
// --------------------------------------------------

function createBuilding({
  name,
  width = 6,
  height = 3,
  depth = 5,
  x = 0,
  y = height / 2,
  z = 0,
  rotationY = 0,
  select = true,
} = {}) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  const material = new THREE.MeshStandardMaterial({
    color: BUILDING_COLOR,
    roughness: 0.86,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.scale.set(
    clamp(width, 0.2, 140),
    clamp(height, 0.2, 80),
    clamp(depth, 0.2, 140)
  );

  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;

  const buildingName = name || `Edificio ${state.nextBuildingNumber++}`;

  mesh.name = buildingName;
  mesh.userData.type = "building";
  mesh.userData.id =
    `building-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  addPermanentEdges(mesh);

  scene.add(mesh);
  state.buildings.push(mesh);

  renderBuildingList();

  if (select) {
    selectBuilding(mesh);
  }

  return mesh;
}

function addPermanentEdges(mesh) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({
      color: BUILDING_EDGE_COLOR,
      transparent: true,
      opacity: 0.42,
    })
  );

  edges.name = "BuildingEdges";
  edges.raycast = () => {};
  mesh.add(edges);
}

function duplicateSelectedBuilding() {
  if (!state.selected) {
    return;
  }

  const source = state.selected;

  const clone = createBuilding({
    name: `${source.name} copia`,
    width: source.scale.x,
    height: source.scale.y,
    depth: source.scale.z,
    x: source.position.x + 2,
    y: source.position.y,
    z: source.position.z + 2,
    rotationY: source.rotation.y,
    select: true,
  });

  return clone;
}

function deleteSelectedBuilding() {
  const building = state.selected;

  if (!building) {
    return;
  }

  transformControls.detach();

  scene.remove(building);

  building.traverse((object) => {
    object.geometry?.dispose?.();

    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        material.dispose?.();
      }
    }
  });

  state.buildings = state.buildings.filter((item) => item !== building);
  state.selected = null;

  removeSelectionBox();
  renderBuildingList();
  updatePropertiesFromSelection();
}

function selectBuilding(building) {
  if (!building || !state.buildings.includes(building)) {
    deselectBuilding();
    return;
  }

  state.selected = building;

  transformControls.attach(building);
  createSelectionBox(building);

  renderBuildingList();
  updatePropertiesFromSelection();
}

function deselectBuilding() {
  state.selected = null;

  transformControls.detach();
  removeSelectionBox();

  renderBuildingList();
  updatePropertiesFromSelection();
}

function createSelectionBox(building) {
  removeSelectionBox();

  selectionBox = new THREE.BoxHelper(building, SELECTED_EDGE_COLOR);

  if (selectionBox.material) {
    selectionBox.material.transparent = true;
    selectionBox.material.opacity = 0.9;
    selectionBox.material.depthTest = false;
  }

  selectionBox.renderOrder = 999;
  selectionBox.raycast = () => {};

  scene.add(selectionBox);
}

function updateSelectionBox() {
  selectionBox?.update();
}

function removeSelectionBox() {
  if (!selectionBox) {
    return;
  }

  scene.remove(selectionBox);
  selectionBox.geometry?.dispose?.();
  selectionBox.material?.dispose?.();
  selectionBox = null;
}

function normalizeSelectedScale() {
  const building = state.selected;

  if (!building) {
    return;
  }

  building.scale.x = clamp(Math.abs(building.scale.x), 0.2, 140);
  building.scale.y = clamp(Math.abs(building.scale.y), 0.2, 80);
  building.scale.z = clamp(Math.abs(building.scale.z), 0.2, 140);
}

// --------------------------------------------------
// LISTA / PROPIEDADES
// --------------------------------------------------

function renderBuildingList() {
  buildingList.replaceChildren();

  for (const building of state.buildings) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      `object-row${building === state.selected ? " selected" : ""}`;

    button.dataset.id = building.userData.id;
    button.setAttribute("aria-label", `Seleccionar ${building.name}`);

    const icon = document.createElement("span");
    icon.className = "object-cube";
    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "object-name";
    label.textContent = building.name;

    button.append(icon, label);

    button.addEventListener("click", () => {
      selectBuilding(building);
    });

    buildingList.appendChild(button);
  }

  buildingCount.textContent = String(state.buildings.length);

  if (state.buildings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-properties";
    empty.textContent = "Todavía no hay edificios.";
    buildingList.appendChild(empty);
  }
}

function updatePropertiesFromSelection() {
  const building = state.selected;
  const hasSelection = Boolean(building);

  emptyProperties.classList.toggle("hidden", hasSelection);
  propertiesContent.classList.toggle("hidden", !hasSelection);

  if (!building) {
    propertiesTitle.textContent = "Sin selección";
    selectionStatus.textContent = "Ningún edificio seleccionado";
    return;
  }

  propertiesTitle.textContent = building.name;
  selectionStatus.textContent = `${building.name} seleccionado`;

  buildingNameInput.value = building.name;

  widthInput.value = round2(building.scale.x);
  heightInput.value = round2(building.scale.y);
  depthInput.value = round2(building.scale.z);

  positionXInput.value = round2(building.position.x);
  positionYInput.value = round2(building.position.y);
  positionZInput.value = round2(building.position.z);

  rotationYInput.value = round2(degrees(building.rotation.y));
}

function applyDimensionsFromInputs() {
  const building = state.selected;

  if (!building) {
    return;
  }

  const width = clamp(
    numberOrFallback(widthInput.value, building.scale.x),
    0.2,
    140
  );

  const height = clamp(
    numberOrFallback(heightInput.value, building.scale.y),
    0.2,
    80
  );

  const depth = clamp(
    numberOrFallback(depthInput.value, building.scale.z),
    0.2,
    140
  );

  building.scale.set(width, height, depth);

  updateSelectionBox();
  updatePropertiesFromSelection();
}

function applyPositionFromInputs() {
  const building = state.selected;

  if (!building) {
    return;
  }

  building.position.set(
    clamp(numberOrFallback(positionXInput.value, building.position.x), -200, 200),
    clamp(numberOrFallback(positionYInput.value, building.position.y), -50, 100),
    clamp(numberOrFallback(positionZInput.value, building.position.z), -200, 200)
  );

  updateSelectionBox();
  updatePropertiesFromSelection();
}

function applyRotationFromInput() {
  const building = state.selected;

  if (!building) {
    return;
  }

  const angle = clamp(
    numberOrFallback(rotationYInput.value, degrees(building.rotation.y)),
    -360,
    360
  );

  building.rotation.y = radians(angle);

  updateSelectionBox();
  updatePropertiesFromSelection();
}

// --------------------------------------------------
// MODOS DE TRANSFORMACIÓN
// --------------------------------------------------

function setTransformMode(mode) {
  if (!["translate", "rotate", "scale"].includes(mode)) {
    return;
  }

  state.transformMode = mode;
  transformControls.setMode(mode);

  // Para edificios nos interesa trabajar respecto a sus propios ejes
  // al escalar, y respecto al mundo al moverlos.
  transformControls.setSpace(mode === "scale" ? "local" : "world");

  for (const button of modeButtons) {
    button.classList.toggle(
      "active",
      button.dataset.mode === mode
    );
  }
}

// --------------------------------------------------
// SELECCIÓN CON CLIC
// --------------------------------------------------

function pointerToNdc(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x =
    ((event.clientX - rect.left) / rect.width) * 2 - 1;

  pointer.y =
    -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickBuilding(event) {
  // Si el puntero está sobre un eje del manipulador,
  // TransformControls debe recibir el clic y no la selección.
  if (transformControls.axis) {
    return;
  }

  pointerToNdc(event);

  raycaster.setFromCamera(pointer, camera);

  const intersections =
    raycaster.intersectObjects(state.buildings, false);

  if (intersections.length > 0) {
    selectBuilding(intersections[0].object);
  } else {
    deselectBuilding();
  }
}

// --------------------------------------------------
// VISTA
// --------------------------------------------------

function resetView() {
  camera.position.copy(INITIAL_CAMERA);
  mapControls.target.copy(INITIAL_TARGET);
  mapControls.update();
}

function setTopView() {
  camera.position.set(0.001, 62, 0.001);
  mapControls.target.set(0, 0, 0);
  camera.lookAt(mapControls.target);
  mapControls.update();
}

function setGridOpacity(value) {
  state.gridOpacity = value;

  const materials =
    Array.isArray(grid.material)
      ? grid.material
      : [grid.material];

  for (const material of materials) {
    material.opacity = value;
  }
}

function setGridVisible(visible) {
  state.gridVisible = visible;
  grid.visible = visible;

  gridToggle.setAttribute(
    "aria-checked",
    String(visible)
  );
}

// --------------------------------------------------
// EVENTOS
// --------------------------------------------------

function installEvents() {
  resizeObserver = new ResizeObserver(resizeViewport);
  resizeObserver.observe(viewport);

  renderer.domElement.addEventListener("pointerdown", (event) => {
    state.pointerDown = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (!state.pointerDown || transformControls.dragging) {
      state.pointerDown = null;
      return;
    }

    const dx = event.clientX - state.pointerDown.x;
    const dy = event.clientY - state.pointerDown.y;
    const moved = Math.hypot(dx, dy);

    state.pointerDown = null;

    // Solo consideramos selección cuando fue realmente un clic/tap,
    // no después de arrastrar la cámara.
    if (moved <= 5) {
      pickBuilding(event);
    }
  });

  addBuildingButton.addEventListener("click", () => {
    const offset = state.buildings.length * 1.25;

    createBuilding({
      width: 6,
      height: 3,
      depth: 5,
      x: clamp(offset, -25, 25),
      y: 1.5,
      z: clamp(offset, -25, 25),
      select: true,
    });
  });

  duplicateButton.addEventListener("click", duplicateSelectedBuilding);
  deleteButton.addEventListener("click", deleteSelectedBuilding);

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      setTransformMode(button.dataset.mode);
    });
  }

  buildingNameInput.addEventListener("input", () => {
    if (!state.selected) {
      return;
    }

    const value = buildingNameInput.value.trim();

    if (value) {
      state.selected.name = value;
      propertiesTitle.textContent = value;
      selectionStatus.textContent = `${value} seleccionado`;
      renderBuildingList();
    }
  });

  for (const input of [widthInput, heightInput, depthInput]) {
    input.addEventListener("change", applyDimensionsFromInputs);
  }

  for (const input of [positionXInput, positionYInput, positionZInput]) {
    input.addEventListener("change", applyPositionFromInputs);
  }

  rotationYInput.addEventListener("change", applyRotationFromInput);

  gridOpacityInput.addEventListener("input", (event) => {
    const percentage = Number(event.target.value);
    setGridOpacity(percentage / 100);
    gridOpacityValue.textContent = `${percentage}%`;
  });

  gridToggle.addEventListener("click", () => {
    setGridVisible(!state.gridVisible);
  });

  resetViewButton.addEventListener("click", resetView);
  topViewButton.addEventListener("click", setTopView);

  window.addEventListener("keydown", (event) => {
    if (isEditingField()) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "w") {
      setTransformMode("translate");
    }

    if (key === "e") {
      setTransformMode("rotate");
    }

    if (key === "r") {
      setTransformMode("scale");
    }

    if (key === "escape") {
      deselectBuilding();
    }

    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      state.selected
    ) {
      event.preventDefault();
      deleteSelectedBuilding();
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      key === "d" &&
      state.selected
    ) {
      event.preventDefault();
      duplicateSelectedBuilding();
    }
  });

  document.addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden;

    if (isPageVisible && !animationFrame) {
      startAnimation();
    }
  });

  window.addEventListener("pagehide", cleanup, { once: true });
}

// --------------------------------------------------
// RENDER
// --------------------------------------------------

function resizeViewport() {
  if (!renderer || !camera || !viewport) {
    return;
  }

  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);

  renderer.setSize(width, height, false);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function startAnimation() {
  if (animationFrame) {
    return;
  }

  const loop = () => {
    if (!isPageVisible) {
      animationFrame = 0;
      return;
    }

    animationFrame = requestAnimationFrame(loop);

    mapControls.update();
    selectionBox?.update();

    renderer.render(scene, camera);
  };

  animationFrame = requestAnimationFrame(loop);
}

function cleanup() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  resizeObserver?.disconnect();
  mapControls?.dispose();
  transformControls?.dispose();

  scene?.traverse((object) => {
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

  renderer?.dispose();
}

// --------------------------------------------------
// INICIO
// --------------------------------------------------

try {
  if (!viewport) {
    throw new Error("No se encontró el área de trabajo 3D.");
  }

  if (!canUseWebGL()) {
    throw new Error(
      "Este navegador no pudo iniciar WebGL. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari."
    );
  }

  createScene();
} catch (error) {
  console.error("[Resort Map Builder]", error);

  showFatalError(
    error instanceof Error
      ? error.message
      : "Ocurrió un error inesperado al iniciar el constructor."
  );
}
