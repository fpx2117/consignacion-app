# Especificación de Zona Horaria en Reportes y UI

## Propósito

Definir cómo la zona horaria efectiva resuelta debe reflejarse de forma consistente en pantallas, comprobantes y reportes generados por el sistema.

## Requisitos

### Requisito: Presentación consistente en UI

El sistema DEBE mostrar fechas y horas en la UI usando la zona horaria efectiva resuelta para el usuario autenticado.

#### Escenario: Pantallas protegidas muestran la fecha con la zona efectiva

- DADO QUE un usuario autenticado navega por pantallas operativas que muestran fechas u horas
- CUANDO la UI renderiza esos valores
- ENTONCES DEBE formatearlos con la zona horaria efectiva del usuario

#### Escenario: Cambiar la preferencia personal actualiza la presentación

- DADO QUE un usuario modifica su zona horaria personal
- CUANDO vuelve a abrir una pantalla que muestra fechas del sistema
- ENTONCES la UI DEBE reflejar el nuevo formato horario consistente con la nueva zona horaria efectiva

### Requisito: Reportes y comprobantes con la misma fuente de verdad

El sistema DEBE generar tickets, remitos, comprobantes y reportes PDF con la misma zona horaria efectiva utilizada en la experiencia operativa correspondiente.

#### Escenario: Reporte y pantalla coinciden

- DADO QUE una operación puede verse en pantalla y también exportarse como reporte o comprobante
- CUANDO el usuario compara ambos resultados dentro del mismo contexto
- ENTONCES las fechas y horas DEBEN coincidir según la misma zona horaria efectiva

#### Escenario: Recurso persistido conserva consistencia al renderizar reporte

- DADO QUE el sistema genera un reporte o comprobante para un recurso persistido
- CUANDO necesita resolver la zona horaria aplicable a ese recurso
- ENTONCES DEBE aplicar la precedencia global definida para evitar diferencias con otros módulos

#### Escenario: Recurso persistido sin usuario durable no inventa dueño

- DADO QUE el sistema genera un reporte o comprobante para un recurso persistido sin referencia estable al usuario dueño o creador
- CUANDO necesita resolver la zona horaria aplicable a ese recurso
- ENTONCES DEBE degradar a la zona horaria de sucursal y luego al fallback técnico según la precedencia global
- Y NO DEBE inferir un usuario desde relaciones operativas indirectas o transitorias

### Requisito: Transparencia del origen en la experiencia de usuario

El sistema DEBERÍA informar en settings o contextos equivalentes cuál es el origen de la zona horaria efectiva cuando eso ayude a interpretar el comportamiento.

#### Escenario: El usuario ve si usa zona propia o heredada

- DADO QUE un usuario revisa su configuración o contexto de sesión
- CUANDO el sistema presenta el estado de su zona horaria
- ENTONCES DEBERÍA indicar si la zona efectiva proviene del usuario, de la sucursal o del fallback técnico

#### Escenario: El fallback técnico se presenta como transitorio

- DADO QUE la zona horaria efectiva de un usuario proviene del fallback técnico
- CUANDO el sistema informa ese estado en un contexto de configuración o sesión
- ENTONCES DEBERÍA dejar claro que se trata de una compatibilidad temporal y no de la configuración deseada

### Requisito: Sin hardcodes de presentación

El sistema NO DEBE introducir nuevos formateos de fechas en UI o reportes que asuman una zona horaria fija por fuera de la resolución global.

#### Escenario: Nueva pantalla o nuevo template

- DADO QUE se incorpora una pantalla o template que muestra fechas del negocio
- CUANDO define su comportamiento de presentación
- ENTONCES DEBE usar la zona horaria efectiva resuelta
- Y NO DEBE asumir una zona horaria fija inline

#### Escenario: Diferencia entre navegador y negocio

- DADO QUE la zona horaria del navegador del usuario difiere de la zona horaria efectiva del negocio
- CUANDO la UI o un reporte muestran fechas del negocio
- ENTONCES DEBEN seguir la zona horaria efectiva del sistema
- Y NO DEBEN priorizar la zona local del dispositivo
