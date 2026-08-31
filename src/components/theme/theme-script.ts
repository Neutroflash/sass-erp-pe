// Se inyecta como <script> inline en <head> (ver layout.tsx), no como módulo — corre de forma
// síncrona ANTES del primer paint, así el <html> ya tiene (o no) la clase "dark" antes de que el
// navegador pinte un solo píxel. Sin esto, ThemeProvider aplicaría el tema recién en un useEffect
// (después de hidratar), y habría un flash visible del tema equivocado en cada carga.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("flashstock-theme");
    var isDark = stored ? stored === "dark" : true; // default de la app: oscuro
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;
