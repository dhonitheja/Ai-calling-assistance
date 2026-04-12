/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    // Lint warnings won't fail the production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors won't fail the production build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
