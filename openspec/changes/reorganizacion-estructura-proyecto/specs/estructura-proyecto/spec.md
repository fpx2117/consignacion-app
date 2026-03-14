# Especificacion de estructura-proyecto

## Proposito

Definir los requisitos verificables para reorganizar la estructura del proyecto por dominios y capas, manteniendo compatibilidad temporal durante la migracion y evitando impactos funcionales en runtime.

## Requisitos

### Requisito: Reorganizacion por dominios y capas

El sistema DEBE reorganizar el codigo interno en una estructura por dominios (`src/features`) y capacidades transversales (`src/shared`), conservando separacion clara de responsabilidades.

El sistema DEBERA mantener una ubicacion coherente para tipos y contratos compartidos sin mezclar logica de dominio con utilidades transversales.

#### Escenario: Migracion estructural de un modulo de dominio

- DADO QUE existe un modulo de dominio en una ubicacion legacy de `src/lib`
- CUANDO se ejecuta la fase de reorganizacion de estructura
- ENTONCES el modulo queda ubicado bajo `src/features/<dominio>`
- Y sus dependencias transversales quedan ubicadas en `src/shared/<capa>` cuando corresponde

#### Escenario: Prevencion de mezcla de capas

- DADO QUE un cambio intenta ubicar utilidades transversales dentro de una carpeta de dominio
- CUANDO se valida la estructura objetivo del repositorio
- ENTONCES la validacion marca el incumplimiento de separacion por capas

### Requisito: Compatibilidad temporal de imports durante migracion

El sistema DEBE mantener compatibilidad temporal de imports legacy mediante wrappers de re-export y/o aliases de transicion hasta completar la migracion de consumo.

El sistema DEBERIA documentar para cada wrapper legacy una ventana de retiro y condicion explicita de eliminacion.

#### Escenario: Import legacy resuelto durante transicion

- DADO QUE un modulo consumidor aun importa desde una ruta legacy
- CUANDO la migracion se encuentra en fase de compatibilidad
- ENTONCES el import se resuelve correctamente a traves del wrapper o alias temporal
- Y el comportamiento funcional permanece sin cambios

#### Escenario: Import legacy fuera de ventana permitida

- DADO QUE la ventana de compatibilidad de un dominio ya finalizo
- CUANDO se agrega un nuevo import a una ruta legacy
- ENTONCES la validacion automatica bloquea el cambio por incumplimiento de politica de migracion

### Requisito: Politica de App Router inmutable

El sistema NO DEBE mover ni renombrar archivos bajo `src/app/**` como parte de este cambio estructural.

El sistema DEBE preservar contratos de runtime de rutas, layouts y route handlers durante toda la migracion.

#### Escenario: Reorganizacion interna sin alterar rutas

- DADO QUE se reorganizan modulos internos consumidos por una ruta existente
- CUANDO se ejecuta la build de la aplicacion
- ENTONCES las rutas publicadas permanecen accesibles con la misma URL
- Y los handlers continúan con el mismo punto de entrada en `src/app/**`

#### Escenario: Intento de mover archivos de App Router

- DADO QUE un lote de migracion incluye un movimiento fisico de archivos en `src/app/**`
- CUANDO se ejecuta la verificacion de politicas del cambio
- ENTONCES el lote se rechaza por violar la inmutabilidad del App Router

### Requisito: Politica de Prisma con source of truth unico

El sistema DEBE mantener `prisma/schema.prisma` como unico schema operativo y `prisma/seed.ts` como semilla canonica durante toda la migracion.

El sistema NO DEBE usar copias historicas de schema o seed como entradas de runtime o CI.

#### Escenario: Validacion de fuente canonica Prisma

- DADO QUE existen archivos historicos de Prisma archivados
- CUANDO se ejecutan validaciones de Prisma en CI o local
- ENTONCES las validaciones usan exclusivamente `prisma/schema.prisma`
- Y no se toma ningun archivo historico como fuente activa

#### Escenario: Referencia accidental a schema historico

- DADO QUE una configuracion apunta a un schema archivado
- CUANDO se ejecuta el proceso de validacion automatica
- ENTONCES la validacion falla indicando ruta Prisma no canonica

### Requisito: Validaciones automaticas de seguridad de migracion

El sistema DEBE ejecutar validaciones automaticas de seguridad estructural en cada fase de migracion para detectar imports rotos, regresiones de build y desviaciones de politicas.

El sistema DEBERA incluir como minimo validaciones de lint, typecheck, build y consistencia de Prisma antes de considerar estable un lote.

#### Escenario: Lote valido de migracion

- DADO QUE se completa un lote de reorganizacion
- CUANDO se ejecutan las validaciones automáticas requeridas
- ENTONCES todas las validaciones finalizan sin errores
- Y el lote queda habilitado para avanzar a la siguiente fase

#### Escenario: Deteccion temprana de regresion estructural

- DADO QUE un lote introduce un import roto
- CUANDO se ejecuta la cadena de validacion automatica
- ENTONCES el proceso falla antes del despliegue
- Y se bloquea la promocion del lote hasta corregir la regresion

### Requisito: Criterios de retiro de legacy wrappers

El sistema DEBE retirar wrappers y aliases legacy cuando no existan referencias activas a rutas antiguas y se hayan cumplido los criterios de estabilidad definidos para el dominio.

El sistema NO DEBERA mantener wrappers legacy indefinidamente una vez cumplidos los criterios de retiro.

#### Escenario: Retiro habilitado por cero referencias

- DADO QUE un dominio no presenta referencias a rutas legacy
- CUANDO se verifica estabilidad con validaciones completas del lote
- ENTONCES los wrappers legacy de ese dominio se eliminan
- Y la documentacion de migracion registra el retiro

#### Escenario: Retiro bloqueado por dependencias pendientes

- DADO QUE aun existen referencias legacy en un dominio
- CUANDO se intenta eliminar wrappers de compatibilidad
- ENTONCES la eliminacion se rechaza
- Y el dominio permanece en estado de compatibilidad temporal
