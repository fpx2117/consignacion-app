# Principios de Diseño de Esquemas

> Normalización, claves primarias, marcas de tiempo, relaciones.

## Decisión de Normalización

```
Cuándo normalizar (tablas separadas):
├── Los datos se repiten en las filas
├── Las actualizaciones requerirían múltiples cambios
├── Las relaciones son claras
└── Los patrones de consulta se benefician

Cuándo desnormalizar (incrustar/duplicar):
├── El rendimiento de lectura es crítico
├── Los datos cambian raramente
├── Siempre se recuperan juntos
└── Se necesitan consultas más simples
```

## Selección de Clave Primaria

| Tipo | Usar Cuando |
|------|----------|
| **UUID** | Sistemas distribuidos, seguridad |
| **ULID** | UUID + ordenable por tiempo |
| **Auto-increment** | Aplicaciones simples, base de datos única |
| **Natural key** | Raramente (significado de negocio) |

## Estrategia de Marcas de Tiempo

```
Para cada tabla:
├── created_at → Cuándo se creó
├── updated_at → Última modificación
└── deleted_at → Borrado lógico (si es necesario)

Usar TIMESTAMPTZ (con zona horaria) no TIMESTAMP
```

## Tipos de Relaciones

| Tipo | Cuándo | Implementación |
|------|------|----------------|
| **Uno a Uno** | Datos de extensión | Tabla separada con FK |
| **Uno a Muchos** | Padre-hijos | FK en la tabla hija |
| **Muchos a Muchos** | Ambos lados tienen muchos | Tabla de unión |

## Clave Foránea ON DELETE

```
├── CASCADE → Eliminar hijos con el padre
├── SET NULL → Los hijos se vuelven huérfanos
├── RESTRICT → Prevenir eliminación si existen hijos
└── SET DEFAULT → Los hijos obtienen el valor por defecto
```
```
