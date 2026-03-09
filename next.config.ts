import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers para todas las respuestas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevenir clickjacking — no permitir embeber en iframes
          { key: "X-Frame-Options", value: "DENY" },
          // Prevenir MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Controlar qué información se envía como Referer
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restringir acceso a APIs del navegador
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Forzar HTTPS en producción (max-age: 2 años)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Prevenir ataques XSS reflejados (legacy, pero no daña)
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Imágenes servidas por el endpoint /api/files/ — solo desde el mismo dominio
      // En producción, reemplazar "localhost" por tu dominio real
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/api/files/**",
      },
    ],
  },
};

export default nextConfig;
