import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Permite cargar imágenes servidas por el endpoint /api/files/
      // tanto en local (localhost) como en Railway (dominio de producción)
      {
        protocol: "https",
        hostname: "**",
        pathname: "/api/files/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/api/files/**",
      },
    ],
  },
};

export default nextConfig;
