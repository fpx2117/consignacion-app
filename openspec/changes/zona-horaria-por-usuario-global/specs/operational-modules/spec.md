# Especificación de Zona Horaria en Módulos Operativos

## Propósito

Definir el comportamiento esperado para cálculos, validaciones y formateo de fechas en módulos operativos del negocio usando la zona horaria efectiva resuelta para el usuario.

## Requisitos

### Requisito: Cálculos operativos con zona horaria efectiva

El sistema DEBE usar la zona horaria efectiva resuelta para crear, validar y fechar operaciones de negocio en ventas, caja, gastos, historial, KPI y procesos equivalentes.

#### Escenario: Una operación nueva usa la zona horaria efectiva

- DADO QUE un usuario autenticado ejecuta una operación de negocio que genera una fecha operativa nueva
- CUANDO el sistema registra esa operación
- ENTONCES DEBE basarse en la zona horaria efectiva resuelta para ese usuario

#### Escenario: Dos usuarios con zonas horarias distintas operan sobre la misma sucursal

- DADO QUE dos usuarios de una misma sucursal tienen zonas horarias efectivas distintas por precedencia
- CUANDO cada uno realiza una operación en su contexto autenticado
- ENTONCES el sistema DEBE resolver la fecha operativa según la zona horaria efectiva de cada usuario

### Requisito: Validaciones horarias de caja y turnos

El sistema DEBE evaluar aperturas, extensiones, cierres y restricciones horarias de caja contra la zona horaria efectiva del usuario autenticado.

#### Escenario: Apertura de turno dentro del horario válido

- DADO QUE un usuario tiene horario laboral configurado
- Y su zona horaria efectiva ubica la hora actual dentro del turno permitido
- CUANDO intenta abrir caja o iniciar turno
- ENTONCES el sistema DEBE permitir la operación

#### Escenario: Restricción horaria evaluada en la zona correcta

- DADO QUE un usuario tiene horario laboral configurado
- Y la decisión de permitido o no permitido cambia según la zona horaria aplicada
- CUANDO el sistema valida el horario operativo
- ENTONCES DEBE tomar la decisión usando la zona horaria efectiva del usuario
- Y NO DEBE evaluarla con una zona horaria hardcodeada distinta

### Requisito: Rangos temporales en historial y métricas

El sistema DEBE calcular cortes de día, semana, mes y año con la zona horaria efectiva resuelta, incluyendo vistas globales y agregaciones históricas.

#### Escenario: Filtro mensual respeta la medianoche efectiva

- DADO QUE un usuario consulta historial o métricas por un período mensual
- CUANDO el sistema calcula el rango temporal aplicable
- ENTONCES DEBE usar la medianoche correspondiente a la zona horaria efectiva del usuario

#### Escenario: Vista global sin atajo a sucursal fija

- DADO QUE un usuario consulta una vista global de métricas o historial
- CUANDO el sistema necesita definir el rango temporal
- ENTONCES DEBE usar la resolución global de zona horaria
- Y NO DEBE basarse en una sucursal fija hardcodeada

### Requisito: Eliminación de supuestos locales dispersos

El sistema NO DEBE permitir que módulos operativos usen una zona horaria hardcodeada o la zona local del dispositivo como fuente de verdad de negocio.

#### Escenario: Módulo operativo con fecha visible

- DADO QUE un módulo operativo muestra o calcula fechas relevantes para el negocio
- CUANDO el sistema resuelve esa fecha
- ENTONCES DEBE usar la zona horaria efectiva del contexto
- Y NO DEBE asumir implícitamente `America/Argentina/Buenos_Aires`

#### Escenario: El navegador solo puede ser sugerencia

- DADO QUE el dispositivo del usuario reporta una zona horaria propia del navegador
- CUANDO esa zona difiere de la zona horaria efectiva resuelta por el sistema
- ENTONCES el sistema DEBE seguir usando la zona horaria efectiva para el comportamiento de negocio
