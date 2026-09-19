import * as THREE from "three";

const NODE_NORMAL = new THREE.Color(0x59656f);
const NODE_SELECTED = new THREE.Color(0x171717);
const NODE_PENDING = new THREE.Color(0x2f8f73);
const MAX_REASONABLE_NODES = 4096;

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

function edgeKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function normalizeRouteNetwork(input = {}) {
  const rawNodes = Array.isArray(input?.nodes) ? input.nodes : [];
  const rawEdges = Array.isArray(input?.edges) ? input.edges : [];
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
    edges.push({ id, a, b });
  }

  return { nodes, edges };
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
    color: 0x59656f,
    transparent: true,
    opacity: 0.74,
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

  let network = { nodes: [], edges: [] };
  let selectedId = null;
  let connectFirstId = null;
  let interaction = "idle";
  let active = false;
  let customNote = "";
  let disposed = false;

  const addButton = panel?.querySelector("#routeAddNodeButton");
  const connectButton = panel?.querySelector("#routeConnectButton");
  const cancelButton = panel?.querySelector("#routeCancelButton");
  const modeNote = panel?.querySelector("#routeModeNote");
  const nodeCount = panel?.querySelector("#routeNodeCount");
  const edgeCount = panel?.querySelector("#routeEdgeCount");
  const listNode = panel?.querySelector("#routeNodeList");
  const selectedSection = panel?.querySelector("#routeSelectedSection");
  const selectedName = panel?.querySelector("#routeSelectedName");
  const moveButton = panel?.querySelector("#routeMoveNodeButton");
  const deleteButton = panel?.querySelector("#routeDeleteNodeButton");
  const connectionsNode = panel?.querySelector("#routeConnections");

  function nodeById(id) {
    return network.nodes.find((node) => node.id === id) ?? null;
  }

  function ensureNodeMesh(count) {
    if (nodeMesh && count <= nodeCapacity) return;
    const next = nextCapacity(Math.max(1, count));
    if (nodeMesh) {
      root.remove(nodeMesh);
      nodeMesh.dispose?.();
    }

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

  function rebuildEdges() {
    const map = new Map(network.nodes.map((node) => [node.id, node]));
    const positions = new Float32Array(network.edges.length * 6);
    let offset = 0;

    for (const edge of network.edges) {
      const a = map.get(edge.a);
      const b = map.get(edge.b);
      if (!a || !b) continue;
      positions[offset++] = a.position[0];
      positions[offset++] = 0;
      positions[offset++] = a.position[2];
      positions[offset++] = b.position[0];
      positions[offset++] = 0;
      positions[offset++] = b.position[2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(offset === positions.length ? positions : positions.slice(0, offset), 3)
    );
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
    network.edges.push({ id: makeId("edge"), a, b });
    rebuildEdges();
    onMutate("Conectar nodos");
    return true;
  }

  function disconnect(a, b) {
    const key = edgeKey(a, b);
    const before = network.edges.length;
    network.edges = network.edges.filter((edge) => edgeKey(edge.a, edge.b) !== key);
    if (network.edges.length === before) return;
    rebuildEdges();
    updateUi();
    onMutate("Desconectar nodos");
  }

  function deleteSelected() {
    if (!selectedId) return;
    const id = selectedId;
    network.nodes = network.nodes.filter((node) => node.id !== id);
    network.edges = network.edges.filter((edge) => edge.a !== id && edge.b !== id);
    selectedId = null;
    if (connectFirstId === id) connectFirstId = null;
    interaction = "idle";
    customNote = "";
    sync3D({ edges: true });
    updateUi();
    onSelectionChange(null);
    onMutate("Eliminar nodo de ruta");
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
      ? "Conexión creada. Puedes pulsar Conectar otra vez para añadir otra."
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
      label.textContent = `↔ Nodo ${indexById.get(otherId) ?? "?"}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "editor-mini-danger";
      button.dataset.disconnectNodeId = otherId;
      button.textContent = "Quitar";
      row.append(label, button);
      connectionsNode.append(row);
    }
  }

  function updateUi() {
    if (nodeCount) nodeCount.textContent = String(network.nodes.length);
    if (edgeCount) edgeCount.textContent = String(network.edges.length);
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
                : "Toca el primer nodo y después el segundo."
              : "La red solo define por dónde podrá pasar una ruta. Todavía no calcula recorridos."
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
        customNote = created ? "Conexión creada." : "Esos nodos ya estaban conectados.";
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

  updateUi();

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(root);
    nodeMesh?.dispose?.();
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
