import * as THREE from "three";

const EPS = 1e-6;
const DEFAULT_PATH_BASE_X = 5.5;
const DEFAULT_PATH_BASE_Y = 0.08;
const DEFAULT_PATH_BASE_Z = 1.6;

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isPathObject(object) {
  return object?.userData?.propType === "path";
}

function frameForPath(object) {
  if (!isPathObject(object)) {
    return null;
  }

  object.updateWorldMatrix(true, true);

  const base = object.userData?.baseDimensions || {};
  const baseX = Math.max(EPS, finite(base.x, DEFAULT_PATH_BASE_X));
  const baseY = Math.max(EPS, finite(base.y, DEFAULT_PATH_BASE_Y));
  const baseZ = Math.max(EPS, finite(base.z, DEFAULT_PATH_BASE_Z));

  const scaleX = Math.max(EPS, Math.abs(finite(object.scale.x, 1)));
  const scaleY = Math.max(EPS, Math.abs(finite(object.scale.y, 1)));
  const scaleZ = Math.max(EPS, Math.abs(finite(object.scale.z, 1)));

  const center3 = object.getWorldPosition(new THREE.Vector3());
  const quaternion = object.getWorldQuaternion(new THREE.Quaternion());

  const direction3 = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
  const direction = new THREE.Vector2(direction3.x, direction3.z);

  if (direction.lengthSq() < EPS) {
    return null;
  }

  direction.normalize();

  const side = new THREE.Vector2(-direction.y, direction.x);

  return {
    object,
    center: new THREE.Vector2(center3.x, center3.z),
    worldY: center3.y,
    direction,
    side,
    baseX,
    baseY,
    baseZ,
    halfLength: (baseX * scaleX) * 0.5,
    halfWidth: (baseZ * scaleZ) * 0.5,
    height: baseY * scaleY,
  };
}

function slabInterval(origin, delta, halfExtent, interval) {
  if (Math.abs(delta) < EPS) {
    return Math.abs(origin) <= halfExtent + EPS;
  }

  let a = (-halfExtent - origin) / delta;
  let b = (halfExtent - origin) / delta;

  if (a > b) {
    const temp = a;
    a = b;
    b = temp;
  }

  interval.min = Math.max(interval.min, a);
  interval.max = Math.min(interval.max, b);

  return interval.min <= interval.max + EPS;
}

/**
 * Intersects the infinite center line of target with the horizontal,
 * oriented rectangle occupied by other.
 *
 * Returns target-line parameters t where:
 * P(t) = target.center + target.direction * t
 */
function targetLineInsideOtherInterval(target, other) {
  const rel = target.center.clone().sub(other.center);

  const originLong = rel.dot(other.direction);
  const originSide = rel.dot(other.side);

  const deltaLong = target.direction.dot(other.direction);
  const deltaSide = target.direction.dot(other.side);

  const interval = {
    min: Number.NEGATIVE_INFINITY,
    max: Number.POSITIVE_INFINITY,
  };

  if (!slabInterval(originLong, deltaLong, other.halfLength, interval)) {
    return null;
  }

  if (!slabInterval(originSide, deltaSide, other.halfWidth, interval)) {
    return null;
  }

  if (!Number.isFinite(interval.min) || !Number.isFinite(interval.max)) {
    return null;
  }

  return interval;
}

function sideOfInterval(value, interval) {
  if (value < interval.min - EPS) return -1;
  if (value > interval.max + EPS) return 1;
  return 0;
}

function applyNewTargetEnd(frame, fixedT, newEndT) {
  const newLength = Math.abs(newEndT - fixedT);

  if (!Number.isFinite(newLength) || newLength < 0.12) {
    return false;
  }

  const centerT = (fixedT + newEndT) * 0.5;
  const newCenter = frame.center
    .clone()
    .addScaledVector(frame.direction, centerT);

  const object = frame.object;
  const signX = object.scale.x < 0 ? -1 : 1;

  object.position.x = newCenter.x;
  object.position.z = newCenter.y;
  object.scale.x = signX * (newLength / frame.baseX);
  object.updateMatrixWorld(true);

  return true;
}

export function adjustPathToPath(targetObject, otherObject) {
  if (!isPathObject(targetObject) || !isPathObject(otherObject)) {
    return {
      ok: false,
      changed: false,
      message: "Selecciona exactamente dos caminos.",
    };
  }

  if (targetObject === otherObject) {
    return {
      ok: false,
      changed: false,
      message: "Los dos caminos deben ser distintos.",
    };
  }

  const target = frameForPath(targetObject);
  const other = frameForPath(otherObject);

  if (!target || !other) {
    return {
      ok: false,
      changed: false,
      message: "No se pudo calcular la orientación de los caminos.",
    };
  }

  const verticalGap = Math.abs(target.worldY - other.worldY);
  const verticalTolerance = Math.max(0.25, target.height + other.height);

  if (verticalGap > verticalTolerance) {
    return {
      ok: false,
      changed: false,
      message: "Los caminos están a alturas diferentes. Acércalos en Y antes de conectarlos.",
    };
  }

  const interval = targetLineInsideOtherInterval(target, other);

  if (!interval) {
    return {
      ok: false,
      changed: false,
      message: "El eje de este camino no alcanza al otro. Muévelos o gíralos un poco más cerca.",
    };
  }

  const negativeEnd = -target.halfLength;
  const positiveEnd = target.halfLength;

  const negativeSide = sideOfInterval(negativeEnd, interval);
  const positiveSide = sideOfInterval(positiveEnd, interval);

  // The target crosses the complete width of the other in its middle.
  // A safe endpoint trim would split the path into two pieces, so we do
  // not perform a destructive operation.
  if (
    (negativeSide === -1 && positiveSide === 1) ||
    (negativeSide === 1 && positiveSide === -1)
  ) {
    return {
      ok: false,
      changed: false,
      message: "El otro camino cruza por la mitad. Este ajuste solo recorta o extiende un extremo.",
    };
  }

  // Target is completely contained inside the other rectangle.
  if (negativeSide === 0 && positiveSide === 0) {
    return {
      ok: false,
      changed: false,
      message: "Este camino está completamente dentro del otro; no hay un extremo exterior que ajustar.",
    };
  }

  let fixedT;
  let currentEndT;
  let desiredEndT;

  if (negativeSide === 0 && positiveSide !== 0) {
    // Negative end is overlapping. Keep positive end fixed.
    fixedT = positiveEnd;
    currentEndT = negativeEnd;
    desiredEndT = positiveSide > 0 ? interval.max : interval.min;
  } else if (positiveSide === 0 && negativeSide !== 0) {
    // Positive end is overlapping. Keep negative end fixed.
    fixedT = negativeEnd;
    currentEndT = positiveEnd;
    desiredEndT = negativeSide < 0 ? interval.min : interval.max;
  } else if (negativeSide === -1 && positiveSide === -1) {
    // Both ends are before the other path. Extend the positive end.
    fixedT = negativeEnd;
    currentEndT = positiveEnd;
    desiredEndT = interval.min;
  } else if (negativeSide === 1 && positiveSide === 1) {
    // Both ends are after the other path. Extend the negative end.
    fixedT = positiveEnd;
    currentEndT = negativeEnd;
    desiredEndT = interval.max;
  } else {
    return {
      ok: false,
      changed: false,
      message: "La unión ya está en el límite o no requiere un recorte seguro.",
    };
  }

  const movement = Math.abs(desiredEndT - currentEndT);
  const safeReach = Math.max(20, target.halfLength * 4);

  if (movement > safeReach) {
    return {
      ok: false,
      changed: false,
      message: "Los caminos están demasiado lejos para un ajuste automático seguro.",
    };
  }

  if (movement < 0.003) {
    return {
      ok: true,
      changed: false,
      message: "Los caminos ya están tocando correctamente.",
    };
  }

  const oldLength = target.halfLength * 2;
  const newLength = Math.abs(desiredEndT - fixedT);

  if (!applyNewTargetEnd(target, fixedT, desiredEndT)) {
    return {
      ok: false,
      changed: false,
      message: "El ajuste dejaría el camino demasiado corto.",
    };
  }

  const action = newLength < oldLength - 0.002
    ? "recortado"
    : newLength > oldLength + 0.002
      ? "extendido"
      : "ajustado";

  return {
    ok: true,
    changed: true,
    action,
    oldLength,
    newLength,
    message: `${targetObject.name} ${action} hasta tocar ${otherObject.name}.`,
  };
}
