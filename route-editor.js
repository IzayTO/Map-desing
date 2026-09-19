import * as THREE from "three";

const NODE_NORMAL = new THREE.Color(0x59656f);
const NODE_SELECTED = new THREE.Color(0x171717);
const NODE_PENDING = new THREE.Color(0x2f8f73);
const EDGE_UNASSIGNED = new THREE.Color(0x59656f);
const MAX_REASONABLE_NODES = 4096;
const ROUTE_COLORS = [
  "#4f7cac",
  "#2f8f73",
  "#c06b45",
  "#8a66a3",
  "#ba8b2f",
  "#4e8b9a",
  "#9b5c66",
  "#66745b",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanId(value, prefix) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || makeId(prefix)).slice(0, 120);
}

function cleanName(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, 80);
}

function cleanColor(value, fallback = "#59656f") {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^#[0-9a-f]{6}$/.test(text) ? text : fallback;
}

function edgeKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function normalizeRouteNetwork(input = {}) {
  const rawNodes = Array.isArray(input?.nodes) ? input.nodes : [];
  const rawEdges = Array.isArray(input?.edges) ? input.edges : [];
  const rawRoutes = Array.isArray(input?.routes) ? input.routes : [];

  const routeIds = new Set();
  const routes = [];
  rawRoutes.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    let id = cleanId(item.id, "route");
    if (routeIds.has(id)) id = makeId("route");
    routeIds.add(id);
    routes.push({
      id,
      name: cleanName(item.name, `Ruta ${index + 1}`),
      color: cleanColor(item.color, ROUTE_COLORS[index % ROUTE_COLORS.length]),
    });
  });

  const ids = new Set();
  const nodes = [];
  for (const item of rawNodes.slice(0, MAX_REASONABLE_NODES)) {
    if (!item || !Array.isArray(item.position)) continue;
    let id = cleanId(item.id, "node");
    if (ids.has(id)) id = makeId("node");
    ids.add(id);

    const x = Number(item.position[0]);
    const z = Number(item.position[2] ?? item.position[1]);
    nodes.push({
      id,
      position: [Number.isFinite(x) ? x : 0, 0, Number.isFinite(z) ? z : 0],
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seen = new Set();
  const edgeIds = new Set();
  const edges = [];

  for (const item of rawEdges) {
    if (!item || typeof item !== "object") continue;
    const a = String(item.a ?? "").slice(0, 120);
    const b = String(item.b ?? "").slice(0, 120);
    if (!nodeIds.has(a) || !nodeIds.has(b) || a === b) continue;
    const key = edgeKey(a, b);
    if (seen.has(key)) continue;
    seen.add(key);

    let id = cleanId(item.id, "edge");
    if (edgeIds.has(id)) id = makeId("edge");
    edgeIds.add(id);
    edges.push({
      id,
      a,
      b,
      routeId: typeof item.routeId === "string" && routeIds.has(item.routeId)
        ? item.routeId
        : null,
    });
  }

  // Una ruta guardada siempre debe tener al menos una conexión.
  const usedRouteIds = new Set(edges.map((edge) => edge.routeId).filter(Boolean));
  const validRoutes = routes.filter((route) => usedRouteIds.has(route.id));
  const validIds = new Set(validRoutes.map((route) => route.id));
  for (const edge of edges) {
    if (edge.routeId && !validIds.has(edge.routeId)) edge.routeId = null;
  }

  return { nodes, edges, routes: validRoutes };
}

function nextCapacity(count) {
  let capacity = 64;
  while (capacity < count && capacity < MAX_REASONABLE_NODES) capacity *= 2;
  return Math.min(MAX_REASONABLE_NODES, capacity);
}

export function createRouteEditor({
  scene,
  camera,
  renderer,
  panel,
  onMutate = () => {},
  onSelectionChange = () => {},
  onInteractionChange = () => {},
  snapPoint = (point) => point,
}) {
  const root = new THREE.Group();
  root.name = "RMB_ROUTE_NETWORK";
  root.visible = false;
  scene.add(root);

  const nodeGeometry = new THREE.SphereGeometry(0.22, 8, 6);
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    toneMapped: false,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    toneMapped: false,
  });

  let nodeMesh = null;
  let nodeCapacity = 0;
  let nodeOrder = [];
  const edgeLines = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMaterial);
  edgeLines.name = "RMB_ROUTE_EDGES";
  edgeLines.position.y = 0.065;
  edgeLines.renderOrder = 42;
  edgeLines.raycast = () => {};
  root.add(edgeLines);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  let network = { nodes: [], edges: [], routes: [] };
  let selectedId = null;
  let connectFirstId = null;
  let activeRouteId = null;
  let interaction = "idle";
  let active = false;
  let customNote = "";
  let disposed = false;

  const addButton = panel?.querySelector("#routeAddNodeButton");
  const connectButton = panel?.querySelector("#routeConnectButton");
  const cancelButton = panel?.querySelector("#routeCancelButton");
  const saveRouteButton = panel?.querySelector("#routeSaveButton");
  const modeNote = panel?.querySelector("#routeModeNote");
  const nodeCount = panel?.querySelector("#routeNodeCount");
  const edgeCount = panel?.querySelector("#routeEdgeCount");
  const savedCount = panel?.querySelector("#routeSavedCount");
  const savedList = panel?.querySelector("#routeSavedList");
  const listNode = panel?.querySelector("#routeNodeList");
  const selectedSection = panel?.querySelector("#routeSelectedSection");
  const selectedName = panel?.querySelector("#routeSelectedName");
  const moveButton = panel?.querySelector("#routeMoveNodeButton");
  const deleteButton = panel?.querySelector("#routeDeleteNodeButton");
  const connectionsNode = panel?.querySelector("#routeConnections");

  function nodeById(id) {
    return network.nodes.find((node) => node.id === id) ?? null;
  }

  function routeById(id) {
    return network.routes.find((route) => route.id === id) ?? null;
  }

  function pruneEmptyRoutes() {
    const used = new Set(network.edges.map((edge) => edge.routeId).filter(Boolean));
    network.routes = network.routes.filter((route) => used.has(route.id));
    if (activeRouteId && !used.has(activeRouteId)) activeRouteId = null;
  }

  function ensureNodeMesh(count) {
    if (nodeMesh && count <= nodeCapacity) return;
    const next = nextCapacity(Math.max(1, count));
    if (nodeMesh) root.remove(nodeMesh);

    nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, next);
    nodeMesh.name = "RMB_ROUTE_NODES";
    nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nodeMesh.renderOrder = 60;
    nodeMesh.frustumCulled = false;
    root.add(nodeMesh);
    nodeCapacity = next;
  }

  function nodeColor(id) {
    if (id === connectFirstId) return NODE_PENDING;
    if (id === selectedId) return NODE_SELECTED;
    return NODE_NORMAL;
  }

  function syncNodes() {
    ensureNodeMesh(network.nodes.length);
    nodeOrder = network.nodes.map((node) => node.id);
    nodeMesh.count = network.nodes.length;

    network.nodes.forEach((node, index) => {
      matrix.makeTranslation(node.position[0], 0.12, node.position[2]);
      nodeMesh.setMatrixAt(index, matrix);
      color.copy(nodeColor(node.id));
      nodeMesh.setColorAt(index, color);
    });

    nodeMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    nodeMesh.computeBoundingSphere?.();
  }

  function refreshNodeColors() {
    if (!nodeMesh) return;
    network.nodes.forEach((node, index) => {
      color.copy(nodeColor(node.id));
      nodeMesh.setColorAt(index, color);
    });
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
  }

  function edgeColor(edge) {
    const route = routeById(edge.routeId);
    if (!route) return EDGE_UNASSIGNED;
    color.set(route.color);
    return color;
  }

  function rebuildEdges() {
    const map = new Map(network.nodes.map((node) => [node.id, node]));
    const positions = new Float32Array(network.edges.length * 6);
    const colors = new Float32Array(network.edges.length * 6);
    let offset = 0;

    for (const edge of network.edges) {
      const a = map.get(edge.a);
      const b = map.get(edge.b);
      if (!a || !b) continue;
      const routeColor = edgeColor(edge);
      const vertex = offset / 3;

      positions[offset++] = a.position[0];
      positions[offset++] = 0;
      positions[offset++] = a.position[2];
      positions[offset++] = b.position[0];
      positions[offset++] = 0;
      positions[offset++] = b.position[2];

      const colorOffset = vertex * 3;
      colors[colorOffset] = routeColor.r;
      colors[colorOffset + 1] = routeColor.g;
      colors[colorOffset + 2] = routeColor.b;
      colors[colorOffset + 3] = routeColor.r;
      colors[colorOffset + 4] = routeColor.g;
      colors[colorOffset + 5] = routeColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    const usedPositions = offset === positions.length ? positions : positions.slice(0, offset);
    const usedColors = colors.slice(0, usedPositions.length);
    geometry.setAttribute("position", new THREE.BufferAttribute(usedPositions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(usedColors, 3));
    edgeLines.geometry.dispose?.();
    edgeLines.geometry = geometry;
    edgeLines.computeBoundingSphere?.();
  }

  function sync3D({ edges = false } = {}) {
    syncNodes();
    if (edges) rebuildEdges();
  }

  function setNote(text = "") {
    customNote = text;
    updateUi();
  }

  function setInteraction(next) {
    interaction = next;
    connectFirstId = null;
    customNote = "";
    refreshNodeColors();
    updateUi();
  }

  function select(id) {
    const next = nodeById(id) ? id : null;
    selectedId = next;
    if (interaction !== "connect") connectFirstId = null;
    refreshNodeColors();
    updateUi();
    onSelectionChange(selectedId);
  }

  function addNode(point) {
    if (network.nodes.length >= MAX_REASONABLE_NODES) {
      setNote(`Se alcanzó el límite de ${MAX_REASONABLE_NODES} nodos para esta edición.`);
      return;
    }
    const snapped = snapPoint(point.clone ? point.clone() : point) || point;
    const node = {
      id: makeId("node"),
      position: [Number(snapped.x) || 0, 0, Number(snapped.z) || 0],
    };
    network.nodes.push(node);
    selectedId = node.id;
    sync3D({ edges: false });
    updateUi();
    onSelectionChange(selectedId);
    onMutate("Crear nodo de ruta");
  }

  function moveSelected(point) {
    const node = nodeById(selectedId);
    if (!node) return;
    const snapped = snapPoint(point.clone ? point.clone() : point) || point;
    node.position = [Number(snapped.x) || 0, 0, Number(snapped.z) || 0];
    interaction = "idle";
    customNote = "";
    sync3D({ edges: true });
    updateUi();
    onMutate("Mover nodo de ruta");
  }

  function connect(a, b) {
    if (!a || !b || a === b || !nodeById(a) || !nodeById(b)) return false;
    const key = edgeKey(a, b);
    if (network.edges.some((edge) => edgeKey(edge.a, edge.b) === key)) return false;
    network.edges.push({
      id: makeId("edge"),
      a,
      b,
      routeId: routeById(activeRouteId) ? activeRouteId : null,
    });
    rebuildEdges();
    onMutate(activeRouteId ? "Extender ruta guardada" : "Conectar nodos");
    return true;
  }

  function disconnect(a, b) {
    const key = edgeKey(a, b);
    const before = network.edges.length;
    network.edges = network.edges.filter((edge) => edgeKey(edge.a, edge.b) !== key);
    if (network.edges.length === before) return;
    pruneEmptyRoutes();
    rebuildEdges();
    updateUi();
    onMutate("Desconectar nodos");
  }

  function deleteSelected() {
    if (!selectedId) return;
    const id = selectedId;
    network.nodes = network.nodes.filter((node) => node.id !== id);
    network.edges = network.edges.filter((edge) => edge.a !== id && edge.b !== id);
    pruneEmptyRoutes();
    selectedId = null;
    if (connectFirstId === id) connectFirstId = null;
    interaction = "idle";
    customNote = "";
    sync3D({ edges: true });
    updateUi();
    onSelectionChange(null);
    onMutate("Eliminar nodo de ruta");
  }

  function unassignedComponentEdges() {
    const unassigned = network.edges.filter((edge) => !edge.routeId);
    if (!unassigned.length) return [];

    let start = selectedId;
    if (!start || !unassigned.some((edge) => edge.a === start || edge.b === start)) {
      start = unassigned[0].a;
    }

    const queue = [start];
    const visitedNodes = new Set([start]);
    const foundEdges = new Set();

    while (queue.length) {
      const nodeId = queue.shift();
      for (const edge of unassigned) {
        if (edge.a !== nodeId && edge.b !== nodeId) continue;
        foundEdges.add(edge.id);
        const other = edge.a === nodeId ? edge.b : edge.a;
        if (!visitedNodes.has(other)) {
          visitedNodes.add(other);
          queue.push(other);
        }
      }
    }

    return unassigned.filter((edge) => foundEdges.has(edge.id));
  }

  function saveRoute() {
    const edges = unassignedComponentEdges();
    if (!edges.length) {
      setNote("Para guardar una ruta necesitas al menos 2 nodos conectados por 1 conexión sin asignar.");
      return;
    }

    const route = {
      id: makeId("route"),
      name: `Ruta ${network.routes.length + 1}`,
      color: ROUTE_COLORS[network.routes.length % ROUTE_COLORS.length],
    };
    network.routes.push(route);
    for (const edge of edges) edge.routeId = route.id;
    activeRouteId = null;
    customNote = `Ruta guardada con ${edges.length} ${edges.length === 1 ? "conexión" : "conexiones"}.`;
    rebuildEdges();
    updateUi();
    onMutate("Guardar ruta");
  }

  function setRouteActive(id) {
    activeRouteId = activeRouteId === id ? null : (routeById(id)?.id || null);
    customNote = activeRouteId
      ? `Editando ${routeById(activeRouteId)?.name || "ruta"}. Las nuevas conexiones usarán su color.`
      : "Edición de ruta cerrada. Las nuevas conexiones quedarán sin asignar.";
    updateUi();
  }

  function renameRoute(id, name) {
    const route = routeById(id);
    if (!route) return;
    const next = cleanName(name, route.name);
    if (next === route.name) return;
    route.name = next;
    updateUi();
    onMutate("Renombrar ruta");
  }

  function recolorRoute(id, value) {
    const route = routeById(id);
    if (!route) return;
    const next = cleanColor(value, route.color);
    if (next === route.color) return;
    route.color = next;
    rebuildEdges();
    updateUi();
    onMutate("Cambiar color de ruta");
  }

  function deleteRoute(id) {
    const route = routeById(id);
    if (!route) return;
    for (const edge of network.edges) {
      if (edge.routeId === id) edge.routeId = null;
    }
    network.routes = network.routes.filter((item) => item.id !== id);
    if (activeRouteId === id) activeRouteId = null;
    customNote = `Se quitó “${route.name}”. Sus conexiones siguen en la red.`;
    rebuildEdges();
    updateUi();
    onMutate("Quitar ruta guardada");
  }

  function updatePointer(event) {
    const canvas = renderer?.domElement;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return true;
  }

  function pickNode(event) {
    if (!nodeMesh || !updatePointer(event)) return null;
    const hit = raycaster.intersectObject(nodeMesh, false)[0];
    if (!hit || !Number.isInteger(hit.instanceId)) return null;
    return nodeOrder[hit.instanceId] ?? null;
  }

  function handleConnectTap(event) {
    const id = pickNode(event);
    if (!id) {
      setNote(connectFirstId ? "Selecciona el segundo nodo." : "Selecciona el primer nodo.");
      return true;
    }

    selectedId = id;
    onSelectionChange(selectedId);

    if (!connectFirstId) {
      connectFirstId = id;
      customNote = "Primer nodo listo. Ahora toca el segundo nodo.";
      refreshNodeColors();
      updateUi();
      return true;
    }

    if (connectFirstId === id) {
      customNote = "El segundo nodo debe ser distinto del primero.";
      refreshNodeColors();
      updateUi();
      return true;
    }

    const first = connectFirstId;
    connectFirstId = null;
    const created = connect(first, id);
    customNote = created
      ? activeRouteId
        ? `Conexión añadida a ${routeById(activeRouteId)?.name || "la ruta"}.`
        : "Conexión creada. Puedes guardarla como ruta cuando termines ese tramo."
      : "Esos nodos ya estaban conectados.";
    interaction = "idle";
    refreshNodeColors();
    updateUi();
    return true;
  }

  function handleTap(event, groundPoint) {
    if (!active) return false;

    if (interaction === "add") {
      if (groundPoint) addNode(groundPoint);
      return true;
    }
    if (interaction === "move") {
      if (groundPoint) moveSelected(groundPoint);
      return true;
    }
    if (interaction === "connect") return handleConnectTap(event);

    select(pickNode(event));
    return true;
  }

  function renderNodeList() {
    if (!listNode) return;
    listNode.replaceChildren();

    if (!network.nodes.length) {
      const empty = document.createElement("div");
      empty.className = "editor-empty-list";
      empty.textContent = "Todavía no hay nodos. Activa + Nodo y toca el sendero.";
      listNode.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    network.nodes.forEach((node, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `editor-list-row${node.id === selectedId ? " active" : ""}`;
      button.dataset.routeNodeId = node.id;

      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = `Nodo ${index + 1}`;
      const coords = document.createElement("small");
      coords.textContent = `${node.position[0].toFixed(2)}, ${node.position[2].toFixed(2)} m`;
      copy.append(title, coords);

      const degree = network.edges.filter((edge) => edge.a === node.id || edge.b === node.id).length;
      const badge = document.createElement("span");
      badge.className = "editor-row-state";
      badge.textContent = String(degree);
      button.append(copy, badge);
      fragment.append(button);
    });
    listNode.append(fragment);
  }

  function renderConnections(node) {
    if (!connectionsNode) return;
    connectionsNode.replaceChildren();
    const edges = network.edges.filter((edge) => edge.a === node.id || edge.b === node.id);

    if (!edges.length) {
      const empty = document.createElement("div");
      empty.className = "editor-empty-list compact";
      empty.textContent = "Este nodo todavía no tiene conexiones.";
      connectionsNode.append(empty);
      return;
    }

    const indexById = new Map(network.nodes.map((item, index) => [item.id, index + 1]));
    for (const edge of edges) {
      const otherId = edge.a === node.id ? edge.b : edge.a;
      const row = document.createElement("div");
      row.className = "route-connection-row";
      const label = document.createElement("span");
      const route = routeById(edge.routeId);
      label.textContent = `↔ Nodo ${indexById.get(otherId) ?? "?"}${route ? ` · ${route.name}` : ""}`;
      if (route) label.style.borderLeft = `3px solid ${route.color}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "editor-mini-danger";
      button.dataset.disconnectNodeId = otherId;
      button.textContent = "Quitar";
      row.append(label, button);
      connectionsNode.append(row);
    }
  }

  function renderSavedRoutes() {
    if (!savedList) return;
    savedList.replaceChildren();

    if (!network.routes.length) {
      const empty = document.createElement("div");
      empty.className = "editor-empty-list compact";
      empty.textContent = "Aún no guardas rutas. Construye un tramo y pulsa Guardar ruta.";
      savedList.append(empty);
      return;
    }

    for (const route of network.routes) {
      const edgeTotal = network.edges.filter((edge) => edge.routeId === route.id).length;
      const row = document.createElement("div");
      row.className = `saved-route-row${route.id === activeRouteId ? " active" : ""}`;
      row.dataset.savedRouteId = route.id;

      const swatch = document.createElement("input");
      swatch.type = "color";
      swatch.className = "saved-route-color";
      swatch.value = route.color;
      swatch.dataset.routeColorId = route.id;
      swatch.title = "Color de la ruta";

      const name = document.createElement("input");
      name.type = "text";
      name.className = "saved-route-name";
      name.maxLength = 80;
      name.value = route.name;
      name.dataset.routeNameId = route.id;
      name.setAttribute("aria-label", "Nombre de ruta");

      const count = document.createElement("small");
      count.className = "saved-route-count";
      count.textContent = `${edgeTotal} ${edgeTotal === 1 ? "conexión" : "conexiones"}`;

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "saved-route-edit";
      edit.dataset.routeEditId = route.id;
      edit.textContent = route.id === activeRouteId ? "Cerrar" : "Editar";
      edit.title = route.id === activeRouteId
        ? "Dejar de asignar nuevas conexiones a esta ruta"
        : "Las nuevas conexiones se añadirán a esta ruta";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "saved-route-remove";
      remove.dataset.routeDeleteId = route.id;
      remove.textContent = "×";
      remove.title = "Quitar ruta guardada sin borrar sus conexiones";

      row.append(swatch, name, count, edit, remove);
      savedList.append(row);
    }
  }

  function updateUi() {
    if (nodeCount) nodeCount.textContent = String(network.nodes.length);
    if (edgeCount) edgeCount.textContent = String(network.edges.length);
    if (savedCount) savedCount.textContent = String(network.routes.length);
    addButton?.classList.toggle("active", interaction === "add");
    connectButton?.classList.toggle("active", interaction === "connect");
    cancelButton?.classList.toggle("hidden", interaction === "idle");

    if (modeNote) {
      modeNote.textContent = customNote || (
        interaction === "add"
          ? "Toca el plano para crear nodos. El modo queda activo para colocar varios."
          : interaction === "move"
            ? "Toca el plano en la nueva posición del nodo seleccionado."
            : interaction === "connect"
              ? connectFirstId
                ? "Primer nodo seleccionado. Toca el segundo nodo."
                : activeRouteId
                  ? `Conectando dentro de ${routeById(activeRouteId)?.name || "la ruta activa"}.`
                  : "Toca el primer nodo y después el segundo."
              : activeRouteId
                ? `${routeById(activeRouteId)?.name || "Ruta"} está activa: las nuevas conexiones usarán ese color.`
                : "Construye la red y guarda tramos con nombre/color. Todavía no calculamos recorridos."
      );
    }

    const node = nodeById(selectedId);
    selectedSection?.classList.toggle("hidden", !node);
    if (node) {
      const index = network.nodes.findIndex((item) => item.id === node.id) + 1;
      if (selectedName) selectedName.textContent = `Nodo ${index}`;
      renderConnections(node);
    } else if (connectionsNode) {
      connectionsNode.replaceChildren();
    }

    renderSavedRoutes();
    renderNodeList();
    onInteractionChange(interaction, modeNote?.textContent || "");
  }

  function setActive(value) {
    active = Boolean(value);
    root.visible = active;
    if (!active) {
      interaction = "idle";
      connectFirstId = null;
      customNote = "";
    }
    refreshNodeColors();
    updateUi();
  }

  function restore(input) {
    network = normalizeRouteNetwork(input);
    selectedId = null;
    connectFirstId = null;
    activeRouteId = null;
    interaction = "idle";
    customNote = "";
    sync3D({ edges: true });
    updateUi();
  }

  function serialize() {
    return clone(network);
  }

  addButton?.addEventListener("click", () => {
    setInteraction(interaction === "add" ? "idle" : "add");
  });
  connectButton?.addEventListener("click", () => {
    setInteraction(interaction === "connect" ? "idle" : "connect");
  });
  cancelButton?.addEventListener("click", () => setInteraction("idle"));
  saveRouteButton?.addEventListener("click", saveRoute);
  moveButton?.addEventListener("click", () => {
    if (nodeById(selectedId)) setInteraction("move");
  });
  deleteButton?.addEventListener("click", deleteSelected);

  listNode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route-node-id]");
    if (!button) return;
    if (interaction === "connect") {
      const id = button.dataset.routeNodeId;
      selectedId = id;
      if (!connectFirstId) {
        connectFirstId = id;
        customNote = "Primer nodo listo. Selecciona el segundo nodo.";
      } else if (connectFirstId === id) {
        customNote = "El segundo nodo debe ser distinto del primero.";
      } else {
        const first = connectFirstId;
        connectFirstId = null;
        const created = connect(first, id);
        interaction = "idle";
        customNote = created
          ? activeRouteId
            ? `Conexión añadida a ${routeById(activeRouteId)?.name || "la ruta"}.`
            : "Conexión creada."
          : "Esos nodos ya estaban conectados.";
      }
      refreshNodeColors();
      updateUi();
      onSelectionChange(selectedId);
      return;
    }
    select(button.dataset.routeNodeId);
  });

  connectionsNode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-disconnect-node-id]");
    if (!button || !selectedId) return;
    disconnect(selectedId, button.dataset.disconnectNodeId);
  });

  savedList?.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-route-edit-id]");
    if (edit) {
      setRouteActive(edit.dataset.routeEditId);
      return;
    }
    const remove = event.target.closest("[data-route-delete-id]");
    if (remove) deleteRoute(remove.dataset.routeDeleteId);
  });

  savedList?.addEventListener("change", (event) => {
    const nameInput = event.target.closest("[data-route-name-id]");
    if (nameInput) {
      renameRoute(nameInput.dataset.routeNameId, nameInput.value);
      return;
    }
    const colorInput = event.target.closest("[data-route-color-id]");
    if (colorInput) recolorRoute(colorInput.dataset.routeColorId, colorInput.value);
  });

  updateUi();

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(root);
    edgeLines.geometry?.dispose?.();
    edgeMaterial.dispose?.();
    nodeGeometry.dispose?.();
    nodeMaterial.dispose?.();
    root.clear();
  }

  return {
    setActive,
    handleTap,
    serialize,
    restore,
    select,
    getSelectedId: () => selectedId,
    isInteracting: () => interaction !== "idle",
    cancelInteraction: () => setInteraction("idle"),
    dispose,
  };
}

export { edgeKey as routeEdgeKey };
