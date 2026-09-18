const SCHEMA = "resort-map-builder";
const VERSION = 2;
const MAX_OBJECTS = 10000;

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

export function createProjectDocument({
  objects,
  settings,
  camera,
}) {
  return {
    schema: SCHEMA,
    version: VERSION,
    savedAt: new Date().toISOString(),
    editor: {
      name: "Resort Map Builder",
      units: "meters",
    },
    settings,
    camera,
    objects,
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

  if (![1, VERSION].includes(Number(input.version))) {
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
      rotationY: finiteNumber(item.rotationY),
      locked: Boolean(item.locked),
      opacity: Math.min(
        1,
        Math.max(0.15, finiteNumber(item.opacity, 1))
      ),
      params:
        item.params && typeof item.params === "object"
          ? {
              steps: Math.min(
                30,
                Math.max(
                  3,
                  Math.round(
                    finiteNumber(item.params.steps, 10)
                  )
                )
              ),
            }
          : null,
    };
  });

  const settings = input.settings && typeof input.settings === "object"
    ? input.settings
    : {};

  const camera = input.camera && typeof input.camera === "object"
    ? input.camera
    : {};

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
            }
          : {
              dataUrl: null,
              visible: true,
              opacity: 0.55,
            },
    },
    camera: {
      position: vector3(camera.position, [42, 36, 48]),
      target: vector3(camera.target, [0, 0, 0]),
    },
    objects,
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

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("El archivo supera el límite de 10 MB.");
  }

  const text = await file.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
}
