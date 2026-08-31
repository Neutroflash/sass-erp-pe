import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        // "<alpha-value>" es el placeholder que Tailwind sustituye por el número de opacidad de un
        // modificador tipo "bg-primary/50" — sin él, esos modificadores no tienen ningún canal de
        // alpha al que engancharse y se ignoran en silencio (renderiza 100% opaco). La mayoría de
        // los usos reales de `primary` en el proyecto llevan opacidad (focus:border-primary/50,
        // bg-primary/10, etc.), así que sin esto el color del tenant se vería mal en casi todas
        // partes, no solo "no se ve" sino "se ve peor que antes".
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        input: "hsl(var(--input) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Atado a --primary (el color del tenant), no a un color fijo — a diferencia del
        // "glow-gold" hardcodeado de Flashkings, este debe verse bien con cualquier primaryColor.
        glow: "0 0 25px hsl(var(--primary) / 0.15)",
        "glow-lg": "0 0 45px hsl(var(--primary) / 0.25)",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.35), 0 0 40px hsl(var(--primary) / 0.1)" },
          "50%": { boxShadow: "0 0 32px hsl(var(--primary) / 0.55), 0 0 60px hsl(var(--primary) / 0.2)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-150%)" },
          "100%": { transform: "translateX(150%)" },
        },
      },
      animation: {
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
