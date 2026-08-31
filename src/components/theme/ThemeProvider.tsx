"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "flashstock-theme";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

/**
 * El estado inicial de useState ("dark") es solo el valor de React hasta el primer efecto — el
 * tema VISUAL real ya lo aplicó el script inline de layout.tsx antes del primer paint (evita el
 * flash del tema equivocado, que un useEffect corriendo después de hidratar no puede evitar). Este
 * componente solo sincroniza el estado de React con lo que <html> ya tiene, y persiste cambios.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggleTheme() {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage puede fallar (modo privado, storage bloqueado) — el toggle sigue
        // funcionando para esta sesión, solo no se recuerda entre visitas.
      }
      return next;
    });
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() debe usarse dentro de <ThemeProvider>");
  return ctx;
}
