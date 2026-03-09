```markdown
---
name: database-design
description: Principios de diseño de bases de datos y toma de decisiones. Diseño de esquemas, estrategia de indexación, selección de ORM, bases de datos serverless.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Diseño de Bases de Datos

> **Aprende a PENSAR, no a copiar patrones SQL.**

## 🎯 Regla de Lectura Selectiva

**¡Lee SOLO los archivos relevantes para la solicitud!** Revisa el mapa de contenido, encuentra lo que necesitas.

| Archivo | Descripción | Cuándo leer |
|------|-------------|--------------|
| `database-selection.md` | PostgreSQL vs Neon vs Turso vs SQLite | Elección de base de datos |
| `orm-selection.md` | Drizzle vs Prisma vs Kysely | Elección de ORM |
| `schema-design.md` | Normalización, PKs, relaciones | Diseño de esquema |
| `indexing.md` | Tipos de índices, índices compuestos | Ajuste de rendimiento |
| `optimization.md` | N+1, EXPLAIN ANALYZE | Optimización de consultas |
| `migrations.md` | Migraciones seguras, DBs serverless | Cambios de esquema |

---

## ⚠️ Principio Fundamental

- PREGUNTA al usuario por sus preferencias de base de datos cuando no estén claras.
- Elige la base de datos/ORM basándote en el CONTEXTO.
- No uses PostgreSQL por defecto para todo.

---

## Lista de Verificación de Decisiones

Antes de diseñar el esquema:

- [ ] ¿Se consultó al usuario sobre su preferencia de base de datos?
- [ ] ¿Se eligió la base de datos para ESTE contexto?
- [ ] ¿Se consideró el entorno de despliegue?
- [ ] ¿Se planificó la estrategia de índices?
- [ ] ¿Se definieron los tipos de relaciones?

---

## Anti-patrones

❌ Usar PostgreSQL por defecto para aplicaciones simples (SQLite puede ser suficiente)
❌ Omitir la creación de índices
❌ Usar SELECT * en producción
❌ Almacenar JSON cuando los datos estructurados son mejores
❌ Ignorar consultas N+1
```
