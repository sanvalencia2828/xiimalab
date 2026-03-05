/** @type {import('next').NextConfig} */
const nextConfig = {
    // Required for the multi-stage Docker build to work
    output: "standalone",
};

export default nextConfig;
