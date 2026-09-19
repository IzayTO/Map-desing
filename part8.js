import * as THREE from "three";

const bridge = window.__RMB_PART8_BRIDGE__;
if (!bridge) {
  throw new Error("Parte 8: no se encontró el puente de inicialización.");
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const workspace = document.querySelector(".workspace");
const projectFileInput = document.querySelector("#projectFileInput");
const oldAxisLayer = document.querySelector(".axis-label-layer");
oldAxisLayer?.classList.add("part8-axis-replaced");

const runtime = {
  core: null,
  root: null,
  placesGroup: null,
  routesGroup: null,
  axisGroup: null,
  routeLines: null,
  placeSprites: new Map(),
  placeLabels: new Map(),
  nodeMeshes: new Map(),
  transformRoot: null,
  transformControls: null,
  selectedPlaceId: null,
  selectedNodeId: null,
  connectFirstId: null,
  tab: "places",
  interaction: "idle",
  showPlaceNames: false,
  history: [],
  historyIndex: -1,
  pointerStart: null,
  initialized: false,
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const groundHit = new THREE.Vector3();

const shared = {
  nodeGeometry: new THREE.SphereGeometry(0.24, 10, 8),
  nodeMaterial: new THREE.MeshBasicMaterial({ color: 0x59656f, depthWrite: true }),
  nodeSelectedMaterial: new THREE.MeshBasicMaterial({ color: 0x1f1f1f, depthWrite: true }),
  nodePendingMaterial: new THREE.MeshBasicMaterial({ color: 0x2f8f73, depthWrite: true }),
  routeMaterial: new THREE.LineBasicMaterial({ color: 0x59656f, transparent: true, opacity: 0.72, depthWrite: false }),
  placeTexture: null,
  placeMaterial: null,
  placeSelectedMaterial: null,
};

function makeCanvasTexture(draw, width = 128, height = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function buildSharedTextures() {
  shared.placeTexture = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#313638";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.38, w * 0.23, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#313638";
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.91);
    ctx.lineTo(w * 0.34, h * 0.56);
    ctx.lineTo(w * 0.66, h * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5d9b86";
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.38, w * 0.10, 0, Math.PI * 2);
    ctx.fill();
  });

  shared.placeMaterial = new THREE.SpriteMaterial({
    map: shared.placeTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  });

  shared.placeSelectedMaterial = shared.placeMaterial.clone();
  shared.placeSelectedMaterial.color.setHex(0xbfe8da);
}

function createTextSprite(text, color = "#222222") {
  const texture = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = "800 72px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(255,255,255,.96)";
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
  });

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  }));
  sprite.scale.set(0.085, 0.085, 1);
  sprite.renderOrder = 1000;
  sprite.raycast = () => {};
  sprite.userData.part8OwnedTexture = texture;
  return sprite;
}

function createPlaceLabel(text) {
  const safeText = String(text || "Lugar").slice(0, 40);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 38px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(255,255,255,.96)";
  ctx.strokeText(safeText, 256, 48);
  ctx.fillStyle = "#222";
  ctx.fillText(safeText, 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  }));
  sprite.scale.set(0.25, 0.047, 1);
  sprite.raycast = () => {};
  sprite.userData.part8OwnedTexture = texture;
  return sprite;
}

function disposeSprite(sprite) {
  if (!sprite) return;
  sprite.parent?.remove(sprite);
  sprite.userData?.part8OwnedTexture?.dispose?.();
  sprite.material?.dispose?.();
}

function normalizeData(input = {}) {
  const places = Array.isArray(input.places) ? input.places : [];
  const network = input.routeNetwork && typeof input.routeNetwork === "object"
    ? input.routeNetwork
    : {};
  const nodes = Array.isArray(network.nodes) ? network.nodes : [];
  const edges = Array.isArray(network.edges) ? network.edges : [];

  const cleanPlaces = places
    .filter((item) => item && Array.isArray(item.position))
    .map((item) => ({
      id: String(item.id || uid("place")),
      name: String(item.name || "Lugar").slice(0, 80),
      category: String(item.category || "general").slice(0, 40),
      position: [Number(item.position[0]) || 0, 0, Number(item.position[2] ?? item.position[1]) || 0],
      locked: Boolean(item.locked),
      visible: item.visible !== false,
      routeNodeId: item.routeNodeId ? String(item.routeNodeId) : null,
    }));

  const cleanNodes = nodes
    .filter((item) => item && Array.isArray(item.position))
    .map((item) => ({
      id: String(item.id || uid("node")),
      position: [Number(item.position[0]) || 0, 0, Number(item.position[2] ?? item.position[1]) || 0],
    }));

  const nodeIds = new Set(cleanNodes.map((node) => node.id));
  const edgeKeys = new Set();
  const cleanEdges = [];

  for (const edge of edges) {
    if (!edge || !nodeIds.has(String(edge.a)) || !nodeIds.has(String(edge.b))) continue;
    const a = String(edge.a);
    const b = String(edge.b);
    if (a === b) continue;
    const key = [a, b].sort().join("::");
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    cleanEdges.push({ id: String(edge.id || uid("edge")), a, b });
  }

  return {
    places: cleanPlaces,
    routeNetwork: {
      nodes: cleanNodes,
      edges: cleanEdges,
    },
  };
}

function setData(next) {
  const normalized = normalizeData(next);
  bridge.data.places = normalized.places;
  bridge.data.routeNetwork = normalized.routeNetwork;
  runtime.selectedPlaceId = null;
  runtime.selectedNodeId = null;
  runtime.connectFirstId = null;
  runtime.interaction = "idle";
  rebuildAll3D();
  renderPanel();
}

function snapshot() {
  return clone({
    places: bridge.data.places,
    routeNetwork: bridge.data.routeNetwork,
  });
}

function pushHistory() {
  const next = snapshot();
  const current = runtime.history[runtime.historyIndex];
  if (current && JSON.stringify(current) === JSON.stringify(next)) return;
  runtime.history = runtime.history.slice(0, runtime.historyIndex + 1);
  runtime.history.push(next);
  runtime.historyIndex = runtime.history.length - 1;
  updateHistoryButtons();
}

function resetHistory() {
  runtime.history = [];
  runtime.historyIndex = -1;
  pushHistory();
}

function undo() {
  if (runtime.historyIndex <= 0) return;
  runtime.historyIndex -= 1;
  const keepIndex = runtime.historyIndex;
  setData(runtime.history[keepIndex]);
  runtime.historyIndex = keepIndex;
  updateHistoryButtons();
}

function redo() {
  if (runtime.historyIndex >= runtime.history.length - 1) return;
  runtime.historyIndex += 1;
  const keepIndex = runtime.historyIndex;
  setData(runtime.history[keepIndex]);
  runtime.historyIndex = keepIndex;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  document.querySelector("#part8Undo")?.toggleAttribute("disabled", runtime.historyIndex <= 0);
  document.querySelector("#part8Redo")?.toggleAttribute("disabled", runtime.historyIndex >= runtime.history.length - 1);
}

function groundPointFromEvent(event) {
  const canvas = runtime.core?.renderer?.domElement;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, runtime.core.camera);
  return raycaster.ray.intersectPlane(groundPlane, groundHit)
    ? groundHit.clone()
    : null;
}

function updatePointerFromEvent(event) {
  const canvas = runtime.core?.renderer?.domElement;
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, runtime.core.camera);
  return true;
}

function findPlaceById(id) {
  return bridge.data.places.find((place) => place.id === id) ?? null;
}
function findNodeById(id) {
  return bridge.data.routeNetwork.nodes.find((node) => node.id === id) ?? null;
}

function refreshPlace3D(place) {
  let sprite = runtime.placeSprites.get(place.id);
  if (!sprite) {
    sprite = new THREE.Sprite(shared.placeMaterial);
    sprite.center.set(0.5, 0.05);
    sprite.scale.set(0.11, 0.15, 1);
    sprite.renderOrder = 900;
    sprite.userData.part8Type = "place";
    sprite.userData.part8Id = place.id;
    runtime.placesGroup.add(sprite);
    runtime.placeSprites.set(place.id, sprite);
  }
  sprite.position.set(place.position[0], 0.06, place.position[2]);
  sprite.visible = place.visible !== false;
  sprite.material = runtime.selectedPlaceId === place.id
    ? shared.placeSelectedMaterial
    : shared.placeMaterial;

  const shouldLabel = place.visible !== false && (runtime.showPlaceNames || runtime.selectedPlaceId === place.id);
  let label = runtime.placeLabels.get(place.id);
  if (shouldLabel) {
    if (!label || label.userData.labelText !== place.name) {
      disposeSprite(label);
      label = createPlaceLabel(place.name);
      label.userData.labelText = place.name;
      runtime.placesGroup.add(label);
      runtime.placeLabels.set(place.id, label);
    }
    label.position.set(place.position[0], 0.95, place.position[2]);
    label.visible = true;
  } else if (label) {
    label.visible = false;
  }
}

function syncPlaces3D() {
  const valid = new Set(bridge.data.places.map((place) => place.id));
  for (const [id, sprite] of runtime.placeSprites) {
    if (!valid.has(id)) {
      sprite.parent?.remove(sprite);
      runtime.placeSprites.delete(id);
    }
  }
  for (const [id, label] of runtime.placeLabels) {
    if (!valid.has(id)) {
      disposeSprite(label);
      runtime.placeLabels.delete(id);
    }
  }
  for (const place of bridge.data.places) refreshPlace3D(place);
}

function refreshNodeMaterials() {
  for (const node of bridge.data.routeNetwork.nodes) {
    const mesh = runtime.nodeMeshes.get(node.id);
    if (!mesh) continue;
    mesh.material = node.id === runtime.connectFirstId
      ? shared.nodePendingMaterial
      : node.id === runtime.selectedNodeId
        ? shared.nodeSelectedMaterial
        : shared.nodeMaterial;
  }
}

function syncNodes3D() {
  const valid = new Set(bridge.data.routeNetwork.nodes.map((node) => node.id));
  for (const [id, mesh] of runtime.nodeMeshes) {
    if (!valid.has(id)) {
      mesh.parent?.remove(mesh);
      runtime.nodeMeshes.delete(id);
    }
  }
  for (const node of bridge.data.routeNetwork.nodes) {
    let mesh = runtime.nodeMeshes.get(node.id);
    if (!mesh) {
      mesh = new THREE.Mesh(shared.nodeGeometry, shared.nodeMaterial);
      mesh.userData.part8Type = "route-node";
      mesh.userData.part8Id = node.id;
      mesh.renderOrder = 60;
      runtime.routesGroup.add(mesh);
      runtime.nodeMeshes.set(node.id, mesh);
    }
    mesh.position.set(node.position[0], 0.10, node.position[2]);
  }
  refreshNodeMaterials();
}

function rebuildRouteLines() {
  const positions = [];
  const nodeMap = new Map(bridge.data.routeNetwork.nodes.map((node) => [node.id, node]));
  for (const edge of bridge.data.routeNetwork.edges) {
    const a = nodeMap.get(edge.a);
    const b = nodeMap.get(edge.b);
    if (!a || !b) continue;
    positions.push(a.position[0], 0.07, a.position[2], b.position[0], 0.07, b.position[2]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  runtime.routeLines.geometry?.dispose?.();
  runtime.routeLines.geometry = geometry;
  runtime.routeLines.computeLineDistances?.();
}

function rebuildAll3D() {
  syncPlaces3D();
  syncNodes3D();
  rebuildRouteLines();
}

function addPlace(position) {
  const place = {
    id: uid("place"),
    name: `Lugar ${bridge.data.places.length + 1}`,
    category: "general",
    position: [position.x, 0, position.z],
    locked: false,
    visible: true,
    routeNodeId: null,
  };
  bridge.data.places.push(place);
  runtime.selectedPlaceId = place.id;
  runtime.interaction = "idle";
  syncPlaces3D();
  pushHistory();
  renderPanel();
}

function moveSelectedPlace(position) {
  const place = findPlaceById(runtime.selectedPlaceId);
  if (!place || place.locked) return;
  place.position = [position.x, 0, position.z];
  runtime.interaction = "idle";
  refreshPlace3D(place);
  pushHistory();
  renderPanel();
}

function deleteSelectedPlace() {
  if (!runtime.selectedPlaceId) return;
  bridge.data.places = bridge.data.places.filter((place) => place.id !== runtime.selectedPlaceId);
  runtime.selectedPlaceId = null;
  runtime.interaction = "idle";
  syncPlaces3D();
  pushHistory();
  renderPanel();
}

function addNode(position) {
  const node = {
    id: uid("node"),
    position: [position.x, 0, position.z],
  };
  bridge.data.routeNetwork.nodes.push(node);
  runtime.selectedNodeId = node.id;
  syncNodes3D();
  rebuildRouteLines();
  pushHistory();
  renderPanel();
}

function moveSelectedNode(position) {
  const node = findNodeById(runtime.selectedNodeId);
  if (!node) return;
  node.position = [position.x, 0, position.z];
  runtime.interaction = "idle";
  syncNodes3D();
  rebuildRouteLines();
  pushHistory();
  renderPanel();
}

function edgeKey(a, b) {
  return [a, b].sort().join("::");
}

function connectNodes(a, b) {
  if (!a || !b || a === b) return false;
  const key = edgeKey(a, b);
  const duplicate = bridge.data.routeNetwork.edges.some((edge) => edgeKey(edge.a, edge.b) === key);
  if (duplicate) return false;
  bridge.data.routeNetwork.edges.push({ id: uid("edge"), a, b });
  rebuildRouteLines();
  pushHistory();
  return true;
}

function disconnectNodes(a, b) {
  const key = edgeKey(a, b);
  bridge.data.routeNetwork.edges = bridge.data.routeNetwork.edges.filter((edge) => edgeKey(edge.a, edge.b) !== key);
  rebuildRouteLines();
  pushHistory();
  renderPanel();
}

function deleteSelectedNode() {
  const id = runtime.selectedNodeId;
  if (!id) return;
  bridge.data.routeNetwork.nodes = bridge.data.routeNetwork.nodes.filter((node) => node.id !== id);
  bridge.data.routeNetwork.edges = bridge.data.routeNetwork.edges.filter((edge) => edge.a !== id && edge.b !== id);
  runtime.selectedNodeId = null;
  runtime.connectFirstId = runtime.connectFirstId === id ? null : runtime.connectFirstId;
  runtime.interaction = "idle";
  syncNodes3D();
  rebuildRouteLines();
  pushHistory();
  renderPanel();
}

function pickPlace(event) {
  if (!updatePointerFromEvent(event)) return null;
  const hits = raycaster.intersectObjects([...runtime.placeSprites.values()].filter((sprite) => sprite.visible), false);
  return hits[0]?.object?.userData?.part8Id ?? null;
}

function pickNode(event) {
  if (!updatePointerFromEvent(event)) return null;
  const hits = raycaster.intersectObjects([...runtime.nodeMeshes.values()], false);
  return hits[0]?.object?.userData?.part8Id ?? null;
}

function isActiveEditingMode() {
  return ["add-place", "move-place", "add-node", "move-node", "connect-node"].includes(runtime.interaction);
}

function onPointerDown(event) {
  runtime.pointerStart = { x: event.clientX, y: event.clientY };
  if (isActiveEditingMode()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function onPointerMove(event) {
  if (isActiveEditingMode()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function onPointerUp(event) {
  const start = runtime.pointerStart;
  runtime.pointerStart = null;
  const moved = start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) : 0;

  if (isActiveEditingMode()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (moved > 10) return;

    if (runtime.interaction === "connect-node") {
      const id = pickNode(event);
      if (!id) return;
      if (!runtime.connectFirstId) {
        runtime.connectFirstId = id;
        runtime.selectedNodeId = id;
      } else if (runtime.connectFirstId === id) {
        runtime.connectFirstId = null;
      } else {
        const connected = connectNodes(runtime.connectFirstId, id);
        runtime.selectedNodeId = id;
        runtime.connectFirstId = null;
        if (!connected) setModeNote("Esos nodos ya estaban conectados.");
      }
      refreshNodeMaterials();
      renderPanel();
      return;
    }

    const point = groundPointFromEvent(event);
    if (!point) return;
    if (runtime.interaction === "add-place") addPlace(point);
    if (runtime.interaction === "move-place") moveSelectedPlace(point);
    if (runtime.interaction === "add-node") addNode(point);
    if (runtime.interaction === "move-node") moveSelectedNode(point);
    return;
  }

  if (moved > 8) return;

  const panel = document.querySelector("#part8Panel");
  if (!panel || panel.classList.contains("part8-hidden")) return;

  if (runtime.tab === "places") {
    const id = pickPlace(event);
    if (id) {
      runtime.selectedPlaceId = id;
      syncPlaces3D();
      renderPanel();
    }
  } else {
    const id = pickNode(event);
    if (id) {
      runtime.selectedNodeId = id;
      refreshNodeMaterials();
      renderPanel();
    }
  }
}

function findTransformControls() {
  if (runtime.transformControls) return runtime.transformControls;
  runtime.core.scene.traverse((object) => {
    if (runtime.transformControls) return;
    if (object?.isTransformControlsRoot || object?.type === "TransformControlsRoot") {
      runtime.transformRoot = object;
      runtime.transformControls = object.controls ?? object._controls ?? null;
    }
  });
  return runtime.transformControls;
}

function updateAxisSprites() {
  const controls = findTransformControls();
  const axisToggle = document.querySelector("#axisLabelsToggle");
  const enabled = axisToggle?.getAttribute("aria-checked") !== "false";
  const object = controls?.object;

  runtime.axisGroup.visible = Boolean(enabled && object);
  if (!enabled || !object) return;

  const origin = new THREE.Vector3();
  object.getWorldPosition(origin);
  const quaternion = new THREE.Quaternion();
  object.getWorldQuaternion(quaternion);
  const local = controls?.space === "local" || controls?.mode === "scale";
  const distance = clamp(runtime.core.camera.position.distanceTo(origin) * 0.075, 1.2, 5.5);
  const axes = [
    ["X", new THREE.Vector3(1, 0, 0), 0xd45252],
    ["Y", new THREE.Vector3(0, 1, 0), 0x3d9959],
    ["Z", new THREE.Vector3(0, 0, 1), 0x4e70d1],
  ];

  axes.forEach(([name, direction], index) => {
    if (local) direction.applyQuaternion(quaternion);
    const sprite = runtime.axisGroup.children[index];
    sprite.visible = controls?.[`show${name}`] !== false;
    sprite.position.copy(origin).add(direction.normalize().multiplyScalar(distance));
  });
}

function updatePerFrame() {
  updateAxisSprites();
}

function createAxisSprites() {
  runtime.axisGroup.clear();
  runtime.axisGroup.add(
    createTextSprite("X", "#d45252"),
    createTextSprite("Y", "#3d9959"),
    createTextSprite("Z", "#4e70d1")
  );
  runtime.axisGroup.visible = false;
}

function injectUi() {
  if (!workspace || document.querySelector("#part8Launcher")) return;

  const launcher = document.createElement("button");
  launcher.id = "part8Launcher";
  launcher.className = "part8-launcher";
  launcher.type = "button";
  launcher.textContent = "⌖ Mapa";
  launcher.setAttribute("aria-expanded", "false");

  const panel = document.createElement("aside");
  panel.id = "part8Panel";
  panel.className = "part8-panel part8-hidden";
  panel.innerHTML = `
    <div class="part8-panel-head">
      <div><strong>Parte 8</strong><small>Lugares y red de rutas</small></div>
      <div class="part8-row">
        <button class="part8-icon-button" id="part8Undo" type="button" title="Deshacer">↶</button>
        <button class="part8-icon-button" id="part8Redo" type="button" title="Rehacer">↷</button>
        <button class="part8-icon-button" id="part8Close" type="button" aria-label="Cerrar">×</button>
      </div>
    </div>
    <div class="part8-tabs">
      <button class="part8-tab active" type="button" data-part8-tab="places">Lugares</button>
      <button class="part8-tab" type="button" data-part8-tab="routes">Rutas</button>
    </div>
    <div id="part8Content"></div>
  `;

  workspace.append(launcher, panel);

  launcher.addEventListener("click", () => {
    const open = panel.classList.toggle("part8-hidden");
    launcher.setAttribute("aria-expanded", String(!open));
  });
  panel.querySelector("#part8Close")?.addEventListener("click", () => {
    panel.classList.add("part8-hidden");
    launcher.setAttribute("aria-expanded", "false");
    runtime.interaction = "idle";
    runtime.connectFirstId = null;
    refreshNodeMaterials();
  });
  panel.querySelector("#part8Undo")?.addEventListener("click", undo);
  panel.querySelector("#part8Redo")?.addEventListener("click", redo);
  panel.querySelectorAll("[data-part8-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      runtime.tab = button.dataset.part8Tab;
      runtime.interaction = "idle";
      runtime.connectFirstId = null;
      panel.querySelectorAll("[data-part8-tab]").forEach((item) => item.classList.toggle("active", item === button));
      refreshNodeMaterials();
      renderPanel();
    });
  });
}

function setModeNote(message = "") {
  const node = document.querySelector("#part8ModeNote");
  if (node) node.textContent = message;
}

function placeEditorHtml(place) {
  if (!place) return "";
  return `
    <div class="part8-section">
      <span class="part8-section-title">Lugar seleccionado</span>
      <label class="part8-field">Nombre<input id="part8PlaceName" value="${escapeHtml(place.name)}" maxlength="80" /></label>
      <label class="part8-field">Categoría
        <select id="part8PlaceCategory">
          ${["general","edificio","lobby","piscina","restaurante","spa","recepcion"].map((item) => `<option value="${item}" ${place.category === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </label>
      <div class="part8-actions">
        <button class="part8-button" id="part8MovePlace" type="button" ${place.locked ? "disabled" : ""}>Mover</button>
        <button class="part8-button" id="part8LockPlace" type="button">${place.locked ? "Desbloquear" : "Bloquear"}</button>
        <button class="part8-button danger" id="part8DeletePlace" type="button">Eliminar</button>
      </div>
    </div>
  `;
}

function routeEditorHtml(node) {
  if (!node) return "";
  const edges = bridge.data.routeNetwork.edges.filter((edge) => edge.a === node.id || edge.b === node.id);
  return `
    <div class="part8-section">
      <span class="part8-section-title">Nodo seleccionado</span>
      <div class="part8-actions">
        <button class="part8-button" id="part8MoveNode" type="button">Mover nodo</button>
        <button class="part8-button danger" id="part8DeleteNode" type="button">Eliminar nodo</button>
      </div>
      <div class="part8-connection-list">
        ${edges.length ? edges.map((edge) => {
          const other = edge.a === node.id ? edge.b : edge.a;
          return `<div class="part8-connection"><span>↔ ${escapeHtml(shortId(other))}</span><button class="part8-button danger" type="button" data-disconnect="${escapeHtml(other)}">Desconectar</button></div>`;
        }).join("") : `<span class="part8-counts">Sin conexiones.</span>`}
      </div>
    </div>
  `;
}

function shortId(id) {
  return String(id).split("-").slice(-1)[0].slice(0, 8);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPlacesPanel(content) {
  const selected = findPlaceById(runtime.selectedPlaceId);
  content.innerHTML = `
    <div class="part8-actions">
      <button class="part8-button primary" id="part8AddPlace" type="button">+ Agregar lugar</button>
      <button class="part8-button" id="part8NamesToggle" type="button">${runtime.showPlaceNames ? "Ocultar nombres" : "Mostrar nombres"}</button>
    </div>
    <div id="part8ModeNote" class="part8-mode-note">${runtime.interaction === "add-place" ? "Toca el suelo para colocar el lugar." : runtime.interaction === "move-place" ? "Toca el suelo para mover el lugar seleccionado." : "Los lugares son marcadores, no nodos de ruta."}</div>
    ${placeEditorHtml(selected)}
    <div class="part8-section">
      <span class="part8-section-title">Lugares · ${bridge.data.places.length}</span>
      <div class="part8-list">
        ${bridge.data.places.length ? bridge.data.places.map((place) => `
          <button class="part8-list-item ${place.id === runtime.selectedPlaceId ? "active" : ""}" type="button" data-place-id="${escapeHtml(place.id)}">
            <span>${escapeHtml(place.name)}</span><small>${escapeHtml(place.category)}</small>
          </button>
        `).join("") : `<span class="part8-counts">Aún no hay lugares.</span>`}
      </div>
    </div>
  `;

  content.querySelector("#part8AddPlace")?.addEventListener("click", () => {
    runtime.interaction = runtime.interaction === "add-place" ? "idle" : "add-place";
    renderPanel();
  });
  content.querySelector("#part8NamesToggle")?.addEventListener("click", () => {
    runtime.showPlaceNames = !runtime.showPlaceNames;
    syncPlaces3D();
    renderPanel();
  });
  content.querySelectorAll("[data-place-id]").forEach((button) => {
    button.addEventListener("click", () => {
      runtime.selectedPlaceId = button.dataset.placeId;
      runtime.interaction = "idle";
      syncPlaces3D();
      renderPanel();
    });
  });
  content.querySelector("#part8PlaceName")?.addEventListener("change", (event) => {
    const place = findPlaceById(runtime.selectedPlaceId);
    if (!place) return;
    place.name = event.target.value.trim() || "Lugar";
    refreshPlace3D(place);
    pushHistory();
    renderPanel();
  });
  content.querySelector("#part8PlaceCategory")?.addEventListener("change", (event) => {
    const place = findPlaceById(runtime.selectedPlaceId);
    if (!place) return;
    place.category = event.target.value;
    pushHistory();
    renderPanel();
  });
  content.querySelector("#part8MovePlace")?.addEventListener("click", () => {
    runtime.interaction = "move-place";
    renderPanel();
  });
  content.querySelector("#part8LockPlace")?.addEventListener("click", () => {
    const place = findPlaceById(runtime.selectedPlaceId);
    if (!place) return;
    place.locked = !place.locked;
    pushHistory();
    renderPanel();
  });
  content.querySelector("#part8DeletePlace")?.addEventListener("click", deleteSelectedPlace);
}

function renderRoutesPanel(content) {
  const selected = findNodeById(runtime.selectedNodeId);
  content.innerHTML = `
    <div class="part8-actions">
      <button class="part8-button primary" id="part8AddNode" type="button">+ Nodo</button>
      <button class="part8-button" id="part8Connect" type="button">Conectar</button>
    </div>
    <div id="part8ModeNote" class="part8-mode-note">${runtime.interaction === "add-node" ? "Toca el suelo para crear nodos. Puedes seguir tocando para colocar varios." : runtime.interaction === "move-node" ? "Toca el suelo para mover el nodo seleccionado." : runtime.interaction === "connect-node" ? runtime.connectFirstId ? "Selecciona el segundo nodo." : "Selecciona el primer nodo." : "Aquí solo construimos la red. Todavía no calculamos rutas."}</div>
    ${routeEditorHtml(selected)}
    <div class="part8-section">
      <span class="part8-section-title">Red</span>
      <div class="part8-counts">${bridge.data.routeNetwork.nodes.length} nodos · ${bridge.data.routeNetwork.edges.length} conexiones</div>
      <div class="part8-list">
        ${bridge.data.routeNetwork.nodes.length ? bridge.data.routeNetwork.nodes.map((node, index) => `
          <button class="part8-list-item ${node.id === runtime.selectedNodeId ? "active" : ""}" type="button" data-node-id="${escapeHtml(node.id)}">
            <span>Nodo ${index + 1}</span><small>${escapeHtml(shortId(node.id))}</small>
          </button>
        `).join("") : `<span class="part8-counts">Aún no hay nodos.</span>`}
      </div>
    </div>
  `;

  content.querySelector("#part8AddNode")?.addEventListener("click", () => {
    runtime.interaction = runtime.interaction === "add-node" ? "idle" : "add-node";
    runtime.connectFirstId = null;
    refreshNodeMaterials();
    renderPanel();
  });
  content.querySelector("#part8Connect")?.addEventListener("click", () => {
    runtime.interaction = runtime.interaction === "connect-node" ? "idle" : "connect-node";
    runtime.connectFirstId = null;
    refreshNodeMaterials();
    renderPanel();
  });
  content.querySelectorAll("[data-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.nodeId;
      if (runtime.interaction === "connect-node") {
        if (!runtime.connectFirstId) {
          runtime.connectFirstId = id;
          runtime.selectedNodeId = id;
        } else if (runtime.connectFirstId !== id) {
          connectNodes(runtime.connectFirstId, id);
          runtime.selectedNodeId = id;
          runtime.connectFirstId = null;
        } else {
          runtime.connectFirstId = null;
        }
      } else {
        runtime.selectedNodeId = id;
      }
      refreshNodeMaterials();
      renderPanel();
    });
  });
  content.querySelector("#part8MoveNode")?.addEventListener("click", () => {
    runtime.interaction = "move-node";
    renderPanel();
  });
  content.querySelector("#part8DeleteNode")?.addEventListener("click", deleteSelectedNode);
  content.querySelectorAll("[data-disconnect]").forEach((button) => {
    button.addEventListener("click", () => disconnectNodes(runtime.selectedNodeId, button.dataset.disconnect));
  });
}

function renderPanel() {
  const content = document.querySelector("#part8Content");
  if (!content) return;
  if (runtime.tab === "places") renderPlacesPanel(content);
  else renderRoutesPanel(content);
  updateHistoryButtons();
}

async function loadPart8FromFile(file) {
  if (!(file instanceof File)) return;
  try {
    const document = JSON.parse(await file.text());
    const extra = document?.part8;
    if (!extra) {
      setData({ places: [], routeNetwork: { nodes: [], edges: [] } });
      resetHistory();
      return;
    }
    setData(extra);
    resetHistory();
  } catch (error) {
    console.warn("[RMB Parte 8] No se pudieron cargar los datos adicionales.", error);
  }
}

function installProjectLoadHook() {
  projectFileInput?.addEventListener("change", () => {
    const file = projectFileInput.files?.[0];
    if (file) loadPart8FromFile(file);
  });
}

function installKeyboardHistory() {
  window.addEventListener("keydown", (event) => {
    const panel = document.querySelector("#part8Panel");
    if (!panel || panel.classList.contains("part8-hidden")) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.shiftKey ? redo() : undo();
    } else if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      event.stopImmediatePropagation();
      redo();
    }
  }, true);
}

function initializeCore(core) {
  if (runtime.initialized) return;
  runtime.initialized = true;
  runtime.core = core;
  buildSharedTextures();

  runtime.root = new THREE.Group();
  runtime.root.name = "RMB_PART8";
  runtime.placesGroup = new THREE.Group();
  runtime.routesGroup = new THREE.Group();
  runtime.axisGroup = new THREE.Group();
  runtime.routeLines = new THREE.LineSegments(new THREE.BufferGeometry(), shared.routeMaterial);
  runtime.routeLines.renderOrder = 40;
  runtime.routeLines.raycast = () => {};
  runtime.routesGroup.add(runtime.routeLines);
  runtime.root.add(runtime.routesGroup, runtime.placesGroup, runtime.axisGroup);
  core.scene.add(runtime.root);
  createAxisSprites();

  const canvas = core.renderer.domElement;
  canvas.addEventListener("pointerdown", onPointerDown, true);
  canvas.addEventListener("pointermove", onPointerMove, true);
  canvas.addEventListener("pointerup", onPointerUp, true);

  injectUi();
  installProjectLoadHook();
  installKeyboardHistory();
  setData(bridge.data);
  resetHistory();
  renderPanel();
}

bridge.renderCallbacks.add((core) => {
  if (!runtime.initialized && window.__RMB_READY__ !== false) initializeCore(core);
  if (runtime.initialized) {
    runtime.core = core;
    updatePerFrame();
  }
});

// Si el primer frame llega antes de que app.js cambie __RMB_READY__, el callback
// del siguiente frame inicializa la Parte 8 automáticamente.
