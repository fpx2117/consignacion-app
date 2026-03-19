# Especificacion de Uploads y Serving Seguro de Archivos

## Proposito

Definir los controles obligatorios para aceptar, almacenar y servir archivos de forma segura, limitando tipos permitidos, reduciendo la exposicion publica y evitando que contenido no validado quede accesible de forma arbitraria.

## Requisitos

### Requisito: Allowlist fuerte de archivos aceptados

El sistema DEBE aceptar uploads solo cuando el archivo cumpla una allowlist explicita por caso de uso que combine extension permitida, tipo declarado y validacion adicional de contenido cuando corresponda.

#### Escenario: Archivo permitido supera todas las validaciones

- DADO QUE un usuario autorizado envia un archivo cuya extension, tipo declarado y contenido coinciden con un tipo permitido
- CUANDO el backend procesa el upload
- ENTONCES DEBE aceptar el archivo
- Y DEBE clasificarlo segun la allowlist del caso de uso correspondiente

#### Escenario: Archivo disfrazado intenta eludir la allowlist

- DADO QUE un usuario envia un archivo con extension permitida pero contenido incompatible o firma binaria invalida
- CUANDO el backend valida el upload
- ENTONCES DEBE rechazar el archivo
- Y NO DEBE almacenarlo como si fuera un tipo valido

### Requisito: Limites de tamano y nombres opacos

El sistema DEBE imponer un tamano maximo por caso de uso y DEBE generar identificadores opacos en servidor para los archivos aceptados.

#### Escenario: Upload dentro del tamano permitido

- DADO QUE un archivo cumple la allowlist y su tamano esta dentro del limite configurado
- CUANDO el backend lo acepta
- ENTONCES DEBE asignarle un nombre o identificador opaco generado por el servidor
- Y NO DEBE exponer el nombre original como identificador publico canonico

#### Escenario: Upload excede el tamano maximo

- DADO QUE un archivo supera el tamano maximo permitido para su caso de uso
- CUANDO el backend procesa la request
- ENTONCES DEBE rechazar el upload
- Y NO DEBE persistir el contenido parcial como archivo valido

### Requisito: Almacenamiento y serving desacoplados de rutas publicas directas

El sistema DEBE servir archivos subidos por usuarios mediante un handler controlado o una politica equivalente y NO DEBE exponerlos automaticamente como contenido publico navegable por ruta directa.

#### Escenario: Archivo valido se sirve desde un punto controlado

- DADO QUE existe un archivo previamente validado y autorizado para servir
- CUANDO un cliente solicita ese recurso
- ENTONCES el sistema DEBE resolverlo mediante un identificador seguro o una ruta controlada
- Y DEBE verificar que el recurso pertenezca al namespace esperado antes de responder

#### Escenario: Ruta ambigua o traversal intenta acceder a otro recurso

- DADO QUE un cliente solicita una ruta ambigua, manipulada o fuera del namespace permitido
- CUANDO el sistema evalua la peticion de serving
- ENTONCES DEBE rechazarla
- Y NO DEBE resolver archivos por concatenacion insegura de path

### Requisito: Respuestas defensivas al servir archivos

El sistema DEBERA emitir headers defensivos y restringir el serving a tipos explicitamente aprobados para evitar interpretacion activa o sniffing inseguro del contenido.

#### Escenario: Archivo permitido se entrega con headers defensivos

- DADO QUE un recurso es elegible para ser servido
- CUANDO el handler responde al cliente
- ENTONCES DEBE fijar un `Content-Type` consistente con metadata segura o allowlist validada
- Y DEBE incluir headers defensivos como `X-Content-Type-Options: nosniff` y una disposicion acorde al caso de uso

#### Escenario: Tipo no aprobado intenta servirse

- DADO QUE un archivo existe pero su tipo no esta aprobado para serving
- CUANDO un cliente solicita ese recurso
- ENTONCES el sistema NO DEBE entregarlo como contenido accesible
- Y DEBE responder con rechazo segun la politica de acceso vigente
