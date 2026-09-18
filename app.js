import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { PROP_CATALOG, createProp, updateParametricProp, disposePropLibrary } from "./props.js?v=6.1";
import { setupMobilePanels } from "./ui.js?v=6.1";
import { createPlacementController } from "./placement.js?v=6.1";
import { setupDesktopControls } from "./desktop-controls.js?v=6.1";
import {
  GRID_STEP,
  MAGNET_THRESHOLD,
  OBJECT_MAGNET_THRESHOLD,
  magnetizeXZ,
  snapObjectToObjects,
} from "./snap.js?v=6.1";
import { setupOneSidedScale } from "./scale-anchor.js?v=6.1";
import {
  createProjectDocument,
  validateProjectDocument,
  downloadProjectJson,
  readProjectJson,
} from "./project-io.js?v=6.1";

window.__RMB_READY__ = false;

// DOM
const viewport = document.querySelector("#viewport");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const selectionStatus = document.querySelector("#selectionStatus");
const objectCounterBadge = document.querySelector("#objectCounterBadge");

const selectionToolbar = document.querySelector("#selectionToolbar");
const quickSelectionName = document.querySelector("#quickSelectionName");
const quickLockButton = document.querySelector("#quickLock");
const quickLockIcon = document.querySelector("#quickLockIcon");
const quickLockText = document.querySelector("#quickLockText");
const quickAnchorScaleButton = document.querySelector("#quickAnchorScale");
const quickAnchorScaleText = document.querySelector("#quickAnchorScaleText");
const quickDuplicateButton = document.querySelector("#quickDuplicate");
const quickDeleteButton = document.querySelector("#quickDelete");

const placementToolbar = document.querySelector("#placementToolbar");
const placementLabel = document.querySelector("#placementLabel");
const placementCount = document.querySelector("#placementCount");
const placementFinishButton = document.querySelector("#placementFinish");

const desktopHelpToggle = document.querySelector("#desktopHelpToggle");
const desktopHelpPanel = document.querySelector("#desktopHelpPanel");
const desktopHelpClose = document.querySelector("#desktopHelpClose");

const snapToggle = document.querySelector("#snapToggle");
const objectSnapToggle = document.querySelector("#objectSnapToggle");
const saveProjectButton = document.querySelector("#saveProject");
const loadProjectButton = document.querySelector("#loadProject");
const projectFileInput = document.querySelector("#projectFileInput");
const projectMessage = document.querySelector("#projectMessage");

const fatalError = document.querySelector("#fatalError");
const fatalMessage = document.querySelector("#fatalMessage");

const libraryButtons = [...document.querySelectorAll("[data-create]")];
const sceneList = document.querySelector("#sceneList");
const objectCount = document.querySelector("#objectCount");

const emptyProperties = document.querySelector("#emptyProperties");
const propertiesContent = document.querySelector("#propertiesContent");
const propertiesKind = document.querySelector("#propertiesKind");
const propertiesTitle = document.querySelector("#propertiesTitle");
const objectNameInput = document.querySelector("#objectName");

const dimensionFields = document.querySelector("#dimensionFields");
const uniformSizeFields = document.querySelector("#uniformSizeFields");
const widthInput = document.querySelector("#objectWidth");
const heightInput = document.querySelector("#objectHeight");
const depthInput = document.querySelector("#objectDepth");
const uniformSizeInput = document.querySelector("#uniformSize");
const uniformSizeValue = document.querySelector("#uniformSizeValue");

const parametricFields = document.querySelector("#parametricFields");
const stairStepsInput = document.querySelector("#stairSteps");
const stairStepsValue = document.querySelector("#stairStepsValue");

const positionXInput = document.querySelector("#positionX");
const positionYInput = document.querySelector("#positionY");
const positionZInput = document.querySelector("#positionZ");
const positionXValue = document.querySelector("#positionXValue");
const positionYValue = document.querySelector("#positionYValue");
const positionZValue = document.querySelector("#positionZValue");
const positionYField = document.querySelector("#positionYField");

const objectOpacityInput = document.querySelector("#objectOpacity");
const objectOpacityValue = document.querySelector("#objectOpacityValue");
const lockedNote = document.querySelector("#lockedNote");

const rotationYInput = document.querySelector("#rotationY");

const duplicateButton = document.querySelector("#duplicateObject");
const deleteButton = document.querySelector("#deleteObject");
const modeButtons = [...document.querySelectorAll("[data-mode]")];

const perspectiveViewButton = document.querySelector("#perspectiveView");
const topViewButton = document.querySelector("#topView");
const resetViewButton = document.querySelector("#resetView");

const gridOpacityInput = document.querySelector("#gridOpacity");
const gridOpacityValue = document.querySelector("#gridOpacityValue");
const groundOpacityInput = document.querySelector("#groundOpacity");
const groundOpacityValue = document.querySelector("#groundOpacityValue");
const gridToggle = document.querySelector("#gridToggle");

const INITIAL_CAMERA = new THREE.Vector3(42, 36, 48);
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0);

const BUILDING_COLOR = 0xc9cbc8;
const BUILDING_EDGE_COLOR = 0x666a68;
const SELECTED_EDGE_COLOR = 0x171717;

const state = {
  objects: [],
  selected: null,
  transformMode: "translate",
  gridOpacity: 0.55,
  groundOpacity: 1,
  gridVisible: true,
  nextBuildingNumber: 1,
  nextPropNumbers: {},
  pointerDown: null,
  lastUniformScale: 1,
  viewMode: "perspective",
  snapEnabled: false,
  objectSnapEnabled: false,
  oneSidedScaleEnabled: false,
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
let mobilePanels;
let placementController;
let desktopControls;
let oneSidedScaleController;
let resizeObserver;
let animationFrame = 0;
let isPageVisible = true;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

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

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isEditingField() {
  const active = document.activeElement;
  return active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement;
}

function isUniformObject(object) {
  return object?.userData?.scalePolicy === "uniform";
}

function isBuilding(object) {
  return object?.userData?.editorType === "building";
}

function canMoveY(object) {
  return Boolean(
    isBuilding(object) ||
    object?.userData?.allowY
  );
}

function isParametricStairs(object) {
  return Boolean(
    object?.userData?.parametric === "stairs"
  );
}

function canUseOneSidedScale(object) {
  return Boolean(
    object &&
    !isLocked(object) &&
    !isUniformObject(object)
  );
}

function getBaseDimensionForAxis(object, axisKey) {
  if (isBuilding(object)) {
    return 1;
  }

  const base =
    object?.userData?.baseDimensions;

  return Math.max(
    0.0001,
    Number(base?.[axisKey]) || 1
  );
}

function isSurfaceLike(object) {
  return object?.userData?.propType === "path" ||
    object?.userData?.propType === "water";
}

function objectKindLabel(object) {
  if (!object) return "";
  if (isBuilding(object)) return "EDIFICIO";
  return (PROP_CATALOG[object.userData.propType]?.label || "PROP").toUpperCase();
}

function isLocked(object) {
  return Boolean(object?.userData?.locked);
}

function formatMeters(value) {
  const rounded = Math.round(value * 4) / 4;
  return `${rounded.toFixed(rounded % 1 === 0 ? 1 : 2)} m`;
}

function getObjectOpacity(object) {
  const value = Number(object?.userData?.opacity);
  return Number.isFinite(value) ? clamp(value, 0.15, 1) : 1;
}

function ensureLocalMaterials(object) {
  object.traverse((child) => {
    if (!child.material || child.userData.editorMaterialLocal) return;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => material.clone());
    } else {
      child.material = child.material.clone();
    }

    child.userData.editorMaterialLocal = true;
  });
}

function setObjectOpacity(object, value) {
  if (!object) return;

  const opacity = clamp(value, 0.15, 1);
  object.userData.opacity = opacity;

  ensureLocalMaterials(object);

  object.traverse((child) => {
    if (!child.material) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    for (const material of materials) {
      material.transparent = opacity < 0.999;
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.999;
      material.needsUpdate = true;
    }
  });
}

function setObjectLocked(object, locked) {
  if (!object) return;

  object.userData.locked = Boolean(locked);

  if (object === state.selected) {
    if (locked) {
      transformControls.detach();
    } else {
      transformControls.attach(object);
      configureTransformForSelection();
    }

    updateSelectionBox();
    updatePropertiesFromSelection();
  }

  refreshSceneList();
}

function toggleSelectedLock() {
  if (!state.selected) return;
  setObjectLocked(state.selected, !isLocked(state.selected));
}

function setProjectMessage(message, tone = "neutral") {
  if (!projectMessage) return;

  projectMessage.textContent = message;
  projectMessage.dataset.tone = tone;
}

function updateSnapUi() {
  snapToggle?.setAttribute(
    "aria-checked",
    String(state.snapEnabled)
  );

  if (snapToggle) {
    snapToggle.textContent =
      state.snapEnabled
        ? `Imán · ${GRID_STEP} m`
        : "Libre";
  }

  objectSnapToggle?.setAttribute(
    "aria-checked",
    String(state.objectSnapEnabled)
  );

  if (objectSnapToggle) {
    objectSnapToggle.textContent =
      state.objectSnapEnabled
        ? "Objetos"
        : "Apagado";
  }
}

function setSnapEnabled(enabled) {
  state.snapEnabled = Boolean(enabled);
  updateSnapUi();

  setProjectMessage(
    state.snapEnabled
      ? `Imán activado: se ajusta a líneas cada ${GRID_STEP} m al acercarte.`
      : "Movimiento libre activado.",
    "neutral"
  );
}

function setObjectSnapEnabled(enabled) {
  state.objectSnapEnabled = Boolean(enabled);
  updateSnapUi();

  setProjectMessage(
    state.objectSnapEnabled
      ? "Imán entre objetos activado."
      : "Imán entre objetos apagado.",
    "neutral"
  );
}

function updateOneSidedScaleUi() {
  const object = state.selected;
  const available =
    canUseOneSidedScale(object);

  quickAnchorScaleButton?.classList.toggle(
    "hidden",
    !available
  );

  quickAnchorScaleButton?.setAttribute(
    "aria-pressed",
    String(
      available &&
      state.oneSidedScaleEnabled
    )
  );

  if (quickAnchorScaleText) {
    quickAnchorScaleText.textContent =
      state.oneSidedScaleEnabled
        ? "Un lado ✓"
        : "Un lado";
  }
}

function setOneSidedScaleEnabled(enabled) {
  state.oneSidedScaleEnabled =
    Boolean(enabled);

  updateOneSidedScaleUi();
  oneSidedScaleController?.refreshMode();
}

function toggleOneSidedScale() {
  setOneSidedScaleEnabled(
    !state.oneSidedScaleEnabled
  );
}

function magnetizePointXZ(x, z) {
  return magnetizeXZ(
    x,
    z,
    {
      enabled: state.snapEnabled,
      step: GRID_STEP,
      threshold: MAGNET_THRESHOLD,
    }
  );
}

function applyMagnetToObject(
  object,
  {
    includeObjectSnap = false,
  } = {}
) {
  if (!object) {
    return;
  }

  if (state.snapEnabled) {
    const snapped = magnetizePointXZ(
      object.position.x,
      object.position.z
    );

    object.position.x = snapped.x;
    object.position.z = snapped.z;
  }

  if (
    state.objectSnapEnabled &&
    (
      includeObjectSnap ||
      state.transformMode === "translate"
    )
  ) {
    snapObjectToObjects(
      object,
      state.objects,
      {
        enabled: true,
        threshold:
          OBJECT_MAGNET_THRESHOLD,
      }
    );
  }
}

function serializeEditorObject(object) {
  return {
    editorType: isBuilding(object)
      ? "building"
      : "prop",
    propType: isBuilding(object)
      ? null
      : object.userData.propType,
    name: object.name,
    position: object.position.toArray(),
    scale: object.scale.toArray(),
    rotationY: object.rotation.y,
    locked: isLocked(object),
    opacity: getObjectOpacity(object),
    params:
      object.userData.params
        ? { ...object.userData.params }
        : null,
  };
}

function serializeProject() {
  return createProjectDocument({
    objects: state.objects.map(
      serializeEditorObject
    ),
    settings: {
      snapEnabled: state.snapEnabled,
      objectSnapEnabled: state.objectSnapEnabled,
      oneSidedScaleEnabled: state.oneSidedScaleEnabled,
      gridVisible: state.gridVisible,
      gridOpacity: state.gridOpacity,
      groundOpacity: state.groundOpacity,
      viewMode: state.viewMode,
    },
    camera: {
      position: camera.position.toArray(),
      target: mapControls.target.toArray(),
    },
  });
}

function disposeEditorObject(object) {
  scene.remove(object);

  object.traverse((child) => {
    if (isBuilding(object)) {
      child.geometry?.dispose?.();
    }

    if (
      child.material &&
      (
        isBuilding(object) ||
        child.userData.editorMaterialLocal
      )
    ) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        material.dispose?.();
      }
    }
  });
}

function clearEditorObjects() {
  transformControls.detach();
  removeSelectionBox();

  for (const object of state.objects) {
    disposeEditorObject(object);
  }

  state.objects = [];
  state.selected = null;
  state.nextBuildingNumber = 1;
  state.nextPropNumbers = {};

  refreshSceneList();
  updatePropertiesFromSelection();
}

function restoreProjectObject(record) {
  let object;

  if (record.editorType === "building") {
    object = createBuilding({
      name: record.name,
      width: 1,
      height: 1,
      depth: 1,
      x: record.position[0],
      y: record.position[1],
      z: record.position[2],
      rotationY: record.rotationY,
      select: false,
    });
  } else {
    object = createEditorProp(
      record.propType,
      {
        name: record.name,
        x: record.position[0],
        z: record.position[2],
        rotationY: record.rotationY,
        scale: 1,
        select: false,
      }
    );

    object.position.y =
      record.position[1];
  }

  if (
    record.params &&
    isParametricStairs(object)
  ) {
    updateParametricProp(
      object,
      record.params
    );
  }

  object.scale.set(
    record.scale[0],
    record.scale[1],
    record.scale[2]
  );

  object.userData.locked =
    record.locked;

  setObjectOpacity(
    object,
    record.opacity
  );

  return object;
}

function restoreProjectSettings(project) {
  state.gridOpacity =
    project.settings.gridOpacity;

  state.groundOpacity =
    project.settings.groundOpacity;

  setGridOpacity(
    state.gridOpacity
  );

  setGroundOpacity(
    state.groundOpacity
  );

  setGridVisible(
    project.settings.gridVisible
  );

  gridOpacityInput.value =
    String(
      Math.round(
        state.gridOpacity * 100
      )
    );

  gridOpacityValue.textContent =
    `${Math.round(state.gridOpacity * 100)}%`;

  groundOpacityInput.value =
    String(
      Math.round(
        state.groundOpacity * 100
      )
    );

  groundOpacityValue.textContent =
    `${Math.round(state.groundOpacity * 100)}%`;

  setSnapEnabled(
    project.settings.snapEnabled
  );

  setObjectSnapEnabled(
    project.settings.objectSnapEnabled
  );

  setOneSidedScaleEnabled(
    project.settings.oneSidedScaleEnabled
  );

  camera.position.fromArray(
    project.camera.position
  );

  mapControls.target.fromArray(
    project.camera.target
  );

  mapControls.update();

  setActiveViewButton(
    project.settings.viewMode
  );
}

function restoreProject(project) {
  if (placementController?.isActive()) {
    placementController.cancel();
    renderer.domElement.classList.remove(
      "placement-active"
    );
  }

  clearEditorObjects();

  for (const record of project.objects) {
    restoreProjectObject(record);
  }

  restoreProjectSettings(project);

  if (state.objects.length > 0) {
    selectObject(
      state.objects[
        state.objects.length - 1
      ]
    );
  } else {
    deselectObject();
  }

  refreshSceneList();
}

function saveProjectFile() {
  try {
    const project = serializeProject();

    downloadProjectJson(
      project,
      "resort.json"
    );

    setProjectMessage(
      `resort.json guardado · ${state.objects.length} objetos.`,
      "success"
    );
  } catch (error) {
    console.error(
      "[Resort Map Builder] Guardar:",
      error
    );

    setProjectMessage(
      error instanceof Error
        ? error.message
        : "No se pudo guardar el proyecto.",
      "error"
    );
  }
}

async function loadProjectFile(file) {
  try {
    const raw =
      await readProjectJson(file);

    const project =
      validateProjectDocument(
        raw,
        {
          knownPropTypes:
            Object.keys(PROP_CATALOG),
        }
      );

    restoreProject(project);

    setProjectMessage(
      `Proyecto cargado · ${project.objects.length} objetos.`,
      "success"
    );
  } catch (error) {
    console.error(
      "[Resort Map Builder] Cargar:",
      error
    );

    setProjectMessage(
      error instanceof Error
        ? error.message
        : "No se pudo cargar el proyecto.",
      "error"
    );
  } finally {
    if (projectFileInput) {
      projectFileInput.value = "";
    }
  }
}

function showFatalError(message) {
  if (fatalMessage) fatalMessage.textContent = message;
  fatalError?.classList.add("visible");
  if (statusText) statusText.textContent = "Error al iniciar";
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

  oneSidedScaleController =
    setupOneSidedScale({
      camera,
      element: renderer.domElement,
      getObject: () => state.selected,
      getMode: () => state.transformMode,
      isToggleEnabled: () =>
        state.oneSidedScaleEnabled,
      canAnchor:
        canUseOneSidedScale,
      getBaseDimension:
        getBaseDimensionForAxis,
    });

  resizeViewport();
  installEvents();
  mobilePanels = setupMobilePanels();

  placementController = createPlacementController({
    toolbar: placementToolbar,
    label: placementLabel,
    count: placementCount,
    finishButton: placementFinishButton,
    onFinish: ({ lastObject }) => {
      renderer.domElement.classList.remove("placement-active");

      if (lastObject && state.objects.includes(lastObject)) {
        selectObject(lastObject);
      } else {
        updatePropertiesFromSelection();
      }
    },
  });

  desktopControls = setupDesktopControls({
    camera,
    mapControls,
    resetView,
    isPlacementActive: () => placementController?.isActive() ?? false,
    isTransformDragging: () => transformControls?.dragging ?? false,
    isEditingField,
  });

  updateSnapUi();

  // Siempre aparece un objeto de prueba para comprobar que app.js sí cargó.
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
  if (statusText) statusText.textContent = "Constructor 3D funcionando";
  window.__RMB_READY__ = true;
  startAnimation();
}

function createLights() {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8c3ba, 2.15));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(22, 38, 26);
  scene.add(keyLight);
}

function createGround() {
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({
      color: 0xf8f8f4,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: state.groundOpacity,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
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
  transformHelper = transformControls.getHelper();
  scene.add(transformHelper);

  transformControls.addEventListener("mouseDown", () => {
    mapControls.enabled = false;

    oneSidedScaleController?.beginDrag(
      transformControls.axis
    );

    if (state.selected && isUniformObject(state.selected)) {
      state.lastUniformScale = state.selected.scale.x;
    }
  });

  transformControls.addEventListener("mouseUp", () => {
    mapControls.enabled = true;
    oneSidedScaleController?.endDrag();
  });

  transformControls.addEventListener("objectChange", () => {
    oneSidedScaleController?.apply();
    applySelectionConstraints();
    updateSelectionBox();
    updatePropertiesFromSelection();
  });
}

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
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: BUILDING_COLOR,
      roughness: 0.86,
      metalness: 0,
    })
  );

  object.userData.editorType = "building";
  object.userData.scalePolicy = "free";
  object.userData.locked = false;
  object.userData.opacity = 1;
  object.userData.id = makeId("building");
  object.name = name || `Edificio ${state.nextBuildingNumber++}`;
  object.scale.set(
    clamp(width, 0.2, 200),
    clamp(height, 0.2, 100),
    clamp(depth, 0.2, 200)
  );
  object.position.set(x, y, z);
  object.rotation.y = rotationY;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(object.geometry),
    new THREE.LineBasicMaterial({
      color: BUILDING_EDGE_COLOR,
      transparent: true,
      opacity: 0.42,
    })
  );
  edges.raycast = () => {};
  object.add(edges);

  scene.add(object);
  state.objects.push(object);
  refreshSceneList();

  if (select) selectObject(object);
  return object;
}

function nextPropName(type) {
  const current = (state.nextPropNumbers[type] || 0) + 1;
  state.nextPropNumbers[type] = current;
  return `${PROP_CATALOG[type]?.defaultName || "Prop"} ${current}`;
}

function createEditorProp(type, {
  x = 0,
  z = 0,
  rotationY = 0,
  scale = 1,
  select = true,
  name = null,
} = {}) {
  const object = createProp(type);
  object.userData.id = makeId(type);
  object.userData.locked = false;
  object.userData.opacity = 1;
  object.name = name || nextPropName(type);
  object.position.set(
    x,
    Number(object.userData.defaultY) || 0,
    z
  );
  object.rotation.y = rotationY;

  if (isUniformObject(object)) {
    object.scale.setScalar(clamp(scale, 0.25, 3));
  }

  scene.add(object);
  state.objects.push(object);
  refreshSceneList();
  if (select) selectObject(object);
  return object;
}

function placementTypeLabel(type) {
  if (type === "building") {
    return "Edificio";
  }

  return PROP_CATALOG[type]?.label || "Objeto";
}

function startPlacementMode(type) {
  if (!type) return;

  state.selected = null;
  transformControls.detach();
  removeSelectionBox();
  refreshSceneList();
  updatePropertiesFromSelection();

  placementController.start(
    type,
    placementTypeLabel(type)
  );

  renderer.domElement.classList.add("placement-active");
}

function createObjectAt(type, point, { select = false } = {}) {
  if (type === "building") {
    return createBuilding({
      x: point.x,
      y: 1.5,
      z: point.z,
      select,
    });
  }

  return createEditorProp(type, {
    x: point.x,
    z: point.z,
    select,
  });
}

function createFromLibrary(type) {
  startPlacementMode(type);
}

function selectObject(object) {
  if (!object || !state.objects.includes(object)) {
    deselectObject();
    return;
  }

  state.selected = object;

  if (isLocked(object)) {
    transformControls.detach();
  } else {
    transformControls.attach(object);
  }

  if (isUniformObject(object)) {
    state.lastUniformScale = object.scale.x;
  }

  configureTransformForSelection();
  createSelectionBox(object);
  refreshSceneList();
  updatePropertiesFromSelection();
}

function deselectObject() {
  state.selected = null;
  transformControls.detach();
  removeSelectionBox();
  refreshSceneList();
  updatePropertiesFromSelection();
}

function duplicateSelectedObject() {
  const source = state.selected;
  if (!source) return;

  if (isBuilding(source)) {
    return createBuilding({
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
  }

  const clone = createEditorProp(source.userData.propType, {
    name: `${source.name} copia`,
    x: source.position.x + 1.5,
    z: source.position.z + 1.5,
    rotationY: source.rotation.y,
    scale: isUniformObject(source) ? source.scale.x : 1,
    select: false,
  });

  clone.position.y = source.position.y;

  if (
    source.userData.params &&
    isParametricStairs(clone)
  ) {
    updateParametricProp(
      clone,
      source.userData.params
    );
  }

  if (!isUniformObject(source)) {
    clone.scale.copy(source.scale);
  }

  setObjectOpacity(
    clone,
    getObjectOpacity(source)
  );

  selectObject(clone);
  return clone;
}

function deleteSelectedObject() {
  const object = state.selected;
  if (!object) return;

  transformControls.detach();
  disposeEditorObject(object);

  state.objects = state.objects.filter((item) => item !== object);
  state.selected = null;
  removeSelectionBox();
  refreshSceneList();
  updatePropertiesFromSelection();
}

function createSelectionBox(object) {
  removeSelectionBox();
  selectionBox = new THREE.BoxHelper(object, SELECTED_EDGE_COLOR);
  if (selectionBox.material) {
    selectionBox.material.transparent = true;
    selectionBox.material.opacity = 0.92;
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
  if (!selectionBox) return;
  scene.remove(selectionBox);
  selectionBox.geometry?.dispose?.();
  selectionBox.material?.dispose?.();
  selectionBox = null;
}

function setTransformMode(mode) {
  if (!["translate", "rotate", "scale"].includes(mode)) return;

  if (placementController?.isActive()) {
    placementController.finish();
  }

  state.transformMode = mode;
  transformControls.setMode(mode);
  configureTransformForSelection();

  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === mode);
  }
}

function configureTransformForSelection() {
  const object = state.selected;
  transformControls.showX = true;
  transformControls.showY = true;
  transformControls.showZ = true;
  if (!object) return;

  if (isLocked(object)) {
    transformControls.detach();
    return;
  }

  if (transformControls.object !== object) {
    transformControls.attach(object);
  }

  const mode = state.transformMode;

  if (mode === "rotate") {
    transformControls.showX = false;
    transformControls.showY = true;
    transformControls.showZ = false;
    transformControls.setSpace("world");
    return;
  }

  if (mode === "translate") {
    if (!canMoveY(object)) {
      transformControls.showY = false;
    }

    transformControls.setSpace("world");
    return;
  }

  if (mode === "scale") {
    transformControls.setSpace("local");
    if (isSurfaceLike(object)) transformControls.showY = false;
  }
}

function applySelectionConstraints() {
  const object = state.selected;
  if (!object || isLocked(object)) return;

  // El plano mide 140 × 140 m, así que mantenemos X/Z
  // dentro de la retícula y sincronizados con los sliders.
  object.position.x = clamp(object.position.x, -70, 70);
  object.position.z = clamp(object.position.z, -70, 70);

  applyMagnetToObject(object);

  if (canMoveY(object)) {
    object.position.y = clamp(
      object.position.y,
      -5,
      40
    );
  } else {
    object.position.y = 0;
  }

  if (isUniformObject(object) && state.transformMode === "scale") {
    const previous = state.lastUniformScale;
    const candidates = [object.scale.x, object.scale.y, object.scale.z];
    let changed = candidates[0];
    let largestDelta = Math.abs(candidates[0] - previous);

    for (const candidate of candidates.slice(1)) {
      const delta = Math.abs(candidate - previous);
      if (delta > largestDelta) {
        largestDelta = delta;
        changed = candidate;
      }
    }

    const uniform = clamp(Math.abs(changed), 0.25, 3);
    object.scale.setScalar(uniform);
    state.lastUniformScale = uniform;
  }

  if (!isUniformObject(object)) {
    object.scale.x = clamp(Math.abs(object.scale.x), 0.05, 200);
    object.scale.y = clamp(Math.abs(object.scale.y), 0.02, 100);
    object.scale.z = clamp(Math.abs(object.scale.z), 0.05, 200);
  }
}

function refreshSceneList() {
  sceneList.replaceChildren();

  for (const object of state.objects) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `scene-row${object === state.selected ? " selected" : ""}`;

    const icon = document.createElement("span");
    icon.className = "scene-icon";
    icon.textContent = isBuilding(object)
      ? "B"
      : (PROP_CATALOG[object.userData.propType]?.label || "P").slice(0, 1);

    const name = document.createElement("span");
    name.className = "scene-name";
    name.textContent = object.name;

    const type = document.createElement("span");
    type.className = "scene-type";
    type.textContent = isBuilding(object)
      ? "edif."
      : PROP_CATALOG[object.userData.propType]?.label.toLowerCase() || "prop";

    if (isLocked(object)) {
      type.textContent = "🔒";
      type.title = "Bloqueado";
    }

    row.append(icon, name, type);
    row.addEventListener("click", () => {
      if (placementController?.isActive()) {
        placementController.finish();
      }

      selectObject(object);

      if (mobilePanels?.isMobile()) {
        mobilePanels.closePanels();
      }
    });
    sceneList.appendChild(row);
  }

  objectCount.textContent = String(state.objects.length);
  objectCounterBadge.textContent =
    `${state.objects.length} ${state.objects.length === 1 ? "objeto" : "objetos"}`;

  if (state.objects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-properties";
    empty.textContent = "La escena está vacía.";
    sceneList.appendChild(empty);
  }
}

function updatePropertiesFromSelection() {
  const object = state.selected;
  const hasSelection = Boolean(object);

  emptyProperties.classList.toggle("hidden", hasSelection);
  propertiesContent.classList.toggle("hidden", !hasSelection);

  const showSelectionToolbar =
    hasSelection && !placementController?.isActive();

  selectionToolbar.classList.toggle(
    "hidden",
    !showSelectionToolbar
  );

  if (!object) {
    propertiesKind.textContent = "SELECCIÓN";
    propertiesTitle.textContent = "Sin selección";
    selectionStatus.textContent = "Ningún objeto seleccionado";
    updateOneSidedScaleUi();
    parametricFields.classList.add("hidden");
    return;
  }

  const locked = isLocked(object);

  quickSelectionName.textContent = object.name;
  quickLockButton.setAttribute("aria-pressed", String(locked));
  quickLockButton.classList.toggle("locked", locked);
  quickLockIcon.textContent = locked ? "🔒" : "🔓";
  quickLockText.textContent = locked ? "Desbloquear" : "Bloquear";

  propertiesKind.textContent = objectKindLabel(object);
  propertiesTitle.textContent = object.name;
  selectionStatus.textContent = `${object.name} seleccionado`;
  objectNameInput.value = object.name;

  const uniform = isUniformObject(object);
  const stairs = isParametricStairs(object);

  dimensionFields.classList.toggle("hidden", uniform);
  uniformSizeFields.classList.toggle("hidden", !uniform);
  parametricFields.classList.toggle("hidden", !stairs);

  if (stairs) {
    const steps =
      Number(object.userData.params?.steps) || 10;

    stairStepsInput.value =
      String(steps);

    stairStepsValue.textContent =
      String(steps);
  }

  if (uniform) {
    const percentage = Math.round(object.scale.x * 100);
    uniformSizeInput.value = String(clamp(percentage, 25, 300));
    uniformSizeValue.textContent = `${percentage}%`;
  } else {
    const dimensions = getEditableDimensions(object);
    widthInput.value = round2(dimensions.x);
    heightInput.value = round2(dimensions.y);
    depthInput.value = round2(dimensions.z);
  }

  positionXInput.value = String(clamp(object.position.x, -70, 70));
  positionYInput.value = String(clamp(object.position.y, -5, 40));
  positionZInput.value = String(clamp(object.position.z, -70, 70));

  positionXValue.textContent = formatMeters(object.position.x);
  positionYValue.textContent = formatMeters(object.position.y);
  positionZValue.textContent = formatMeters(object.position.z);

  const movableY = canMoveY(object);
  positionYField.classList.toggle(
    "hidden",
    !movableY
  );
  positionYInput.disabled =
    !movableY || locked;

  updateOneSidedScaleUi();

  const opacityPercent = Math.round(getObjectOpacity(object) * 100);
  objectOpacityInput.value = String(opacityPercent);
  objectOpacityValue.textContent = `${opacityPercent}%`;

  rotationYInput.value = round2(degrees(object.rotation.y));

  const geometryControls = [
    widthInput,
    heightInput,
    depthInput,
    uniformSizeInput,
    stairStepsInput,
    positionXInput,
    positionYInput,
    positionZInput,
    rotationYInput,
  ];

  for (const control of geometryControls) {
    if (control) {
      control.disabled =
        locked ||
        (
          control === positionYInput &&
          !movableY
        );
    }
  }

  lockedNote.classList.toggle("hidden", !locked);
}

function getEditableDimensions(object) {
  if (isBuilding(object)) return object.scale;
  const base = object.userData.baseDimensions || { x: 1, y: 1, z: 1 };
  return {
    x: base.x * object.scale.x,
    y: base.y * object.scale.y,
    z: base.z * object.scale.z,
  };
}

function setEditableDimensions(object, width, height, depth) {
  if (isBuilding(object)) {
    object.scale.set(width, height, depth);
    return;
  }

  const base = object.userData.baseDimensions || { x: 1, y: 1, z: 1 };
  object.scale.set(width / base.x, height / base.y, depth / base.z);
}

function applyDimensionsFromInputs() {
  const object = state.selected;
  if (!object || isLocked(object) || isUniformObject(object)) return;

  const current = getEditableDimensions(object);
  const width = clamp(numberOrFallback(widthInput.value, current.x), 0.1, 200);
  const height = clamp(numberOrFallback(heightInput.value, current.y), 0.02, 100);
  const depth = clamp(numberOrFallback(depthInput.value, current.z), 0.1, 200);

  setEditableDimensions(object, width, height, depth);
  updateSelectionBox();
  updatePropertiesFromSelection();
}

function applyPositionFromSliders() {
  const object = state.selected;
  if (!object || isLocked(object)) return;

  object.position.x = clamp(
    numberOrFallback(positionXInput.value, object.position.x),
    -70,
    70
  );

  object.position.z = clamp(
    numberOrFallback(positionZInput.value, object.position.z),
    -70,
    70
  );

  object.position.y = canMoveY(object)
    ? clamp(
        numberOrFallback(positionYInput.value, object.position.y),
        -5,
        40
      )
    : 0;

  applyMagnetToObject(
    object,
    {
      includeObjectSnap: true,
    }
  );

  positionXInput.value =
    String(object.position.x);

  positionZInput.value =
    String(object.position.z);

  positionXValue.textContent = formatMeters(object.position.x);
  positionYValue.textContent = formatMeters(object.position.y);
  positionZValue.textContent = formatMeters(object.position.z);

  updateSelectionBox();
}

function applyRotationFromInput() {
  const object = state.selected;
  if (!object || isLocked(object)) return;

  const angle = clamp(
    numberOrFallback(rotationYInput.value, degrees(object.rotation.y)),
    -360,
    360
  );
  object.rotation.y = radians(angle);
  updateSelectionBox();
  updatePropertiesFromSelection();
}

function applyUniformSize(percentage) {
  const object = state.selected;
  if (!object || isLocked(object) || !isUniformObject(object)) return;

  const scale = clamp(percentage / 100, 0.25, 3);
  object.scale.setScalar(scale);
  state.lastUniformScale = scale;
  uniformSizeValue.textContent = `${Math.round(scale * 100)}%`;
  updateSelectionBox();
}

function applyStairSteps(value) {
  const object = state.selected;

  if (
    !object ||
    isLocked(object) ||
    !isParametricStairs(object)
  ) {
    return;
  }

  const steps = clamp(
    Math.round(Number(value) || 10),
    3,
    30
  );

  const opacity =
    getObjectOpacity(object);

  updateParametricProp(
    object,
    { steps }
  );

  setObjectOpacity(
    object,
    opacity
  );

  stairStepsInput.value =
    String(steps);

  stairStepsValue.textContent =
    String(steps);

  updateSelectionBox();
}

function pointerToNdc(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function editorRootFromHit(object) {
  let current = object;
  while (current) {
    if (state.objects.includes(current)) return current;

    if (
      current.userData?.editorRoot &&
      state.objects.includes(current.userData.editorRoot)
    ) {
      return current.userData.editorRoot;
    }

    current = current.parent;
  }
  return null;
}

function groundPointFromEvent(event) {
  pointerToNdc(event);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObject(ground, false);

  if (!hits.length) {
    return null;
  }

  const point = hits[0].point.clone();
  point.x = clamp(point.x, -70, 70);
  point.z = clamp(point.z, -70, 70);

  const snapped =
    magnetizePointXZ(
      point.x,
      point.z
    );

  point.x = snapped.x;
  point.z = snapped.z;
  point.y = 0;

  return point;
}

function placeCurrentType(event) {
  if (!placementController?.isActive()) {
    return false;
  }

  const point = groundPointFromEvent(event);

  if (!point) {
    return true;
  }

  const type = placementController.getType();
  const object = createObjectAt(
    type,
    point,
    { select: false }
  );

  applyMagnetToObject(
    object,
    {
      includeObjectSnap: true,
    }
  );

  placementController.record(object);

  state.selected = object;
  transformControls.detach();
  createSelectionBox(object);
  refreshSceneList();
  updatePropertiesFromSelection();

  return true;
}

function pickObject(event) {
  if (transformControls.axis) return;

  pointerToNdc(event);
  raycaster.setFromCamera(pointer, camera);

  const intersections = raycaster.intersectObjects(state.objects, true);
  for (const intersection of intersections) {
    const root = editorRootFromHit(intersection.object);
    if (root) {
      selectObject(root);
      return;
    }
  }
  deselectObject();
}

function setActiveViewButton(mode) {
  state.viewMode = mode;
  perspectiveViewButton.classList.toggle("active", mode === "perspective");
  topViewButton.classList.toggle("active", mode === "top");
}

function setPerspectiveView() {
  camera.position.copy(INITIAL_CAMERA);
  mapControls.target.copy(INITIAL_TARGET);
  camera.lookAt(mapControls.target);
  mapControls.update();
  setActiveViewButton("perspective");
}

function setTopView() {
  camera.position.set(0.001, 62, 0.001);
  mapControls.target.set(0, 0, 0);
  camera.lookAt(mapControls.target);
  mapControls.update();
  setActiveViewButton("top");
}

function resetView() {
  if (state.viewMode === "top") {
    setTopView();
  } else {
    setPerspectiveView();
  }
}

function setGridOpacity(value) {
  state.gridOpacity = value;
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of materials) material.opacity = value;
}

function setGroundOpacity(value) {
  state.groundOpacity = value;
  ground.material.opacity = value;
}

function setGridVisible(visible) {
  state.gridVisible = visible;
  grid.visible = visible;
  gridToggle.setAttribute("aria-checked", String(visible));
}

function installEvents() {
  resizeObserver = new ResizeObserver(resizeViewport);
  resizeObserver.observe(viewport);

  // En PC el botón derecho rota la cámara. Evitamos el menú contextual.
  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    state.pointerDown = { x: event.clientX, y: event.clientY };
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

    if (moved <= 5) {
      if (!placeCurrentType(event)) {
        pickObject(event);
      }
    }
  });

  for (const button of libraryButtons) {
    button.addEventListener("click", () => {
      createFromLibrary(button.dataset.create);

      if (mobilePanels?.isMobile()) {
        mobilePanels.closePanels();
      }
    });
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => setTransformMode(button.dataset.mode));
  }

  objectNameInput.addEventListener("input", () => {
    if (!state.selected) return;
    const value = objectNameInput.value.trim();
    if (!value) return;

    state.selected.name = value;
    propertiesTitle.textContent = value;
    selectionStatus.textContent = `${value} seleccionado`;
    refreshSceneList();
  });

  for (const input of [widthInput, heightInput, depthInput]) {
    input.addEventListener("change", applyDimensionsFromInputs);
  }

  for (const input of [positionXInput, positionYInput, positionZInput]) {
    input.addEventListener("input", applyPositionFromSliders);
  }

  rotationYInput.addEventListener("change", applyRotationFromInput);

  uniformSizeInput.addEventListener("input", (event) => {
    applyUniformSize(Number(event.target.value));
  });

  stairStepsInput.addEventListener(
    "input",
    (event) => {
      applyStairSteps(
        Number(event.target.value)
      );
    }
  );

  duplicateButton.addEventListener("click", duplicateSelectedObject);
  deleteButton.addEventListener("click", deleteSelectedObject);

  quickLockButton.addEventListener("click", toggleSelectedLock);
  quickAnchorScaleButton.addEventListener(
    "click",
    toggleOneSidedScale
  );
  quickDuplicateButton.addEventListener("click", duplicateSelectedObject);
  quickDeleteButton.addEventListener("click", deleteSelectedObject);

  objectOpacityInput.addEventListener("input", (event) => {
    if (!state.selected) return;

    const percentage = Number(event.target.value);
    setObjectOpacity(state.selected, percentage / 100);
    objectOpacityValue.textContent = `${percentage}%`;
  });

  perspectiveViewButton.addEventListener("click", setPerspectiveView);
  topViewButton.addEventListener("click", setTopView);
  resetViewButton.addEventListener("click", resetView);

  desktopHelpToggle?.addEventListener("click", () => {
    const hidden = desktopHelpPanel.classList.toggle("hidden");
    desktopHelpToggle.setAttribute("aria-expanded", String(!hidden));
  });

  desktopHelpClose?.addEventListener("click", () => {
    desktopHelpPanel.classList.add("hidden");
    desktopHelpToggle.setAttribute("aria-expanded", "false");
  });

  snapToggle?.addEventListener(
    "click",
    () => {
      setSnapEnabled(
        !state.snapEnabled
      );
    }
  );

  objectSnapToggle?.addEventListener(
    "click",
    () => {
      setObjectSnapEnabled(
        !state.objectSnapEnabled
      );
    }
  );

  saveProjectButton?.addEventListener(
    "click",
    () => {
      saveProjectFile();

      if (mobilePanels?.isMobile()) {
        mobilePanels.closePanels();
      }
    }
  );

  loadProjectButton?.addEventListener(
    "click",
    () => {
      projectFileInput?.click();
    }
  );

  projectFileInput?.addEventListener(
    "change",
    async () => {
      const file =
        projectFileInput.files?.[0];

      if (!file) return;

      await loadProjectFile(file);

      if (mobilePanels?.isMobile()) {
        mobilePanels.closePanels();
      }
    }
  );

  gridOpacityInput.addEventListener("input", (event) => {
    const percentage = Number(event.target.value);
    setGridOpacity(percentage / 100);
    gridOpacityValue.textContent = `${percentage}%`;
  });

  groundOpacityInput.addEventListener("input", (event) => {
    const percentage = Number(event.target.value);
    setGroundOpacity(percentage / 100);
    groundOpacityValue.textContent = `${percentage}%`;
  });

  gridToggle.addEventListener("click", () => {
    setGridVisible(!state.gridVisible);
  });

  window.addEventListener("keydown", (event) => {
    if (isEditingField()) return;
    const key = event.key.toLowerCase();

    if (key === "w") setTransformMode("translate");
    if (key === "e") setTransformMode("rotate");
    if (key === "r") setTransformMode("scale");
    if (key === "escape") {
      if (placementController?.isActive()) {
        placementController.finish();
      } else {
        deselectObject();
      }
    }

    if ((event.key === "Delete" || event.key === "Backspace") && state.selected) {
      event.preventDefault();
      deleteSelectedObject();
    }

    if ((event.ctrlKey || event.metaKey) && key === "d" && state.selected) {
      event.preventDefault();
      duplicateSelectedObject();
    }
  });

  document.addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden;
    if (isPageVisible && !animationFrame) startAnimation();
  });

  window.addEventListener("pagehide", cleanup, { once: true });
}

function resizeViewport() {
  if (!renderer || !camera || !viewport) return;

  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function startAnimation() {
  if (animationFrame) return;

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
  desktopControls?.dispose?.();
  oneSidedScaleController?.dispose?.();
  mapControls?.dispose();
  transformControls?.dispose();

  for (const object of state.objects) {
    disposeEditorObject(object);
  }

  ground?.geometry?.dispose?.();
  ground?.material?.dispose?.();

  const gridMaterials =
    grid && Array.isArray(grid.material)
      ? grid.material
      : grid?.material
        ? [grid.material]
        : [];

  for (const material of gridMaterials) material.dispose?.();

  disposePropLibrary();
  renderer?.dispose();
}

try {
  if (!viewport) throw new Error("No se encontró el área de trabajo 3D.");

  if (!canUseWebGL()) {
    throw new Error(
      "Este navegador no pudo iniciar WebGL. Usa una versión reciente de Safari, Chrome, Edge o Firefox."
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
