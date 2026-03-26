/** @type {import('next').NextConfig} */
const nextConfig = {
    // "standalone" solo para Docker local — Vercel lo maneja automáticamente
    // output: "standalone",

    // Variables de entorno disponibles en el cliente (sin exponer secretos)
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
    },

    // Imágenes externas permitidas
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**" },
        ],
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
