# Optimización de Consultas (Edición 2026)

> Problema N+1, EXPLAIN ANALYZE, paginación por cursor y estrategias de indexación avanzada.

## El Problema N+1

```text
¿Qué es N+1?
├── 1 consulta para obtener registros padres
├── N consultas adicionales para registros relacionados
└── ¡Degradación exponencial del rendimiento!

Soluciones Modernas:
├── JOINs / JSON Aggregation → Traer datos relacionados en un solo payload JSON (PostgreSQL `json_agg`)
├── Eager loading → Configuración del ORM para precarga
├── DataLoaders → Batching y caching (Esencial en GraphQL/BFF)
└── Keyset Pagination → Evitar el conteo de registros innecesarios
```

## Mentalidad de Análisis (Observabilidad)

```text
Antes de optimizar:
├── EXPLAIN (ANALYZE, BUFFERS) → Ver uso de memoria y disco
├── Identificar Seq Scan vs Index Scan
├── Detectar "Index Only Scans" (El estado ideal)
└── Analizar el "JIT Compilation" y "Parallel Workers"
```

## Prioridades de Optimización

1.  **Índices Estratégicos**: No solo crear índices, sino usar *Covering Indexes* (INCLUDE), índices parciales (WHERE) y tipos modernos como BRIN para Big Data.
2.  **Paginación por Cursor (Keyset)**: Abandonar `OFFSET` y `LIMIT` en favor de filtros por ID o timestamp para evitar el re-escaneo de tablas.
3.  **Proyección Estricta**: Seleccionar solo las columnas necesarias. El uso de `SELECT *` rompe la capacidad de la DB de realizar *Index Only Scans*.
4.  **Agregación en Base de Datos**: Utilizar funciones de ventana (`Window Functions`) y agregaciones JSON para reducir el procesamiento en el servidor de aplicaciones.
5.  **Caché en el Edge**: Mover los datos leídos frecuentemente a capas de caché distribuida o BDs vectoriales/documentales si el esquema es muy complejo para SQL.
```
