/**
 * lib/projects/data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lista de proyectos, compartida entre la página /projects (cliente) y la
 * acción de avance (servidor). El servidor resuelve las URLs de GitHub y de la
 * demo desde aquí; nunca las acepta del cliente.
 *
 * `stack` es lo que el repositorio usa hoy (comprobado en su código y sus
 * dependencias); lo que aún no usa va en `planned`. Las skills demostradas y
 * las fases aplicables salen solo de `stack`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { ProjectCardProps } from "@/components/ProjectCard";

export const PROJECTS: ProjectCardProps[] = [
    {
        title: "Xiimalab",
        description: "AI & Blockchain Intelligence Hub — hackathon matching, ML recommendations y staking de habilidades",
        status: "in-development",
        stack: ["Next.js", "TypeScript", "FastAPI", "Docker", "Supabase", "Python", "Anthropic API", "Salidas estructuradas", "Stellar"],
        metrics: { pages: 12, apis: "20+", score: "84%" },
        accentColor: "#34d399",
        liveUrl: "https://xiimalab.vercel.app",
        githubUrl: "https://github.com/sanvalencia2828/xiimalab",
    },
    {
        title: "AURA",
        description: "Motor de resize de imágenes con IA — optimiza y redimensiona para redes sociales con engagement analytics",
        status: "active",
        stack: ["TypeScript", "Next.js", "NextAuth", "sharp"],
        planned: ["AI/ML", "OpenCV"],
        metrics: { accuracy: "94%", latency: "<80ms", platforms: 6 },
        accentColor: "#7dd3fc",
        githubUrl: "https://github.com/sanvalencia2828/Aura",
    },
    {
        title: "RedimensionAI",
        description: "Social Media Image Optimizer — vibecoding, redimensionado inteligente para múltiples plataformas",
        status: "completed",
        stack: ["TypeScript", "Next.js", "Vercel", "Web3 (wagmi)", "Tesseract.js"],
        planned: ["AI"],
        metrics: { uptime: "99.9%", boost: "3x", plataformas: 8 },
        accentColor: "#a78bfa",
        liveUrl: "https://redimension-ai-rho.vercel.app",
        githubUrl: "https://github.com/sanvalencia2828/RedimensionAI",
    },
    {
        title: "Regen-Buddy",
        description: "Fruterito — mascota virtual AI estilo Regenmon con chat inteligente y modo 8-bit",
        status: "active",
        stack: ["HTML5", "JavaScript", "CSS3", "OpenAI"],
        metrics: { tipo: "Virtual Pet", modo: "8-bit", vibe: "regen" },
        accentColor: "#f59e0b",
        liveUrl: "https://regenmon-chat.vercel.app",
        githubUrl: "https://github.com/sanvalencia2828/regen-buddy",
    },
    {
        title: "Pulsar Radar",
        description: "Radar de memecoins de Solana en tiempo real — puntúa potencial y riesgo de cada token desde sus primeros minutos, con mapa visual y alertas",
        status: "active",
        stack: ["Next.js", "TypeScript", "Tailwind", "FastAPI", "DexScreener API", "Solana"],
        metrics: { scores: "2 (0–100)", etapas: 4, refresh: "5s" },
        accentColor: "#ff4524",
        liveUrl: "https://miguelangel213.github.io/pulsar-radar/",
        githubUrl: "https://github.com/miguelangel213/pulsar-radar",
        author: {
            name: "Miguel Ángel",
            handle: "miguelangel213",
            profileUrl: "https://github.com/miguelangel213",
            role: "Creado por",
        },
        license: "MIT",
    },
    {
        title: "Rastreador · Londrina Radar Comercial",
        description: "Plataforma geoespacial open source que rastrea comercios y polos emergentes en Londrina (PR) — heatmap de densidad, clustering de polos y ETL de datos CNPJ, sin APIs comerciales",
        status: "active",
        stack: ["Next.js", "React", "MapLibre GL", "FastAPI", "PostGIS", "Python", "Docker"],
        metrics: { comercios: "2.7k", polos: 5, "apis pagas": 0 },
        accentColor: "#22d3ee",
        githubUrl: "https://github.com/sanvalencia2828/Rastreador",
    },
];
