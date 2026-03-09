# Principios de Migración

> Estrategia de migración segura para cambios con tiempo de inactividad cero (zero-downtime).

## Estrategia de Migración Segura

```
Para cambios sin tiempo de inactividad:
│
├── Agregar columna
│   └── Agregar como nullable → backfill → agregar NOT NULL
│
├── Eliminar columna
│   └── Dejar de usar en código → desplegar → eliminar columna
│
├── Agregar índice
│   └── CREATE INDEX CONCURRENTLY (no bloqueante)
│
└── Renombrar columna
    └── Agregar nueva → migrar datos → desplegar → eliminar antigua
```

## Filosofía de Migración

- Nunca realizar cambios disruptivos en un solo paso.
- Probar las migraciones en una copia de datos reales primero.
- Contar siempre con un plan de reversión (rollback) probado.
- Ejecutar dentro de transacciones siempre que sea posible.

## Mejores Prácticas

- **Migraciones Desacopladas**: Utilizar *Feature Flags* para separar el despliegue del esquema de la activación de la funcionalidad.
- **Validación por IA**: Emplear herramientas de IA para analizar el impacto de las consultas y sugerir índices óptimos antes de aplicar cambios.
- **Observabilidad Integrada**: Monitorear métricas de latencia y bloqueos en tiempo real durante la ejecución de la migración.
- **Enfoque "Expand and Contract"**: El estándar de oro para evitar estados inconsistentes entre versiones de la aplicación.
- **Pruebas de Regresión Automáticas**: Ejecutar suites de pruebas contra la base de datos migrada en entornos efímeros antes del merge.

## Bases de Datos Serverless

### Neon (Serverless PostgreSQL)

| Característica | Beneficio |
| :--- | :--- |
| Escala a cero | Ahorro de costos en inactividad |
| Branching instantáneo | Ramas de BD para desarrollo y preview |
| PostgreSQL Completo | Compatibilidad total con el ecosistema |
| Autoescalado | Manejo dinámico de picos de tráfico |

### Turso (Edge SQLite)

| Característica | Beneficio |
| :--- | :--- |
| Ubicaciones Edge | Latencia ultra baja global |
| Compatible con SQLite | Simplicidad y ligereza |
| Nivel gratuito generoso | Ideal para prototipado y startups |
| Distribución Global | Rendimiento consistente en todo el mundo |
```
