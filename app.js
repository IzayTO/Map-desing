import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { PROP_CATALOG, createProp, updateParametricProp, disposePropLibrary } from "./props.js?v=6.4";
import { setupMobilePanels } from "./ui.js?v=6.4";
import { createPlacementController } from "./placement.js?v=6.4";
import { setupDesktopControls } from "./desktop-controls.js?v=6.4";
import {
  GRID_STEP,
  MAGNET_THRESHOLD,
  OBJECT_MAGNET_THRESHOLD,
  magnetizeXZ,
  snapObjectToObjects,
} from "./snap.js?v=6.4";
import { setupOneSidedScale } from "./scale-anchor.js?v=6.4";
import {
  createProjectDocument,
  validateProjectDocument,
  downloadProjectJson,
  readProjectJson,
} from "./project-io.js?v=6.4";

window.__RMB_READY__ = false;

// DOM
const viewport = document.querySelector("#viewport");
const alignmentGuideX = document.querySelector("#alignmentGuideX");
const alignmentGuideZ = document.querySelector("#alignmentGuideZ");
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
const groundSnapToggle = document.querySelector("#groundSnapToggle");
const loadReferenceImageButton = document.querySelector("#loadReferenceImage");
const clearReferenceImageButton = document.querySelector("#clearReferenceImage");
const referenceImageInput = document.querySelector("#referenceImageInput");
const referenceVisibleToggle = document.querySelector("#referenceVisibleToggle");
const referenceOpacityInput = document.querySelector("#referenceOpacity");
const referenceOpacityValue = document.querySelector("#referenceOpacityValue");
const referenceWidthInput = document.querySelector("#referenceWidth");
const referenceWidthValue = document.querySelector("#referenceWidthValue");
const referenceHeightInput = document.querySelector("#referenceHeight");
const referenceHeightValue = document.querySelector("#referenceHeightValue");
const referenceFitContainButton = document.querySelector("#referenceFitContain");
const referenceFillPlaneButton = document.querySelector("#referenceFillPlane");
const referenceResetSizeButton = document.querySelector("#referenceResetSize");
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
  snapEnabled: true,
  snapThreshold: 0.3,
  objectSnapEnabled: true,
  objectSnapThreshold: 0.3,
  groundSnapEnabled: true,
  groundSnapThreshold: 0.15,
  oneSidedScaleEnabled: false,
  referenceImage: {
    dataUrl: null,
    opacity: 0.55,
    visible: true,
    width: 140,
    height: 140,
    aspectRatio: 1,
  },
};

let scene;
let camera;
let renderer;
let mapControls;
let transformControls;
let transformHelper;
let ground;
let referencePlane;
let referenceTexture;
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
const REFERENCE_PLANE_SIZE = 140;

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


function formatThresholdLabel(value, off = "Apagado") {
  const n = Number(value) || 0;
  return n <= 0 ? off : `${n.toFixed(2)} m`;
}

function hideAlignmentGuides() {
  alignmentGuideX?.classList.add("hidden");
  alignmentGuideZ?.classList.add("hidden");
}

function projectWorldToViewport(vector) {
  const rect = renderer.domElement.getBoundingClientRect();
  const projected = vector.clone().project(camera);
  return {
    x: ((projected.x + 1) * 0.5) * rect.width,
    y: ((1 - projected.y) * 0.5) * rect.height,
  };
}

function showAlignmentGuides(object, snapResult) {
  if (!object || !snapResult || (!snapResult.snappedX && !snapResult.snappedZ)) {
    hideAlignmentGuides();
    return;
  }

  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const point = projectWorldToViewport(center);

  if (snapResult.snappedX && alignmentGuideX) {
    alignmentGuideX.style.left = `${point.x}px`;
    alignmentGuideX.classList.remove('hidden');
  } else {
    alignmentGuideX?.classList.add('hidden');
  }

  if (snapResult.snappedZ && alignmentGuideZ) {
    alignmentGuideZ.style.top = `${point.y}px`;
    alignmentGuideZ.classList.remove('hidden');
  } else {
    alignmentGuideZ?.classList.add('hidden');
  }
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
  if (snapToggle) {
    snapToggle.value = String(state.snapEnabled ? state.snapThreshold : 0);
  }

  if (objectSnapToggle) {
    objectSnapToggle.value = String(
      state.objectSnapEnabled ? state.objectSnapThreshold : 0
    );
  }

  if (groundSnapToggle) {
    groundSnapToggle.value = String(
      state.groundSnapEnabled ? state.groundSnapThreshold : 0
    );
  }
}

function setSnapEnabled(enabled, threshold = state.snapThreshold) {
  state.snapEnabled = Boolean(enabled);
  state.snapThreshold = state.snapEnabled
    ? clamp(Number(threshold) || 0.3, 0.05, 2)
    : 0;
  updateSnapUi();
  updateReferenceUi();
  hideAlignmentGuides();

  setProjectMessage(
    state.snapEnabled
      ? `Imán de cuadrícula activado · alcance ${formatThresholdLabel(state.snapThreshold, 'Libre')}.`
      : "Imán de cuadrícula apagado.",
    "neutral"
  );
}

function setObjectSnapEnabled(enabled, threshold = state.objectSnapThreshold) {
  state.objectSnapEnabled = Boolean(enabled);
  state.objectSnapThreshold = state.objectSnapEnabled
    ? clamp(Number(threshold) || 0.3, 0.05, 2)
    : 0;
  updateSnapUi();
  updateReferenceUi();
  hideAlignmentGuides();

  setProjectMessage(
    state.objectSnapEnabled
      ? `Imán entre objetos activado · alcance ${formatThresholdLabel(state.objectSnapThreshold, 'Apagado')}.`
      : "Imán entre objetos apagado.",
    "neutral"
  );
}

function setGroundSnapEnabled(enabled, threshold = state.groundSnapThreshold) {
  state.groundSnapEnabled = Boolean(enabled);
  state.groundSnapThreshold = state.groundSnapEnabled
    ? clamp(Number(threshold) || 0.15, 0.01, 2)
    : 0;
  updateSnapUi();
  updateReferenceUi();
  hideAlignmentGuides();

  setProjectMessage(
    state.groundSnapEnabled
      ? `Atracción al suelo activada · alcance ${formatThresholdLabel(state.groundSnapThreshold, 'Apagado')}.`
      : 'Atracción al suelo apagada.',
    'neutral'
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
      threshold: state.snapThreshold || MAGNET_THRESHOLD,
    }
  );
}

function applyGroundSnapToObject(object) {
  if (!object || !canMoveY(object)) {
    return false;
  }

  if (
    state.groundSnapEnabled &&
    Math.abs(object.position.y) <= (state.groundSnapThreshold || 0)
  ) {
    object.position.y = 0;
    return true;
  }

  return false;
}

function applyMagnetToObject(
  object,
  {
    includeObjectSnap = false,
  } = {}
) {
  if (!object) {
    hideAlignmentGuides();
    return {
      snappedX: false,
      snappedZ: false,
    };
  }

  if (state.snapEnabled) {
    const snapped = magnetizePointXZ(
      object.position.x,
      object.position.z
    );

    object.position.x = snapped.x;
    object.position.z = snapped.z;
  }

  let snapResult = {
    snappedX: false,
    snappedZ: false,
  };

  if (
    state.objectSnapEnabled &&
    (
      includeObjectSnap ||
      state.transformMode === "translate" ||
      state.transformMode === "scale"
    )
  ) {
    snapResult = snapObjectToObjects(
      object,
      state.objects,
      {
        enabled: true,
        threshold:
          state.objectSnapThreshold || OBJECT_MAGNET_THRESHOLD,
      }
    );
  }

  showAlignmentGuides(object, snapResult);
  return snapResult;
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
      snapThreshold: state.snapThreshold,
      objectSnapEnabled: state.objectSnapEnabled,
      objectSnapThreshold: state.objectSnapThreshold,
      groundSnapEnabled: state.groundSnapEnabled,
      groundSnapThreshold: state.groundSnapThreshold,
      oneSidedScaleEnabled: state.oneSidedScaleEnabled,
      gridVisible: state.gridVisible,
      gridOpacity: state.gridOpacity,
      groundOpacity: state.groundOpacity,
      viewMode: state.viewMode,
      referenceImage: {
        dataUrl: state.referenceImage.dataUrl,
        visible: state.referenceImage.visible,
        opacity: state.referenceImage.opacity,
        width: state.referenceImage.width,
        height: state.referenceImage.height,
        aspectRatio: state.referenceImage.aspectRatio,
      },
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
    project.settings.snapEnabled,
    project.settings.snapThreshold
  );

  setObjectSnapEnabled(
    project.settings.objectSnapEnabled,
    project.settings.objectSnapThreshold
  );

  setGroundSnapEnabled(
    project.settings.groundSnapEnabled,
    project.settings.groundSnapThreshold
  );

  setOneSidedScaleEnabled(
    project.settings.oneSidedScaleEnabled
  );

  state.referenceImage = {
    dataUrl:
      project.settings.referenceImage?.dataUrl || null,
    visible:
      project.settings.referenceImage?.visible !== false,
    opacity:
      project.settings.referenceImage?.opacity ?? 0.55,
    width:
      project.settings.referenceImage?.width ?? REFERENCE_PLANE_SIZE,
    height:
      project.settings.referenceImage?.height ?? REFERENCE_PLANE_SIZE,
    aspectRatio:
      project.settings.referenceImage?.aspectRatio ?? 1,
  };

  if (state.referenceImage.dataUrl) {
    loadReferenceTextureFromDataUrl(
      state.referenceImage.dataUrl,
      { preserveCurrentSize: true }
    ).catch((error) => {
      console.error('[Resort Map Builder] Imagen guía:', error);
    });
  } else {
    clearReferenceImage();
  }

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
  updateReferenceUi();
  hideAlignmentGuides();

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

  referencePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: state.referenceImage.opacity,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  referencePlane.rotation.x = -Math.PI / 2;
  referencePlane.position.y = -0.008;
  referencePlane.renderOrder = 1;
  referencePlane.raycast = () => {};
  scene.add(referencePlane);
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
  mapControls.maxDistance = 320;
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
  hideAlignmentGuides();
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

  applyMagnetToObject(object, {
    includeObjectSnap:
      state.transformMode === 'translate' ||
      state.transformMode === 'scale',
  });

  if (canMoveY(object)) {
    object.position.y = clamp(
      object.position.y,
      -5,
      40
    );

    applyGroundSnapToObject(object);
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
    hideAlignmentGuides();
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
  applySelectionConstraints();
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

  applyGroundSnapToObject(object);

  positionXInput.value =
    String(object.position.x);

  positionZInput.value =
    String(object.position.z);

  if (canMoveY(object)) {
    positionYInput.value = String(object.position.y);
  }

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
  applySelectionConstraints();
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

  applySelectionConstraints();

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
  camera.position.set(0.001, 92, 0.001);
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


function computeReferenceFitSize(aspectRatio = 1) {
  const safeAspect = Math.max(0.05, Number(aspectRatio) || 1);

  if (safeAspect >= 1) {
    return {
      width: REFERENCE_PLANE_SIZE,
      height: round2(REFERENCE_PLANE_SIZE / safeAspect),
    };
  }

  return {
    width: round2(REFERENCE_PLANE_SIZE * safeAspect),
    height: REFERENCE_PLANE_SIZE,
  };
}

function applyReferenceImageGeometry() {
  if (!referencePlane) return;

  const width = clamp(
    numberOrFallback(state.referenceImage.width, REFERENCE_PLANE_SIZE),
    5,
    REFERENCE_PLANE_SIZE
  );
  const height = clamp(
    numberOrFallback(state.referenceImage.height, REFERENCE_PLANE_SIZE),
    5,
    REFERENCE_PLANE_SIZE
  );

  state.referenceImage.width = width;
  state.referenceImage.height = height;

  referencePlane.scale.set(
    width / REFERENCE_PLANE_SIZE,
    height / REFERENCE_PLANE_SIZE,
    1
  );
}

function fitReferenceImageToPlane() {
  const fitted = computeReferenceFitSize(state.referenceImage.aspectRatio);
  state.referenceImage.width = fitted.width;
  state.referenceImage.height = fitted.height;
  applyReferenceImageGeometry();
  updateReferenceUi();
}

function fillReferenceImageToPlane() {
  state.referenceImage.width = REFERENCE_PLANE_SIZE;
  state.referenceImage.height = REFERENCE_PLANE_SIZE;
  applyReferenceImageGeometry();
  updateReferenceUi();
}

function updateReferenceUi() {
  if (referenceVisibleToggle) {
    referenceVisibleToggle.setAttribute(
      "aria-checked",
      String(Boolean(state.referenceImage.visible))
    );

    referenceVisibleToggle.textContent =
      state.referenceImage.visible
        ? "Visible"
        : "Oculta";
  }

  if (referenceOpacityInput) {
    referenceOpacityInput.value = String(
      Math.round((state.referenceImage.opacity || 0) * 100)
    );
  }

  if (referenceOpacityValue) {
    referenceOpacityValue.textContent = `${Math.round((state.referenceImage.opacity || 0) * 100)}%`;
  }

  if (referenceWidthInput) {
    referenceWidthInput.value = String(
      clamp(numberOrFallback(state.referenceImage.width, REFERENCE_PLANE_SIZE), 5, REFERENCE_PLANE_SIZE)
    );
  }

  if (referenceWidthValue) {
    referenceWidthValue.textContent = `${clamp(numberOrFallback(state.referenceImage.width, REFERENCE_PLANE_SIZE), 5, REFERENCE_PLANE_SIZE).toFixed(2)} m`;
  }

  if (referenceHeightInput) {
    referenceHeightInput.value = String(
      clamp(numberOrFallback(state.referenceImage.height, REFERENCE_PLANE_SIZE), 5, REFERENCE_PLANE_SIZE)
    );
  }

  if (referenceHeightValue) {
    referenceHeightValue.textContent = `${clamp(numberOrFallback(state.referenceImage.height, REFERENCE_PLANE_SIZE), 5, REFERENCE_PLANE_SIZE).toFixed(2)} m`;
  }
}

function applyReferenceImageState() {
  if (!referencePlane) return;

  const shouldShow = Boolean(
    state.referenceImage.dataUrl && state.referenceImage.visible
  );

  applyReferenceImageGeometry();
  referencePlane.visible = shouldShow;
  referencePlane.material.visible = shouldShow;
  referencePlane.material.opacity = state.referenceImage.opacity;
  referencePlane.material.needsUpdate = true;
  updateReferenceUi();
}

function clearReferenceImage() {
  if (referenceTexture) {
    referenceTexture.dispose?.();
    referenceTexture = null;
  }

  if (referencePlane?.material?.map) {
    referencePlane.material.map = null;
  }

  state.referenceImage.dataUrl = null;
  state.referenceImage.visible = true;
  state.referenceImage.opacity = 0.55;
  state.referenceImage.aspectRatio = 1;
  state.referenceImage.width = REFERENCE_PLANE_SIZE;
  state.referenceImage.height = REFERENCE_PLANE_SIZE;
  applyReferenceImageState();
}

async function readImageFileAsDataUrl(file) {
  if (!(file instanceof File)) {
    throw new Error('Selecciona una imagen.');
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error('La imagen supera el límite de 12 MB.');
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function loadReferenceTextureFromDataUrl(dataUrl, { preserveCurrentSize = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) {
      clearReferenceImage();
      resolve();
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(
      dataUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;

        if (referenceTexture) {
          referenceTexture.dispose?.();
        }

        const image = texture.image || {};
        const widthPx = numberOrFallback(image.width, 1);
        const heightPx = numberOrFallback(image.height, 1);
        const aspectRatio = Math.max(0.05, widthPx / Math.max(1, heightPx));

        referenceTexture = texture;
        referencePlane.material.map = texture;
        referencePlane.material.needsUpdate = true;

        state.referenceImage.dataUrl = dataUrl;
        state.referenceImage.aspectRatio = aspectRatio;

        if (!preserveCurrentSize) {
          const fitted = computeReferenceFitSize(aspectRatio);
          state.referenceImage.width = fitted.width;
          state.referenceImage.height = fitted.height;
        } else {
          state.referenceImage.width = clamp(
            numberOrFallback(state.referenceImage.width, computeReferenceFitSize(aspectRatio).width),
            5,
            REFERENCE_PLANE_SIZE
          );
          state.referenceImage.height = clamp(
            numberOrFallback(state.referenceImage.height, computeReferenceFitSize(aspectRatio).height),
            5,
            REFERENCE_PLANE_SIZE
          );
        }

        applyReferenceImageState();
        resolve();
      },
      undefined,
      () => reject(new Error('No se pudo cargar la imagen guía.'))
    );
  });
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
    "change",
    () => {
      const value = Number(snapToggle.value) || 0;
      setSnapEnabled(value > 0, value);
    }
  );

  objectSnapToggle?.addEventListener(
    "change",
    () => {
      const value = Number(objectSnapToggle.value) || 0;
      setObjectSnapEnabled(value > 0, value);
    }
  );

  groundSnapToggle?.addEventListener(
    "change",
    () => {
      const value = Number(groundSnapToggle.value) || 0;
      setGroundSnapEnabled(value > 0, value);
    }
  );

  referenceVisibleToggle?.addEventListener('click', () => {
    state.referenceImage.visible = !state.referenceImage.visible;
    applyReferenceImageState();
  });

  referenceOpacityInput?.addEventListener('input', (event) => {
    const percentage = Number(event.target.value);
    state.referenceImage.opacity = percentage / 100;
    if (referencePlane) {
      referencePlane.material.opacity = state.referenceImage.opacity;
    }
    updateReferenceUi();
  });

  referenceWidthInput?.addEventListener('input', (event) => {
    state.referenceImage.width = clamp(Number(event.target.value) || REFERENCE_PLANE_SIZE, 5, REFERENCE_PLANE_SIZE);
    applyReferenceImageGeometry();
    updateReferenceUi();
  });

  referenceHeightInput?.addEventListener('input', (event) => {
    state.referenceImage.height = clamp(Number(event.target.value) || REFERENCE_PLANE_SIZE, 5, REFERENCE_PLANE_SIZE);
    applyReferenceImageGeometry();
    updateReferenceUi();
  });

  referenceFitContainButton?.addEventListener('click', () => {
    fitReferenceImageToPlane();
    setProjectMessage('Imagen guía encajada respetando su proporción.', 'success');
  });

  referenceFillPlaneButton?.addEventListener('click', () => {
    fillReferenceImageToPlane();
    setProjectMessage('Imagen guía estirada para llenar todo el plano.', 'success');
  });

  referenceResetSizeButton?.addEventListener('click', () => {
    fitReferenceImageToPlane();
    setProjectMessage('Imagen guía restaurada a su tamaño proporcional.', 'neutral');
  });

  loadReferenceImageButton?.addEventListener('click', () => {
    referenceImageInput?.click();
  });

  clearReferenceImageButton?.addEventListener('click', () => {
    clearReferenceImage();
    setProjectMessage('Imagen guía retirada.', 'neutral');
  });

  referenceImageInput?.addEventListener('change', async () => {
    const file = referenceImageInput.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      await loadReferenceTextureFromDataUrl(dataUrl);
      setProjectMessage('Imagen guía visible · ajustada al plano completo.', 'success');
    } catch (error) {
      console.error('[Resort Map Builder] Imagen guía:', error);
      setProjectMessage(error instanceof Error ? error.message : 'No se pudo cargar la imagen guía.', 'error');
    } finally {
      referenceImageInput.value = '';
    }
  });

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
  referencePlane?.geometry?.dispose?.();
  referenceTexture?.dispose?.();
  referencePlane?.material?.dispose?.();

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
