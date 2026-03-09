# Selección de ORM (2025)

> Elige el ORM basado en las necesidades de despliegue y DX.

## Árbol de Decisión

```
¿Cuál es el contexto?
│
├── Despliegue en el Edge / El tamaño del bundle importa
│   └── Drizzle (más pequeño, similar a SQL)
│
├── Mejor DX / Primero el esquema (Schema-first)
│   └── Prisma (migraciones, studio)
│
├── Control máximo
│   └── SQL puro con constructor de consultas (query builder)
│
└── Ecosistema Python
    └── SQLAlchemy 2.0 (soporte asíncrono)
```

## Comparación

| ORM | Ideal para | Compensaciones (Trade-offs) |
|-----|----------|------------|
| **Drizzle** | Edge, TypeScript | Más nuevo, menos ejemplos |
| **Prisma** | DX, gestión de esquemas | Más pesado, no apto para Edge |
| **Kysely** | Constructor SQL con tipos seguros | Migraciones manuales |
| **Raw SQL** | Consultas complejas, control | Seguridad de tipos manual |
```
