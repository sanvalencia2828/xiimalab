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

    // Proxy: redirige /stream/* al backend FastAPI para SSE en tiempo real
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        return [
            {
                source: "/stream/:path*",
                destination: `${apiUrl}/stream/:path*`,
            },
        ];
    },
};

export default nextConfig;
