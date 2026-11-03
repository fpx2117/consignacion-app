# Diseño técnico propuesto

## Decisión principal

Adoptar un **monolito modular incremental** con:

- Functional Core / Imperative Shell;
- Clean Architecture pragmática;
- DDD selectivo para reglas e invariantes complejas;
- funciones puras para cálculos comerciales;
- migración por estrangulamiento, sin reescritura.

Clean Architecture no se aplicará como una plantilla de carpetas. Su valor será
la dirección de dependencias. DDD no se aplicará a cada tabla: se reservará para
ventas, inventario, consignaciones, caja/pagos y facturación.

## Estructura objetivo

```text
src/
├── app/api/                         # Adaptadores HTTP de Next.js
└── modules/
    ├── shared/domain/
    │   ├── money.ts
    │   ├── percentage.ts
    │   ├── units.ts
    │   └── domain-error.ts
    ├── sales/
    │   ├── domain/
    │   ├── application/
    │   └── infrastructure/
    ├── inventory/
    │   ├── domain/
    │   ├── application/
    │   └── infrastructure/
    ├── consignments/
    ├── catalog/
    ├── cash/
    ├── invoicing/
    └── notifications/
```

Cada módulo se crea sólo cuando una extracción real lo necesita. No se agregarán
directorios vacíos por anticipado.

## Regla de dependencias

```text
Next.js route -> Application use case -> Domain
Infrastructure -> implementa puertos de Application
```

El dominio no puede importar:

- Prisma o tipos generados por Prisma;
- `NextResponse`, Request o APIs de Next.js;
- Socket.IO;
- filesystem, variables de entorno o proveedores externos;
- reloj global implícito.

Zod permanece en los adaptadores de entrada. Prisma y PostgreSQL permanecen en
infraestructura. Las rutas existentes conservan URL, payload, códigos HTTP y
forma de respuesta.

## Núcleo matemático

### Dinero, costos y tasas

El esquema no utiliza una única escala: ventas y totales suelen persistirse con
dos decimales, mientras costos unitarios de compras pueden conservar cuatro.
Además, los flujos actuales no redondean todos en el mismo momento.

La primera extracción mantendrá exactamente la aritmética y los límites de
redondeo observados en cada flujo. No convertirá automáticamente todos los
valores a centavos.

Después de la caracterización se evaluarán tipos de punto fijo con escala
explícita, sin depender de Prisma:

```text
SaleMoney     -> escala 2
PreciseCost   -> escala 4
Percentage    -> escala declarada
FixedDecimal  -> coeficiente entero + escala
```

Los adaptadores serán responsables de convertir entre HTTP, tipos de dominio y
Prisma Decimal. Adoptar una representación nueva o cambiar el momento del
redondeo será una decisión separada y observable, no parte automática del
refactor.

### Funciones puras iniciales

```text
applyDiscount
applyCardSurcharge
applyConsignmentMarkup
calculateLineTotal
calculateSaleTotals
calculatePendingUnits
validateSettlement
calculateGrossProfit
calculateMarginPercentage
calculateStockTransition
```

Cada función debe:

- recibir todos sus datos como argumentos;
- no consultar Prisma;
- no leer configuración global;
- no utilizar `new Date()` internamente;
- no emitir eventos;
- devolver un resultado o un error de dominio explícito.

Antes de unificar el redondeo se crearán tests de caracterización para capturar
el comportamiento actual. La política objetivo propuesta es redondear a centavos
por línea y volver a normalizar el total, pero su adopción requiere comparar el
resultado con ventas históricas y aprobar cualquier diferencia observable.

## Piloto: `RegistrarVenta`

El primer caso de uso será ventas porque ya posee los controles transaccionales
más sólidos.

```ts
type RegisterSaleCommand = {
  userId: number;
  branchId: number;
  customerId?: number | null;
  paymentMethod: PaymentMethod;
  globalDiscount: Money;
  items: SaleItemInput[];
};

type RegisterSaleResult = {
  sale: LegacySaleResponseSnapshot;
  payment: LegacyPaymentResponseSnapshot;
  postCommitEvents: PostCommitEvent[];
};
```

Los snapshots de compatibilidad contendrán todos los campos, relaciones,
nullable values, representación Decimal y orden de detalles que hoy devuelve el
endpoint. Se producirán dentro de la transacción; no se reconstruirán mediante
una consulta posterior al commit.

El caso de uso preservará:

- transacción `Serializable`;
- reintentos por conflictos serializables o unicidad;
- decremento condicional de stock;
- advisory lock por sucursal para numeración;
- scoping de sucursal;
- creación atómica de venta, pago y movimientos;
- efectos externos posteriores al commit.

La extracción tendrá dos etapas distintas:

1. **Extracción compatible:** conserva exactamente los límites transaccionales y
   resultados observables actuales detrás del nuevo caso de uso.
2. **Endurecimiento autorizado:** mueve la resolución del cliente por defecto y
   la revalidación/lock de la sesión de caja dentro de cada intento transaccional,
   después de caracterizar las respuestas existentes.

Antes de activar el piloto se corregirá por separado el acceso a clientes de otra
sucursal y se definirá su respuesta HTTP compatible.

La ruta HTTP se limitará a autenticar, validar, construir el comando, ejecutar el
caso de uso y traducir errores de dominio a respuestas existentes.

El dispatch se realizará una sola vez mediante
`SALES_REGISTER_USE_CASE=legacy|application`, con `legacy` como valor seguro. No
habrá ejecución doble ni fallback entre handlers después de iniciar efectos. La
activación canary y el rollback exactos están definidos en el ADR 006. `legacy`
designa al adaptador compatible `B1`, no al binario original que hace dual-write
incondicional; ventas y checkout deben respetar la capacidad del ADR 002.

No se creará un `Repository<T>` genérico. `RegisterSaleUnitOfWork`, definido por
el caso de uso e implementado por un único adaptador Prisma, abrirá la transacción
y expondrá capacidades específicas para inventario, numeración, venta y pago.
Ningún módulo importará infraestructura de otro módulo ni circulará un
`Prisma.TransactionClient` por el dominio.

## Autoridad de stock

1. `StockSucursal` será la fuente canónica.
2. El trigger actual es un candidato de transición, no una solución aprobada. Se
   probarán escrituras concurrentes sobre distintas sucursales del mismo
   producto. Si falla, se reemplazará por una proyección con serialización o
   delta atómico probado.
3. Antes de cambiar escritores se inventariarán todos los flujos y se documentará
   una matriz `versión de aplicación × estado del trigger`.
4. Ningún despliegue ni rollback podrá combinar el trigger activo con una versión
   que continúe realizando dual-write.
5. El cutover utilizará una etapa compatible o una ventana de escritura
   controlada. El rollback restaurará siempre un par aplicación/esquema
   compatible mediante migración compensatoria aditiva; no se editará una
   migración aplicada.
6. Toda salida utilizará una actualización condicional con stock suficiente.
7. Las invariantes concurrentes se comprobarán en la base, no solamente en
   memoria.
8. Toda restitución por anulación deberá reclamar atómicamente la transición
   `anulada=false -> true` dentro de la misma transacción que restaura stock y
   registra movimientos. Sólo el ganador podrá restituir.
9. Los campos globales de `Producto` sólo podrán eliminarse después de migrar
   todos sus lectores.

Las versiones `L0` (dual-write), `B1` (puente gobernado por capacidad) y `C2`
(canónica) sólo se desplegarán en las combinaciones permitidas por el ADR 002. El
cutover y el rollback incluyen pausa de escrituras, reconciliación completa y
transición transaccional del trigger y la capacidad.

Si se descubre trigger activo con `L0`, se aplica un fence operacional total y se
drenan transacciones antes de compensar. La capacidad no protege a binarios que
no la consultan.

## Autoridad de numeración

PostgreSQL asignará `numeroVenta` mediante un numerador por sucursal y
`numeroFolio` mediante otro por cliente. UPSERTs atómicos y triggers `BEFORE
INSERT` cubrirán writers nuevos y versiones puente compatibles. Las instancias
actuales de consignaciones deben retirarse primero porque reutilizan el folio
local después del insert. Índices únicos reforzarán cada ámbito después de
auditar y reparar datos. Los advisory locks y cálculos locales se preservarán
hasta completar el rollout mixto descrito en el ADR 007.
Los numeradores permanecen durante rollback de aplicación; volver a allocators
independientes no es una estrategia admitida.

## Efectos externos

Notificaciones, Socket.IO y proveedores externos no deben ejecutarse dentro de
una transacción prolongada. La primera extracción utilizará efectos post-commit
explícitos. Cuando se requiera entrega confiable, se incorporará un outbox
transaccional, no llamadas dispersas desde las rutas.

Socket.IO deberá utilizar salas por instalación/sucursal/usuario y validar que
la sesión continúe vigente al conectar o renovar la conexión.

## Estrategia de pruebas

1. **Caracterización:** contratos HTTP, errores, cálculos y redondeos actuales.
2. **Dominio:** pruebas de tabla y propiedades para funciones puras.
3. **Aplicación:** casos de uso con puertos controlados, sin Next.js ni Prisma.
4. **Infraestructura:** integración real con PostgreSQL y rollback.
5. **Concurrencia:** consignar, liquidar, vender y anular en paralelo.
6. **Contratos:** rutas Next.js contra casos de uso y respuestas existentes.
7. **E2E:** flujos críticos antes de retirar implementaciones legacy.
8. **Rollback:** activar el piloto, escribir registros con la ruta nueva,
   regresar a la ruta legacy y demostrar que puede operar sobre esos registros
   sin duplicar efectos.

## ADRs propuestos

1. Monolito modular y regla de dependencias.
2. `StockSucursal` como autoridad.
3. Representación monetaria y política de redondeo.
4. Límites transaccionales y outbox.
5. Aislamiento de eventos Socket.IO.
6. Migración incremental sin reescritura.
7. Autoridad única de numeración comercial.

## Alternativas descartadas

- **Microservicios:** agregan coordinación y fallos distribuidos sin resolver los
  problemas actuales.
- **DDD completo sobre todas las tablas:** crea entidades espejo y ceremonia sin
  invariantes que la justifiquen.
- **Repositorio genérico:** oculta capacidades de Prisma y produce interfaces
  demasiado amplias.
- **Reorganización masiva inicial:** aumenta el diff sin corregir integridad ni
  aportar evidencia de comportamiento.
- **Eliminar inmediatamente el trigger:** deja escritores directos sin una red de
  protección antes de completar la migración.
