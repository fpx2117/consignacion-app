// src/modules/invoices/config/rubros.ts
// Fuente de verdad única para los rubros de negocio: consumida por el selector
// de Setup/Ajustes, el hint de contexto del prompt de extracción de facturas
// (invoice-extraction.config.ts) y las sugerencias de clave en los editores de
// atributos de producto.
//
// Agregar un rubro nuevo es agregar una fila acá.
// No requiere migración ni tocar el prompt a mano.
//
// Importante:
// - atributosTipicos debe describir atributos útiles para interpretar ítems de factura.
// - Evitar poner lógica comercial interna como "fiado", "cuenta corriente",
//   "membresías vencidas", etc.
// - Mantener atributos como palabras clave simples ayuda al modelo OCR/LLM
//   a normalizar productos sin inventar estructuras distintas por rubro.

export interface RubroNegocio {
  slug: string;
  label: string;

  /**
   * Atributos típicos de este rubro, usados como hint en el prompt OCR
   * y como sugerencias de clave en la UI.
   *
   * Deben ser atributos de producto/ítem, no reglas de negocio.
   */
  atributosTipicos: string;
}

export const RUBROS_NEGOCIO: RubroNegocio[] = [
  {
    slug: "kiosco",
    label: "Kiosco",
    atributosTipicos:
      "marca, sabor, variedad, presentación, tamaño, peso, volumen, unidad, pack, cantidad por pack, envase, retornable, descartable, vencimiento, código de barras, tipo de producto, categoría, subcategoría",
  },
  {
    slug: "almacen",
    label: "Almacén",
    atributosTipicos:
      "marca, presentación, peso, volumen, unidad, pack, cantidad por pack, variedad, sabor, envase, vencimiento, lote, código de barras, tipo de producto, categoría, subcategoría",
  },
  {
    slug: "supermercado",
    label: "Supermercado",
    atributosTipicos:
      "marca, presentación, peso, volumen, unidad, pack, cantidad por pack, variedad, sabor, envase, vencimiento, lote, código de barras, tipo de producto, categoría, subcategoría, precio por unidad, precio por kilo, precio por litro",
  },
  {
    slug: "mayorista",
    label: "Mayorista / Distribuidora",
    atributosTipicos:
      "marca, presentación, unidad, bulto, caja, pack, cantidad por bulto, cantidad por caja, cantidad por pack, peso, volumen, vencimiento, lote, código de barras, SKU, código interno, categoría, subcategoría",
  },
  {
    slug: "perfumeria",
    label: "Perfumería",
    atributosTipicos:
      "marca, línea, fragancia, presentación, ml, concentración, EDP, EDT, parfum, body splash, tester, género, familia olfativa, tamaño, envase, código de barras, lote, vencimiento",
  },
  {
    slug: "cosmetica",
    label: "Cosmética / Maquillaje",
    atributosTipicos:
      "marca, línea, tono, color, número de tono, presentación, ml, gramos, tipo de piel, acabado, textura, waterproof, vencimiento, lote, código de barras, categoría",
  },
  {
    slug: "vapes",
    label: "Vapes / Cigarrillos Electrónicos",
    atributosTipicos:
      "marca, modelo, sabor, puffs, caladas, nicotina, mg, ml, capacidad, descartable, recargable, pod, kit, resistencia, ohm, batería, mah, color, mentol, tabaco, código de barras, lote",
  },
  {
    slug: "farmacia",
    label: "Farmacia",
    atributosTipicos:
      "laboratorio, droga, principio activo, concentración, dosis, presentación, comprimidos, cápsulas, jarabe, crema, ampolla, lote, vencimiento, troquel, código de barras, registro sanitario, venta libre, bajo receta",
  },
  {
    slug: "veterinaria",
    label: "Veterinaria",
    atributosTipicos:
      "laboratorio, marca, especie, medicamento, principio activo, concentración, dosis, presentación, peso, sabor, edad, tamaño de mascota, lote, vencimiento, código de barras, tipo de producto",
  },
  {
    slug: "pet_shop",
    label: "Pet Shop",
    atributosTipicos:
      "marca, especie, perro, gato, ave, roedor, alimento, accesorio, peso, sabor, edad, cachorro, adulto, senior, tamaño de mascota, raza, presentación, vencimiento, lote, código de barras",
  },
  {
    slug: "ferreteria",
    label: "Ferretería",
    atributosTipicos:
      "marca, medida, material, unidad de medida, diámetro, largo, ancho, alto, espesor, rosca, calibre, voltaje, amperaje, potencia, color, modelo, código interno, SKU, tipo de producto",
  },
  {
    slug: "corralon",
    label: "Corralón / Materiales de Construcción",
    atributosTipicos:
      "marca, material, medida, peso, unidad, bolsa, placa, metro, metro cuadrado, metro cúbico, espesor, largo, ancho, alto, calibre, color, tipo de producto, código interno",
  },
  {
    slug: "pintureria",
    label: "Pinturería",
    atributosTipicos:
      "marca, línea, color, código de color, acabado, mate, satinado, brillante, litros, ml, tipo de superficie, interior, exterior, base, rendimiento, lote, vencimiento",
  },
  {
    slug: "electricidad",
    label: "Electricidad",
    atributosTipicos:
      "marca, modelo, voltaje, amperaje, potencia, watts, lúmenes, temperatura de color, medida, sección, mm, metros, rollo, tipo de cable, ficha, toma, código interno, SKU",
  },
  {
    slug: "electronica",
    label: "Electrónica",
    atributosTipicos:
      "marca, modelo, número de serie, IMEI, capacidad, memoria, almacenamiento, color, pulgadas, voltaje, potencia, conectividad, versión, garantía, SKU, código interno, código de barras",
  },
  {
    slug: "celulares",
    label: "Celulares / Accesorios",
    atributosTipicos:
      "marca, modelo, compatibilidad, IMEI, número de serie, capacidad, almacenamiento, color, pulgadas, tipo de conector, USB-C, Lightning, potencia, watts, garantía, SKU",
  },
  {
    slug: "informatica",
    label: "Informática",
    atributosTipicos:
      "marca, modelo, procesador, memoria RAM, almacenamiento, capacidad, pulgadas, placa, socket, frecuencia, velocidad, conectividad, número de serie, garantía, SKU, código interno",
  },
  {
    slug: "indumentaria",
    label: "Indumentaria",
    atributosTipicos:
      "marca, talle, color, género, temporada, material, composición, modelo, prenda, línea, corte, largo, ancho, código de barras, SKU, variante",
  },
  {
    slug: "zapateria",
    label: "Zapatería",
    atributosTipicos:
      "marca, modelo, número, talle, color, material, género, temporada, tipo de calzado, suela, horma, SKU, código de barras, variante",
  },
  {
    slug: "marroquineria",
    label: "Marroquinería",
    atributosTipicos:
      "marca, modelo, color, material, tamaño, género, tipo de producto, cierre, correa, capacidad, SKU, código de barras",
  },
  {
    slug: "libreria",
    label: "Librería",
    atributosTipicos:
      "marca, tipo de producto, tamaño, color, presentación, cantidad de hojas, gramaje, formato, rayado, cuadriculado, liso, ISBN, editorial, autor, código de barras, SKU",
  },
  {
    slug: "jugueteria",
    label: "Juguetería",
    atributosTipicos:
      "marca, línea, personaje, edad recomendada, material, tamaño, color, modelo, piezas, pilas, código de barras, SKU, tipo de producto",
  },
  {
    slug: "regaleria",
    label: "Regalería / Bazar",
    atributosTipicos:
      "marca, material, color, tamaño, medida, capacidad, volumen, diseño, modelo, unidad, set, cantidad de piezas, código de barras, SKU, tipo de producto",
  },
  {
    slug: "bazar",
    label: "Bazar",
    atributosTipicos:
      "marca, material, medida, diámetro, capacidad, litros, color, modelo, unidad, set, cantidad de piezas, apto microondas, apto lavavajillas, código de barras",
  },
  {
    slug: "muebleria",
    label: "Mueblería",
    atributosTipicos:
      "marca, modelo, material, color, largo, ancho, alto, medida, ambiente, cantidad de piezas, terminación, tapizado, código interno, SKU",
  },
  {
    slug: "decoracion",
    label: "Decoración",
    atributosTipicos:
      "marca, modelo, material, color, medida, largo, ancho, alto, estilo, ambiente, fragancia, presentación, código de barras, SKU",
  },
  {
    slug: "panaderia",
    label: "Panadería",
    atributosTipicos:
      "tipo de producto, peso, unidad, cantidad, sabor, relleno, presentación, producción diaria, fecha de elaboración, vencimiento, lote, categoría",
  },
  {
    slug: "pasteleria",
    label: "Pastelería",
    atributosTipicos:
      "tipo de producto, sabor, relleno, tamaño, peso, porciones, presentación, decoración, fecha de elaboración, vencimiento, lote, categoría",
  },
  {
    slug: "carniceria",
    label: "Carnicería",
    atributosTipicos:
      "tipo de corte, animal, carne vacuna, pollo, cerdo, cordero, peso, kilo, unidad, categoría, origen, envasado, lote, vencimiento, fecha de faena",
  },
  {
    slug: "fiambreria",
    label: "Fiambrería",
    atributosTipicos:
      "marca, tipo de fiambre, tipo de queso, peso, kilo, unidad, presentación, horma, fetas, sabor, origen, lote, vencimiento, código de barras",
  },
  {
    slug: "verduleria",
    label: "Verdulería",
    atributosTipicos:
      "tipo de producto, variedad, peso, kilo, unidad, calibre, origen, maduración, orgánico, bandeja, bolsa, cajón, categoría",
  },
  {
    slug: "pescaderia",
    label: "Pescadería",
    atributosTipicos:
      "tipo de pescado, marisco, corte, fresco, congelado, peso, kilo, unidad, origen, lote, vencimiento, fecha de captura, presentación",
  },
  {
    slug: "dieteticay_natural",
    label: "Dietética / Natural",
    atributosTipicos:
      "marca, tipo de producto, peso, gramos, kilo, unidad, sabor, variedad, orgánico, sin TACC, vegano, presentación, vencimiento, lote, código de barras",
  },
  {
    slug: "heladeria",
    label: "Heladería",
    atributosTipicos:
      "sabor, peso, kilo, unidad, presentación, pote, cucurucho, palito, tipo de producto, apto vegano, sin TACC, fecha de elaboración, vencimiento, lote",
  },
  {
    slug: "bar_cerveceria",
    label: "Bar / Cervecería",
    atributosTipicos:
      "marca, estilo, tipo de bebida, volumen, ml, litros, envase, botella, lata, barril, retornable, graduación alcohólica, IBU, vencimiento, lote, código de barras",
  },
  {
    slug: "restaurant",
    label: "Restaurant / Comida",
    atributosTipicos:
      "ingrediente, insumo, marca, peso, kilo, unidad, presentación, envase, vencimiento, lote, tipo de producto, categoría, subcategoría",
  },
  {
    slug: "rotiseria",
    label: "Rotisería",
    atributosTipicos:
      "ingrediente, insumo, peso, kilo, unidad, presentación, fecha de elaboración, vencimiento, lote, tipo de producto, categoría",
  },
  {
    slug: "cafeteria",
    label: "Cafetería",
    atributosTipicos:
      "marca, tipo de café, origen, molienda, intensidad, peso, gramos, unidad, cápsulas, cantidad por pack, leche, jarabe, sabor, vencimiento, lote",
  },
  {
    slug: "gimnasio",
    label: "Gimnasio",
    atributosTipicos:
      "tipo de servicio, duración, plan, membresía, marca, suplemento, sabor, peso, presentación, porciones, vencimiento, lote, código de barras",
  },
  {
    slug: "peluqueria",
    label: "Peluquería",
    atributosTipicos:
      "marca, línea, tipo de producto, shampoo, acondicionador, tintura, oxidante, color, número de tono, volumen, ml, tipo de cabello, lote, vencimiento",
  },
  {
    slug: "estetica",
    label: "Estética / Spa",
    atributosTipicos:
      "marca, línea, tipo de producto, tratamiento, presentación, ml, gramos, tipo de piel, zona de aplicación, aparatología, insumo descartable, lote, vencimiento",
  },
  {
    slug: "optica",
    label: "Óptica",
    atributosTipicos:
      "marca, modelo, armazón, color, material, medida, graduación, dioptría, lente, filtro azul, UV, contacto, curva base, diámetro, vencimiento, lote",
  },
  {
    slug: "relojeria_joyeria",
    label: "Relojería / Joyería",
    atributosTipicos:
      "marca, modelo, material, color, medida, talle, piedra, metal, quilates, baño, garantía, número de serie, SKU, código interno",
  },
  {
    slug: "autopartes",
    label: "Autopartes / Repuestos",
    atributosTipicos:
      "marca, modelo, compatibilidad, vehículo, año, motor, medida, número de pieza, código OEM, lado, delantero, trasero, garantía, SKU",
  },
  {
    slug: "lubricentro",
    label: "Lubricentro",
    atributosTipicos:
      "marca, viscosidad, tipo de aceite, mineral, semi sintético, sintético, litros, presentación, filtro, compatibilidad, vehículo, vencimiento, lote",
  },
  {
    slug: "bicicleteria",
    label: "Bicicletería",
    atributosTipicos:
      "marca, modelo, rodado, medida, talle, color, material, compatibilidad, tipo de bicicleta, número de serie, SKU, código interno",
  },
  {
    slug: "motorepuestos",
    label: "Moto Repuestos",
    atributosTipicos:
      "marca, modelo, compatibilidad, cilindrada, año, medida, número de pieza, lado, delantero, trasero, color, garantía, SKU",
  },
  {
    slug: "sanitaria",
    label: "Sanitaria",
    atributosTipicos:
      "marca, medida, diámetro, material, rosca, largo, color, tipo de conexión, presión, unidad, código interno, SKU",
  },
  {
    slug: "agropecuaria",
    label: "Agropecuaria",
    atributosTipicos:
      "marca, tipo de producto, especie, cultivo, presentación, peso, litros, dosis, principio activo, lote, vencimiento, registro, código de barras",
  },
  {
    slug: "floreria",
    label: "Florería",
    atributosTipicos:
      "tipo de flor, planta, color, tamaño, unidad, ramo, maceta, presentación, ocasión, variedad, origen, fecha de ingreso",
  },
  {
    slug: "limpieza",
    label: "Artículos de Limpieza",
    atributosTipicos:
      "marca, tipo de producto, fragancia, presentación, litros, ml, gramos, unidad, pack, cantidad por pack, concentración, vencimiento, lote, código de barras",
  },
  {
    slug: "cotillon",
    label: "Cotillón",
    atributosTipicos:
      "tipo de producto, temática, color, tamaño, cantidad por pack, material, edad, personaje, ocasión, código de barras, SKU",
  },
  {
    slug: "textil_hogar",
    label: "Textil Hogar",
    atributosTipicos:
      "marca, material, medida, color, tamaño, cantidad de piezas, tipo de tela, composición, cama, baño, cocina, SKU, código de barras",
  },
  {
    slug: "bebes",
    label: "Bebés / Maternidad",
    atributosTipicos:
      "marca, talle, edad, peso recomendado, etapa, color, material, presentación, cantidad por pack, vencimiento, lote, código de barras",
  },
  {
    slug: "servicios_generales",
    label: "Servicios Generales",
    atributosTipicos:
      "tipo de servicio, duración, unidad, categoría, descripción, insumo asociado, mano de obra, código interno",
  },
];

export const RUBRO_OTRO_SLUG = "otro";

/**
 * Tope de longitud para el texto libre de rubro en Setup/Ajustes.
 *
 * Ver settings/general/route.ts.
 * Esto evita mandar un texto largo en cada request de OCR.
 */
export const RUBRO_MAX_LENGTH = 60;

const RUBRO_ATRIBUTOS_TIPICOS_MAP: Record<string, string> = Object.fromEntries(
  RUBROS_NEGOCIO.map((r) => [r.slug, r.atributosTipicos]),
);

/**
 * Hint de atributos típicos para el rubro dado.
 *
 * Devuelve "" si:
 * - el rubro viene vacío,
 * - el rubro es texto libre de "Otro",
 * - el rubro no existe en los slugs fijos,
 * - el rubro no tiene atributos típicos definidos.
 *
 * En esos casos el prompt OCR omite la cláusula de sugerencia.
 */
export function getAtributosTipicos(rubro: string | null | undefined): string {
  if (!rubro) return "";
  return RUBRO_ATRIBUTOS_TIPICOS_MAP[rubro] ?? "";
}

/**
 * Devuelve el label visible de un rubro.
 * Útil para mostrar el nombre en Ajustes, Setup o logs.
 */
export function getRubroLabel(rubro: string | null | undefined): string {
  if (!rubro) return "";
  return RUBROS_NEGOCIO.find((r) => r.slug === rubro)?.label ?? rubro;
}

/**
 * Valida si un slug pertenece a la lista fija de rubros.
 * No valida el texto libre de "Otro".
 */
export function isRubroNegocioSlug(rubro: string | null | undefined): boolean {
  if (!rubro) return false;
  return RUBROS_NEGOCIO.some((r) => r.slug === rubro);
}

/**
 * Opciones listas para usar en un selector.
 */
export function getRubrosNegocioOptions(): Array<{
  value: string;
  label: string;
}> {
  return RUBROS_NEGOCIO.map((rubro) => ({
    value: rubro.slug,
    label: rubro.label,
  }));
}
