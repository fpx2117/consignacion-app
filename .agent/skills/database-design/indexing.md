# Principios de Indexación

> Cuándo y cómo crear índices de manera efectiva.

## Cuándo Crear Índices

```
Indexar estos:
├── Columnas en cláusulas WHERE
├── Columnas en condiciones JOIN
├── Columnas en ORDER BY
├── Columnas de claves foráneas
└── Restricciones de unicidad

No sobre-indexar:
├── Tablas con mucha escritura (ralentiza inserciones)
├── Columnas de baja cardinalidad
├── Columnas raramente consultadas
```

## Selección del Tipo de Índice

| Tipo | Uso Para |
|------|---------|
| **B-tree** | Propósito general, igualdad y rango |
| **Hash** | Solo igualdad, más rápido |
| **GIN** | JSONB, arrays, búsqueda de texto completo |
| **GiST** | Geométricos, tipos de rango |
| **HNSW/IVFFlat** | Similitud de vectores (pgvector) |

## Principios de Índices Compuestos

```
El orden importa para índices compuestos:
├── Columnas de igualdad primero
├── Columnas de rango al final
├── Las más selectivas primero
└── Coincidir con el patrón de consulta
```
```
