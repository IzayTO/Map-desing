import * as THREE from "three";

/*
  Parte 5.1 · Controles de escritorio.

  Se mantiene MapControls para mouse.
  Este módulo añade navegación de teclado sin interferir con
  formularios, colocación ni TransformControls.
*/

export function setupDesktopControls({
  camera,
  mapControls,
  resetView,
  isPlacementActive,
  isTransformDragging,
  isEditingField,
}) {
  const moveStep = 1.6;
  const rotateStep = THREE.MathUtils.degToRad(4.5);
  const tiltStep = THREE.MathUtils.degToRad(3.5);
  const zoomFactorIn = 0.88;
  const zoomFactorOut = 1.14;

  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const delta = new THREE.Vector3();

  function canHandleKeyboard() {
    return (
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !isEditingField() &&
      !isTransformDragging()
    );
  }

  function moveTarget(direction) {
    camera.getWorldDirection(forward);
    forward.y = 0;

    if (forward.lengthSq() < 0.0001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    right.crossVectors(forward, camera.up).normalize();

    delta.set(0, 0, 0);

    if (direction === "forward") delta.addScaledVector(forward, moveStep);
    if (direction === "back") delta.addScaledVector(forward, -moveStep);
    if (direction === "left") delta.addScaledVector(right, -moveStep);
    if (direction === "right") delta.addScaledVector(right, moveStep);

    mapControls.target.add(delta);
    camera.position.add(delta);
    mapControls.update();
  }

  function orbit(deltaTheta = 0, deltaPhi = 0) {
    offset.copy(camera.position).sub(mapControls.target);
    spherical.setFromVector3(offset);

    spherical.theta += deltaTheta;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + deltaPhi,
      mapControls.minPolarAngle,
      mapControls.maxPolarAngle
    );

    offset.setFromSpherical(spherical);
    camera.position.copy(mapControls.target).add(offset);
    camera.lookAt(mapControls.target);
    mapControls.update();
  }

  function zoom(factor) {
    offset.copy(camera.position).sub(mapControls.target);

    const currentDistance = offset.length();
    const nextDistance = THREE.MathUtils.clamp(
      currentDistance * factor,
      mapControls.minDistance,
      mapControls.maxDistance
    );

    offset.setLength(nextDistance);
    camera.position.copy(mapControls.target).add(offset);
    camera.lookAt(mapControls.target);
    mapControls.update();
  }

  function onKeyDown(event) {
    if (!canHandleKeyboard()) return;

    const key = event.key;

    // Transform mode shortcuts W/E/R remain owned by app.js.
    // Camera navigation uses arrows, Shift+arrows and +/-.
    if (key === "ArrowUp" && !event.shiftKey) {
      event.preventDefault();
      moveTarget("forward");
      return;
    }

    if (key === "ArrowDown" && !event.shiftKey) {
      event.preventDefault();
      moveTarget("back");
      return;
    }

    if (key === "ArrowLeft" && !event.shiftKey) {
      event.preventDefault();
      moveTarget("left");
      return;
    }

    if (key === "ArrowRight" && !event.shiftKey) {
      event.preventDefault();
      moveTarget("right");
      return;
    }

    if (event.shiftKey && key === "ArrowLeft") {
      event.preventDefault();
      orbit(rotateStep, 0);
      return;
    }

    if (event.shiftKey && key === "ArrowRight") {
      event.preventDefault();
      orbit(-rotateStep, 0);
      return;
    }

    if (event.shiftKey && key === "ArrowUp") {
      event.preventDefault();
      orbit(0, -tiltStep);
      return;
    }

    if (event.shiftKey && key === "ArrowDown") {
      event.preventDefault();
      orbit(0, tiltStep);
      return;
    }

    if (key === "+" || key === "=") {
      event.preventDefault();
      zoom(zoomFactorIn);
      return;
    }

    if (key === "-" || key === "_") {
      event.preventDefault();
      zoom(zoomFactorOut);
      return;
    }

    if (key === "0") {
      event.preventDefault();

      // Si estamos colocando, no terminamos el modo: solo centramos cámara.
      resetView();
    }
  }

  window.addEventListener("keydown", onKeyDown);

  return {
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
