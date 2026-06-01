# Propuesta: Motor de E-Commerce Dinámico (Dynamic E-commerce Engine)

## Intención

Desarrollar la base funcional y visual de un nuevo e-commerce desde cero, enfocado en ser un motor de tienda "White-label" o completamente marca-personalizable. La necesidad principal (y problema central a resolver) es desacoplar el diseño del código fuente: todos los aspectos visuales fundamentales de la tienda (colores, tipografías y estilos principales) deben ser parametrizables dinámicamente desde un módulo de "Settings", sin requerir nuevas versiones de código, compilaciones o conocimientos técnicos por parte de los administradores.

## Alcance

### Dentro del Alcance
- **Módulo Administrador de "Settings"**: Interfaz UI/UX para que el administrador gestione variables de estilo (color primario, secundario, tipografías, y posiblemente estilos de bordes).
- **Backend/Almacenamiento**: Modelo de base de datos para guardar estas preferencias a nivel de *tenant* o tienda global, junto a su API de persistencia.
- **Frontend (E-commerce público)**: Implementación del motor de inyección de estilos (ej. CSS custom properties o Theme Provider) que consume los Settings de la base de datos para pintar la interfaz.
- **Estilos de Respaldo (Fallback)**: Valores de diseño por defecto si el módulo de settings falla o no ha sido configurado.

### Fuera del Alcance
- Pasarelas de pagos, carritos complejos o gestión avanzada de inventario (en esta primera iteración, nos centramos en el motor y la personalización).
- Constructor de páginas (Page Builder) de arrastrar y soltar (Drag and Drop); solo aplicamos estilos dinámicos a una plantilla estructurada fija.
- Animaciones complejas personalizables.

## Enfoque

El enfoque técnico se basará en **Variables CSS dinámicas** inyectadas en la raíz (`:root`) del DOM de la tienda. 
1. El backend proveerá un modelo `StoreSettings` (ej. `{ primaryColor: '#FF0000', fontFamily: 'Inter' }`).
2. En la carga inicial de la aplicación (idealmente vía SSR para evitar parpadeos, o SSR-hidratado), el cliente realizará la consulta para obtener `StoreSettings`.
3. Se generará un bloque `<style>` dinámico o un script que inyectará estas variables (ej. `--theme-primary: #FF0000`) en el documento.
4. Todos los componentes de UI del frontend público estarán desarrollados para consumir estas variables CSS (ej. usando utilidades extendidas si es Tailwind, o estilos CSS planos).

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `Database` | Nuevo | Tabla/Modelo para la configuración global/tenant de estilos. |
| `API` | Nuevo | Endpoints de CRUD para las configuraciones del sistema. |
| `Admin / Settings` | Nuevo | Nueva vista o módulo en el dashboard administrativo con *color pickers* y selección de fuentes. |
| `Storefront / UI` | Nuevo | Motor principal de renderizado web y componentes UI base dependientes de variables inyectadas. |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Flash de contenido sin estilo (FOUC) durante el primer render | Alta | Inyectar la configuración pre-cargada desde el servidor (SSR) o utilizar un fallback rápido estático mientras resuelve el fetch. |
| Complejidad de mantener contraste accesible | Media | Recomendar automáticamente en el UI de Settings colores de contraste o advertir al usuario sobre mala legibilidad (WCAG). |

## Plan de Reversión (Rollback)

Al ser un desarrollo desde cero, si el sistema de estilos dinámicos produce un error de bloqueo:
- Se implementará un mecanismo de `catch` en el cargador principal que inyectará una configuración "hardcoded" de estilos (ej. un tema claro clásico predeterminado).
- La característica puede ser desactivada mediante una bandera de características (Feature Flag) en caso extremo, forzando a la tienda a operar con sus hojas de estilo fijadas temporalmente.

## Dependencias

- **Selector de fuentes**: Integración con Google Fonts o alojamiento local de las fuentes requeridas para cargarlas dinámicamente según lo guardado en los Settings.
- Librerías UI para el administrador (ej. react-color para seleccionar colores).

## Criterios de Éxito

- [ ] El usuario administrador puede cambiar un color y la tipografía desde el módulo de Settings.
- [ ] La interfaz guarda correctamente esta información en base de datos.
- [ ] Al visitar el "Storefront", los estilos cambian y reflejan la nueva configuración automáticamente sin requerir que un desarrollador intervenga y sin empaquetar nuevamente la aplicación.
- [ ] Si la base de datos no está disponible, la tienda carga utilizando un tema estandarizado de emergencia (fallback).