import * as THREE from "three";

const PRESETS = Object.freeze([
  { id: "lindo-50-51", hotel: "lindo", area: "50-51", label: "50-51" },
  { id: "lindo-52-55", hotel: "lindo", area: "52-55", label: "52-55" },
  { id: "lindo-lobby", hotel: "lindo", area: "lobby", label: "Lobby" },
  { id: "maya-60", hotel: "maya", area: "60", label: "60" },
  { id: "maya-61-62", hotel: "maya", area: "61-62", label: "61-62" },
  { id: "maya-63-64", hotel: "maya", area: "63-64", label: "63-64" },
  { id: "maya-65-66", hotel: "maya", area: "65-66", label: "65-66" },
  { id: "maya-lobby", hotel: "maya", area: "lobby", label: "Lobby" },
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function presetById(id) {
  return PRESETS.find((item) => item.id === id) || null;
}

function makeTargetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  ctx.shadowColor = "rgba(0,0,0,.18)";
  ctx.shadowBlur = 7;
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#426f8f";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5;
  for (const [x1,y1,x2,y2] of [[-40,0,-24,0],[24,0,40,0],[0,-40,0,-24],[0,24,0,40]]) {
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  }
  ctx.fillStyle = "#426f8f";
  ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function createViewCentersManager({
  scene,
  panel,
  snapPoint = (point) => point,
  getRouteNetwork = () => ({ nodes: [] }),
  onMutate = () => {},
  onInteractionChange = () => {},
}) {
  const group = new THREE.Group();
  group.name = "RMB_VIEW_CENTERS";
  scene.add(group);

  const texture = makeTargetTexture();
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  });

  const positions = new Map();
  const sprites = new Map();
  let interaction = "idle";
  let visible = true;

  const hotelSelect = panel?.querySelector("#viewCenterHotel");
  const areaSelect = panel?.querySelector("#viewCenterArea");
  const status = panel?.querySelector("#viewCenterStatus");
  const placeButton = panel?.querySelector("#viewCenterPlace");
  const deleteButton = panel?.querySelector("#viewCenterDelete");
  const list = panel?.querySelector("#viewCenterList");
  const visibleToggle = panel?.querySelector("#viewCenterVisibleToggle");

  function hotelLabel(hotel) {
    return hotel === "maya" ? "Maya" : "Lindo";
  }

  function currentPreset() {
    const hotel = hotelSelect?.value || "lindo";
    const area = areaSelect?.value || "";
    return PRESETS.find((p) => p.hotel === hotel && p.area === area) || null;
  }

  function updateAreaOptions() {
    if (!areaSelect) return;
    const hotel = hotelSelect?.value || "lindo";
    const previous = areaSelect.value;
    areaSelect.replaceChildren();
    for (const item of PRESETS.filter((p) => p.hotel === hotel)) {
      const option = document.createElement("option");
      option.value = item.area;
      option.textContent = item.label;
      areaSelect.appendChild(option);
    }
    if ([...areaSelect.options].some((option) => option.value === previous)) {
      areaSelect.value = previous;
    }
  }

  function nearestRouteNode(position) {
    const nodes = getRouteNetwork()?.nodes || [];
    let best = null;
    for (const node of nodes) {
      const p = Array.isArray(node.position) ? node.position : [0,0,0];
      const distance = Math.hypot(
        Number(p[0] || 0) - position[0],
        Number(p[2] || 0) - position[2]
      );
      if (!best || distance < best.distance) best = { id: node.id, distance };
    }
    return best;
  }

  function syncSprites() {
    for (const [id, sprite] of sprites) {
      if (!positions.has(id)) {
        group.remove(sprite);
        sprites.delete(id);
      }
    }

    for (const [id, position] of positions) {
      let sprite = sprites.get(id);
      if (!sprite) {
        sprite = new THREE.Sprite(material);
        sprite.name = `Centrador: ${id}`;
        sprite.scale.set(0.032, 0.032, 1);
        sprite.center.set(0.5, 0.5);
        sprite.renderOrder = 890;
        sprite.raycast = () => {};
        group.add(sprite);
        sprites.set(id, sprite);
      }
      sprite.position.set(position[0], 0.08, position[2]);
      sprite.visible = visible;
    }
  }

  function renderList() {
    if (!list) return;
    list.replaceChildren();
    for (const hotel of ["lindo","maya"]) {
      for (const preset of PRESETS.filter((p) => p.hotel === hotel)) {
        const row = document.createElement("div");
        row.className = `view-center-row${positions.has(preset.id) ? " configured" : ""}`;
        const label = document.createElement("strong");
        label.textContent = `${hotelLabel(hotel)} · ${preset.label}`;
        const state = document.createElement("span");
        if (positions.has(preset.id)) {
          const p = positions.get(preset.id);
          state.textContent = `${round2(p[0])}, ${round2(p[2])} m`;
        } else {
          state.textContent = "Pendiente";
        }
        row.append(label, state);
        list.append(row);
      }
    }
  }

  function updateUi() {
    const preset = currentPreset();
    const position = preset ? positions.get(preset.id) : null;
    if (status) {
      if (!preset) {
        status.textContent = "Selecciona hotel y zona.";
      } else if (!position) {
        status.textContent = `${hotelLabel(preset.hotel)} · ${preset.label}: todavía no está colocado.`;
      } else {
        const nearest = nearestRouteNode(position);
        status.textContent = nearest
          ? `${hotelLabel(preset.hotel)} · ${preset.label}: X ${round2(position[0])} · Z ${round2(position[2])} m · nodo más cercano ${round2(nearest.distance)} m.`
          : `${hotelLabel(preset.hotel)} · ${preset.label}: X ${round2(position[0])} · Z ${round2(position[2])} m.`;
      }
    }
    if (deleteButton) deleteButton.disabled = !position;
    if (placeButton) placeButton.textContent = position ? "⌖ Reubicar" : "⌖ Colocar";
    if (visibleToggle) {
      visibleToggle.textContent = visible ? "Visibles" : "Ocultos";
      visibleToggle.setAttribute("aria-checked", String(visible));
    }
    renderList();
    syncSprites();
  }

  function setInteraction(next) {
    interaction = next === "place" ? "place" : "idle";
    const preset = currentPreset();
    onInteractionChange(
      interaction,
      interaction === "place" && preset
        ? `CENTRADOR · ${hotelLabel(preset.hotel)} ${preset.label} · toca el plano`
        : ""
    );
  }

  function handleTap(_event, point) {
    if (interaction !== "place") return false;
    const preset = currentPreset();
    if (!preset || !point) return true;
    const snapped = snapPoint(point);
    positions.set(preset.id, [Number(snapped.x)||0, 0, Number(snapped.z)||0]);
    setInteraction("idle");
    updateUi();
    onMutate("Colocar centrador de vista");
    return true;
  }

  function serialize() {
    const result = [];
    for (const preset of PRESETS) {
      const position = positions.get(preset.id);
      if (!position) continue;
      const nearest = nearestRouteNode(position);
      result.push({
        ...clone(preset),
        position: [...position],
        nearestRouteNodeId: nearest?.id || null,
        nearestRouteNodeDistanceMeters: nearest ? round2(nearest.distance) : null,
        initialView: {
          mode: "aerial-oblique",
          target: [...position],
          cameraOffset: [14, 12, 16],
          fov: 45,
        },
      });
    }
    return result;
  }

  function restore(input) {
    positions.clear();
    for (const item of Array.isArray(input) ? input : []) {
      const preset = presetById(item?.id);
      if (!preset || !Array.isArray(item.position)) continue;
      positions.set(preset.id, [Number(item.position[0])||0, 0, Number(item.position[2])||0]);
    }
    setInteraction("idle");
    updateAreaOptions();
    updateUi();
  }

  hotelSelect?.addEventListener("change", () => { updateAreaOptions(); updateUi(); });
  areaSelect?.addEventListener("change", updateUi);
  placeButton?.addEventListener("click", () => setInteraction("place"));
  deleteButton?.addEventListener("click", () => {
    const preset = currentPreset();
    if (!preset || !positions.has(preset.id)) return;
    positions.delete(preset.id);
    updateUi();
    onMutate("Quitar centrador de vista");
  });
  visibleToggle?.addEventListener("click", () => {
    visible = !visible;
    updateUi();
  });

  updateAreaOptions();
  updateUi();

  return {
    handleTap,
    serialize,
    restore,
    isInteracting: () => interaction !== "idle",
    cancelInteraction: () => setInteraction("idle"),
    dispose() {
      scene.remove(group);
      for (const sprite of sprites.values()) group.remove(sprite);
      sprites.clear();
      material.dispose?.();
      texture.dispose?.();
    },
  };
}

export { PRESETS as VIEW_CENTER_PRESETS };
