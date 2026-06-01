import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ No exponer versión de Next.js en headers
  poweredByHeader: false,

  // ✅ Compresión habilitada (gzip/brotli)
  compress: true,

  // ✅ Security headers + Cache headers para assets estáticos
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
      // ✅ Cache agresivo solo en producción para assets inmutables de Next.js
      ...(isProduction
        ? [
            {
              source: "/_next/static/(.*)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : []),
      // ✅ No cachear respuestas de API en CDN
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
          {
            key: "Surrogate-Control",
            value: "no-store",
          },
        ],
      },
      // ✅ Cache moderado para archivos de la API de imágenes
      {
        source: "/api/files/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },

  images: {
    // ✅ Formatos modernos WebP y AVIF para ahorro de peso
    formats: ["image/avif", "image/webp"],
    // ✅ Dominios permitidos para next/image
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/api/files/**",
      },
      {
        protocol: "https",
        hostname: "localhost",
        pathname: "/api/files/**",
      },
    ],
    // ✅ Tamaños de dispositivo optimizados para el POS
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ✅ Optimizaciones experimentales de Next.js 15
  experimental: {
    // Optimización de imports de paquetes grandes
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "motion/react",
      "date-fns",
    ],
  },
};

export default nextConfig;
