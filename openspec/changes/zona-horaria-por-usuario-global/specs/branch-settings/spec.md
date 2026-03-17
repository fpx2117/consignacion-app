# Especificación de Zona Horaria de Sucursal como Compatibilidad

## Propósito

Definir el rol de la configuración de zona horaria de sucursal como segundo nivel de precedencia y compatibilidad durante la transición hacia una resolución global centrada en usuario.

## Requisitos

### Requisito: Semántica secundaria de sucursal

El sistema DEBE tratar la zona horaria de sucursal como un nivel secundario de precedencia. La configuración de sucursal NO DEBE seguir siendo la única fuente de verdad global.

#### Escenario: La configuración de sucursal aplica cuando el usuario no decide

- DADO QUE una sucursal tiene una zona horaria válida configurada
- Y un usuario de esa sucursal no tiene preferencia propia
- CUANDO el sistema resuelve la zona horaria efectiva
- ENTONCES DEBE aplicar la zona horaria de la sucursal

#### Escenario: La configuración de sucursal deja de prevalecer sobre el usuario

- DADO QUE una sucursal tiene una zona horaria válida configurada
- Y el usuario autenticado tiene una zona horaria propia válida distinta
- CUANDO el sistema resuelve la zona horaria efectiva
- ENTONCES NO DEBE prevalecer la configuración de sucursal sobre la del usuario

### Requisito: Configuración de sucursal preservada por compatibilidad

El sistema DEBERÁ conservar la capacidad de consultar y actualizar la zona horaria de sucursal para compatibilidad operativa y organizacional.

#### Escenario: Un administrador actualiza la zona horaria de la sucursal

- DADO QUE un administrador gestiona la configuración general de una sucursal
- CUANDO guarda una zona horaria válida para esa sucursal
- ENTONCES el sistema DEBE persistir la configuración de sucursal
- Y DEBE dejarla disponible como segundo nivel de precedencia

#### Escenario: El cambio de sucursal afecta solo a quienes heredan

- DADO QUE una sucursal cambia su zona horaria configurada
- Y existen usuarios con preferencia propia y usuarios sin preferencia propia
- CUANDO el sistema aplica la nueva configuración
- ENTONCES solo los usuarios que heredan DEBEN verse afectados por ese cambio
- Y los usuarios con preferencia propia NO DEBEN perder su zona horaria efectiva

### Requisito: Migración histórica acotada a sucursal

El sistema DEBE mantener cualquier tratamiento de corrección histórica de fechas como una operación asociada a la configuración de sucursal y NO DEBE dispararla por cambios de preferencia personal.

#### Escenario: Cambio de zona horaria de sucursal mantiene su responsabilidad histórica

- DADO QUE existe una capacidad administrativa para corregir datos históricos vinculados a la zona horaria
- CUANDO se opera sobre la configuración de una sucursal
- ENTONCES esa capacidad DEBE seguir asociada a la sucursal

#### Escenario: Cambio de preferencia del usuario no dispara corrección histórica

- DADO QUE un usuario cambia su zona horaria personal
- CUANDO el sistema registra ese cambio
- ENTONCES NO DEBE iniciar una corrección histórica de timestamps compartidos

### Requisito: Comunicación de precedencia en settings

El sistema DEBERÁ comunicar en la experiencia de configuración que la zona horaria de sucursal funciona como herencia o fallback organizacional, no como criterio primario deseado.

#### Escenario: La UI distingue zona personal y zona de sucursal

- DADO QUE un usuario accede a la configuración relacionada con zona horaria
- CUANDO visualiza opciones personales y organizacionales
- ENTONCES el sistema DEBE distinguir claramente la zona horaria personal de la zona horaria de sucursal

#### Escenario: La UI explica la precedencia

- DADO QUE un usuario o administrador revisa la configuración de zona horaria
- CUANDO el sistema presenta el estado actual
- ENTONCES DEBE quedar explícito que la precedencia es usuario sobre sucursal
- Y que la sucursal opera como herencia o compatibilidad
