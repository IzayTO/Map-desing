import * as THREE from "three";

const CATEGORIES = Object.freeze([
  ["general", "General"],
  ["edificio", "Edificio"],
  ["lobby", "Lobby"],
  ["piscina", "Piscina"],
  ["restaurante", "Restaurante"],
  ["spa", "Spa"],
  ["recepcion", "Recepción"],
]);

const CATEGORY_COLORS = Object.freeze({
  general: 0x59656f,
  edificio: 0x6c655d,
  lobby: 0x5b7394,
  piscina: 0x4e8b9a,
  restaurante: 0x8b694e,
  spa: 0x7a668f,
  recepcion: 0x5f8268,
});

function clampText(value, fallback, length) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, length);
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePlace(item) {
  if (!item || typeof item !== "object") return null;
  const source = Array.isArray(item.position) ? item.position : [0, 0, 0];
  const x = Number(source[0]);
  const z = Number(source[2] ?? source[1]);
  const category = CATEGORIES.some(([key]) => key === item.category)
    ? item.category
    : "general";

  return {
    id: clampText(item.id, makeId("place"), 120),
    name: clampText(item.name, "Lugar", 80),
    category,
    position: [Number.isFinite(x) ? x : 0, 0, Number.isFinite(z) ? z : 0],
    locked: Boolean(item.locked),
    visible: item.visible !== false,
    routeNodeId:
      typeof item.routeNodeId === "string" && item.routeNodeId.trim()
        ? item.routeNodeId.trim().slice(0, 120)
        : null,
  };
}

function createPinTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#303435";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 55, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#303435";
  ctx.beginPath();
  ctx.moveTo(64, 148);
  ctx.lineTo(43, 82);
  ctx.lineTo(85, 82);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(64, 55, 11, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createLabelSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.name = "RMB_PLACE_ACTIVE_LABEL";
  sprite.visible = false;
  sprite.renderOrder = 904;
  sprite.raycast = () => {};
  sprite.userData.canvas = canvas;
  sprite.userData.texture = texture;
  return sprite;
}

function drawLabel(sprite, text) {
  const canvas = sprite.userData.canvas;
  const texture = sprite.userData.texture;
  const ctx = canvas.getContext("2d");
  const safe = clampText(text, "Lugar", 46);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 36px -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 9;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,.98)";
  ctx.strokeText(safe, 256, 48);
  ctx.fillStyle = "#222629";
  ctx.fillText(safe, 256, 48);
  texture.needsUpdate = true;
  sprite.userData.labelText = safe;
}

export function createPlacesManager({
  scene,
  camera,
  renderer,
  panel,
  onMutate = () => {},
  onSelectionChange = () => {},
  onInteractionChange = () => {},
  snapPoint = (point) => point,
}) {
  const group = new THREE.Group();
  group.name = "RMB_PLACES";
  scene.add(group);

  const pinTexture = createPinTexture();
  const materials = new Map();
  for (const [category] of CATEGORIES) {
    const material = new THREE.SpriteMaterial({
      map: pinTexture,
      color: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
      toneMapped: false,
    });
    materials.set(category, material);
  }

  const selectedMaterial = new THREE.SpriteMaterial({
    map: pinTexture,
    color: 0x171717,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  });

  const labelSprite = createLabelSprite();
  group.add(labelSprite);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const sprites = new Map();
  let places = [];
  let selectedId = null;
  let hoveredId = null;
  let interaction = "idle";
  let active = false;
  let disposed = false;

  const addButton = panel?.querySelector("#placeAddButton");
  const cancelButton = panel?.querySelector("#placeCancelButton");
  const modeNote = panel?.querySelector("#placeModeNote");
  const countNode = panel?.querySelector("#placeCount");
  const listNode = panel?.querySelector("#placeList");
  const selectedSection = panel?.querySelector("#placeSelectedSection");
  const nameInput = panel?.querySelector("#placeName");
  const categorySelect = panel?.querySelector("#placeCategory");
  const moveButton = panel?.querySelector("#placeMoveButton");
  const lockButton = panel?.querySelector("#placeLockButton");
  const visibilityButton = panel?.querySelector("#placeVisibilityButton");
  const deleteButton = panel?.querySelector("#placeDeleteButton");

  function placeById(id) {
    return places.find((place) => place.id === id) ?? null;
  }

  function spriteForPlace(place) {
    let sprite = sprites.get(place.id);
    if (sprite) return sprite;

    sprite = new THREE.Sprite(materials.get(place.category) || materials.get("general"));
    sprite.name = `Lugar: ${place.name}`;
    sprite.center.set(0.5, 0.05);
    sprite.scale.set(0.075, 0.105, 1);
    sprite.renderOrder = 900;
    sprite.frustumCulled = false;
    sprite.userData.placeId = place.id;
    group.add(sprite);
    sprites.set(place.id, sprite);
    return sprite;
  }

  function refreshLabel() {
    const targetId = selectedId || hoveredId;
    const place = placeById(targetId);
    if (!active || !place || place.visible === false) {
      labelSprite.visible = false;
      return;
    }

    if (labelSprite.userData.labelText !== place.name) drawLabel(labelSprite, place.name);
    labelSprite.position.set(place.position[0], 0.72, place.position[2]);
    labelSprite.scale.set(0.27, 0.052, 1);
    labelSprite.visible = true;
  }

  function sync3D() {
    const valid = new Set(places.map((place) => place.id));
    for (const [id, sprite] of sprites) {
      if (valid.has(id)) continue;
      group.remove(sprite);
      sprites.delete(id);
    }

    for (const place of places) {
      const sprite = spriteForPlace(place);
      sprite.name = `Lugar: ${place.name}`;
      sprite.position.set(place.position[0], 0.07, place.position[2]);
      sprite.visible = place.visible !== false;
      sprite.material = place.id === selectedId
        ? selectedMaterial
        : materials.get(place.category) || materials.get("general");
    }

    refreshLabel();
  }

  function setInteraction(next) {
    interaction = next;
    updateUi();
  }

  function select(id) {
    const next = placeById(id) ? id : null;
    if (selectedId === next) return;
    selectedId = next;
    hoveredId = null;
    interaction = "idle";
    sync3D();
    updateUi();
    onSelectionChange(selectedId);
  }

  function addAt(point) {
    const snapped = snapPoint(point.clone ? point.clone() : point) || point;
    const place = {
      id: makeId("place"),
      name: `Lugar ${places.length + 1}`,
      category: "general",
      position: [Number(snapped.x) || 0, 0, Number(snapped.z) || 0],
      locked: false,
      visible: true,
      routeNodeId: null,
    };
    places.push(place);
    selectedId = place.id;
    interaction = "idle";
    sync3D();
    updateUi();
    onSelectionChange(selectedId);
    onMutate("Crear lugar");
  }

  function moveSelectedTo(point) {
    const place = placeById(selectedId);
    if (!place || place.locked) return;
    const snapped = snapPoint(point.clone ? point.clone() : point) || point;
    place.position = [Number(snapped.x) || 0, 0, Number(snapped.z) || 0];
    interaction = "idle";
    sync3D();
    updateUi();
    onMutate("Mover lugar");
  }

  function deleteSelected() {
    if (!selectedId) return;
    const index = places.findIndex((place) => place.id === selectedId);
    if (index < 0) return;
    places.splice(index, 1);
    selectedId = null;
    hoveredId = null;
    interaction = "idle";
    sync3D();
    updateUi();
    onSelectionChange(null);
    onMutate("Eliminar lugar");
  }

  function pick(event) {
    if (!renderer?.domElement) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const candidates = [...sprites.values()].filter((sprite) => sprite.visible);
    const hit = raycaster.intersectObjects(candidates, false)[0];
    return hit?.object?.userData?.placeId ?? null;
  }

  function handleTap(event, groundPoint) {
    if (!active) return false;

    if (interaction === "add") {
      if (groundPoint) addAt(groundPoint);
      return true;
    }

    if (interaction === "move") {
      if (groundPoint) moveSelectedTo(groundPoint);
      return true;
    }

    const id = pick(event);
    select(id);
    return true;
  }

  function handleHover(event) {
    if (!active || event.pointerType === "touch") return;
    const id = pick(event);
    if (id === hoveredId) return;
    hoveredId = id;
    refreshLabel();
  }

  function updateList() {
    if (!listNode) return;
    listNode.replaceChildren();

    if (!places.length) {
      const empty = document.createElement("div");
      empty.className = "editor-empty-list";
      empty.textContent = "Todavía no hay lugares importantes.";
      listNode.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const place of places) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `editor-list-row${place.id === selectedId ? " active" : ""}`;
      button.dataset.placeId = place.id;

      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = place.name;
      const category = document.createElement("small");
      category.textContent = CATEGORIES.find(([key]) => key === place.category)?.[1] || "General";
      copy.append(name, category);

      const state = document.createElement("span");
      state.className = "editor-row-state";
      state.textContent = place.locked ? "🔒" : place.visible === false ? "◌" : "•";
      button.append(copy, state);
      fragment.append(button);
    }
    listNode.append(fragment);
  }

  function updateUi() {
    if (countNode) countNode.textContent = String(places.length);
    if (addButton) addButton.classList.toggle("active", interaction === "add");
    if (cancelButton) cancelButton.classList.toggle("hidden", interaction === "idle");

    if (modeNote) {
      modeNote.textContent =
        interaction === "add"
          ? "Toca el plano para colocar el nuevo lugar."
          : interaction === "move"
            ? "Toca el plano en la nueva posición del lugar."
            : "Selecciona un marcador para editarlo. Los lugares y los nodos de ruta son entidades distintas.";
    }

    const place = placeById(selectedId);
    selectedSection?.classList.toggle("hidden", !place);
    if (place) {
      if (nameInput && document.activeElement !== nameInput) nameInput.value = place.name;
      if (categorySelect) categorySelect.value = place.category;
      if (moveButton) moveButton.disabled = place.locked;
      if (lockButton) lockButton.textContent = place.locked ? "Desbloquear" : "Bloquear";
      if (visibilityButton) visibilityButton.textContent = place.visible === false ? "Mostrar" : "Ocultar";
    }

    updateList();
    onInteractionChange(interaction, modeNote?.textContent || "");
  }

  function setActive(value) {
    active = Boolean(value);
    group.visible = true;
    if (!active) {
      interaction = "idle";
      hoveredId = null;
    }
    refreshLabel();
    updateUi();
  }

  function restore(input) {
    const source = Array.isArray(input) ? input : [];
    const ids = new Set();
    places = [];
    for (const item of source) {
      const place = normalizePlace(item);
      if (!place) continue;
      if (ids.has(place.id)) place.id = makeId("place");
      ids.add(place.id);
      places.push(place);
    }
    selectedId = null;
    hoveredId = null;
    interaction = "idle";
    sync3D();
    updateUi();
  }

  function serialize() {
    return clone(places);
  }

  addButton?.addEventListener("click", () => {
    setInteraction(interaction === "add" ? "idle" : "add");
  });
  cancelButton?.addEventListener("click", () => setInteraction("idle"));
  moveButton?.addEventListener("click", () => {
    const place = placeById(selectedId);
    if (place && !place.locked) setInteraction("move");
  });
  lockButton?.addEventListener("click", () => {
    const place = placeById(selectedId);
    if (!place) return;
    place.locked = !place.locked;
    interaction = "idle";
    updateUi();
    onMutate(place.locked ? "Bloquear lugar" : "Desbloquear lugar");
  });
  visibilityButton?.addEventListener("click", () => {
    const place = placeById(selectedId);
    if (!place) return;
    place.visible = place.visible === false;
    sync3D();
    updateUi();
    onMutate("Cambiar visibilidad del lugar");
  });
  deleteButton?.addEventListener("click", deleteSelected);
  nameInput?.addEventListener("change", () => {
    const place = placeById(selectedId);
    if (!place) return;
    place.name = clampText(nameInput.value, "Lugar", 80);
    sync3D();
    updateUi();
    onMutate("Renombrar lugar");
  });
  categorySelect?.addEventListener("change", () => {
    const place = placeById(selectedId);
    if (!place) return;
    place.category = CATEGORIES.some(([key]) => key === categorySelect.value)
      ? categorySelect.value
      : "general";
    sync3D();
    updateUi();
    onMutate("Cambiar categoría del lugar");
  });
  listNode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-place-id]");
    if (!button) return;
    select(button.dataset.placeId);
  });

  updateUi();

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(group);
    for (const sprite of sprites.values()) group.remove(sprite);
    sprites.clear();
    labelSprite.userData.texture?.dispose?.();
    labelSprite.material?.dispose?.();
    for (const material of materials.values()) material.dispose?.();
    selectedMaterial.dispose?.();
    pinTexture.dispose?.();
    group.clear();
  }

  return {
    setActive,
    handleTap,
    handleHover,
    serialize,
    restore,
    select,
    getSelectedId: () => selectedId,
    isInteracting: () => interaction !== "idle",
    cancelInteraction: () => setInteraction("idle"),
    dispose,
  };
}

export { CATEGORIES as PLACE_CATEGORIES };
