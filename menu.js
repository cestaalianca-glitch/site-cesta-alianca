function ajustarAlturaHeader() {
  const header = document.querySelector(".header");
  if (!header) return;
  document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}

document.addEventListener("DOMContentLoaded", () => {
  ajustarAlturaHeader();
  window.addEventListener("resize", ajustarAlturaHeader);
  window.addEventListener("load", ajustarAlturaHeader);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ajustarAlturaHeader);
  }

  const botao = document.getElementById("nav-toggle");
  const nav = document.getElementById("nav-principal");
  if (!botao || !nav) return;

  botao.addEventListener("click", () => {
    const aberto = nav.classList.toggle("aberto");
    botao.classList.toggle("aberto", aberto);
    botao.setAttribute("aria-expanded", aberto ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("aberto");
      botao.classList.remove("aberto");
      botao.setAttribute("aria-expanded", "false");
    });
  });
});
