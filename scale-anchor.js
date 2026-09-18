import * as THREE from "three";

/*
  Escalado desde un solo lado.

  - PC: mantener Shift durante el arrastre de un eje.
  - Móvil: el editor proporciona un toggle persistente.
  - Solo actúa en handles X/Y/Z individuales.
  - Mantiene fijo el lado opuesto desplazando el centro
    exactamente la mitad del cambio dimensional.
*/

export function setupOneSidedScale({
  camera,
  element,
  getObject,
  getMode,
  isToggleEnabled,
  canAnchor,
  getBaseDimension,
}) {
  let shiftHeld = false;
  let dragging = false;
  let axis = null;
  let session = null;

  const pointer = new THREE.Vector2();
  const centerWorld = new THREE.Vector3();
  const positiveWorld = new THREE.Vector3();
  const objectWorldQuaternion = new THREE.Quaternion();
  const localAxis = new THREE.Vector3();
  const axisInParent = new THREE.Vector3();
  const initialPosition = new THREE.Vector3();

  function active() {
    return Boolean(isToggleEnabled?.() || shiftHeld);
  }

  function updatePointer(event) {
    pointer.set(event.clientX, event.clientY);
  }

  function validAxis(value) {
    return value === "X" || value === "Y" || value === "Z";
  }

  function axisVector(value, target) {
    target.set(0, 0, 0);

    if (value === "X") target.x = 1;
    if (value === "Y") target.y = 1;
    if (value === "Z") target.z = 1;

    return target;
  }

  function getHandleSign(object, currentAxis) {
    if (!validAxis(currentAxis)) {
      return 1;
    }

    const rect = element.getBoundingClientRect();

    object.getWorldPosition(centerWorld);
    object.getWorldQuaternion(objectWorldQuaternion);

    axisVector(currentAxis, localAxis)
      .applyQuaternion(objectWorldQuaternion)
      .normalize();

    positiveWorld
      .copy(centerWorld)
      .addScaledVector(localAxis, 1);

    const centerNdc = centerWorld.clone().project(camera);
    const positiveNdc = positiveWorld.clone().project(camera);

    const cx = rect.left + (centerNdc.x + 1) * 0.5 * rect.width;
    const cy = rect.top + (1 - centerNdc.y) * 0.5 * rect.height;

    const px = rect.left + (positiveNdc.x + 1) * 0.5 * rect.width;
    const py = rect.top + (1 - positiveNdc.y) * 0.5 * rect.height;

    const axisX = px - cx;
    const axisY = py - cy;
    const pointerX = pointer.x - cx;
    const pointerY = pointer.y - cy;

    const axisLengthSq = axisX * axisX + axisY * axisY;

    if (axisLengthSq < 0.001) {
      return 1;
    }

    return pointerX * axisX + pointerY * axisY >= 0
      ? 1
      : -1;
  }

  function startSession() {
    const object = getObject?.();

    if (
      !dragging ||
      !object ||
      getMode?.() !== "scale" ||
      !validAxis(axis) ||
      !canAnchor?.(object)
    ) {
      session = null;
      return;
    }

    const key = axis.toLowerCase();

    initialPosition.copy(object.position);

    // La posición del objeto está expresada en coordenadas de su padre.
    // Por eso usamos su quaternion local para la dirección del eje.
    axisVector(axis, axisInParent)
      .applyQuaternion(object.quaternion)
      .normalize();

    session = {
      object,
      axis,
      key,
      sign: getHandleSign(object, axis),
      startScale: object.scale[key],
      startPosition: initialPosition.clone(),
      axisInParent: axisInParent.clone(),
      baseDimension: Math.max(
        0.0001,
        Number(getBaseDimension?.(object, key)) || 1
      ),
    };
  }

  function beginDrag(currentAxis) {
    dragging = true;
    axis = currentAxis;

    if (active()) {
      startSession();
    }
  }

  function endDrag() {
    dragging = false;
    axis = null;
    session = null;
  }

  function refreshMode() {
    if (!dragging) {
      session = null;
      return;
    }

    if (active()) {
      startSession();
    } else {
      session = null;
    }
  }

  function apply() {
    const object = getObject?.();

    if (
      !dragging ||
      !active() ||
      !object ||
      !canAnchor?.(object) ||
      getMode?.() !== "scale" ||
      !validAxis(axis)
    ) {
      return false;
    }

    if (
      !session ||
      session.object !== object ||
      session.axis !== axis
    ) {
      startSession();
    }

    if (!session) {
      return false;
    }

    const scaleDelta =
      object.scale[session.key] -
      session.startScale;

    const dimensionDelta =
      scaleDelta *
      session.baseDimension;

    object.position
      .copy(session.startPosition)
      .addScaledVector(
        session.axisInParent,
        session.sign * dimensionDelta * 0.5
      );

    return true;
  }

  function onKeyDown(event) {
    if (event.key !== "Shift") return;

    if (!shiftHeld) {
      shiftHeld = true;
      refreshMode();
    }
  }

  function onKeyUp(event) {
    if (event.key !== "Shift") return;

    shiftHeld = false;
    refreshMode();
  }

  element.addEventListener("pointerdown", updatePointer, true);
  element.addEventListener("pointermove", updatePointer, true);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    beginDrag,
    endDrag,
    apply,
    refreshMode,
    isShiftHeld: () => shiftHeld,
    dispose() {
      element.removeEventListener("pointerdown", updatePointer, true);
      element.removeEventListener("pointermove", updatePointer, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
