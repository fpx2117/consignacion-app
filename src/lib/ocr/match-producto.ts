// src/lib/ocr/match-producto.ts
// Matching aproximado de un nombre detectado por OCR contra el catálogo de productos
// existente, usando similaridad de bigramas (coeficiente de Dice). Sin dependencias externas.

export type ProductoMatch = {
  productoId: number;
  score: number;
};

const UMBRAL_MATCH = 0.5;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bigramas(texto: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < texto.length - 1; i++) {
    set.add(texto.slice(i, i + 2));
  }
  return set;
}

function coeficienteDice(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const bigA = bigramas(na);
  const bigB = bigramas(nb);
  if (bigA.size === 0 || bigB.size === 0) return 0;

  let interseccion = 0;
  for (const bg of bigA) {
    if (bigB.has(bg)) interseccion++;
  }

  return (2 * interseccion) / (bigA.size + bigB.size);
}

export function matchProductoPorNombre(
  nombre: string,
  productos: { id: number; nombre: string }[],
): ProductoMatch | null {
  let mejor: ProductoMatch | null = null;

  for (const producto of productos) {
    const score = coeficienteDice(nombre, producto.nombre);
    if (score >= UMBRAL_MATCH && (!mejor || score > mejor.score)) {
      mejor = { productoId: producto.id, score };
    }
  }

  return mejor;
}
