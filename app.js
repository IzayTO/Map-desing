(() => {
  const statusDot = document.querySelector("#statusDot");
  const statusText = document.querySelector("#statusText");
  const jsCheck = document.querySelector("#jsCheck");
  const buildInfo = document.querySelector("#buildInfo");

  const boot = () => {
    statusDot?.classList.add("ready");

    if (statusText) {
      statusText.textContent = "Proyecto funcionando";
    }

    if (jsCheck) {
      jsCheck.textContent = "✓ cargado";
    }

    if (buildInfo) {
      buildInfo.textContent = "Base v0.1";
    }

    console.info("[Resort Map Builder] Base v0.1 cargada correctamente.");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
