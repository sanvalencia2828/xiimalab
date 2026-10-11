/** @type {import('next').NextConfig} */
const nextConfig = {
    // "standalone" solo para Docker local — Vercel lo maneja automáticamente
    // output: "standalone",

    // Variables de entorno disponibles en el cliente (sin exponer secretos)
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
    },

    // @stellar/stellar-sdk intenta cargar sodium-native (módulo nativo opcional); sin él usa
    // tweetnacl, que es lo que queremos en el navegador y en Vercel. Aquí solo se usa StrKey.
    webpack(config) {
        config.resolve.alias = { ...config.resolve.alias, "sodium-native": false };
        return config;
    },

    // Imágenes externas permitidas
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**" },
        ],
    },

    // Páginas unificadas (redirección permanente, 308):
    //   /aggregated → /hackathons
    //   Market Match (/match, /market-match) → pestaña "Mercado" de /skills
    async redirects() {
        return [
            { source: "/aggregated", destination: "/hackathons", permanent: true },
            { source: "/match", destination: "/skills?tab=mercado", permanent: true },
            { source: "/market-match", destination: "/skills?tab=mercado", permanent: true },
        ];
    },

    // Proxy SSE y rutas del backend FastAPI (puerto 8000)
    // En Vercel, NEXT_PUBLIC_API_URL apunta al backend desplegado.
    // En local, el EventSource("/stream/...") se redirige a localhost:8000.
    async rewrites() {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        return [
            {
                source: "/stream/:path*",
                destination: `${backendUrl}/stream/:path*`,
            },
            {
                source: "/api/backend/:path*",
                destination: `${backendUrl}/:path*`,
            },
        ];
    },
};

export default nextConfig;
