import * as THREE from "three";

const bridge = window.__RMB_PART8_BRIDGE__ ?? {
  core: null,
  renderCallbacks: new Set(),
  data: {
    places: [],
    routeNetwork: {
      nodes: [],
      edges: [],
    },
  },
};

window.__RMB_PART8_BRIDGE__ = bridge;

if (!THREE.WebGLRenderer.prototype.__rmbPart8Patched) {
  const originalRender = THREE.WebGLRenderer.prototype.render;

  THREE.WebGLRenderer.prototype.render = function patchedRender(scene, camera) {
    bridge.core = {
      scene,
      camera,
      renderer: this,
    };

    for (const callback of bridge.renderCallbacks) {
      try {
        callback(bridge.core);
      } catch (error) {
        console.error("[RMB Parte 8] render callback", error);
      }
    }

    return originalRender.call(this, scene, camera);
  };

  THREE.WebGLRenderer.prototype.__rmbPart8Patched = true;
}

if (!window.__RMB_PART8_BLOB_PATCHED__) {
  const NativeBlob = window.Blob;

  class ResortMapBlob extends NativeBlob {
    constructor(parts = [], options = {}) {
      let nextParts = parts;
      const type = String(options?.type ?? "").toLowerCase();

      if (
        type.includes("application/json") &&
        Array.isArray(parts) &&
        parts.length === 1 &&
        typeof parts[0] === "string"
      ) {
        try {
          const document = JSON.parse(parts[0]);

          if (document?.schema === "resort-map-builder") {
            document.part8 = {
              version: 1,
              places: structuredClone(bridge.data.places ?? []),
              routeNetwork: structuredClone(
                bridge.data.routeNetwork ?? { nodes: [], edges: [] }
              ),
            };

            nextParts = [JSON.stringify(document, null, 2)];
          }
        } catch {
          // No es un JSON del proyecto. Se deja intacto.
        }
      }

      super(nextParts, options);
    }
  }

  window.Blob = ResortMapBlob;
  window.__RMB_PART8_BLOB_PATCHED__ = true;
}
