import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#030712",
                card: "#111827",
                "card-hover": "#1a2535",
                accent: "#7dd3fc",
                "accent-bright": "#38bdf8",
                "accent-dim": "#0ea5e9",
                border: "#1f2937",
                muted: "#374151",
                "muted-text": "#6b7280",
                success: "#10b981",
                warning: "#f59e0b",
                danger: "#ef4444",
                stellar: "#8b5cf6",
                avalanche: "#ef4444",
                blockchain: "#f59e0b",
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            boxShadow: {
                card: "0 4px 24px rgba(0,0,0,0.4)",
                glow: "0 0 20px rgba(125, 211, 252, 0.25)",
                "glow-strong": "0 0 40px rgba(125, 211, 252, 0.45)",
                "glow-success": "0 0 20px rgba(16, 185, 129, 0.3)",
            },
            animation: {
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                shimmer: "shimmer 2s linear infinite",
                float: "float 4s ease-in-out infinite",
            },
            keyframes: {
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-6px)" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
