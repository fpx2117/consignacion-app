# Especificación de Zona Horaria de Usuario y Sesión

## Propósito

Definir cómo la preferencia de zona horaria del usuario se configura, se refleja en su sesión y gobierna el comportamiento global del sistema.

## Requisitos

### Requisito: Preferencia personal configurable

El sistema DEBE permitir que cada usuario configure una zona horaria personal que pase a ser la fuente primaria para su experiencia operativa.

#### Escenario: El usuario guarda una zona horaria propia

- DADO QUE un usuario autenticado accede a su configuración personal
- CUANDO guarda una zona horaria válida
- ENTONCES el sistema DEBE persistir esa preferencia para ese usuario
- Y DEBE usarla como primer nivel de precedencia en resoluciones posteriores

#### Escenario: La preferencia personal es independiente de la sucursal

- DADO QUE dos usuarios comparten la misma sucursal
- Y solo uno de ellos configura una zona horaria propia
- CUANDO ambos operan en el sistema
- ENTONCES el usuario configurado DEBE ver aplicada su preferencia
- Y el otro usuario DEBE seguir heredando la zona horaria de la sucursal o el fallback técnico

### Requisito: Herencia explícita hacia sucursal

El sistema DEBE permitir que un usuario elimine su preferencia personal para volver a heredar la zona horaria de la sucursal activa.

#### Escenario: El usuario vuelve a heredar desde sucursal

- DADO QUE un usuario tiene una zona horaria propia configurada
- Y la sucursal activa tiene una zona horaria válida
- CUANDO el usuario quita su preferencia personal
- ENTONCES el sistema DEBE dejar de usar la zona horaria del usuario
- Y DEBE resolver la zona horaria efectiva desde la sucursal

#### Escenario: La herencia cae al fallback si la sucursal no define zona horaria válida

- DADO QUE un usuario no tiene zona horaria propia configurada
- Y la sucursal activa no tiene una zona horaria válida
- CUANDO el sistema resuelve la zona horaria efectiva
- ENTONCES DEBE usar el fallback técnico temporal

### Requisito: Sesión y perfil con visibilidad de origen

El sistema DEBE exponer en el contexto de sesión/perfil la preferencia del usuario, la configuración de sucursal aplicable y la zona horaria efectivamente resuelta con su origen.

#### Escenario: El perfil informa los tres niveles relevantes

- DADO QUE un usuario autenticado consulta su perfil o contexto de sesión
- CUANDO el sistema responde la información de identidad operativa
- ENTONCES DEBE incluir la zona horaria del usuario
- Y DEBE incluir la zona horaria de la sucursal si existe
- Y DEBE incluir la zona horaria efectiva y su origen

#### Escenario: El origen coincide con la precedencia aplicada

- DADO QUE el sistema informa una zona horaria efectiva al usuario autenticado
- CUANDO el origen informado es usuario, sucursal o fallback
- ENTONCES ese origen DEBE coincidir con la regla real usada para resolver la zona horaria

### Requisito: Cambio de preferencia con efecto transversal

El sistema DEBERÁ reflejar la nueva zona horaria efectiva del usuario en todos los módulos relevantes después de actualizar su preferencia, sin requerir redefinir la zona horaria de sucursal.

#### Escenario: La nueva preferencia impacta en todos los módulos relevantes

- DADO QUE un usuario cambia su zona horaria personal por una válida distinta de la actual
- CUANDO vuelve a consultar módulos operativos, reportes y pantallas que muestran fechas
- ENTONCES todos ellos DEBEN reflejar la nueva zona horaria efectiva del usuario

#### Escenario: Cambiar la preferencia no modifica datos compartidos de sucursal

- DADO QUE un usuario cambia su zona horaria personal
- CUANDO el sistema guarda esa preferencia
- ENTONCES NO DEBE alterar por ese solo hecho la configuración de zona horaria de la sucursal
- Y NO DEBE reinterpretar retroactivamente datos históricos compartidos de la sucursal
