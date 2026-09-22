const SCHEMA = "resort-map-builder";
const VERSION = 8;
const MAX_OBJECTS = 10000;
const MAX_PLACES = 2000;
const MAX_ROUTE_NODES = 10000;
const MAX_ROUTE_EDGES = 30000;
const MAX_SAVED_ROUTES = 2000;
const MAX_PATH_CONNECTIONS = 5000;
const MAX_VIEW_CENTERS = 16;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function vector3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) {
    return [...fallback];
  }

  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2]),
  ];
}

function cleanText(value, fallback, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function validatePlaces(input) {
  const source = input === undefined ? [] : input;
  if (!Array.isArray(source)) {
    throw new Error("La lista de lugares importantes no es válida.");
  }
  if (source.length > MAX_PLACES) {
    throw new Error(`El proyecto contiene demasiados lugares (${source.length}).`);
  }

  const ids = new Set();
  return source.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Lugar inválido en la posición ${index + 1}.`);
    }

    let id = cleanText(item.id, `place-${index + 1}`, 120);
    if (ids.has(id)) id = `place-${index + 1}`;
    ids.add(id);

    const position = vector3(item.position);
    position[1] = 0;

    return {
      id,
      name: cleanText(item.name, `Lugar ${index + 1}`, 80),
      category: cleanText(item.category, "general", 40),
      color:
        typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color.trim())
          ? item.color.trim().toLowerCase()
          : "#59656f",
      position,
      locked: Boolean(item.locked),
      visible: item.visible === undefined ? true : Boolean(item.visible),
      routeNodeId:
        typeof item.routeNodeId === "string" && item.routeNodeId.trim()
          ? item.routeNodeId.trim().slice(0, 120)
          : null,
    };
  });
}

function validateRouteNetwork(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawNodes = source.nodes === undefined ? [] : source.nodes;
  const rawEdges = source.edges === undefined ? [] : source.edges;
  const rawRoutes = source.routes === undefined ? [] : source.routes;

  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges) || !Array.isArray(rawRoutes)) {
    throw new Error("La red de rutas no contiene nodos, conexiones o rutas válidas.");
  }
  if (rawNodes.length > MAX_ROUTE_NODES) {
    throw new Error(`La red contiene demasiados nodos (${rawNodes.length}).`);
  }
  if (rawEdges.length > MAX_ROUTE_EDGES) {
    throw new Error(`La red contiene demasiadas conexiones (${rawEdges.length}).`);
  }
  if (rawRoutes.length > MAX_SAVED_ROUTES) {
    throw new Error(`La red contiene demasiadas rutas guardadas (${rawRoutes.length}).`);
  }

  const routeIds = new Set();
  const routes = [];
  const colorPattern = /^#[0-9a-f]{6}$/i;
  rawRoutes.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    let id = cleanText(item.id, `route-${index + 1}`, 120);
    if (routeIds.has(id)) id = `route-${index + 1}`;
    routeIds.add(id);
    const rawColor = typeof item.color === "string" ? item.color.trim() : "";
    routes.push({
      id,
      name: cleanText(item.name, `Ruta ${index + 1}`, 80),
      color: colorPattern.test(rawColor) ? rawColor.toLowerCase() : "#59656f",
    });
  });

  const ids = new Set();
  const nodes = rawNodes.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Nodo inválido en la posición ${index + 1}.`);
    }
    let id = cleanText(item.id, `node-${index + 1}`, 120);
    if (ids.has(id)) id = `node-${index + 1}`;
    ids.add(id);
    const position = vector3(item.position);
    position[1] = 0;
    return { id, position };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set();
  const pairs = new Set();
  const edges = [];

  rawEdges.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const a = cleanText(item.a, "", 120);
    const b = cleanText(item.b, "", 120);
    if (!a || !b || a === b || !nodeIds.has(a) || !nodeIds.has(b)) return;

    const pair = a < b ? `${a}::${b}` : `${b}::${a}`;
    if (pairs.has(pair)) return;
    pairs.add(pair);

    let id = cleanText(item.id, `edge-${index + 1}`, 120);
    if (edgeIds.has(id)) id = `edge-${index + 1}`;
    edgeIds.add(id);
    const routeId = typeof item.routeId === "string" && routeIds.has(item.routeId)
      ? item.routeId
      : null;
    edges.push({ id, a, b, routeId });
  });

  const usedRouteIds = new Set(edges.map((edge) => edge.routeId).filter(Boolean));
  const validRoutes = routes.filter((route) => usedRouteIds.has(route.id));
  const validRouteIds = new Set(validRoutes.map((route) => route.id));
  for (const edge of edges) {
    if (edge.routeId && !validRouteIds.has(edge.routeId)) edge.routeId = null;
  }

  return { nodes, edges, routes: validRoutes };
}


function validatePathConnections(input, objects) {
  const source = input === undefined ? [] : input;

  if (!Array.isArray(source)) {
    throw new Error("La lista de uniones de caminos no es válida.");
  }

  if (source.length > MAX_PATH_CONNECTIONS) {
    throw new Error(`El proyecto contiene demasiadas uniones de caminos (${source.length}).`);
  }

  const paths = new Set(
    objects
      .filter((object) => object.editorType === "prop" && object.propType === "path" && object.id)
      .map((object) => object.id)
  );

  const usedIds = new Set();
  const usedPairs = new Set();
  const result = [];

  source.forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const a = cleanText(item.a, "", 120);
    const b = cleanText(item.b, "", 120);

    if (!a || !b || a === b || !paths.has(a) || !paths.has(b)) return;

    const pair = a < b ? `${a}::${b}` : `${b}::${a}`;
    if (usedPairs.has(pair)) return;
    usedPairs.add(pair);

    let id = cleanText(item.id, `path-link-${index + 1}`, 120);
    if (usedIds.has(id)) id = `path-link-${index + 1}`;
    usedIds.add(id);

    result.push({ id, a, b });
  });

  return result;
}


function validateViewCenters(input, routeNetwork) {
  const source = input === undefined ? [] : input;
  if (!Array.isArray(source)) {
    throw new Error("La lista de centradores de vista no es válida.");
  }
  if (source.length > MAX_VIEW_CENTERS) {
    throw new Error(`El proyecto contiene demasiados centradores (${source.length}).`);
  }

  const allowed = new Map([
    ["lindo-50-51", ["lindo", "50-51", "50-51"]],
    ["lindo-52-55", ["lindo", "52-55", "52-55"]],
    ["lindo-lobby", ["lindo", "lobby", "Lobby"]],
    ["maya-60", ["maya", "60", "60"]],
    ["maya-61-62", ["maya", "61-62", "61-62"]],
    ["maya-63-64", ["maya", "63-64", "63-64"]],
    ["maya-65-66", ["maya", "65-66", "65-66"]],
    ["maya-lobby", ["maya", "lobby", "Lobby"]],
  ]);

  const nodeIds = new Set((routeNetwork?.nodes || []).map((node) => node.id));
  const used = new Set();
  const result = [];

  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const id = cleanText(item.id, "", 80);
    if (!allowed.has(id) || used.has(id)) continue;
    used.add(id);

    const [hotel, area, label] = allowed.get(id);
    const position = vector3(item.position);
    position[1] = 0;
    const target = vector3(item.initialView?.target, position);
    target[1] = 0;
    const offset = vector3(item.initialView?.cameraOffset, [14, 12, 16]);
    const nodeId = typeof item.nearestRouteNodeId === "string" && nodeIds.has(item.nearestRouteNodeId)
      ? item.nearestRouteNodeId
      : null;

    result.push({
      id,
      hotel,
      area,
      label,
      position,
      nearestRouteNodeId: nodeId,
      nearestRouteNodeDistanceMeters: nodeId
        ? Math.max(0, finiteNumber(item.nearestRouteNodeDistanceMeters, 0))
        : null,
      initialView: {
        mode: "aerial-oblique",
        target,
        cameraOffset: offset,
        fov: Math.min(80, Math.max(30, finiteNumber(item.initialView?.fov, 45))),
      },
    });
  }

  return result;
}

function sanitizedObjectParams(item) {
  if (!item?.params || typeof item.params !== "object") return null;

  if (item.propType === "path") {
    const allowed = new Set(["straight", "roundabout", "curve", "wave"]);
    return {
      variant: allowed.has(item.params.variant) ? item.params.variant : "straight",
      width: Math.min(8, Math.max(0.35, finiteNumber(item.params.width, 1.6))),
      radius: Math.min(24, Math.max(1, finiteNumber(item.params.radius, 3.2))),
      angle: Math.min(330, Math.max(15, finiteNumber(item.params.angle, 90))),
      amplitude: Math.min(8, Math.max(0.15, finiteNumber(item.params.amplitude, 1.45))),
      waves: Math.min(4, Math.max(0.5, finiteNumber(item.params.waves, 1.25))),
    };
  }

  if (["stairsStraight", "stairsL", "stairsU"].includes(item.propType)) {
    return {
      steps: Math.min(
        30,
        Math.max(
          3,
          Math.round(
            finiteNumber(item.params.steps, 10)
          )
        )
      ),
    };
  }

  return null;
}

export function createProjectDocument({
  objects,
  settings,
  camera,
  places = [],
  routeNetwork = { nodes: [], edges: [], routes: [] },
  pathConnections = [],
  viewCenters = [],
}) {
  return {
    schema: SCHEMA,
    version: VERSION,
    savedAt: new Date().toISOString(),
    editor: {
      name: "Wizard Map Design",
      units: "meters",
    },
    settings,
    camera,
    objects,
    places,
    routeNetwork,
    pathConnections,
    viewCenters,
  };
}

export function validateProjectDocument(
  input,
  {
    knownPropTypes = [],
  } = {}
) {
  if (!input || typeof input !== "object") {
    throw new Error("El archivo no contiene un proyecto válido.");
  }

  if (input.schema !== SCHEMA) {
    throw new Error("Este JSON no pertenece a Resort Map Builder.");
  }

  if (![1, 2, 3, 4, 5, 6, 7, VERSION].includes(Number(input.version))) {
    throw new Error(
      `Versión de proyecto no compatible: ${input.version ?? "desconocida"}.`
    );
  }

  if (!Array.isArray(input.objects)) {
    throw new Error("El proyecto no contiene una lista de objetos.");
  }

  if (input.objects.length > MAX_OBJECTS) {
    throw new Error(
      `El proyecto contiene demasiados objetos (${input.objects.length}).`
    );
  }

  const known = new Set(knownPropTypes);

  const objects = input.objects.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Objeto inválido en la posición ${index + 1}.`);
    }

    const editorType =
      item.editorType === "building"
        ? "building"
        : item.editorType === "prop"
          ? "prop"
          : null;

    if (!editorType) {
      throw new Error(`Tipo de objeto inválido en la posición ${index + 1}.`);
    }

    if (
      editorType === "prop" &&
      (!item.propType || !known.has(item.propType))
    ) {
      throw new Error(
        `Prop desconocido "${item.propType ?? ""}" en la posición ${index + 1}.`
      );
    }

    return {
      editorType,
      propType: editorType === "prop" ? item.propType : null,
      name:
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim().slice(0, 80)
          : editorType === "building"
            ? "Edificio"
            : "Prop",
      position: vector3(item.position),
      scale: vector3(item.scale, [1, 1, 1]).map((value) =>
        Math.max(0.001, Math.abs(value))
      ),
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim().slice(0, 120)
          : null,
      rotation: Array.isArray(item.rotation)
        ? vector3(item.rotation)
        : [0, finiteNumber(item.rotationY), 0],
      rotationY: finiteNumber(item.rotationY),
      mirror: {
        x: Boolean(item.mirror?.x),
        y: Boolean(item.mirror?.y),
        z: Boolean(item.mirror?.z),
      },
      locked: Boolean(item.locked),
      opacity: Math.min(
        1,
        Math.max(0.15, finiteNumber(item.opacity, 1))
      ),
      outlineEnabled:
        item.outlineEnabled === undefined
          ? true
          : Boolean(item.outlineEnabled),
      outlineStrength: Math.min(
        1,
        Math.max(0, finiteNumber(item.outlineStrength, 0.4))
      ),
      params: sanitizedObjectParams(item),
    };
  });

  const settings = input.settings && typeof input.settings === "object"
    ? input.settings
    : {};

  const camera = input.camera && typeof input.camera === "object"
    ? input.camera
    : {};

  // Parte 8.6.1: validar la red ANTES de usarla en el retorno.
  // La 8.6 referenciaba validatedRouteNetwork sin declararla aquí.
  const validatedRouteNetwork = validateRouteNetwork(input.routeNetwork);

  return {
    schema: SCHEMA,
    version: VERSION,
    savedAt:
      typeof input.savedAt === "string"
        ? input.savedAt
        : null,
    settings: {
      snapEnabled:
        settings.snapEnabled === undefined
          ? finiteNumber(settings.snapThreshold, 0.3) > 0
          : Boolean(settings.snapEnabled),
      snapThreshold: Math.min(
        2,
        Math.max(0, finiteNumber(settings.snapThreshold, 0.3))
      ),
      objectSnapEnabled:
        settings.objectSnapEnabled === undefined
          ? finiteNumber(settings.objectSnapThreshold, 0.3) > 0
          : Boolean(settings.objectSnapEnabled),
      objectSnapThreshold: Math.min(
        2,
        Math.max(0, finiteNumber(settings.objectSnapThreshold, 0.3))
      ),
      groundSnapEnabled:
        settings.groundSnapEnabled === undefined
          ? finiteNumber(settings.groundSnapThreshold, 0.15) > 0
          : Boolean(settings.groundSnapEnabled),
      groundSnapThreshold: Math.min(
        2,
        Math.max(0, finiteNumber(settings.groundSnapThreshold, 0.15))
      ),
      oneSidedScaleEnabled: Boolean(settings.oneSidedScaleEnabled),
      showAxisLabels:
        settings.showAxisLabels === undefined
          ? true
          : Boolean(settings.showAxisLabels),
      showCompass:
        settings.showCompass === undefined
          ? true
          : Boolean(settings.showCompass),
      gridVisible:
        settings.gridVisible === undefined
          ? true
          : Boolean(settings.gridVisible),
      gridOpacity: Math.min(
        1,
        Math.max(0, finiteNumber(settings.gridOpacity, 0.55))
      ),
      groundOpacity: Math.min(
        1,
        Math.max(0.15, finiteNumber(settings.groundOpacity, 1))
      ),
      viewMode:
        settings.viewMode === "top"
          ? "top"
          : "perspective",
      referenceImage:
        settings.referenceImage && typeof settings.referenceImage === "object"
          ? {
              dataUrl:
                typeof settings.referenceImage.dataUrl === "string"
                  ? settings.referenceImage.dataUrl
                  : null,
              visible:
                settings.referenceImage.visible === undefined
                  ? true
                  : Boolean(settings.referenceImage.visible),
              opacity: Math.min(
                1,
                Math.max(0, finiteNumber(settings.referenceImage.opacity, 0.55))
              ),
              width: Math.min(
                140,
                Math.max(5, finiteNumber(settings.referenceImage.width, 140))
              ),
              height: Math.min(
                140,
                Math.max(5, finiteNumber(settings.referenceImage.height, 140))
              ),
              aspectRatio: Math.max(
                0.05,
                finiteNumber(settings.referenceImage.aspectRatio, 1)
              ),
            }
          : {
              dataUrl: null,
              visible: true,
              opacity: 0.55,
              width: 140,
              height: 140,
              aspectRatio: 1,
            },
    },
    camera: {
      position: vector3(camera.position, [42, 36, 48]),
      target: vector3(camera.target, [0, 0, 0]),
    },
    objects,
    places: validatePlaces(input.places),
    routeNetwork: validatedRouteNetwork,
    pathConnections: validatePathConnections(input.pathConnections, objects),
    viewCenters: validateViewCenters(input.viewCenters, validatedRouteNetwork),
  };
}

export function downloadProjectJson(
  projectDocument,
  filename = "resort.json"
) {
  const text = JSON.stringify(projectDocument, null, 2);
  const blob = new Blob([text], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1200);
}

export async function readProjectJson(file) {
  if (!(file instanceof File)) {
    throw new Error("Selecciona un archivo JSON.");
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error("El archivo supera el límite de 30 MB.");
  }

  const text = await file.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
}
