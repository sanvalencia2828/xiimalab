import type { Config } from "tailwindcss";

/**
 * Xiimalab — Technical UI tokens.
 * Los nombres de color se mantienen para compatibilidad con todos los
 * componentes existentes; sólo cambian sus valores hacia una paleta
 * neutra + señal (estilo Linear / Vercel / Grafana).
 */
const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Canvas / superficies
                background: "#0a0b0f",
                card: "#111319",
                "card-hover": "#171a21",
                border: "#262a34",
                muted: "#373c48",
                "muted-text": "#949baa",

                // Acento — azul sobrio, no cyan fluorescente
                accent: "#5ea5ff",
                "accent-bright": "#7ab6ff",
                "accent-dim": "#4a7fcc",

                // Señal funcional
                success: "#4ac07b",
                warning: "#e2a747",
                danger: "#e05f5f",

                // Brand
                stellar: "#8b5cf6",
                avalanche: "#e05f5f",
                blockchain: "#e2a747",
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            borderRadius: {
                sm: "4px",
                DEFAULT: "6px",
                md: "6px",
                lg: "8px",
                xl: "10px",
                "2xl": "12px",
            },
            boxShadow: {
                card: "0 1px 2px rgba(0,0,0,0.35)",
                pop: "0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.4)",
                // Glows neutralizados — se mantienen los nombres para no romper clases existentes
                glow: "0 1px 2px rgba(0,0,0,0.35)",
                "glow-strong": "0 2px 6px rgba(0,0,0,0.45)",
                "glow-success": "0 1px 2px rgba(0,0,0,0.35)",
            },
            fontSize: {
                "2xs": ["10px", { lineHeight: "14px" }],
            },
            animation: {
                shimmer: "shimmer 2.5s linear infinite",
                // float y pulse se mantienen por compatibilidad pero como no-op visual
                float: "none",
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
            keyframes: {
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(0px)" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
