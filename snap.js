import * as THREE from "three";

export const GRID_SIZE = 140;
export const GRID_DIVISIONS = 70;
export const GRID_STEP = GRID_SIZE / GRID_DIVISIONS; // 2 m
export const MAGNET_THRESHOLD = 0.36;
export const OBJECT_MAGNET_THRESHOLD = 0.30;

export function magnetizeValue(
  value,
  {
    enabled = true,
    step = GRID_STEP,
    threshold = MAGNET_THRESHOLD,
  } = {}
) {
  if (!enabled || !Number.isFinite(value)) {
    return value;
  }

  const nearest = Math.round(value / step) * step;

  return Math.abs(value - nearest) <= threshold
    ? nearest
    : value;
}

export function magnetizeXZ(
  x,
  z,
  options = {}
) {
  return {
    x: magnetizeValue(x, options),
    z: magnetizeValue(z, options),
  };
}

function bestAxisSnap(movingBox, targetBox, axis, threshold) {
  const movingMin = movingBox.min[axis];
  const movingMax = movingBox.max[axis];
  const movingCenter = (movingMin + movingMax) * 0.5;

  const targetMin = targetBox.min[axis];
  const targetMax = targetBox.max[axis];
  const targetCenter = (targetMin + targetMax) * 0.5;

  // Orden intencional: primero borde contra borde,
  // después alineación de bordes y finalmente centros.
  const candidates = [
    targetMin - movingMax,
    targetMax - movingMin,
    targetMin - movingMin,
    targetMax - movingMax,
    targetCenter - movingCenter,
  ];

  let best = null;

  for (const delta of candidates) {
    const distance = Math.abs(delta);

    if (
      distance <= threshold &&
      (best === null || distance < Math.abs(best))
    ) {
      best = delta;
    }
  }

  return best;
}

export function snapObjectToObjects(
  movingObject,
  objects,
  {
    enabled = true,
    threshold = OBJECT_MAGNET_THRESHOLD,
  } = {}
) {
  if (!enabled || !movingObject || !Array.isArray(objects)) {
    return {
      snappedX: false,
      snappedZ: false,
      deltaX: 0,
      deltaZ: 0,
    };
  }

  movingObject.updateWorldMatrix(true, true);

  const movingBox = new THREE.Box3().setFromObject(movingObject);

  let bestX = null;
  let bestZ = null;

  for (const target of objects) {
    if (!target || target === movingObject || !target.visible) {
      continue;
    }

    target.updateWorldMatrix(true, true);

    const targetBox = new THREE.Box3().setFromObject(target);

    const deltaX = bestAxisSnap(
      movingBox,
      targetBox,
      "x",
      threshold
    );

    const deltaZ = bestAxisSnap(
      movingBox,
      targetBox,
      "z",
      threshold
    );

    if (
      deltaX !== null &&
      (
        bestX === null ||
        Math.abs(deltaX) < Math.abs(bestX)
      )
    ) {
      bestX = deltaX;
    }

    if (
      deltaZ !== null &&
      (
        bestZ === null ||
        Math.abs(deltaZ) < Math.abs(bestZ)
      )
    ) {
      bestZ = deltaZ;
    }
  }

  if (bestX !== null) {
    movingObject.position.x += bestX;
  }

  if (bestZ !== null) {
    movingObject.position.z += bestZ;
  }

  return {
    snappedX: bestX !== null,
    snappedZ: bestZ !== null,
    deltaX: bestX ?? 0,
    deltaZ: bestZ ?? 0,
  };
}
