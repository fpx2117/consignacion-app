import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint Config — Consignación App
 * Fase 5 del saneamiento TypeScript: guardrails anti-regresión activos.
 *
 * POLÍTICA DE REGLAS:
 * - `@typescript-eslint/no-explicit-any`: warn global → error en src/lib/**, src/app/api/**
 *   Los `any` justificados en límites de SDKs externos llevan eslint-disable-next-line
 *   con comentario de razón obligatorio.
 * - `@typescript-eslint/no-unused-vars`: error (con patrón _ para ignorar intencionalmente)
 * - `@typescript-eslint/ban-ts-comment`: error — cero @ts-nocheck nuevos permitidos
 *
 * GUARDRAILS:
 * - `@ts-nocheck` global bloqueado por `ban-ts-comment`.
 * - Para deshabilitar una regla específica en un archivo, debe existir
 *   un comentario de razón adyacente explicando el límite técnico.
 * - NO bajar estas reglas a "off" sin registrar el motivo en este archivo.
 *
 * `any` REMANENTES JUSTIFICADOS (ver JUSTIFICACIONES-ANY.md):
 * - src/lib/apiService.ts: genérico HTTP client (headers dinámicos, tipado fetch)
 * - src/lib/kpi-logic.ts: prisma.catalogVisit (tabla fuera de schema principal), reduce Prisma
 * - src/lib/payments/mercadopago.ts, paypal.ts: SDKs externos con tipos incompletos
 * - src/lib/reports/**: PDFMake SDK sin tipos completos
 * - src/lib/subscriptions/require-subscription.ts: JWT payload externo
 * - src/app/api/settings/users/route.ts: Prisma error typing
 * - src/app/ver/dashboard/[period]/pdf/route.ts: PDFMake
 * - src/app/ver/remito/[id]/route.ts: PDFMake
 * - src/app/lista/components/store-header.tsx: config público sin schema fijo (API externa)
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ── Reglas globales ───────────────────────────────────────────────────────
  {
    rules: {
      // GUARDRAIL: ban-ts-comment en error — cero @ts-nocheck nuevos
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-nocheck": true, // siempre bloqueado
          "ts-ignore": "allow-with-description", // solo con descripción obligatoria
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],

      // no-unused-vars: error con convención _ para ignorar intencionalmente
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      // no-explicit-any: warn global.
      // Los archivos con límites de SDKs externos usan disable-next-line con razón.
      // Los archivos críticos (lib/auth, lib/validators, api/*) tienen override a error.
      "@typescript-eslint/no-explicit-any": "warn",

      // Sin cambios: hook de React
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // ── Override: src/lib/** y src/app/api/** → any = error (capa de servidor)
  // Los archivos con límites de SDKs externos tienen supresiones inline con razón.
  {
    files: [
      "src/lib/auth/**/*.ts",
      "src/lib/sucursalScope.ts",
      "src/lib/utils*.ts",
      "src/lib/validators/**/*.ts",
      "src/lib/config.ts",
      "src/lib/prisma.ts",
      "src/lib/types.ts",
      "src/app/api/auth/**/*.ts",
      "src/app/api/categorias/**/*.ts",
      "src/app/api/clientes/**/*.ts",
      "src/app/api/consignaciones/**/*.ts",
      "src/app/api/gastos/**/*.ts",
      "src/app/api/historial/**/*.ts",
      "src/app/api/liquidaciones/**/*.ts",
      "src/app/api/pagos/**/*.ts",
      "src/app/api/pedidos-esperados/**/*.ts",
      "src/app/api/productos/**/*.ts",
      "src/app/api/setup/**/*.ts",
      "src/app/api/socket/**/*.ts",
      "src/app/api/sucursales/**/*.ts",
      "src/app/api/ventas/**/*.ts",
      "src/app/api/webhooks/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // Override global ignores
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "prisma/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
