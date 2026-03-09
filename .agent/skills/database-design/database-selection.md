# Selección de Base de Datos (2026)

> Elige la base de datos según el contexto, no por defecto.

## Árbol de Decisión

```
¿Cuáles son tus requisitos?
│
├── Funcionalidades relacionales completas
│   ├── Autohospedado → PostgreSQL
│   └── Serverless → Neon, Supabase
│
├── Despliegue en el Edge / Latencia ultra baja
│   └── Turso (SQLite en el edge)
│
├── IA / Búsqueda vectorial
│   └── PostgreSQL + pgvector
│
├── Simple / Embebida / Local
│   └── SQLite
│
└── Distribución global
    └── PlanetScale, CockroachDB, Turso
```

## Comparativa

| Base de Datos | Ideal para | Compromisos |
|---------------|------------|-------------|
| **PostgreSQL** | Funciones completas, consultas complejas | Requiere gestión de hosting |
| **Neon** | PG Serverless, branching de datos | Complejidad inherente de PG |
| **Turso** | Edge, baja latencia | Limitaciones de SQLite |
| **SQLite** | Proyectos simples, embebidos o locales | Escritor único (Single-writer) |
| **PlanetScale** | MySQL, escala global | Restricciones en claves foráneas |

## Preguntas Clave

1. ¿Cuál es el entorno de despliegue?
2. ¿Qué tan complejas son las consultas?
3. ¿Es prioritario el Edge o Serverless?
4. ¿Necesitas capacidades de búsqueda vectorial (IA)?
5. ¿Se requiere distribución global de datos?
```
