# Especificacion de Rate Limiting y Anti-Abuso en Auth Recovery

## Proposito

Definir protecciones testeables para desacelerar abuso en los flujos de login, recuperacion y restablecimiento de cuenta, preservando respuestas uniformes y observabilidad suficiente.

## Requisitos

### Requisito: Limites especificos por endpoint sensible

El sistema DEBE aplicar rate limiting configurable y diferenciado para `login`, `forgot-password` y `reset-password`, usando llaves compuestas acordes al riesgo del flujo.

#### Escenario: Login consume presupuesto de intentos propio

- DADO QUE un cliente realiza multiples intentos de autenticacion sobre el endpoint de login
- CUANDO el volumen supera el umbral configurado para la ventana activa
- ENTONCES el sistema DEBE bloquear o desacelerar intentos adicionales para esa llave de limite
- Y NO DEBE reutilizar ciegamente el mismo presupuesto que otros endpoints sensibles

#### Escenario: Forgot password y reset password usan politicas diferenciadas

- DADO QUE existen requests concurrentes a `forgot-password` y `reset-password`
- CUANDO el sistema evalua sus limites
- ENTONCES DEBE aplicar politicas especificas por endpoint
- Y DEBE permitir que el agotamiento de un flujo no implique automaticamente el agotamiento del otro salvo regla documentada

### Requisito: Llaves compuestas resistentes a abuso basico

El sistema DEBE construir la evaluacion de rate limiting con combinaciones de IP, identidad normalizada, token u otros atributos pertinentes para reducir brute force, flooding y abuso repetido.

#### Escenario: Abuso desde una IP compartida con misma identidad

- DADO QUE varias requests hacia un flujo sensible comparten la misma IP y la misma identidad normalizada
- CUANDO el volumen excede el umbral permitido
- ENTONCES el sistema DEBE considerar esa combinacion para activar el bloqueo o backoff
- Y DEBE registrar el evento como intento reiterado

#### Escenario: Reset password considera el token o artefacto de recuperacion

- DADO QUE existen multiples intentos sobre un mismo token o artefacto de recuperacion
- CUANDO el sistema evalua el rate limiting de `reset-password`
- ENTONCES DEBE poder distinguir el abuso asociado a ese token o artefacto
- Y NO DEBE depender solo de la IP cuando exista una identidad adicional mas precisa

### Requisito: Respuestas uniformes y anti-enumeracion

El sistema DEBE preservar respuestas uniformes en flujos de auth recovery y NO DEBE filtrar informacion que facilite enumeracion de cuentas, tokens o estados internos.

#### Escenario: Forgot password para cuenta existente o inexistente

- DADO QUE un cliente solicita recuperacion para una cuenta existente o inexistente
- CUANDO el sistema responde dentro del flujo normal permitido
- ENTONCES DEBE mantener una respuesta equivalente hacia el cliente
- Y NO DEBE revelar si la identidad existe, esta bloqueada o no fue encontrada

#### Escenario: Request bloqueada por limite mantiene lenguaje seguro

- DADO QUE una request supera el rate limiting del endpoint sensible
- CUANDO el sistema devuelve el rechazo correspondiente
- ENTONCES DEBE responder con un codigo y mensaje compatibles con la politica de seguridad
- Y NO DEBE incluir detalles que ayuden a ajustar ataques sobre cuentas o tokens especificos

### Requisito: Auditoria y tuning operativo

El sistema DEBERA registrar eventos relevantes de abuso, bloqueos y ajustes de umbral para permitir monitoreo, tuning y respuesta operativa posterior.

#### Escenario: Intento bloqueado queda auditado

- DADO QUE una request a login, forgot-password o reset-password es bloqueada por rate limiting
- CUANDO el sistema emite la respuesta al cliente
- ENTONCES DEBE registrar un evento de seguridad con endpoint, ventana y clave relevante minimizada
- Y DEBE dejar evidencia suficiente para correlacionar patrones de abuso

#### Escenario: Ajuste de thresholds iniciales

- DADO QUE el equipo operativo observa falsos positivos o abuso residual despues del despliegue
- CUANDO revisa la telemetria del control
- ENTONCES DEBERIA poder ajustar thresholds y ventanas dentro de la politica aprobada
- Y DEBE conservar trazabilidad de ese ajuste para revisiones posteriores
