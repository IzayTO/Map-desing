import * as THREE from "three";

const EPS = 1e-6;
const MAX_CONNECTIONS = 5000;

export function isPathObject(object) {
  return object?.userData?.propType === "path";
}

export function isStraightPathObject(object) {
  return isPathObject(object) &&
    (object?.userData?.params?.variant || "straight") === "straight";
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pairKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function baseDimensions(object) {
  const base = object?.userData?.baseDimensions || {};
  return {
    x: Math.max(EPS, finite(base.x, 5.5)),
    y: Math.max(EPS, finite(base.y, 0.08)),
    z: Math.max(EPS, finite(base.z, 1.6)),
  };
}

function worldPoint(object, x, y, z) {
  return object.localToWorld(new THREE.Vector3(x, y, z));
}

function endpointDescriptor(object, sign) {
  const base = baseDimensions(object);
  object.updateWorldMatrix(true, true);

  const scaleX = Math.max(EPS, Math.abs(finite(object.scale.x, 1)));
  const widthWorld = base.z * Math.abs(finite(object.scale.z, 1));
  // Cubrimos una franja generosa de ambos caminos para tapar las líneas
  // internas del extremo y convertir la unión en una sola superficie visual.
  const overlapWorld = Math.min(1.35, Math.max(0.52, widthWorld * 0.72));
  const overlapLocal = Math.min(base.x * 0.42, overlapWorld / scaleX);

  const endX = sign * base.x * 0.5;
  const insideX = sign * Math.max(0, base.x * 0.5 - overlapLocal);
  const halfZ = base.z * 0.5;

  const center = worldPoint(object, endX, base.y, 0);
  const topA = worldPoint(object, insideX, base.y, -halfZ);
  const topB = worldPoint(object, insideX, base.y, halfZ);
  const bottomA = worldPoint(object, insideX, 0, -halfZ);
  const bottomB = worldPoint(object, insideX, 0, halfZ);

  return {
    object,
    sign,
    center,
    top: [topA, topB],
    bottom: [bottomA, bottomB],
    widthWorld: topA.distanceTo(topB),
    heightWorld: Math.max(
      0.02,
      (topA.distanceTo(bottomA) + topB.distanceTo(bottomB)) * 0.5
    ),
  };
}

function nearestEndpointPair(a, b) {
  const aEnds = [endpointDescriptor(a, -1), endpointDescriptor(a, 1)];
  const bEnds = [endpointDescriptor(b, -1), endpointDescriptor(b, 1)];
  let best = null;

  for (const ea of aEnds) {
    for (const eb of bEnds) {
      const horizontal = Math.hypot(
        ea.center.x - eb.center.x,
        ea.center.z - eb.center.z
      );
      const vertical = Math.abs(ea.center.y - eb.center.y);
      const score = horizontal + vertical * 3;

      if (!best || score < best.score) {
        best = { a: ea, b: eb, score, horizontal, vertical };
      }
    }
  }

  return best;
}

function convexHullXZ(points) {
  const unique = [];
  const seen = new Set();

  for (const point of points) {
    const key = `${point.x.toFixed(5)}:${point.z.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ x: point.x, z: point.z });
  }

  if (unique.length < 3) return [];

  unique.sort((p, q) => p.x === q.x ? p.z - q.z : p.x - q.x);

  const cross = (o, a, b) =>
    (a.x - o.x) * (b.z - o.z) -
    (a.z - o.z) * (b.x - o.x);

  const lower = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= EPS) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= EPS) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function polygonAreaXZ(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area) * 0.5;
}

function sourcePathMaterial(object) {
  let source = null;

  object?.traverse?.((child) => {
    if (source || !child?.isMesh || child.userData?.isOutlinePart) return;
    const candidate = Array.isArray(child.material)
      ? child.material.find(Boolean)
      : child.material;
    if (candidate) source = candidate;
  });

  let material;
  if (source?.clone) {
    material = source.clone();
  } else {
    material = new THREE.MeshStandardMaterial({
      color: 0xc7beb1,
      roughness: 1,
    });
  }

  material.transparent = Boolean(material.transparent || material.opacity < 0.999);
  material.depthTest = true;
  material.depthWrite = material.opacity >= 0.999;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
  return material;
}

function buildBridgeMesh(a, b) {
  const nearest = nearestEndpointPair(a, b);
  if (!nearest) {
    return { ok: false, message: "No se pudieron localizar los extremos de los caminos." };
  }

  const maxGap = Math.max(
    2.4,
    (nearest.a.widthWorld + nearest.b.widthWorld) * 1.35
  );

  if (nearest.horizontal > maxGap) {
    return {
      ok: false,
      message: "Los extremos están demasiado lejos. Acércalos antes de unirlos.",
    };
  }

  const maxVertical = Math.max(0.22, nearest.a.heightWorld + nearest.b.heightWorld);
  if (nearest.vertical > maxVertical) {
    return {
      ok: false,
      message: "Los caminos están a alturas distintas. Alinéalos en Y antes de unirlos.",
    };
  }

  const hull = convexHullXZ([
    ...nearest.a.top,
    ...nearest.b.top,
  ]);

  if (hull.length < 3 || polygonAreaXZ(hull) < 0.002) {
    return {
      ok: false,
      message: "Los caminos ya están prácticamente unidos o la unión sería demasiado pequeña.",
    };
  }

  const allTopY = [...nearest.a.top, ...nearest.b.top].map((p) => p.y);

  // La 8.6 usa una tapa única, horizontal y muy ligeramente elevada.
  // No hay paredes laterales en la pieza de unión, por lo que desaparece
  // el trapecio sombreado que delataba la pieza en 8.5.
  const topY = Math.max(...allTopY) + 0.0022;
  const n = hull.length;
  const positions = [];
  const indices = [];

  for (const p of hull) positions.push(p.x, topY, p.z);

  // El hull está en sentido antihorario X/Z. Invertimos el abanico para +Y.
  for (let i = 1; i < n - 1; i += 1) {
    indices.push(0, i + 1, i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = sourcePathMaterial(a);
  material.side = THREE.DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -5;
  material.polygonOffsetUnits = -5;
  material.needsUpdate = true;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "RMB_PATH_CONNECTION_PATCH";
  mesh.renderOrder = 60;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  mesh.userData.isPathConnectionPatch = true;

  return {
    ok: true,
    mesh,
    message: "Unión visual creada. La tapa continua cubre el hueco y las líneas internas sin recortar ninguno de los dos caminos.",
  };
}

function disposeMesh(mesh) {
  if (!mesh) return;
  mesh.parent?.remove(mesh);
  mesh.geometry?.dispose?.();

  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  for (const material of materials) material?.dispose?.();
}

export function createPathConnectionManager({ scene }) {
  const group = new THREE.Group();
  group.name = "RMB_PATH_CONNECTIONS";
  scene.add(group);

  let records = [];
  const meshes = new Map();
  let objectLookup = new Map();

  function rebuildLookup(objects = []) {
    objectLookup = new Map(
      objects
        .filter((object) => object?.userData?.id)
        .map((object) => [object.userData.id, object])
    );
  }

  function objectsForRecord(record) {
    const a = objectLookup.get(record.a);
    const b = objectLookup.get(record.b);
    if (!isStraightPathObject(a) || !isStraightPathObject(b)) return null;
    return [a, b];
  }

  function rebuildRecord(record) {
    disposeMesh(meshes.get(record.id));
    meshes.delete(record.id);

    const pair = objectsForRecord(record);
    if (!pair) return { ok: false, message: "Ya no existen ambos caminos." };

    const built = buildBridgeMesh(pair[0], pair[1]);
    if (!built.ok) return built;

    built.mesh.userData.pathConnectionId = record.id;
    built.mesh.userData.pathA = record.a;
    built.mesh.userData.pathB = record.b;
    group.add(built.mesh);
    meshes.set(record.id, built.mesh);
    return built;
  }

  function hasPair(a, b) {
    const aId = a?.userData?.id;
    const bId = b?.userData?.id;
    if (!aId || !bId) return false;
    const key = pairKey(aId, bId);
    return records.some((record) => pairKey(record.a, record.b) === key);
  }

  function connect(a, b, objects = []) {
    if (!isPathObject(a) || !isPathObject(b) || a === b) {
      return { ok: false, changed: false, message: "Selecciona exactamente dos caminos distintos." };
    }

    if (!isStraightPathObject(a) || !isStraightPathObject(b)) {
      return {
        ok: false,
        changed: false,
        message: "La unión automática es solo para caminos rectos. Las curvas, rotondas y ondulados ya tienen su propia geometría.",
      };
    }

    if (records.length >= MAX_CONNECTIONS) {
      return { ok: false, changed: false, message: "Se alcanzó el límite de uniones guardadas." };
    }

    rebuildLookup(objects);

    const aId = a.userData?.id;
    const bId = b.userData?.id;
    if (!aId || !bId) {
      return { ok: false, changed: false, message: "Los caminos no tienen identificadores válidos." };
    }

    const key = pairKey(aId, bId);
    const existing = records.find((record) => pairKey(record.a, record.b) === key);

    if (existing) {
      const result = rebuildRecord(existing);
      return {
        ...result,
        changed: Boolean(result.ok),
        existing: true,
        message: result.ok
          ? "Unión actualizada con la posición actual de los caminos."
          : result.message,
      };
    }

    const record = {
      id: makeId("path-link"),
      a: aId,
      b: bId,
    };

    records.push(record);
    const result = rebuildRecord(record);

    if (!result.ok) {
      records = records.filter((item) => item !== record);
      return { ...result, changed: false };
    }

    return { ...result, changed: true, existing: false };
  }

  function removePair(a, b) {
    const aId = a?.userData?.id;
    const bId = b?.userData?.id;
    if (!aId || !bId) return false;

    const key = pairKey(aId, bId);
    const record = records.find((item) => pairKey(item.a, item.b) === key);
    if (!record) return false;

    disposeMesh(meshes.get(record.id));
    meshes.delete(record.id);
    records = records.filter((item) => item.id !== record.id);
    return true;
  }

  function removeForObject(objectOrId) {
    const id = typeof objectOrId === "string"
      ? objectOrId
      : objectOrId?.userData?.id;

    if (!id) return false;

    const removing = records.filter((record) => record.a === id || record.b === id);
    if (!removing.length) return false;

    for (const record of removing) {
      disposeMesh(meshes.get(record.id));
      meshes.delete(record.id);
    }

    records = records.filter((record) => record.a !== id && record.b !== id);
    return true;
  }

  function updateForObject(object, objects = []) {
    const id = object?.userData?.id;
    if (!id) return;

    rebuildLookup(objects);
    for (const record of records) {
      if (record.a === id || record.b === id) rebuildRecord(record);
    }
  }

  function serialize() {
    return records.map((record) => ({ ...record }));
  }

  function clear() {
    for (const mesh of meshes.values()) disposeMesh(mesh);
    meshes.clear();
    records = [];
    objectLookup.clear();
  }

  function restore(input, objects = []) {
    clear();
    rebuildLookup(objects);

    const source = Array.isArray(input) ? input : [];
    const usedPairs = new Set();
    const usedIds = new Set();

    for (const item of source) {
      if (!item || typeof item !== "object") continue;
      const a = typeof item.a === "string" ? item.a : "";
      const b = typeof item.b === "string" ? item.b : "";
      if (!a || !b || a === b) continue;
      if (!isStraightPathObject(objectLookup.get(a)) || !isStraightPathObject(objectLookup.get(b))) continue;

      const key = pairKey(a, b);
      if (usedPairs.has(key)) continue;
      usedPairs.add(key);

      let id = typeof item.id === "string" && item.id.trim()
        ? item.id.trim().slice(0, 120)
        : makeId("path-link");
      if (usedIds.has(id)) id = makeId("path-link");
      usedIds.add(id);

      const record = { id, a, b };
      records.push(record);
      rebuildRecord(record);
    }
  }

  function dispose() {
    clear();
    scene.remove(group);
  }

  return {
    connect,
    removePair,
    removeForObject,
    hasPair,
    updateForObject,
    serialize,
    restore,
    clear,
    dispose,
  };
}
