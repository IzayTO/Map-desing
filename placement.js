export function createPlacementController({
  toolbar,
  label,
  count,
  finishButton,
  onFinish,
}) {
  const state = {
    active: false,
    type: null,
    displayLabel: "",
    placedCount: 0,
    lastObject: null,
  };

  function render() {
    toolbar?.classList.toggle("hidden", !state.active);

    if (label) {
      label.textContent = state.displayLabel || "Objeto";
    }

    if (count) {
      const amount = state.placedCount;
      count.textContent =
        `${amount} ${amount === 1 ? "colocado" : "colocados"}`;
    }
  }

  function start(type, displayLabel) {
    state.active = true;
    state.type = type;
    state.displayLabel = displayLabel;
    state.placedCount = 0;
    state.lastObject = null;
    render();
  }

  function record(object) {
    if (!state.active) return;

    state.placedCount += 1;
    state.lastObject = object || state.lastObject;
    render();
  }

  function finish() {
    if (!state.active) return;

    const snapshot = {
      type: state.type,
      displayLabel: state.displayLabel,
      placedCount: state.placedCount,
      lastObject: state.lastObject,
    };

    state.active = false;
    state.type = null;
    state.displayLabel = "";
    state.placedCount = 0;
    state.lastObject = null;
    render();

    onFinish?.(snapshot);
  }

  function cancel() {
    if (!state.active) return;

    state.active = false;
    state.type = null;
    state.displayLabel = "";
    state.placedCount = 0;
    state.lastObject = null;
    render();
  }

  finishButton?.addEventListener("click", finish);
  render();

  return {
    start,
    record,
    finish,
    cancel,
    isActive: () => state.active,
    getType: () => state.type,
    getLastObject: () => state.lastObject,
    getPlacedCount: () => state.placedCount,
  };
}
