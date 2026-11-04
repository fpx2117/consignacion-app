// src/modules/ventas/register-sale-switch.ts
// Switch del piloto `RegistrarVenta` (ADR 006).
//
// Un único punto de dispatch anterior a cualquier efecto persistente. Sólo el
// valor exacto `application` habilita la ruta nueva; ausente, vacío o inválido
// resuelven a `legacy` con diagnóstico. No hay ejecución doble ni fallback entre
// handlers.

export const REGISTER_SALE_USE_CASE_ENV = "SALES_REGISTER_USE_CASE";

export type RegisterSaleUseCaseName = "legacy" | "application";

export type RegisterSaleUseCaseSelection = {
  name: RegisterSaleUseCaseName;
  diagnostic: string | null;
};

export function resolveRegisterSaleUseCase(
  raw: string | undefined,
): RegisterSaleUseCaseSelection {
  if (raw === "application") return { name: "application", diagnostic: null };
  if (raw === "legacy") return { name: "legacy", diagnostic: null };

  const reason =
    raw === undefined
      ? "is not set"
      : raw === ""
        ? "is empty"
        : `has an invalid value (${JSON.stringify(raw)})`;

  return {
    name: "legacy",
    diagnostic:
      `${REGISTER_SALE_USE_CASE_ENV} ${reason}; ` +
      "using the legacy register-sale adapter.",
  };
}

const reportedDiagnostics = new Set<string>();

/**
 * Resuelve el switch para una request. El diagnóstico no se repite por proceso
 * para no inundar los logs cuando la variable simplemente no está configurada.
 */
export function readRegisterSaleUseCase(
  env: NodeJS.ProcessEnv = process.env,
): RegisterSaleUseCaseSelection {
  const selection = resolveRegisterSaleUseCase(env[REGISTER_SALE_USE_CASE_ENV]);
  if (selection.diagnostic && !reportedDiagnostics.has(selection.diagnostic)) {
    reportedDiagnostics.add(selection.diagnostic);
    console.warn(selection.diagnostic);
  }
  return selection;
}
