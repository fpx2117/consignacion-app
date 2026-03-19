# Diseno: Endurecimiento de seguridad integral

## Enfoque tecnico

El endurecimiento se implementa como un cambio transversal de controles, no como una serie de parches independientes. La prioridad es mover decisiones de confianza al servidor, reducir secretos expuestos, limitar la entrada de archivos arbitrarios, desacelerar vectores de abuso y cerrar superficie vulnerable en la cadena de dependencias.

Los cinco hallazgos estan relacionados:

1. `require-auth.ts` hoy permite que un header controlado por el cliente influya en el contexto multi-sucursal.
2. `.env` contiene valores reales que deben considerarse comprometidos operativamente.
3. El flujo de upload/serving acepta y publica archivos con validacion insuficiente.
4. Auth/recovery carece de rate limiting y deja expuestos flujos de brute force, flooding y token abuse.
5. El arbol de dependencias mantiene advisories abiertos que amplian la superficie de explotacion.

La solucion busca una postura de **default deny**, con validaciones explicitas, configuracion segura por defecto y rollback controlado.

## Decisiones de arquitectura

### Decision: El contexto multi-sucursal se resuelve server-side y nunca desde un header confiado ciegamente

**Eleccion**: eliminar `x-sucursal-id` como mecanismo de override directo en `require-auth.ts`. El contexto de sucursal activa debe derivarse de la sesion/cookie controlada por el servidor y luego validarse contra las sucursales autorizadas para el usuario.

**Alternativas consideradas**:
- Mantener el header pero validarlo solo para admins.
- Firmar el header desde cliente.
- Permitir header solo en rutas internas especificas.

**Justificacion**: cualquier valor enviado por el cliente debe considerarse no confiable. Aunque el header pueda mantenerse como input auxiliar en casos muy acotados, la decision final debe ser server-side y vinculada a autorizacion real, no a preferencia del browser.

---

### Decision: Los secretos versionados se tratan como incidente y se rotan, no solo se ocultan

**Eleccion**: retirar secretos reales de `.env`, introducir `.env.example` seguro y documentar una politica obligatoria de rotacion inmediata para DB, JWT, links firmados, pagos y correo.

**Alternativas consideradas**:
- Solo agregar `.gitignore` y dejar el archivo actual fuera de futuros commits.
- Renombrar variables sin rotar valores.

**Justificacion**: una vez que un secreto real estuvo en el repositorio, debe asumirse expuesto. Cambiar nombres o dejar de versionarlo no elimina el riesgo operativo.

---

### Decision: Uploads con allowlist fuerte y almacenamiento/serving desacoplados de rutas publicas directas

**Eleccion**: aceptar solo tipos de archivo explicitamente permitidos por caso de uso, validar extension + MIME declarado + firma binaria cuando aplique, imponer limite de tamano, generar nombres opacos y servir desde un handler controlado con headers defensivos.

**Alternativas consideradas**:
- Confiar solo en la extension o `file.type` del browser.
- Mantener `public/uploads` para desarrollo sin endurecimiento adicional.
- Restringir solo el frontend y dejar el backend igual.

**Justificacion**: la validacion del cliente no protege el servidor. Ademas, servir contenido subido por usuarios desde rutas publicas directas incrementa el riesgo de contenido activo, phishing interno, malware hospedado o bypass de cache/politicas.

---

### Decision: Rate limiting por endpoint sensible con llaves compuestas y respuesta uniforme

**Eleccion**: aplicar rate limiting a `login`, `forgot-password` y `reset-password` con claves por IP + identidad normalizada + ventana temporal. Las respuestas deben seguir siendo uniformes para no facilitar enumeracion.

**Alternativas consideradas**:
- Rate limiting global para toda la API.
- CAPTCHA obligatorio inmediato.
- Solo logging sin bloqueo.

**Justificacion**: los endpoints sensibles tienen patrones de abuso distintos. Un limite especifico por flujo reduce falsos positivos y mejora la trazabilidad sin degradar innecesariamente toda la aplicacion.

---

### Decision: Remediacion de dependencias basada en severidad, explotabilidad y compatibilidad

**Eleccion**: clasificar advisories por criticidad, actualizar primero dependencias expuestas a internet o en paths de auth/upload/parsing y exigir evidencia de cierre posterior al upgrade.

**Alternativas consideradas**:
- Actualizacion masiva de todo el arbol en un solo lote.
- Ignorar advisories transitorios hasta una futura migracion grande.

**Justificacion**: el cambio necesita reducir riesgo rapido sin introducir una regresion amplia por upgrades indiscriminados.

## Flujos de control objetivo

### Flujo de autorizacion multi-sucursal endurecido

```text
Request autenticada
    -> requireAuth() valida JWT/cookie de sesion
    -> resuelve identidad de usuario
    -> obtiene sucursales permitidas desde fuente server-side
    -> resuelve sucursal activa desde fuente controlada por servidor
    -> si existe input del cliente (header/query/body), se trata como solicitud y no como verdad
    -> verifica pertenencia/autorizacion antes de fijar contexto efectivo
    -> retorna auth + activeSucursalId validado
```

Regla clave: ninguna ruta debe consumir `x-sucursal-id` como autoridad suficiente para leer o mutar datos de otra sucursal.

### Flujo de secretos y rotacion

```text
Deteccion de secretos reales versionados
    -> clasificacion por proveedor / alcance
    -> rotacion inmediata en origen
    -> actualizacion de secretos en ambientes desplegados
    -> invalidacion de tokens/credenciales previas
    -> saneamiento del repo (.env seguro + .env.example)
    -> checklist de verificacion post-rotacion
```

### Flujo de upload endurecido

```text
POST /api/upload
    -> autenticar + autorizar por rol/caso de uso
    -> validar presencia del archivo
    -> validar tamano maximo
    -> validar extension permitida
    -> validar MIME declarado
    -> validar firma binaria / magic number cuando aplique
    -> generar nombre opaco
    -> almacenar fuera de ruta publica directa o servir via handler controlado
    -> persistir metadata segura
    -> devolver URL/identificador canonico
```

### Flujo de serving endurecido

```text
GET /api/files/[...path]
    -> resolver identificador seguro
    -> verificar que el recurso exista y pertenezca al namespace esperado
    -> determinar content-type solo desde metadata/allowlist segura
    -> enviar headers defensivos (nosniff, disposition segun caso, cache control apropiado)
    -> denegar tipos no permitidos o rutas ambiguas
```

### Flujo de rate limiting en auth/recovery

```text
Request a login / forgot-password / reset-password
    -> construir key de limite (IP + identidad normalizada + endpoint)
    -> consultar contador/ventana
    -> si excede umbral: responder 429 o rechazo equivalente auditado
    -> si no excede: procesar flujo normal
    -> registrar evento de seguridad y actualizar contador
```

## Cambios en archivos

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `src/lib/auth/require-auth.ts` | Modificar | Quitar prioridad de `x-sucursal-id`, validar sucursal efectiva contra permisos reales y formalizar contrato de auth endurecido. |
| `src/lib/sucursalScope.ts` y helpers relacionados | Modificar | Centralizar validacion de sucursal permitida para evitar desalineaciones entre rutas. |
| `src/app/api/auth/login/route.ts` | Modificar | Integrar rate limiting, auditoria de intentos y respuestas seguras. |
| `src/app/api/auth/forgot-password/route.ts` | Modificar | Aplicar throttling, controles anti-flood y politicas de token/reintento. |
| `src/app/api/auth/reset-password/route.ts` | Modificar | Aplicar throttling, controles sobre token y cierre de sesiones si corresponde. |
| `src/app/api/upload/route.ts` | Modificar | Validar archivos con allowlist fuerte, tamano maximo y nombres opacos. |
| `src/app/api/files/[...path]/route.ts` | Modificar | Restringir tipos servidos y emitir headers defensivos. |
| `.env` | Modificar | Sustituir secretos reales por placeholders seguros o valores no productivos. |
| `.env.example` | Crear o modificar | Documentar todas las variables requeridas sin exponer credenciales reales. |
| `package.json` / lockfile | Modificar | Remediar dependencias con advisories priorizados y fijar versiones seguras. |
| `docs/security/*` o documento operativo equivalente | Crear o modificar | Politica de secretos, rotacion, limites y remediacion de dependencias. |

## Contratos y reglas operativas

### Contrato de autorizacion

```ts
type AuthContext = {
  userId: number;
  rol: "ADMIN" | "EMPLEADO";
  activeSucursalId: number;
  allowedSucursalIds: number[];
};

// Regla: activeSucursalId siempre debe pertenecer a allowedSucursalIds,
// salvo el caso explicito y controlado de vista global si el rol lo permite.
```

### Politica de secretos

```text
- .env local: solo desarrollo, nunca con credenciales reales compartidas.
- .env.example: placeholders y comentarios de formato.
- Secretos productivos: fuera del repo, gestionados por entorno.
- Rotacion obligatoria si un valor real fue commiteado, aunque luego se elimine.
```

### Politica de uploads

```text
- Allowlist por extension y MIME.
- Maximo de tamano por caso de uso.
- Nombre opaco generado por servidor.
- Sin servir tipos no aprobados.
- Sin confiar en nombres originales para routing o content-type.
```

## Estrategia de validacion

| Capa | Que validar | Enfoque |
|------|------------|---------|
| Unitaria | `require-auth.ts` no acepta cambio de sucursal solo por header | Tests con combinaciones de rol, cookie, header y sucursales permitidas |
| Unitaria | Validador de uploads | Casos de extension falsa, MIME falso, magic number invalido y tamano excedido |
| Integracion | `forgot-password` y `reset-password` con rate limiting | Ventanas, reintentos y respuestas uniformes |
| Integracion | `api/files` | Bloqueo de tipos/rutas no permitidos y headers correctos |
| Operativa | Rotacion de secretos | Checklist por proveedor, deploy y verificacion de integraciones |
| Seguridad | Dependencias | `npm audit`/SCA despues del upgrade y evidencia de advisories cerrados |

## Migracion y despliegue

1. Rotar primero secretos expuestos y actualizar ambientes antes de desplegar cambios de codigo dependientes.
2. Desplegar endurecimiento de autorizacion multi-sucursal y monitorear errores 401/403 inesperados.
3. Desplegar rate limiting con thresholds conservadores y telemetria inicial.
4. Desplegar endurecimiento de uploads/serving con inventario previo de archivos legacy si se necesita compatibilidad.
5. Ejecutar remediacion de dependencias por lotes pequenos y validar build/lint/typecheck/smoke despues de cada lote.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|-------|---------|------------|
| Endpoints existentes dependen implicitamente del header de sucursal | Alto | Introducir helper central de contexto validado y testear rutas criticas multi-sucursal. |
| Rotacion de secretos de pago/correo genera downtime | Alto | Secuencia por proveedor, ventana coordinada y verificacion inmediata post-rotacion. |
| Archivos SVG/PDF u otros formatos legitimos quedan bloqueados | Medio | Allowlist explicita por caso de uso y compatibilidad transitoria solo para formatos aprobados. |
| Rate limiting afecta oficinas con IP compartida | Medio | Combinar IP con identidad/endpoint y parametrizar thresholds por entorno. |
| Un advisory no puede actualizarse sin cambio mayor | Medio | Documentar mitigacion temporal y bloquear paths explotables hasta upgrade completo. |

## Preguntas abiertas

- [ ] Confirmar si la vista global (`sucursalId=0`) debe seguir existiendo como excepcion explicita dentro del nuevo contrato de autorizacion.
- [ ] Confirmar el almacenamiento canonico de uploads en produccion para decidir si el endurecimiento incluye mover completamente fuera de `public/uploads`.
- [ ] Confirmar la fuente oficial de advisories priorizados que servira como criterio de cierre del cambio.
