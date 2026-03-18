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
};

export default nextConfig;
