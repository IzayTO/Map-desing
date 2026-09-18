export function setupMobilePanels() {
  const openButtons = [...document.querySelectorAll("[data-open-panel]")];
  const closeButtons = [...document.querySelectorAll("[data-close-panel]")];
  const backdrop = document.querySelector("#mobileBackdrop");

  function closePanels() {
    document.querySelectorAll(".panel.mobile-open").forEach((panel) => {
      panel.classList.remove("mobile-open");
    });

    openButtons.forEach((button) => {
      button.classList.remove("active");
    });

    backdrop?.classList.remove("visible");
  }

  function openPanel(id, trigger) {
    const panel = document.getElementById(id);
    if (!panel) return;

    closePanels();
    panel.classList.add("mobile-open");
    trigger?.classList.add("active");
    backdrop?.classList.add("visible");
  }

  openButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.openPanel;
      const target = document.getElementById(id);

      if (target?.classList.contains("mobile-open")) {
        closePanels();
      } else {
        openPanel(id, button);
      }
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closePanels);
  });

  backdrop?.addEventListener("click", closePanels);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanels();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      closePanels();
    }
  });

  return { closePanels, openPanel };
}
