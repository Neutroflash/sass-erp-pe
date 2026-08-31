import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
