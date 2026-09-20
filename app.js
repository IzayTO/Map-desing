import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { PROP_CATALOG, createProp, updateParametricProp, disposePropLibrary } from "./props.js?v=8.0.0";
import { setupMobilePanels } from "./ui.js?v=8.0.0";
import { createPlacementController } from "./placement.js?v=8.0.0";
import { setupDesktopControls } from "./desktop-controls.js?v=8.0.0";
import {
  GRID_STEP,
  MAGNET_THRESHOLD,
  OBJECT_MAGNET_THRESHOLD,
  magnetizeXZ,
  snapObjectToObjects,
} from "./snap.js?v=8.0.0";
import { setupOneSidedScale } from "./scale-anchor.js?v=8.2.0";
import {
  createProjectDocument,
  validateProjectDocument,
  downloadProjectJson,
  readProjectJson,
} from "./project-io.js?v=8.2.0";
import { createAxisOverlay } from "./axis-overlay.js?v=8.2.0";
import { createPlacesManager } from "./places.js?v=8.0.0";
import { createRouteEditor } from "./route-editor.js?v=8.2.0";

window.__RMB_READY__ = false;

// DOM
const viewport = document.querySelector("#viewport");
const workspace = document.querySelector(".workspace");
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

const rotationXInput = document.querySelector("#rotationX");
const rotationYInput = document.querySelector("#rotationY");
const rotationZInput = document.querySelector("#rotationZ");
const mirrorXButton = document.querySelector("#mirrorX");
const mirrorYButton = document.querySelector("#mirrorY");
const mirrorZButton = document.querySelector("#mirrorZ");
const mirrorQuickToolbar = document.querySelector("#mirrorQuickToolbar");
const rotationAxisToolbar = document.querySelector("#rotationAxisToolbar");
const rotationAxisButtons = [...document.querySelectorAll("[data-rotation-axis]")];

const duplicateButton = document.querySelector("#duplicateObject");
const deleteButton = document.querySelector("#deleteObject");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const editSectionButtons = [...document.querySelectorAll("[data-edit-section]")];
const objectEditorSection = document.querySelector("#objectEditorSection");
const placesEditorSection = document.querySelector("#placesEditorSection");
const routesEditorSection = document.querySelector("#routesEditorSection");
const mobileUndoButton = document.querySelector("#mobileUndo");
const mobileRedoButton = document.querySelector("#mobileRedo");
const specialModeToolbar = document.querySelector("#specialModeToolbar");
const specialModeText = document.querySelector("#specialModeText");
const specialModeCancelButton = document.querySelector("#specialModeCancel");

const multiSelectStartButton = document.querySelector("#multiSelectStart");
const multiSelectionProperties = document.querySelector("#multiSelectionProperties");
const multiSelectionCount = document.querySelector("#multiSelectionCount");
const multiSelectionLockedCount = document.querySelector("#multiSelectionLockedCount");
const multiOpacityInput = document.querySelector("#multiOpacity");
const multiOpacityValue = document.querySelector("#multiOpacityValue");
const multiSelectionClearButton = document.querySelector("#multiSelectionClear");
const multiOutlineToggle = document.querySelector("#multiOutlineToggle");
const multiOutlineStrengthInput = document.querySelector("#multiOutlineStrength");
const multiOutlineStrengthValue = document.querySelector("#multiOutlineStrengthValue");
const multiOutlineApplies = document.querySelector("#multiOutlineApplies");
const familySelect = document.querySelector("#familySelect");


let positionXNumberInput = null;
let positionYNumberInput = null;
let positionZNumberInput = null;
let historyUndoButton = null;
let historyRedoButton = null;
let outlineControlsWrap = null;
let objectOutlineToggle = null;
let objectOutlineStrengthInput = null;
let objectOutlineStrengthValue = null;
let axisLabelsToggle = null;
let compassToggle = null;
let compassCanvas = null;
let compassCtx = null;

const perspectiveViewButton = document.querySelector("#perspectiveView");
const topViewButton = document.querySelector("#topView");
const resetViewButton = document.querySelector("#resetView");
const mobileResetViewButton = document.querySelector("#mobileResetView");

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
  showAxisLabels: true,
  showCompass: true,
  history: [],
  historyIndex: -1,
  historyMuted: false,
  pendingTransformChange: false,
  ctrlRotationSnap: false,
  rotationAxes: { x: false, y: true, z: false },
  editSection: "objects",
  multiSelected: [],
  multiSelectCollecting: false,
  multiScaleSnapshot: null,
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
let axisOverlay;
let placesManager;
let routeEditor;
let multiScaleProxy;
let overlayDirty = true;
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

function updateCtrlRotationSnap(enabled) {
  state.ctrlRotationSnap = Boolean(enabled);

  if (!transformControls) return;

  transformControls.setRotationSnap(
    state.ctrlRotationSnap
      ? THREE.MathUtils.degToRad(45)
      : null
  );
}

function isCtrlRotationSnapActive() {
  return Boolean(
    state.ctrlRotationSnap &&
    state.transformMode === "rotate"
  );
}

function ensureMirrorState(object) {
  if (!object) return { x: false, y: false, z: false };
  const current = object.userData.mirror;
  object.userData.mirror = {
    x: Boolean(current?.x),
    y: Boolean(current?.y),
    z: Boolean(current?.z),
  };
  return object.userData.mirror;
}

function mirrorSign(object, axis) {
  return ensureMirrorState(object)[axis] ? -1 : 1;
}

function applyScaleMagnitudes(object, x, y, z) {
  object.scale.set(
    Math.max(0.0001, Math.abs(x)) * mirrorSign(object, "x"),
    Math.max(0.0001, Math.abs(y)) * mirrorSign(object, "y"),
    Math.max(0.0001, Math.abs(z)) * mirrorSign(object, "z")
  );
}

function updateMirrorUi() {
  const multi = isMultiSelectionReady();
  const targets = multi
    ? state.multiSelected
    : (state.selected ? [state.selected] : []);

  const showQuickMirrors = Boolean(
    targets.length &&
    state.editSection === "objects" &&
    !state.multiSelectCollecting &&
    (multi || state.transformMode === "translate") &&
    !placementController?.isActive()
  );

  mirrorQuickToolbar?.classList.toggle("hidden", !showQuickMirrors);
  workspace?.classList.toggle("mirror-tools-active", showQuickMirrors);

  for (const [axis, button] of [["x", mirrorXButton], ["y", mirrorYButton], ["z", mirrorZButton]]) {
    if (!button) continue;
    const values = targets.map((object) => Boolean(ensureMirrorState(object)[axis]));
    const allActive = values.length > 0 && values.every(Boolean);
    const someActive = values.some(Boolean) && !allActive;
    const editable = targets.some((object) => !isLocked(object));

    button.setAttribute("aria-pressed", String(allActive));
    button.classList.toggle("active", allActive);
    button.classList.toggle("mixed", someActive);
    button.disabled = !targets.length || !editable;
  }
}

function mirrorSelectedObject(axis) {
  if (!["x", "y", "z"].includes(axis)) return;

  if (isMultiSelectionReady()) {
    const targets = state.multiSelected.filter((object) => !isLocked(object));
    if (!targets.length) return;

    const targetState = !targets.every(
      (object) => Boolean(ensureMirrorState(object)[axis])
    );

    for (const object of targets) {
      const before = new THREE.Box3().setFromObject(object);
      const mirror = ensureMirrorState(object);
      mirror[axis] = targetState;

      applyScaleMagnitudes(
        object,
        Math.abs(object.scale.x),
        Math.abs(object.scale.y),
        Math.abs(object.scale.z)
      );
      object.updateMatrixWorld(true);

      if (axis === "y") {
        const after = new THREE.Box3().setFromObject(object);
        if (Number.isFinite(before.min.y) && Number.isFinite(after.min.y)) {
          object.position.y += before.min.y - after.min.y;
        }
      }

      applyObjectOutlineStyle(object, true);
    }

    positionMultiScaleProxy();
    configureMultiScaleTransform();
    updateMultiSelectionUi();
    recordHistory(`Espejo ${axis.toUpperCase()} múltiple`);
    return;
  }

  const object = state.selected;
  if (!object || isLocked(object)) return;

  const before = new THREE.Box3().setFromObject(object);
  const mirror = ensureMirrorState(object);
  mirror[axis] = !mirror[axis];

  applyScaleMagnitudes(
    object,
    Math.abs(object.scale.x),
    Math.abs(object.scale.y),
    Math.abs(object.scale.z)
  );
  object.updateMatrixWorld(true);

  if (axis === "y") {
    const after = new THREE.Box3().setFromObject(object);
    if (Number.isFinite(before.min.y) && Number.isFinite(after.min.y)) {
      object.position.y += before.min.y - after.min.y;
    }
  }

  applySelectionConstraints();
  applyObjectOutlineStyle(object, true);
  updateSelectionBox();
  updatePropertiesFromSelection();
  recordHistory(`Espejo ${axis.toUpperCase()}`);
}

function updateRotationAxisUi() {
  const show = Boolean(
    state.selected &&
    !state.multiSelectCollecting &&
    !hasMultiSelection() &&
    !isLocked(state.selected) &&
    state.editSection === "objects" &&
    state.transformMode === "rotate"
  );

  rotationAxisToolbar?.classList.toggle("hidden", !show);
  workspace?.classList.toggle("rotation-axes-active", show);

  if (show) {
    mirrorQuickToolbar?.classList.add("hidden");
    workspace?.classList.remove("mirror-tools-active");
  }

  for (const button of rotationAxisButtons) {
    const axis = String(button.dataset.rotationAxis || "").toLowerCase();
    const enabled = Boolean(state.rotationAxes[axis]);
    button.setAttribute("aria-pressed", String(enabled));
    button.classList.toggle("active", enabled);
  }
}

function toggleRotationAxis(axis) {
  const key = String(axis || "").toLowerCase();
  if (!["x", "y", "z"].includes(key)) return;
  state.rotationAxes[key] = !state.rotationAxes[key];
  configureTransformForSelection();
  updateRotationAxisUi();
}

function hasMultiSelection() {
  return Array.isArray(state.multiSelected) && state.multiSelected.length > 0;
}

function isMultiSelected(object) {
  return Boolean(object && state.multiSelected.includes(object));
}

function isMultiSelectionReady() {
  return hasMultiSelection() && !state.multiSelectCollecting;
}

function unlockedMultiTargets() {
  return state.multiSelected.filter((object) => !isLocked(object));
}

function outlineCapableMultiTargets() {
  return state.multiSelected.filter((object) => objectSupportsOutline(object));
}

function familyKeyForObject(object) {
  if (!object) return "";
  if (isBuilding(object)) return "building";
  const propType = object.userData?.propType;
  return propType ? `prop:${propType}` : "";
}

function familyLabelForKey(key) {
  if (key === "building") return "Edificios";
  if (key.startsWith("prop:")) {
    const propType = key.slice(5);
    return PROP_CATALOG[propType]?.label || "Props";
  }
  return "Objetos";
}

function objectsForFamily(key) {
  return state.objects.filter((object) => familyKeyForObject(object) === key);
}

function refreshFamilySelect() {
  if (!familySelect) return;

  const current = familySelect.value;
  const families = new Map();

  for (const object of state.objects) {
    const key = familyKeyForObject(object);
    if (!key) continue;
    families.set(key, (families.get(key) || 0) + 1);
  }

  familySelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = families.size
    ? "Seleccionar familia…"
    : "Sin familias en el plano";
  familySelect.appendChild(placeholder);

  const sorted = [...families.entries()].sort((a, b) =>
    familyLabelForKey(a[0]).localeCompare(familyLabelForKey(b[0]), "es")
  );

  for (const [key, count] of sorted) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${familyLabelForKey(key)} · ${count}`;
    familySelect.appendChild(option);
  }

  familySelect.disabled = families.size === 0;

  if (families.has(current)) {
    familySelect.value = current;
  } else {
    familySelect.value = "";
  }
}

function activateDirectMultiSelection(objects) {
  const unique = [...new Set(objects)].filter((object) => state.objects.includes(object));

  if (!unique.length) {
    clearMultiSelection();
    return;
  }

  if (placementController?.isActive()) {
    placementController.finish();
    renderer?.domElement?.classList.remove("placement-active");
  }

  state.editSection = "objects";
  updateEditorSectionUi();

  state.selected = null;
  removeSelectionBox();
  transformControls.detach();

  state.multiSelected = unique;
  state.multiSelectCollecting = false;
  state.multiScaleSnapshot = null;
  state.transformMode = "scale";

  specialModeToolbar?.classList.add("hidden");
  configureMultiScaleTransform();
  updateMultiSelectionUi();
  updatePropertiesFromSelection();
  markOverlayDirty();
}

function toggleDirectMultiSelection(object) {
  if (!object || !state.objects.includes(object)) return;

  const current = [];

  if (state.selected && state.objects.includes(state.selected)) {
    current.push(state.selected);
  }

  for (const item of state.multiSelected) {
    if (state.objects.includes(item) && !current.includes(item)) current.push(item);
  }

  const index = current.indexOf(object);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(object);
  }

  activateDirectMultiSelection(current);
}

function isDesktopCtrlSelection(event) {
  return Boolean(
    event?.ctrlKey &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    state.editSection === "objects" &&
    !placementController?.isActive()
  );
}

function selectObjectFamily(key) {
  if (!key) return;
  const matches = objectsForFamily(key);
  activateDirectMultiSelection(matches);

  if (familySelect) familySelect.value = "";

  if (mobilePanels?.isMobile()) {
    mobilePanels.closePanels();
  }
}

function multiSelectionBounds(objects = state.multiSelected) {
  const box = new THREE.Box3();
  let hasBox = false;

  for (const object of objects) {
    if (!object || !state.objects.includes(object)) continue;
    object.updateWorldMatrix(true, true);
    const current = new THREE.Box3().setFromObject(object);
    if (current.isEmpty()) continue;
    if (!hasBox) {
      box.copy(current);
      hasBox = true;
    } else {
      box.union(current);
    }
  }

  return hasBox ? box : null;
}

function ensureMultiScaleProxy() {
  if (multiScaleProxy) return multiScaleProxy;
  multiScaleProxy = new THREE.Object3D();
  multiScaleProxy.name = "Multi height proxy";
  multiScaleProxy.userData.editorHelper = true;
  scene.add(multiScaleProxy);
  return multiScaleProxy;
}

function positionMultiScaleProxy() {
  if (!multiScaleProxy || !hasMultiSelection()) return;
  const box = multiSelectionBounds();
  if (!box) return;
  const center = box.getCenter(new THREE.Vector3());
  multiScaleProxy.position.set(center.x, box.max.y, center.z);
  multiScaleProxy.rotation.set(0, 0, 0);
  multiScaleProxy.scale.set(1, 1, 1);
  multiScaleProxy.updateMatrixWorld(true);
}

function configureMultiScaleTransform() {
  if (!transformControls || !isMultiSelectionReady()) return;

  const editable = unlockedMultiTargets();
  if (!editable.length) {
    transformControls.detach();
    return;
  }

  ensureMultiScaleProxy();
  positionMultiScaleProxy();

  transformControls.attach(multiScaleProxy);
  // La selección múltiple usa una flecha Y como control de ALTURA.
  // El desplazamiento de esa flecha se convierte en escala vertical,
  // conservando individualmente la base inferior de cada objeto.
  transformControls.setMode("translate");
  transformControls.setSpace("world");
  transformControls.showX = false;
  transformControls.showY = true;
  transformControls.showZ = false;
  transformControls.setSize(1.08);
}

function beginMultiScaleDrag() {
  if (!isMultiSelectionReady() || transformControls.object !== multiScaleProxy) {
    state.multiScaleSnapshot = null;
    return false;
  }

  const objects = unlockedMultiTargets().map((object) => {
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    return {
      object,
      scaleY: Math.max(0.0001, Math.abs(object.scale.y)),
      bottom: box.min.y,
      height: Math.max(0.05, box.max.y - box.min.y),
    };
  });

  if (!objects.length) {
    state.multiScaleSnapshot = null;
    return false;
  }

  state.multiScaleSnapshot = {
    proxyStartY: multiScaleProxy.position.y,
    objects,
  };
  return true;
}

function applyMultiScaleDrag() {
  const snapshot = state.multiScaleSnapshot;
  if (!snapshot || transformControls.object !== multiScaleProxy) return false;

  const deltaHeight = multiScaleProxy.position.y - snapshot.proxyStartY;

  for (const record of snapshot.objects) {
    const object = record.object;
    if (!state.objects.includes(object) || isLocked(object)) continue;

    const targetHeight = Math.max(0.05, record.height + deltaHeight);
    const ratio = targetHeight / Math.max(0.05, record.height);
    const nextScaleY = clamp(record.scaleY * ratio, 0.02, 100);

    object.scale.y = nextScaleY * mirrorSign(object, "y");
    object.updateMatrixWorld(true);

    const after = new THREE.Box3().setFromObject(object);
    if (Number.isFinite(after.min.y)) {
      object.position.y += record.bottom - after.min.y;
      object.updateMatrixWorld(true);
    }

  }

  // No reconstruimos listas, contornos ni UI durante cada pixel de arrastre.
  // Los contornos son hijos del mesh y heredan la escala automáticamente.
  return true;
}

function endMultiScaleDrag() {
  if (!state.multiScaleSnapshot) return false;
  state.multiScaleSnapshot = null;
  positionMultiScaleProxy();
  configureMultiScaleTransform();
  return true;
}

function updateMultiSelectModeButtons() {
  const multiActive = state.multiSelectCollecting || isMultiSelectionReady();

  for (const button of modeButtons) {
    const mode = button.dataset.mode;
    if (multiActive) {
      const allowed = mode === "scale";
      button.disabled = !allowed;
      button.classList.toggle("active", allowed && isMultiSelectionReady());
    } else {
      button.disabled = false;
      button.classList.toggle("active", mode === state.transformMode);
    }
  }
}

function updateMultiSelectionSpecialToolbar() {
  if (!state.multiSelectCollecting) return;
  updateSpecialModeToolbar(
    "objects",
    "multi",
    `SELECCIÓN MÚLTIPLE · ${state.multiSelected.length} ${state.multiSelected.length === 1 ? "objeto" : "objetos"}`
  );
}

function updateMultiSelectionPanel() {
  const targets = state.multiSelected;
  const count = targets.length;
  const lockedCount = targets.filter(isLocked).length;

  multiSelectionProperties?.classList.toggle("hidden", !isMultiSelectionReady());

  if (multiSelectionCount) {
    multiSelectionCount.textContent = `${count} ${count === 1 ? "objeto" : "objetos"}`;
  }
  if (multiSelectionLockedCount) {
    multiSelectionLockedCount.textContent = lockedCount
      ? `${lockedCount} bloqueado${lockedCount === 1 ? "" : "s"}`
      : "Ninguno bloqueado";
  }

  if (isMultiSelectionReady() && count) {
    const opacities = targets.map(getObjectOpacity);
    const average = opacities.reduce((sum, value) => sum + value, 0) / opacities.length;
    const same = opacities.every((value) => Math.abs(value - opacities[0]) < 0.001);
    const pct = Math.round(average * 100);
    if (multiOpacityInput) multiOpacityInput.value = String(pct);
    if (multiOpacityValue) {
      multiOpacityValue.textContent = same
        ? `${Math.round(opacities[0] * 100)}%`
        : `Mixta · ${pct}%`;
    }

    const outlineTargets = outlineCapableMultiTargets();
    const capableCount = outlineTargets.length;

    if (multiOutlineApplies) {
      multiOutlineApplies.textContent = capableCount
        ? `${capableCount} de ${count} objeto${count === 1 ? "" : "s"} compatible${capableCount === 1 ? "" : "s"}.`
        : "Ningún objeto seleccionado usa contorno.";
    }

    if (multiOutlineToggle) {
      const enabledValues = outlineTargets.map(
        (object) => object.userData.outlineEnabled !== false
      );
      const allEnabled = capableCount > 0 && enabledValues.every(Boolean);
      const noneEnabled = capableCount > 0 && enabledValues.every((value) => !value);
      const mixedEnabled = capableCount > 0 && !allEnabled && !noneEnabled;

      multiOutlineToggle.disabled = capableCount === 0;
      multiOutlineToggle.setAttribute("aria-pressed", String(allEnabled));
      multiOutlineToggle.classList.toggle("mixed", mixedEnabled);
      multiOutlineToggle.textContent = capableCount === 0
        ? "Contorno · N/A"
        : mixedEnabled
          ? "Contorno · Mixto"
          : allEnabled
            ? "Contorno · ON"
            : "Contorno · OFF";
    }

    if (multiOutlineStrengthInput && multiOutlineStrengthValue) {
      if (!capableCount) {
        multiOutlineStrengthInput.disabled = true;
        multiOutlineStrengthValue.textContent = "N/A";
      } else {
        multiOutlineStrengthInput.disabled = false;
        const strengths = outlineTargets.map((object) =>
          clamp(
            Number(object.userData.outlineStrength) || getDefaultOutlineStrength(object),
            0,
            1
          )
        );
        const averageStrength =
          strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
        const sameStrength = strengths.every(
          (value) => Math.abs(value - strengths[0]) < 0.001
        );
        const strengthPct = Math.round(averageStrength * 100);
        multiOutlineStrengthInput.value = String(strengthPct);
        multiOutlineStrengthValue.textContent = sameStrength
          ? `${Math.round(strengths[0] * 100)}%`
          : `Mixta · ${strengthPct}%`;
      }
    }
  }
}

function updateMultiSelectionUi() {
  const collecting = state.multiSelectCollecting;
  const ready = isMultiSelectionReady();
  const targets = state.multiSelected;
  const count = targets.length;
  const lockedCount = targets.filter(isLocked).length;

  workspace?.classList.toggle("multi-select-active", collecting || ready);
  updateMultiSelectionPanel();

  if (ready) {
    selectionToolbar?.classList.remove("hidden");
    if (quickSelectionName) quickSelectionName.textContent = `${count} objetos`;

    const allLocked = count > 0 && targets.every(isLocked);
    const someLocked = lockedCount > 0 && !allLocked;
    quickLockButton?.setAttribute("aria-pressed", String(allLocked));
    quickLockButton?.classList.toggle("locked", allLocked);
    quickLockButton?.classList.toggle("mixed", someLocked);
    if (quickLockIcon) quickLockIcon.textContent = allLocked ? "🔒" : "🔓";
    if (quickLockText) quickLockText.textContent = allLocked ? "Desbloquear" : "Bloquear";

    quickAnchorScaleButton?.classList.add("hidden");
    quickDuplicateButton?.classList.add("hidden");
    quickDeleteButton?.classList.remove("hidden");

    if (selectionStatus) {
      selectionStatus.textContent = `${count} objetos seleccionados · altura Y conjunta`;
    }
  } else {
    quickAnchorScaleButton?.classList.remove("hidden");
    quickDuplicateButton?.classList.remove("hidden");
  }

  if (collecting) {
    selectionToolbar?.classList.add("hidden");
    if (selectionStatus) {
      selectionStatus.textContent = `${count} seleccionados · toca objetos para añadir/quitar`;
    }
    updateMultiSelectionSpecialToolbar();
  }

  updateMultiSelectModeButtons();
  updateMirrorUi();
  updateRotationAxisUi();
  refreshOutlineStates();
  refreshSceneList();
}

function clearMultiSelection({ resetMode = true } = {}) {
  if (!state.multiSelectCollecting && !hasMultiSelection()) return;

  state.multiSelectCollecting = false;
  state.multiSelected = [];
  state.multiScaleSnapshot = null;

  if (transformControls?.object === multiScaleProxy) {
    transformControls.detach();
  }

  specialModeToolbar?.classList.add("hidden");
  workspace?.classList.remove("multi-select-active");
  quickAnchorScaleButton?.classList.remove("hidden");
  quickDuplicateButton?.classList.remove("hidden");
  multiSelectionProperties?.classList.add("hidden");

  if (resetMode) {
    state.transformMode = "translate";
    transformControls?.setMode("translate");
    transformControls?.setSize(0.92);
  }

  refreshOutlineStates();
  updateMultiSelectModeButtons();
  updateMirrorUi();
  updateRotationAxisUi();
  refreshSceneList();
  updatePropertiesFromSelection();
  markOverlayDirty();
}

function startMultiSelectMode() {
  if (state.editSection !== "objects") {
    state.editSection = "objects";
    updateEditorSectionUi();
  }

  if (placementController?.isActive()) {
    placementController.finish();
    renderer?.domElement?.classList.remove("placement-active");
  }

  if (state.selected) {
    state.selected = null;
    transformControls.detach();
    removeSelectionBox();
  }

  state.multiSelected = [];
  state.multiSelectCollecting = true;
  state.multiScaleSnapshot = null;
  transformControls.detach();
  transformControls.setSize(0.92);
  hideAlignmentGuides();
  axisOverlay?.hide?.();

  updateMultiSelectionUi();

  if (mobilePanels?.isMobile()) {
    mobilePanels.closePanels();
  }
}

function toggleMultiSelectedObject(object) {
  if (!state.multiSelectCollecting || !object || !state.objects.includes(object)) return;

  const index = state.multiSelected.indexOf(object);
  if (index >= 0) {
    state.multiSelected.splice(index, 1);
  } else {
    state.multiSelected.push(object);
  }

  updateMultiSelectionUi();
}

function finishMultiSelectMode() {
  if (!state.multiSelectCollecting) return;

  if (!state.multiSelected.length) {
    clearMultiSelection();
    return;
  }

  state.multiSelectCollecting = false;
  specialModeToolbar?.classList.add("hidden");
  state.transformMode = "scale";
  configureMultiScaleTransform();
  updateMultiSelectionUi();
  updatePropertiesFromSelection();
}

function setMultiOpacity(value) {
  if (!isMultiSelectionReady()) return;
  const opacity = clamp(value, 0.15, 1);
  for (const object of state.multiSelected) {
    setObjectOpacity(object, opacity);
  }
  if (multiOpacityValue) {
    multiOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
  }
  refreshOutlineStates();
}

function setMultiOutlineEnabled(enabled) {
  if (!isMultiSelectionReady()) return;

  const targets = outlineCapableMultiTargets();
  for (const object of targets) {
    object.userData.outlineEnabled = Boolean(enabled);
  }

  refreshOutlineStates();
  updateMultiSelectionPanel();
}

function toggleMultiOutlineEnabled() {
  const targets = outlineCapableMultiTargets();
  if (!targets.length) return;

  const allEnabled = targets.every((object) => object.userData.outlineEnabled !== false);
  setMultiOutlineEnabled(!allEnabled);
  recordHistory("Contorno múltiple");
}

function setMultiOutlineStrength(value) {
  if (!isMultiSelectionReady()) return;

  const strength = clamp(Number(value), 0, 1);
  const targets = outlineCapableMultiTargets();

  for (const object of targets) {
    object.userData.outlineStrength = strength;
  }

  if (multiOutlineStrengthValue) {
    multiOutlineStrengthValue.textContent = `${Math.round(strength * 100)}%`;
  }

  refreshOutlineStates();
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
    if (child.userData?.isOutlinePart) return;
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
    if (child.userData?.isOutlinePart) return;
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

  applyObjectOutlineStyle(object, object === state.selected);
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
  if (isMultiSelectionReady()) {
    const targets = state.multiSelected;
    if (!targets.length) return;
    const nextLocked = !targets.every(isLocked);

    for (const object of targets) {
      object.userData.locked = nextLocked;
    }

    if (nextLocked) {
      transformControls.detach();
    } else {
      configureMultiScaleTransform();
    }

    updateMultiSelectionUi();
    recordHistory(
      nextLocked
        ? "Bloquear selección múltiple"
        : "Desbloquear selección múltiple"
    );
    return;
  }

  if (!state.selected) return;
  setObjectLocked(state.selected, !isLocked(state.selected));
  recordHistory("Bloquear objeto");
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


const OUTLINE_EXCLUDED_TYPES = new Set([
  "palm",
  "tree",
  "shrub",
  "water",
  "lamp",
  "fountain",
  "bridge",
  "archedBridge",
  "wallLamp",
]);

const OUTLINE_THRESHOLD_ANGLE = 18;
const OUTLINE_SCALE_EPSILON = 1.00025;

function objectSupportsOutline(object) {
  if (!object) return false;
  if (isBuilding(object)) return true;
  if (object.userData?.kind === "vegetation") return false;
  if (OUTLINE_EXCLUDED_TYPES.has(object.userData?.propType)) return false;
  return true;
}

function getDefaultOutlineStrength(object) {
  if (isBuilding(object)) return 0.42;
  const type = object?.userData?.propType;
  if (type === "path") return 0.36;
  if (type === "lowWall" || type === "railing") return 0.40;
  if (type === "window" || type === "door") return 0.44;
  return 0.38;
}

function disposeOutlinePart(part) {
  if (!part) return;
  part.parent?.remove(part);
  part.geometry?.dispose?.();
  const materials = Array.isArray(part.material)
    ? part.material
    : [part.material];
  for (const material of materials) {
    material?.dispose?.();
  }
}

function removeObjectOutlines(object) {
  if (!object) return;
  const parts = Array.isArray(object.userData.outlineParts)
    ? [...object.userData.outlineParts]
    : [];
  for (const part of parts) {
    disposeOutlinePart(part);
  }
  object.userData.outlineParts = [];
}

function createOutlineForMesh(mesh) {
  if (!mesh?.isMesh || !mesh.geometry) return null;

  const existing = mesh.children.find(
    (child) => child.userData?.isOutlinePart === true
  );
  if (existing) return existing;

  const edgesGeometry = new THREE.EdgesGeometry(
    mesh.geometry,
    OUTLINE_THRESHOLD_ANGLE
  );

  if (!edgesGeometry.attributes?.position?.count) {
    edgesGeometry.dispose?.();
    return null;
  }

  const line = new THREE.LineSegments(
    edgesGeometry,
    new THREE.LineBasicMaterial({
      color: BUILDING_EDGE_COLOR,
      transparent: true,
      opacity: 0.38,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    })
  );

  // El contorno vive DENTRO del mismo mesh. Por eso hereda siempre
  // posición, rotación y escala y no puede quedarse "atrás".
  line.userData.isOutlinePart = true;
  line.userData.editorMaterialLocal = true;
  line.userData.outlineOwnerUuid = mesh.uuid;
  line.raycast = () => {};
  line.frustumCulled = false;
  line.renderOrder = 24;
  line.scale.setScalar(OUTLINE_SCALE_EPSILON);
  mesh.add(line);
  return line;
}

function ensureObjectOutlines(object) {
  if (!object) return [];

  if (!objectSupportsOutline(object)) {
    removeObjectOutlines(object);
    object.userData.outlineCapable = false;
    object.userData.outlineEnabled = false;
    return [];
  }

  object.userData.outlineCapable = true;
  if (object.userData.outlineEnabled === undefined) {
    object.userData.outlineEnabled = true;
  }
  if (!Number.isFinite(Number(object.userData.outlineStrength))) {
    object.userData.outlineStrength = getDefaultOutlineStrength(object);
  }

  const parts = [];
  object.traverse((child) => {
    if (!child?.isMesh || !child.geometry || child.userData?.isOutlinePart) {
      return;
    }
    const outline = createOutlineForMesh(child);
    if (outline) parts.push(outline);
  });

  object.userData.outlineParts = parts;
  return parts;
}

function rebuildObjectOutlines(object) {
  if (!object) return;
  removeObjectOutlines(object);
  ensureObjectOutlines(object);
  applyObjectOutlineStyle(object, object === state.selected);
}

function applyObjectOutlineStyle(object, isSelected = false) {
  if (!object) return;

  const parts = ensureObjectOutlines(object);
  const capable = Boolean(object.userData.outlineCapable);
  const enabled = capable && object.userData.outlineEnabled !== false;
  const strength = clamp(
    Number(object.userData.outlineStrength) || getDefaultOutlineStrength(object),
    0,
    1
  );

  const multiSelected = isMultiSelected(object);
  const opacity = enabled
    ? clamp(
        multiSelected
          ? strength
          : (isSelected ? Math.max(strength, 0.62) : strength),
        0,
        1
      )
    : 0;

  const color = isSelected
    ? SELECTED_EDGE_COLOR
    : BUILDING_EDGE_COLOR;

  for (const line of parts) {
    const materials = Array.isArray(line.material)
      ? line.material
      : [line.material];

    for (const material of materials) {
      material.color.setHex(color);
      material.opacity = opacity;
      material.transparent = opacity < 0.999;
      material.depthTest = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    }

    line.visible = opacity > 0.01;
  }
}

function refreshOutlineStates() {
  for (const object of state.objects) {
    applyObjectOutlineStyle(
      object,
      object === state.selected || isMultiSelected(object)
    );
  }
}

function makePositionNumberInput(axisLabel) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = axisLabel === "Y" ? "-5" : "-70";
  input.max = axisLabel === "Y" ? "40" : "70";
  input.step = "0.25";
  input.inputMode = "decimal";
  input.className = "axis-number-input";
  input.setAttribute("aria-label", `Posición ${axisLabel}`);
  return input;
}

function injectPositionNumberInputs() {
  const map = [
    [positionXValue, "X"],
    [positionYValue, "Y"],
    [positionZValue, "Z"],
  ];

  for (const [valueNode, axis] of map) {
    if (!valueNode) continue;

    const originalParent = valueNode.parentElement;
    if (!originalParent) continue;

    const existingInput = originalParent.querySelector(".axis-number-input");
    if (existingInput) {
      if (axis === "X") positionXNumberInput = existingInput;
      if (axis === "Y") positionYNumberInput = existingInput;
      if (axis === "Z") positionZNumberInput = existingInput;
      continue;
    }

    const wrap = document.createElement("span");
    wrap.className = "slider-head-side";

    const input = makePositionNumberInput(axis);

    // IMPORTANT:
    // Save the original parent BEFORE moving valueNode into wrap.
    // Otherwise valueNode.parentElement becomes `wrap`, and trying
    // wrap.appendChild(wrap) throws HierarchyRequestError.
    originalParent.appendChild(wrap);
    wrap.append(input, valueNode);

    if (axis === "X") positionXNumberInput = input;
    if (axis === "Y") positionYNumberInput = input;
    if (axis === "Z") positionZNumberInput = input;
  }
}

function injectHistoryToolbar() {
  const host = document.querySelector(".topbar");
  const modeToolbar = document.querySelector(".mode-toolbar");
  if (!host || !modeToolbar || host.querySelector(".history-toolbar")) return;

  const bar = document.createElement("div");
  bar.className = "history-toolbar";
  bar.innerHTML = `
    <button type="button" class="history-button" id="historyUndo" title="Deshacer (Ctrl/Cmd + Z)">↶</button>
    <button type="button" class="history-button" id="historyRedo" title="Rehacer (Ctrl/Cmd + Shift + Z)">↷</button>
  `;
  modeToolbar.insertAdjacentElement("afterend", bar);

  historyUndoButton = bar.querySelector("#historyUndo");
  historyRedoButton = bar.querySelector("#historyRedo");

  historyUndoButton?.addEventListener("click", undoHistory);
  historyRedoButton?.addEventListener("click", redoHistory);
  mobileUndoButton?.addEventListener("click", undoHistory);
  mobileRedoButton?.addEventListener("click", redoHistory);
  updateHistoryUi();
}

function injectOutlineControls() {
  if (!propertiesContent || propertiesContent.querySelector("#outlineControls")) return;

  const lockedNoteNode = lockedNote;
  const label = document.createElement("div");
  label.className = "section-label";
  label.textContent = "Contorno";

  const wrap = document.createElement("div");
  wrap.id = "outlineControls";
  wrap.className = "outline-controls hidden";
  wrap.innerHTML = `
    <button type="button" class="mini-switch outline-toggle" id="objectOutlineToggle" aria-checked="true">Contorno</button>
    <label class="slider-field compact-slider">
      <span class="slider-field-head">
        <span>Nitidez / intensidad</span>
        <strong id="objectOutlineStrengthValue">40%</strong>
      </span>
      <input id="objectOutlineStrength" type="range" min="0" max="100" step="5" value="40" />
    </label>
  `;

  lockedNoteNode?.before(label, wrap);
  outlineControlsWrap = wrap;
  objectOutlineToggle = wrap.querySelector("#objectOutlineToggle");
  objectOutlineStrengthInput = wrap.querySelector("#objectOutlineStrength");
  objectOutlineStrengthValue = wrap.querySelector("#objectOutlineStrengthValue");

  objectOutlineToggle?.addEventListener("click", () => {
    const object = state.selected;
    if (!object || !object.userData.outlineCapable) return;
    object.userData.outlineEnabled = !(object.userData.outlineEnabled !== false);
    applyObjectOutlineStyle(object, true);
    updateOutlineControls();
    recordHistory("Cambiar contorno");
  });

  objectOutlineStrengthInput?.addEventListener("input", (event) => {
    const object = state.selected;
    if (!object || !object.userData.outlineCapable) return;
    object.userData.outlineStrength = clamp(Number(event.target.value) / 100, 0, 1);
    applyObjectOutlineStyle(object, true);
    updateOutlineControls();
  });

  objectOutlineStrengthInput?.addEventListener("change", () => {
    recordHistory("Intensidad de contorno");
  });
}

function injectViewExtras() {
  const viewContent = document.querySelector(".view-content");
  if (!viewContent || viewContent.querySelector("#axisLabelsToggle")) return;

  const section = document.createElement("div");
  section.className = "view-extras";
  section.innerHTML = `
    <div class="section-label">Guías</div>
    <div class="view-extra-grid">
      <button type="button" class="mini-switch" id="axisLabelsToggle" aria-checked="true">Ejes X / Y / Z</button>
      <button type="button" class="mini-switch" id="compassToggle" aria-checked="true">Mini brújula</button>
    </div>
  `;
  viewContent.appendChild(section);

  axisLabelsToggle = section.querySelector("#axisLabelsToggle");
  compassToggle = section.querySelector("#compassToggle");

  axisLabelsToggle?.addEventListener("click", () => {
    state.showAxisLabels = !state.showAxisLabels;
    updateViewExtrasUi();
    updateAxisLabels();
  });

  compassToggle?.addEventListener("click", () => {
    state.showCompass = !state.showCompass;
    updateViewExtrasUi();
    updateCompass();
  });

  updateViewExtrasUi();
}

function injectAxisOverlays() {
  if (!workspace || workspace.querySelector(".axis-label-layer")) return;
}

function installEnhancedUi() {
  injectPositionNumberInputs();
  injectHistoryToolbar();
  injectOutlineControls();
  injectViewExtras();

  if (!compassCanvas) {
    compassCanvas = document.createElement("canvas");
    compassCanvas.className = "mini-compass";
    compassCanvas.width = 84;
    compassCanvas.height = 84;
    workspace.appendChild(compassCanvas);
    compassCtx = compassCanvas.getContext("2d");
  }

  const pairInput = (slider, numberInput) => {
    if (!slider || !numberInput) return;
    slider.addEventListener("input", () => {
      numberInput.value = slider.value;
    });
    numberInput.addEventListener("input", () => {
      slider.value = numberInput.value;
      applyPositionFromSliders();
    });
    numberInput.addEventListener("change", () => {
      applyPositionFromSliders();
      recordHistory("Mover objeto");
    });
  };

  pairInput(positionXInput, positionXNumberInput);
  pairInput(positionYInput, positionYNumberInput);
  pairInput(positionZInput, positionZNumberInput);

  updateViewExtrasUi();
}

function updateOutlineControls() {
  const object = state.selected;
  if (!outlineControlsWrap || !objectOutlineToggle || !objectOutlineStrengthInput || !objectOutlineStrengthValue) return;

  const capable = Boolean(object && object.userData?.outlineCapable);
  outlineControlsWrap.classList.toggle("hidden", !capable);
  const labelNode = outlineControlsWrap.previousElementSibling;
  if (labelNode?.classList.contains("section-label")) {
    labelNode.classList.toggle("hidden", !capable);
  }

  if (!capable) return;

  const enabled = object.userData.outlineEnabled !== false;
  const pct = Math.round((Number(object.userData.outlineStrength) || getDefaultOutlineStrength(object)) * 100);
  objectOutlineToggle.setAttribute("aria-checked", String(enabled));
  objectOutlineToggle.textContent = enabled ? "Contorno · ON" : "Contorno · OFF";
  objectOutlineStrengthInput.value = String(pct);
  objectOutlineStrengthValue.textContent = `${pct}%`;
  objectOutlineStrengthInput.disabled = !enabled;
}

function updateViewExtrasUi() {
  axisLabelsToggle?.setAttribute("aria-checked", String(state.showAxisLabels));
  compassToggle?.setAttribute("aria-checked", String(state.showCompass));
  if (compassCanvas) {
    compassCanvas.classList.toggle("hidden", !state.showCompass);
  }
}

function markOverlayDirty() {
  overlayDirty = true;
  axisOverlay?.markDirty();
}

function updateAxisLabels() {
  markOverlayDirty();
}

function drawCompassAxis(label, color, vector) {
  if (!compassCtx) return;
  const cx = compassCanvas.width / 2;
  const cy = compassCanvas.height / 2;
  const scale = 22;
  compassCtx.strokeStyle = color;
  compassCtx.fillStyle = color;
  compassCtx.lineWidth = 2;
  compassCtx.beginPath();
  compassCtx.moveTo(cx, cy);
  compassCtx.lineTo(cx + vector.x * scale, cy - vector.y * scale);
  compassCtx.stroke();
  compassCtx.font = "11px Inter, sans-serif";
  compassCtx.fillText(label, cx + vector.x * (scale + 6) - 4, cy - vector.y * (scale + 6) + 4);
}

function updateCompass() {
  if (!compassCanvas || !compassCtx) return;
  updateViewExtrasUi();
  if (!state.showCompass) return;

  compassCtx.clearRect(0, 0, compassCanvas.width, compassCanvas.height);
  const cx = compassCanvas.width / 2;
  const cy = compassCanvas.height / 2;

  compassCtx.fillStyle = "rgba(255,255,255,.88)";
  compassCtx.strokeStyle = "rgba(23,23,23,.12)";
  compassCtx.lineWidth = 1;
  compassCtx.beginPath();
  compassCtx.arc(cx, cy, 30, 0, Math.PI * 2);
  compassCtx.fill();
  compassCtx.stroke();

  const inv = camera.quaternion.clone().invert();
  drawCompassAxis("X", "#cf5c5c", new THREE.Vector3(1, 0, 0).applyQuaternion(inv));
  drawCompassAxis("Y", "#4e9661", new THREE.Vector3(0, 1, 0).applyQuaternion(inv));
  drawCompassAxis("Z", "#5e7fd5", new THREE.Vector3(0, 0, 1).applyQuaternion(inv));
}

function updateOverlayWidgets() {
  if (!overlayDirty) return;
  overlayDirty = false;
  axisOverlay?.update();
  updateCompass();
}

function captureHistorySnapshot() {
  return {
    objects: state.objects.map(serializeEditorObject),
    places: placesManager?.serialize?.() || [],
    routeNetwork: routeEditor?.serialize?.() || { nodes: [], edges: [], routes: [] },
    nextBuildingNumber: state.nextBuildingNumber,
    nextPropNumbers: { ...state.nextPropNumbers },
    selectedId: state.selected?.userData?.id || null,
    editSection: state.editSection,
  };
}

function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function updateHistoryUi() {
  const undoDisabled = state.historyIndex <= 0;
  const redoDisabled = state.historyIndex >= state.history.length - 1;
  if (historyUndoButton) historyUndoButton.disabled = undoDisabled;
  if (historyRedoButton) historyRedoButton.disabled = redoDisabled;
  if (mobileUndoButton) mobileUndoButton.disabled = undoDisabled;
  if (mobileRedoButton) mobileRedoButton.disabled = redoDisabled;
}

function recordHistory(_label = "") {
  if (state.historyMuted) return;
  const snapshot = captureHistorySnapshot();
  const current = state.history[state.historyIndex];
  if (current && snapshotsEqual(current, snapshot)) {
    updateHistoryUi();
    return;
  }
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
  updateHistoryUi();
}

function resetHistoryToCurrent() {
  state.history = [];
  state.historyIndex = -1;
  recordHistory("Reset history");
}

function applyHistorySnapshot(snapshot) {
  if (!snapshot) return;
  state.historyMuted = true;
  clearMultiSelection({ resetMode: false });
  clearEditorObjects();
  for (const record of snapshot.objects || []) {
    restoreProjectObject(record);
  }
  placesManager?.restore?.(snapshot.places || []);
  routeEditor?.restore?.(snapshot.routeNetwork || { nodes: [], edges: [], routes: [] });
  state.nextBuildingNumber = snapshot.nextBuildingNumber || 1;
  state.nextPropNumbers = { ...(snapshot.nextPropNumbers || {}) };
  const selected = state.objects.find((item) => item.userData.id === snapshot.selectedId);
  if (selected) {
    state.editSection = "objects";
    selectObject(selected);
  } else {
    deselectObject();
    state.editSection = ["objects", "places", "routes"].includes(snapshot.editSection)
      ? snapshot.editSection
      : "objects";
  }
  updateEditorSectionUi();
  refreshOutlineStates();
  markOverlayDirty();
  state.historyMuted = false;
  updateHistoryUi();
}

function undoHistory() {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  applyHistorySnapshot(state.history[state.historyIndex]);
}

function redoHistory() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  applyHistorySnapshot(state.history[state.historyIndex]);
}

function updateSpecialModeToolbar(section, mode = "idle", message = "") {
  if (!specialModeToolbar) return;
  const visible = state.editSection === section && mode !== "idle";
  specialModeToolbar.classList.toggle("hidden", !visible);

  if (visible && specialModeText) {
    specialModeText.textContent =
      message ||
      (section === "objects"
        ? "Selección múltiple"
        : section === "places"
          ? "Editando lugar"
          : "Editando rutas");
  }

  if (specialModeCancelButton) {
    const isMulti = section === "objects" && mode === "multi";
    specialModeCancelButton.textContent = isMulti ? "✓" : "×";
    specialModeCancelButton.setAttribute(
      "aria-label",
      isMulti ? "Terminar selección múltiple" : "Cancelar modo"
    );
    specialModeCancelButton.title = isMulti ? "Terminar selección" : "Cancelar modo";
  }
}

function updateEditorSectionUi() {
  const section = state.editSection;

  for (const button of editSectionButtons) {
    const active = button.dataset.editSection === section;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }

  objectEditorSection?.classList.toggle("hidden", section !== "objects");
  placesEditorSection?.classList.toggle("hidden", section !== "places");
  routesEditorSection?.classList.toggle("hidden", section !== "routes");

  placesManager?.setActive?.(section === "places");
  routeEditor?.setActive?.(section === "routes");

  if (section === "objects") {
    if (state.multiSelectCollecting) {
      updateMultiSelectionSpecialToolbar();
    } else {
      specialModeToolbar?.classList.add("hidden");
    }
    updatePropertiesFromSelection();
    updateRotationAxisUi();
    updateMirrorUi();
    updateMultiSelectionPanel();
    return;
  }

  rotationAxisToolbar?.classList.add("hidden");
  mirrorQuickToolbar?.classList.add("hidden");
  workspace?.classList.remove("rotation-axes-active");
  workspace?.classList.remove("mirror-tools-active");
  selectionToolbar?.classList.add("hidden");
  hideAlignmentGuides();
  axisOverlay?.hide?.();

  if (section === "places") {
    if (propertiesKind) propertiesKind.textContent = "LUGARES";
    if (propertiesTitle) propertiesTitle.textContent = "Lugares importantes";
    if (selectionStatus) selectionStatus.textContent = "Editando lugares importantes";
  } else {
    if (propertiesKind) propertiesKind.textContent = "RUTAS";
    if (propertiesTitle) propertiesTitle.textContent = "Editor de rutas";
    if (selectionStatus) selectionStatus.textContent = "Editando red de rutas";
  }
}

function setEditSection(section) {
  if (!["objects", "places", "routes"].includes(section)) return;
  if (state.editSection === section) {
    updateEditorSectionUi();
    return;
  }

  if (section !== "objects") {
    if (placementController?.isActive()) {
      placementController.finish();
      renderer?.domElement?.classList.remove("placement-active");
    }
    if (state.multiSelectCollecting || hasMultiSelection()) {
      clearMultiSelection();
    }
    if (state.selected) deselectObject();
  }

  state.editSection = section;
  updateEditorSectionUi();
  markOverlayDirty();
}

function snapSpecialPoint(point) {
  if (!point) return point;
  const snapped = magnetizePointXZ(point.x, point.z);
  const result = point.clone ? point.clone() : new THREE.Vector3(point.x, 0, point.z);
  result.x = clamp(snapped.x, -70, 70);
  result.y = 0;
  result.z = clamp(snapped.z, -70, 70);
  return result;
}

function handleSpecialEditorTap(event) {
  if (state.editSection === "places") {
    return placesManager?.handleTap?.(event, groundPointFromEvent(event)) ?? true;
  }
  if (state.editSection === "routes") {
    return routeEditor?.handleTap?.(event, groundPointFromEvent(event)) ?? true;
  }
  return false;
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
  if (!object || !canMoveY(object) || !state.groundSnapEnabled) {
    return false;
  }

  object.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(object);
  const bottom = box.min.y;
  const threshold = state.groundSnapThreshold || 0;

  if (Math.abs(bottom) <= threshold) {
    object.position.y -= bottom;
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
    id: object.userData.id,
    name: object.name,
    position: object.position.toArray(),
    scale: [Math.abs(object.scale.x), Math.abs(object.scale.y), Math.abs(object.scale.z)],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    rotationY: object.rotation.y,
    mirror: { ...ensureMirrorState(object) },
    locked: isLocked(object),
    opacity: getObjectOpacity(object),
    outlineEnabled:
      object.userData.outlineEnabled !== false,
    outlineStrength:
      Number(object.userData.outlineStrength) || getDefaultOutlineStrength(object),
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
      showAxisLabels: state.showAxisLabels,
      showCompass: state.showCompass,
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
    places: placesManager?.serialize?.() || [],
    routeNetwork: routeEditor?.serialize?.() || { nodes: [], edges: [], routes: [] },
  });
}

function disposeEditorObject(object) {
  scene.remove(object);

  object.traverse((child) => {
    if (isBuilding(object) || child.userData?.isOutlinePart) {
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
  state.multiSelected = [];
  state.multiSelectCollecting = false;
  state.multiScaleSnapshot = null;
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

  object.userData.mirror = {
    x: Boolean(record.mirror?.x),
    y: Boolean(record.mirror?.y),
    z: Boolean(record.mirror?.z),
  };

  applyScaleMagnitudes(
    object,
    record.scale[0],
    record.scale[1],
    record.scale[2]
  );

  const restoredRotation = Array.isArray(record.rotation)
    ? record.rotation
    : [0, record.rotationY || 0, 0];
  object.rotation.set(
    Number(restoredRotation[0]) || 0,
    Number(restoredRotation[1]) || 0,
    Number(restoredRotation[2]) || 0
  );

  object.userData.id = record.id || object.userData.id;
  object.userData.locked =
    record.locked;

  object.userData.outlineEnabled =
    record.outlineEnabled !== false;
  object.userData.outlineStrength =
    Number(record.outlineStrength) || getDefaultOutlineStrength(object);

  setObjectOpacity(
    object,
    record.opacity
  );

  rebuildObjectOutlines(object);

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

  state.showAxisLabels =
    project.settings.showAxisLabels !== false;
  state.showCompass =
    project.settings.showCompass !== false;

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
  updateViewExtrasUi();
  markOverlayDirty();
  updateOverlayWidgets();
}

function restoreProject(project) {
  if (placementController?.isActive()) {
    placementController.cancel();
    renderer.domElement.classList.remove(
      "placement-active"
    );
  }

  state.historyMuted = true;
  clearEditorObjects();

  for (const record of project.objects) {
    restoreProjectObject(record);
  }

  restoreProjectSettings(project);
  placesManager?.restore?.(project.places || []);
  routeEditor?.restore?.(project.routeNetwork || { nodes: [], edges: [], routes: [] });
  state.editSection = "objects";
  updateEditorSectionUi();

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
  refreshOutlineStates();
  state.historyMuted = false;
  resetHistoryToCurrent();
}

function saveProjectFile() {
  try {
    const project = serializeProject();

    downloadProjectJson(
      project,
      "resort.json"
    );

    setProjectMessage(
      `resort.json guardado · ${state.objects.length} objetos · ${placesManager?.serialize?.().length || 0} lugares · ${routeEditor?.serialize?.().nodes.length || 0} nodos.`,
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
      `Proyecto cargado · ${project.objects.length} objetos · ${project.places.length} lugares · ${project.routeNetwork.nodes.length} nodos.`,
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
  const coarsePointer = window.matchMedia?.("(hover:none), (pointer:coarse)")?.matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  installEnhancedUi();

  createLights();
  createGround();
  createGrid();
  createOriginMarker();
  createMapControls();
  createTransformControls();
  ensureMultiScaleProxy();

  axisOverlay = createAxisOverlay({
    scene,
    camera,
    renderer,
    transformControls,
    getSelectedObject: () => state.selected,
    getTransformMode: () => state.transformMode,
    isEnabled: () => state.showAxisLabels && state.editSection === "objects",
  });

  placesManager = createPlacesManager({
    scene,
    camera,
    renderer,
    panel: placesEditorSection,
    snapPoint: snapSpecialPoint,
    onMutate: recordHistory,
    onSelectionChange: (id) => {
      if (state.editSection === "places" && selectionStatus) {
        selectionStatus.textContent = id ? "Lugar seleccionado" : "Editando lugares importantes";
      }
    },
    onInteractionChange: (mode, message) => {
      updateSpecialModeToolbar("places", mode, message);
    },
  });

  routeEditor = createRouteEditor({
    scene,
    camera,
    renderer,
    panel: routesEditorSection,
    snapPoint: snapSpecialPoint,
    onMutate: recordHistory,
    onSelectionChange: (id) => {
      if (state.editSection === "routes" && selectionStatus) {
        selectionStatus.textContent = id ? "Nodo de ruta seleccionado" : "Editando red de rutas";
      }
    },
    onInteractionChange: (mode, message) => {
      updateSpecialModeToolbar("routes", mode, message);
    },
  });

  updateEditorSectionUi();

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
  state.historyMuted = true;
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
  state.historyMuted = false;
  resetHistoryToCurrent();

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
      side: THREE.FrontSide,
      transparent: state.groundOpacity < 0.999,
      opacity: state.groundOpacity,
      depthWrite: state.groundOpacity >= 0.999,
      depthTest: true,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.renderOrder = -30;
  scene.add(ground);

  referencePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.FrontSide,
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
  referencePlane.renderOrder = -20;
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
    material.depthTest = true;
  }
  grid.renderOrder = -10;
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

  // Móvil / táctil:
  // 1 dedo = orbitar, 2 dedos = desplazar + pellizco = zoom.
  // Estas asignaciones no alteran los controles de mouse/teclado en PC.
  mapControls.touches.ONE = THREE.TOUCH.ROTATE;
  mapControls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  mapControls.minDistance = 7;
  mapControls.maxDistance = 320;
  mapControls.minPolarAngle = Math.PI * 0.055;
  mapControls.maxPolarAngle = Math.PI * 0.495;
  mapControls.target.copy(INITIAL_TARGET);

  mapControls.addEventListener("change", () => {
    // MapControls can accumulate a small Y offset during touch panning.
    // Remove only that vertical component while preserving X/Z panning.
    const targetY = mapControls.target.y;

    if (Math.abs(targetY) > 0.00001) {
      mapControls.target.y = 0;
      camera.position.y -= targetY;
    }

    // Hard safety floor. The camera must never cross below the map.
    if (camera.position.y < 0.35) {
      camera.position.y = 0.35;
    }

    markOverlayDirty();
  });

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
    markOverlayDirty();
    state.pendingTransformChange = false;

    if (isMultiSelectionReady() && transformControls.object === multiScaleProxy) {
      beginMultiScaleDrag();
      return;
    }

    oneSidedScaleController?.beginDrag(
      transformControls.axis
    );

    if (state.selected && isUniformObject(state.selected)) {
      state.lastUniformScale = Math.abs(state.selected.scale.x);
    }
  });

  transformControls.addEventListener("mouseUp", () => {
    mapControls.enabled = true;
    markOverlayDirty();

    if (isMultiSelectionReady() && transformControls.object === multiScaleProxy) {
      const changed = Boolean(state.pendingTransformChange);
      endMultiScaleDrag();
      if (changed) {
        recordHistory("Altura Y múltiple");
      }
      state.pendingTransformChange = false;
      return;
    }

    oneSidedScaleController?.endDrag();
    if (state.pendingTransformChange) {
      if (state.selected) applyObjectOutlineStyle(state.selected, true);
      recordHistory("Transformar objeto");
      state.pendingTransformChange = false;
    }
  });

  transformControls.addEventListener("objectChange", () => {
    if (isMultiSelectionReady() && transformControls.object === multiScaleProxy) {
      if (applyMultiScaleDrag()) {
        state.pendingTransformChange = true;
      }
      return;
    }

    oneSidedScaleController?.apply();
    markOverlayDirty();
    applySelectionConstraints();
    state.pendingTransformChange = true;
    if (state.selected) applyObjectOutlineStyle(state.selected, true);
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
  object.userData.mirror = { x: false, y: false, z: false };
  object.name = name || `Edificio ${state.nextBuildingNumber++}`;
  object.scale.set(
    clamp(width, 0.2, 200),
    clamp(height, 0.2, 100),
    clamp(depth, 0.2, 200)
  );
  object.position.set(x, y, z);
  object.rotation.y = rotationY;


  scene.add(object);
  state.objects.push(object);
  ensureObjectOutlines(object);
  applyObjectOutlineStyle(object, false);
  refreshSceneList();

  if (select) selectObject(object);
  recordHistory("Crear edificio");
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
  object.userData.mirror = { x: false, y: false, z: false };
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
  ensureObjectOutlines(object);
  applyObjectOutlineStyle(object, false);
  refreshSceneList();
  if (select) selectObject(object);
  recordHistory("Crear objeto");
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

  state.editSection = "objects";
  updateEditorSectionUi();
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

  if (state.multiSelectCollecting || hasMultiSelection()) {
    clearMultiSelection({ resetMode: false });
  }

  state.editSection = "objects";
  state.selected = object;
  updateEditorSectionUi();
  markOverlayDirty();

  if (isLocked(object)) {
    transformControls.detach();
  } else {
    transformControls.attach(object);
  }

  if (isUniformObject(object)) {
    state.lastUniformScale = Math.abs(object.scale.x);
  }

  configureTransformForSelection();
  updateRotationAxisUi();
  createSelectionBox(object);
  refreshSceneList();
  updatePropertiesFromSelection();
}

function deselectObject() {
  if (state.multiSelectCollecting || hasMultiSelection()) {
    clearMultiSelection();
    return;
  }

  hideAlignmentGuides();
  state.selected = null;
  transformControls.detach();
  updateRotationAxisUi();
  markOverlayDirty();
  removeSelectionBox();
  refreshSceneList();
  updatePropertiesFromSelection();
}

function duplicateSelectedObject() {
  const source = state.selected;
  if (!source) return;

  if (isBuilding(source)) {
    const clone = createBuilding({
      name: `${source.name} copia`,
      width: Math.abs(source.scale.x),
      height: Math.abs(source.scale.y),
      depth: Math.abs(source.scale.z),
      x: source.position.x + 2,
      y: source.position.y,
      z: source.position.z + 2,
      rotationY: source.rotation.y,
      select: false,
    });
    clone.rotation.copy(source.rotation);
    clone.userData.mirror = { ...ensureMirrorState(source) };
    applyScaleMagnitudes(clone, Math.abs(source.scale.x), Math.abs(source.scale.y), Math.abs(source.scale.z));
    selectObject(clone);
    return clone;
  }

  const clone = createEditorProp(source.userData.propType, {
    name: `${source.name} copia`,
    x: source.position.x + 1.5,
    z: source.position.z + 1.5,
    rotationY: source.rotation.y,
    scale: isUniformObject(source) ? Math.abs(source.scale.x) : 1,
    select: false,
  });

  clone.position.y = source.position.y;
  clone.rotation.copy(source.rotation);
  clone.userData.mirror = { ...ensureMirrorState(source) };

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
    applyScaleMagnitudes(clone, Math.abs(source.scale.x), Math.abs(source.scale.y), Math.abs(source.scale.z));
  } else {
    applyScaleMagnitudes(clone, Math.abs(source.scale.x), Math.abs(source.scale.y), Math.abs(source.scale.z));
  }

  setObjectOpacity(
    clone,
    getObjectOpacity(source)
  );

  clone.userData.outlineEnabled = source.userData.outlineEnabled !== false;
  clone.userData.outlineStrength = Number(source.userData.outlineStrength) || getDefaultOutlineStrength(source);
  rebuildObjectOutlines(clone);

  selectObject(clone);
  return clone;
}

function deleteSelectedObject() {
  if (isMultiSelectionReady()) {
    const targets = [...state.multiSelected];
    if (!targets.length) return;

    transformControls.detach();
    const deleting = new Set(targets);
    for (const object of targets) {
      disposeEditorObject(object);
    }

    state.objects = state.objects.filter((item) => !deleting.has(item));
    clearMultiSelection();
    recordHistory("Eliminar selección múltiple");
    return;
  }

  const object = state.selected;
  if (!object) return;

  transformControls.detach();
  disposeEditorObject(object);

  state.objects = state.objects.filter((item) => item !== object);
  state.selected = null;
  removeSelectionBox();
  refreshSceneList();
  updatePropertiesFromSelection();
  recordHistory("Eliminar objeto");
}

function createSelectionBox(object) {
  selectionBox = null;
  refreshOutlineStates();
  markOverlayDirty();
  updateOverlayWidgets();
}

function updateSelectionBox() {
  refreshOutlineStates();
  markOverlayDirty();
  updateOverlayWidgets();
}

function removeSelectionBox() {
  selectionBox = null;
  refreshOutlineStates();
  markOverlayDirty();
  updateOverlayWidgets();
}

function setTransformMode(mode) {
  if (!["translate", "rotate", "scale"].includes(mode)) return;

  if (state.multiSelectCollecting || isMultiSelectionReady()) {
    if (mode !== "scale") return;

    state.transformMode = "scale";
    if (isMultiSelectionReady()) configureMultiScaleTransform();
    updateMultiSelectModeButtons();
    updateMirrorUi();
    markOverlayDirty();
    return;
  }

  if (state.editSection !== "objects") {
    state.editSection = "objects";
    updateEditorSectionUi();
  }

  if (placementController?.isActive()) {
    placementController.finish();
  }

  state.transformMode = mode;
  transformControls.setMode(mode);

  transformControls.setRotationSnap(
    state.ctrlRotationSnap
      ? THREE.MathUtils.degToRad(45)
      : null
  );

  configureTransformForSelection();
  updateRotationAxisUi();
  updateMirrorUi();
  markOverlayDirty();

  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === mode);
  }
}

function configureTransformForSelection() {
  if (isMultiSelectionReady()) {
    configureMultiScaleTransform();
    return;
  }

  const object = state.selected;
  markOverlayDirty();
  transformControls.showX = true;
  transformControls.showY = true;
  transformControls.showZ = true;
  if (!object) return;

  if (isLocked(object)) {
    transformControls.detach();
    updateRotationAxisUi();
    return;
  }

  if (transformControls.object !== object) {
    transformControls.attach(object);
  }

  const mode = state.transformMode;

  if (mode === "rotate") {
    transformControls.showX = Boolean(state.rotationAxes.x);
    transformControls.showY = Boolean(state.rotationAxes.y);
    transformControls.showZ = Boolean(state.rotationAxes.z);
    transformControls.setSpace("local");
    updateRotationAxisUi();
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
    const candidates = [Math.abs(object.scale.x), Math.abs(object.scale.y), Math.abs(object.scale.z)];
    let changed = candidates[0];
    let largestDelta = Math.abs(candidates[0] - previous);

    for (const candidate of candidates.slice(1)) {
      const delta = Math.abs(candidate - previous);
      if (delta > largestDelta) {
        largestDelta = delta;
        changed = candidate;
      }
    }

    const uniform = clamp(changed, 0.25, 3);
    applyScaleMagnitudes(object, uniform, uniform, uniform);
    state.lastUniformScale = uniform;
  }

  if (!isUniformObject(object)) {
    applyScaleMagnitudes(
      object,
      clamp(Math.abs(object.scale.x), 0.05, 200),
      clamp(Math.abs(object.scale.y), 0.02, 100),
      clamp(Math.abs(object.scale.z), 0.05, 200)
    );
  }
}

function refreshSceneList() {
  sceneList.replaceChildren();
  refreshFamilySelect();

  for (const object of state.objects) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `scene-row${object === state.selected || isMultiSelected(object) ? " selected" : ""}`;

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
    row.addEventListener("click", (event) => {
      if (placementController?.isActive()) {
        placementController.finish();
      }

      if (state.multiSelectCollecting) {
        toggleMultiSelectedObject(object);
        if (mobilePanels?.isMobile()) mobilePanels.closePanels();
        return;
      }

      if (isDesktopCtrlSelection(event)) {
        event.preventDefault();
        toggleDirectMultiSelection(object);
        return;
      }

      if (isMultiSelectionReady()) {
        clearMultiSelection({ resetMode: false });
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
  if (state.editSection !== "objects") {
    selectionToolbar?.classList.add("hidden");
    return;
  }

  if (state.multiSelectCollecting || isMultiSelectionReady()) {
    emptyProperties.classList.add("hidden");
    propertiesContent.classList.add("hidden");
    updateMultiSelectionPanel();
    updateMultiSelectionUi();
    return;
  }

  multiSelectionProperties?.classList.add("hidden");

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
    updateMirrorUi();
    updateRotationAxisUi();
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
    const percentage = Math.round(Math.abs(object.scale.x) * 100);
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

  if (positionXNumberInput) positionXNumberInput.value = round2(object.position.x);
  if (positionYNumberInput) positionYNumberInput.value = round2(object.position.y);
  if (positionZNumberInput) positionZNumberInput.value = round2(object.position.z);

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

  rotationXInput.value = round2(degrees(object.rotation.x));
  rotationYInput.value = round2(degrees(object.rotation.y));
  rotationZInput.value = round2(degrees(object.rotation.z));
  updateMirrorUi();

  const geometryControls = [
    widthInput,
    heightInput,
    depthInput,
    uniformSizeInput,
    stairStepsInput,
    positionXInput,
    positionYInput,
    positionZInput,
    rotationXInput,
    rotationYInput,
    rotationZInput,
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
  updateOutlineControls();
  updateRotationAxisUi();
}

function getEditableDimensions(object) {
  if (isBuilding(object)) {
    return { x: Math.abs(object.scale.x), y: Math.abs(object.scale.y), z: Math.abs(object.scale.z) };
  }
  const base = object.userData.baseDimensions || { x: 1, y: 1, z: 1 };
  return {
    x: base.x * Math.abs(object.scale.x),
    y: base.y * Math.abs(object.scale.y),
    z: base.z * Math.abs(object.scale.z),
  };
}

function setEditableDimensions(object, width, height, depth) {
  if (isBuilding(object)) {
    applyScaleMagnitudes(object, width, height, depth);
    return;
  }

  const base = object.userData.baseDimensions || { x: 1, y: 1, z: 1 };
  applyScaleMagnitudes(object, width / base.x, height / base.y, depth / base.z);
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
  applyObjectOutlineStyle(object, true);
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

  if (positionXNumberInput) positionXNumberInput.value = round2(object.position.x);
  if (positionYNumberInput) positionYNumberInput.value = round2(object.position.y);
  if (positionZNumberInput) positionZNumberInput.value = round2(object.position.z);

  updateSelectionBox();
}

function applyRotationFromInput() {
  const object = state.selected;
  if (!object || isLocked(object)) return;

  const x = clamp(numberOrFallback(rotationXInput.value, degrees(object.rotation.x)), -360, 360);
  const y = clamp(numberOrFallback(rotationYInput.value, degrees(object.rotation.y)), -360, 360);
  const z = clamp(numberOrFallback(rotationZInput.value, degrees(object.rotation.z)), -360, 360);
  object.rotation.set(radians(x), radians(y), radians(z));
  updateSelectionBox();
  updatePropertiesFromSelection();
}

function applyUniformSize(percentage) {
  const object = state.selected;
  if (!object || isLocked(object) || !isUniformObject(object)) return;

  const scale = clamp(percentage / 100, 0.25, 3);
  applyScaleMagnitudes(object, scale, scale, scale);
  state.lastUniformScale = scale;
  applySelectionConstraints();
  uniformSizeValue.textContent = `${Math.round(scale * 100)}%`;
  applyObjectOutlineStyle(object, true);
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

  rebuildObjectOutlines(object);
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
  let hitRoot = null;

  for (const intersection of intersections) {
    const root = editorRootFromHit(intersection.object);
    if (root) {
      hitRoot = root;
      break;
    }
  }

  if (state.multiSelectCollecting) {
    if (hitRoot) {
      toggleMultiSelectedObject(hitRoot);
    } else {
      clearMultiSelection();
    }
    return;
  }

  // PC: Control + clic funciona como selección múltiple de escritorio.
  // Añade o quita el objeto tocado sin perder los demás.
  if (isDesktopCtrlSelection(event)) {
    if (hitRoot) toggleDirectMultiSelection(hitRoot);
    return;
  }

  if (isMultiSelectionReady()) {
    if (!hitRoot) {
      clearMultiSelection();
      return;
    }

    clearMultiSelection({ resetMode: false });
    selectObject(hitRoot);
    return;
  }

  if (hitRoot) {
    selectObject(hitRoot);
    return;
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
  markOverlayDirty();
}

function setTopView() {
  camera.position.set(0.001, 92, 0.001);
  mapControls.target.set(0, 0, 0);
  camera.lookAt(mapControls.target);
  mapControls.update();
  setActiveViewButton("top");
  markOverlayDirty();
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
  ground.material.transparent = value < 0.999;
  ground.material.depthWrite = value >= 0.999;
  ground.material.needsUpdate = true;
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

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (state.editSection === "places" && !mapControls.dragging) {
      placesManager?.handleHover?.(event);
    }
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
      if (handleSpecialEditorTap(event)) return;
      if (!placeCurrentType(event)) {
        pickObject(event);
      }
    }
  });

  for (const button of libraryButtons) {
    button.addEventListener("click", () => {
      setEditSection("objects");
      createFromLibrary(button.dataset.create);

      if (mobilePanels?.isMobile()) {
        mobilePanels.closePanels();
      }
    });
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      setEditSection("objects");
      setTransformMode(button.dataset.mode);
    });
  }

  for (const button of editSectionButtons) {
    button.addEventListener("click", () => {
      setEditSection(button.dataset.editSection);
    });
  }

  multiSelectStartButton?.addEventListener("click", startMultiSelectMode);
  multiSelectionClearButton?.addEventListener("click", () => clearMultiSelection());

  multiOpacityInput?.addEventListener("input", (event) => {
    setMultiOpacity(Number(event.target.value) / 100);
  });
  multiOpacityInput?.addEventListener("change", () => {
    if (isMultiSelectionReady()) recordHistory("Opacidad múltiple");
  });

  multiOutlineToggle?.addEventListener("click", toggleMultiOutlineEnabled);

  multiOutlineStrengthInput?.addEventListener("input", (event) => {
    setMultiOutlineStrength(Number(event.target.value) / 100);
  });
  multiOutlineStrengthInput?.addEventListener("change", () => {
    if (isMultiSelectionReady()) recordHistory("Intensidad de contorno múltiple");
  });

  familySelect?.addEventListener("change", (event) => {
    const key = String(event.target.value || "");
    if (key) selectObjectFamily(key);
  });

  objectNameInput.addEventListener("input", () => {
    if (!state.selected) return;
    const value = objectNameInput.value.trim();
    if (!value) return;

    state.selected.name = value;
    propertiesTitle.textContent = value;
    selectionStatus.textContent = `${value} seleccionado`;
    refreshSceneList();
  });

  objectNameInput.addEventListener("change", () => {
    if (state.selected) recordHistory("Renombrar objeto");
  });

  for (const input of [widthInput, heightInput, depthInput]) {
    input.addEventListener("change", () => {
      applyDimensionsFromInputs();
      recordHistory("Cambiar dimensiones");
    });
  }

  for (const input of [positionXInput, positionYInput, positionZInput]) {
    input.addEventListener("input", applyPositionFromSliders);
    input.addEventListener("change", () => recordHistory("Mover objeto"));
  }

  for (const input of [rotationXInput, rotationYInput, rotationZInput]) {
    input?.addEventListener("change", () => {
      applyRotationFromInput();
      recordHistory("Rotar objeto");
    });
  }

  mirrorXButton?.addEventListener("click", () => mirrorSelectedObject("x"));
  mirrorYButton?.addEventListener("click", () => mirrorSelectedObject("y"));
  mirrorZButton?.addEventListener("click", () => mirrorSelectedObject("z"));

  for (const button of rotationAxisButtons) {
    button.addEventListener("click", () => toggleRotationAxis(button.dataset.rotationAxis));
  }

  uniformSizeInput.addEventListener("input", (event) => {
    applyUniformSize(Number(event.target.value));
  });
  uniformSizeInput.addEventListener("change", () => recordHistory("Escalar objeto"));

  stairStepsInput.addEventListener(
    "input",
    (event) => {
      applyStairSteps(
        Number(event.target.value)
      );
    }
  );
  stairStepsInput.addEventListener("change", () => recordHistory("Editar escalera"));

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
  objectOpacityInput.addEventListener("change", () => {
    if (state.selected) recordHistory("Cambiar opacidad");
  });

  perspectiveViewButton.addEventListener("click", setPerspectiveView);
  topViewButton.addEventListener("click", setTopView);
  resetViewButton.addEventListener("click", resetView);

  mobileResetViewButton?.addEventListener("click", () => {
    setPerspectiveView();
  });

  specialModeCancelButton?.addEventListener("click", () => {
    if (state.editSection === "objects" && state.multiSelectCollecting) {
      finishMultiSelectMode();
      return;
    }
    if (state.editSection === "places") placesManager?.cancelInteraction?.();
    if (state.editSection === "routes") routeEditor?.cancelInteraction?.();
  });

  for (const button of [
    document.querySelector("#placeAddButton"),
    document.querySelector("#placeMoveButton"),
    document.querySelector("#routeAddNodeButton"),
    document.querySelector("#routeMoveNodeButton"),
    document.querySelector("#routeConnectButton"),
  ].filter(Boolean)) {
    button.addEventListener("click", () => {
      if (mobilePanels?.isMobile()) mobilePanels.closePanels();
    });
  }

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
    const key = event.key.toLowerCase();

    if (event.key === "Control") {
      updateCtrlRotationSnap(true);
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoHistory();
      } else {
        undoHistory();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "y") {
      event.preventDefault();
      redoHistory();
      return;
    }

    if (isEditingField()) return;

    if (key === "w") setTransformMode("translate");
    if (key === "e") setTransformMode("rotate");
    if (key === "r") setTransformMode("scale");
    if (key === "escape") {
      if (state.editSection === "places" && placesManager?.isInteracting?.()) {
        placesManager.cancelInteraction?.();
      } else if (state.editSection === "routes" && routeEditor?.isInteracting?.()) {
        routeEditor.cancelInteraction?.();
      } else if (placementController?.isActive()) {
        placementController.finish();
      } else if (state.multiSelectCollecting || hasMultiSelection()) {
        clearMultiSelection();
      } else if (state.editSection !== "objects") {
        setEditSection("objects");
      } else {
        deselectObject();
      }
    }

    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      (state.selected || isMultiSelectionReady())
    ) {
      event.preventDefault();
      deleteSelectedObject();
    }

    if ((event.ctrlKey || event.metaKey) && key === "d" && state.selected) {
      event.preventDefault();
      duplicateSelectedObject();
    }
  });


  window.addEventListener("keyup", (event) => {
    if (event.key === "Control") {
      updateCtrlRotationSnap(false);
    }
  });

  window.addEventListener("blur", () => {
    updateCtrlRotationSnap(false);
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
  markOverlayDirty();
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

    if (mapControls.target.y !== 0) {
      const targetY = mapControls.target.y;
      mapControls.target.y = 0;
      camera.position.y -= targetY;
    }

    if (camera.position.y < 0.35) {
      camera.position.y = 0.35;
    }

    selectionBox?.update();
    updateOverlayWidgets();
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
  if (multiScaleProxy) {
    scene?.remove(multiScaleProxy);
    multiScaleProxy = null;
  }
  axisOverlay?.dispose?.();
  placesManager?.dispose?.();
  routeEditor?.dispose?.();
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
