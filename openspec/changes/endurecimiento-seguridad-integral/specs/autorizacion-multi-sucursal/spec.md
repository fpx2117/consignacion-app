# Especificacion de Autorizacion Multi-Sucursal

## Proposito

Definir el comportamiento obligatorio para resolver y aplicar el contexto de sucursal en requests autenticadas sin confiar en headers controlados por el cliente como fuente de autorizacion.

## Requisitos

### Requisito: Contexto efectivo resuelto por el servidor

El sistema DEBE resolver la sucursal efectiva de cada request autenticada exclusivamente desde fuentes controladas por el servidor y validadas contra las sucursales permitidas para el usuario.

#### Escenario: La sucursal activa proviene de una fuente server-side valida

- DADO QUE un usuario autenticado tiene una lista de sucursales permitidas
- Y el servidor dispone de una fuente valida para la sucursal activa de ese usuario
- CUANDO el sistema construye el contexto de autorizacion para una request
- ENTONCES DEBE fijar `activeSucursalId` usando solo la fuente controlada por el servidor
- Y DEBE verificar que `activeSucursalId` pertenezca a la lista de sucursales permitidas

#### Escenario: No existe sucursal activa valida en el servidor

- DADO QUE un usuario autenticado no tiene una sucursal activa valida resuelta por el servidor
- CUANDO el sistema intenta construir el contexto de autorizacion
- ENTONCES NO DEBE inferir una sucursal efectiva desde datos no confiables del cliente
- Y DEBE rechazar la request o derivarla a un estado de seleccion controlada segun la politica del sistema

### Requisito: Headers y entradas del cliente sin autoridad implicita

El sistema NO DEBE tratar `x-sucursal-id` ni ninguna otra entrada del cliente como autoridad suficiente para cambiar la sucursal efectiva de una request autenticada.

#### Escenario: Header malicioso intenta pivotear de sucursal

- DADO QUE un usuario autenticado pertenece solo a la sucursal 10
- Y la request incluye `x-sucursal-id` con valor 20
- CUANDO el sistema valida la autorizacion multi-sucursal
- ENTONCES NO DEBE usar el header para fijar la sucursal efectiva en 20
- Y DEBE conservar la sucursal server-side valida o rechazar la request

#### Escenario: Entrada del cliente coincide con una sucursal permitida

- DADO QUE un usuario autenticado pertenece a varias sucursales permitidas
- Y la request incluye una entrada del cliente que solicita una sucursal permitida
- CUANDO el sistema procesa esa solicitud
- ENTONCES DEBE tratarla solo como una preferencia o solicitud de cambio
- Y NO DEBE aplicarla sin una validacion server-side explicita del contexto resultante

### Requisito: Contrato consistente de autorizacion por request

El sistema DEBE exponer un contrato de autorizacion consistente que incluya identidad, rol, sucursal efectiva validada y conjunto de sucursales permitidas para la request actual.

#### Escenario: Request valida obtiene contexto completo

- DADO QUE una request autenticada supera la validacion de identidad y sucursal
- CUANDO una ruta consume el contexto de autorizacion
- ENTONCES DEBE recibir la identidad del usuario, su rol, `activeSucursalId` validado y la lista de sucursales permitidas
- Y esos datos DEBEN corresponder al mismo estado de autorizacion evaluado por el servidor

#### Escenario: Ruta critica reutiliza el mismo contrato

- DADO QUE dos rutas protegidas procesan operaciones para un mismo usuario autenticado
- CUANDO ambas resuelven el contexto multi-sucursal de la request
- ENTONCES DEBEN basarse en el mismo contrato de autorizacion
- Y NO DEBEN aplicar reglas divergentes para interpretar la sucursal efectiva

### Requisito: Excepciones globales bajo politica explicita

El sistema SOLO PODRA permitir una vista global o sin sucursal fija cuando exista una politica explicita por rol y esa excepcion quede diferenciada del acceso normal por sucursal.

#### Escenario: Rol con permiso explicito de vista global

- DADO QUE un rol tiene permiso explicito para operar en vista global
- CUANDO el sistema resuelve el contexto de autorizacion para una request global
- ENTONCES DEBE marcar la excepcion global de forma explicita y auditable
- Y NO DEBE confundirla con una sucursal efectiva ordinaria no validada

#### Escenario: Rol sin permiso global intenta acceder sin sucursal valida

- DADO QUE un rol no tiene permiso de vista global
- Y la request no cuenta con una sucursal efectiva valida
- CUANDO el sistema evalua la autorizacion
- ENTONCES DEBE rechazar el acceso
- Y NO DEBE degradar automaticamente a una vista global por ausencia de sucursal
