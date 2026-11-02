type PersistedConsignacion = {
  numeroFolio: number;
};

export function getPersistedConsignacionFolio(
  consignacion: PersistedConsignacion,
): number {
  return consignacion.numeroFolio;
}
