import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#0F172A", // azul principal
        accent: "#3D62F5", // cyan principal
        azul: "#0F172A",
        azul2: "#1E293B",
        "cyan-d": "#2448E0",
        naranja: "#F59E0B",
        "naranja-d": "#D97706",
        "cobre-soft": "#EEF2FF",
        verde: "#10B981",
        rojo: "#EF4444",
        gris: "#64748B",
        bg: "#F1F5F9",
        card: "#FFFFFF",
        linea: "#E2E8F0",
        txt: "#0F172A",

        // Namespace landing-* (tokens del diseno de referencia lineas 12-30)
        "landing-ink": "#0D1B2A",
        "landing-gris": "#64748B",
        "landing-gris2": "#94A3B8",
        "landing-linea": "#E2E8F0",
        "landing-soft": "#F5F8FF",
        "landing-soft2": "#F7F9FC",
        "landing-azul": "#1D4ED8",
        "landing-azul-d": "#173FB0",
        "landing-azul-claro": "#EAF1FF",
        "landing-naranja": "#FF5E2C",
        "landing-naranja-d": "#E44F20",
        "landing-naranja-claro": "#FFF0EA",
        "landing-verde": "#16A34A",
        "landing-ambar": "#BC7627",
        "landing-rojo": "#BE3A3F",
        "landing-cyan": "#0EA5E9",
        "landing-teal": "#0D9488",
      },
      borderRadius: {
        "landing-frame": "18px",
      },
      boxShadow: {
        "landing-card": "0 10px 30px -18px rgba(13,27,42,.2)",
        "landing-frame": "0 40px 90px -30px rgba(13,27,42,.28)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        "landing-sans": ["var(--font-poppins)", "sans-serif"],
        "landing-mono": ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
