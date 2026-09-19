import * as THREE from "three";

const AXIS_COLORS = {
  X: "#d45252",
  Y: "#3d9959",
  Z: "#4e70d1",
};

function makeAxisTexture(label, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 96, 96);
  context.font = "800 58px -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 11;
  context.strokeStyle = "rgba(255,255,255,.97)";
  context.strokeText(label, 48, 50);
  context.fillStyle = color;
  context.fillText(label, 48, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createAxisSprite(label) {
  const texture = makeAxisTexture(label, AXIS_COLORS[label]);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.name = `RMB_AXIS_LABEL_${label}`;
  sprite.frustumCulled = false;
  sprite.renderOrder = 1002;
  sprite.raycast = () => {};
  sprite.userData.axisLabel = label;
  sprite.userData.axisTexture = texture;
  return sprite;
}

function worldUnitsPerPixel(camera, renderer, worldPoint) {
  camera.updateMatrixWorld();
  const cameraPoint = worldPoint.clone().applyMatrix4(camera.matrixWorldInverse);
  const depth = Math.max(0.25, Math.abs(cameraPoint.z));
  const height = Math.max(1, renderer.domElement.clientHeight || renderer.domElement.height || 1);
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * depth;
  return visibleHeight / height;
}

/**
 * Etiquetas X/Y/Z realmente 3D para TransformControls.
 * No usa offsets DOM, por lo que paneles laterales, DPR y resize no alteran
 * la relación entre el gizmo y sus letras.
 */
export function createAxisOverlay({
  scene,
  camera,
  renderer,
  transformControls,
  getSelectedObject,
  getTransformMode,
  isEnabled = () => true,
}) {
  const group = new THREE.Group();
  group.name = "RMB_AXIS_LABELS_3D";
  group.visible = false;

  const sprites = {
    X: createAxisSprite("X"),
    Y: createAxisSprite("Y"),
    Z: createAxisSprite("Z"),
  };

  group.add(sprites.X, sprites.Y, sprites.Z);
  scene.add(group);

  const origin = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  let dirty = true;
  let disposed = false;

  function markDirty() {
    dirty = true;
  }

  function hide() {
    group.visible = false;
    for (const sprite of Object.values(sprites)) sprite.visible = false;
  }

  function update(force = false) {
    if (disposed || (!dirty && !force)) return;
    dirty = false;

    const object = getSelectedObject?.();
    if (
      !isEnabled?.() ||
      !object ||
      transformControls?.object !== object
    ) {
      hide();
      return;
    }

    object.updateWorldMatrix(true, false);
    object.getWorldPosition(origin);
    object.getWorldQuaternion(quaternion);

    const mode = getTransformMode?.() || transformControls.mode || "translate";
    const localAxes = mode === "scale" || mode === "rotate";
    const pxToWorld = worldUnitsPerPixel(camera, renderer, origin);
    const offsetPixels = mode === "rotate" ? 48 : 55;
    const labelPixels = 17;
    const offsetWorld = Math.max(0.08, pxToWorld * offsetPixels);
    const labelWorld = Math.max(0.035, pxToWorld * labelPixels);

    const definitions = [
      ["X", 1, 0, 0],
      ["Y", 0, 1, 0],
      ["Z", 0, 0, 1],
    ];

    group.visible = true;

    for (const [axis, x, y, z] of definitions) {
      const sprite = sprites[axis];
      const visible = transformControls?.[`show${axis}`] !== false;
      sprite.visible = visible;
      if (!visible) continue;

      direction.set(x, y, z);
      if (localAxes) direction.applyQuaternion(quaternion);
      direction.normalize();

      sprite.position.copy(origin).addScaledVector(direction, offsetWorld);
      sprite.scale.set(labelWorld, labelWorld, 1);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(group);
    for (const sprite of Object.values(sprites)) {
      sprite.userData.axisTexture?.dispose?.();
      sprite.material?.dispose?.();
    }
    group.clear();
  }

  return {
    markDirty,
    update,
    hide,
    dispose,
  };
}
