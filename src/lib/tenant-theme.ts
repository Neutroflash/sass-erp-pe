const DEFAULT_PRIMARY_HEX = "#eab308"; // mismo dorado que ya vive hardcodeado en globals.css
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Luminancia perceptual (no el contraste WCAG exacto, pero suficiente para elegir el lado
 * correcto) — decide si el texto sobre el color primario debe ser negro o blanco, para que un
 * tenant que elija un color oscuro no termine con texto negro ilegible sobre su propio botón. */
function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

export interface TenantThemeVars {
  "--primary": string;
  "--primary-foreground": string;
}

/**
 * Variables CSS a inyectar (vía `style`, no una clase — son valores dinámicos por tenant) en el
 * layout que envuelve las páginas de un tenant (tienda pública + panel, ver
 * `sites/[tenant]/layout.tsx`). El resto de la UI ya usa el token `primary`/`primary-foreground`
 * de Tailwind (definido en tailwind.config.ts como `hsl(var(--primary))`) en vez de colores
 * literales — este es el único punto que decide su valor real por tenant.
 *
 * `primaryColor` inválido o ausente cae al dorado default (el mismo valor ya hardcodeado en
 * `globals.css`), para que un tenant sin configurar nada se vea exactamente igual que antes de
 * que existiera esta función.
 */
export function tenantThemeVars(primaryColor: string | null): TenantThemeVars {
  const hex = primaryColor && HEX_RE.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY_HEX;
  const { h, s, l } = hexToHsl(hex);
  return {
    "--primary": `${h} ${s}% ${l}%`,
    "--primary-foreground": isLight(hex) ? "0 0% 9%" : "0 0% 98%",
  };
}
