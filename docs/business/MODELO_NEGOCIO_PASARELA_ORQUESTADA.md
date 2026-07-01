# Modelo de negocio para pasarela orquestada (Camino A)

> **Nota (2026-06-30):** documento estratégico/comercial especulativo, no una feature en desarrollo. No hay código relacionado en `src/` (sin `orquestad`, `PSP` ni "smart routing"). No conecta con el modelo de negocio actual (SaaS de consignaciones).

## 1) Camino A: qué es y por qué es el recomendado

**Camino A** implica construir una capa de orquestación de pagos sobre proveedores existentes (PSP/adquirentes/billeteras), sin convertirse en adquirente propio.

### Por qué es la decisión recomendada para este proyecto
- **Time-to-market más corto**: permite lanzar checkout público en semanas, no en años.
- **Menor riesgo regulatorio**: se opera como integrador/orquestador, delegando licencias y parte del compliance al proveedor.
- **Menor CAPEX y complejidad**: evita montar core adquirente, conciliación bancaria completa y operación antifraude de nivel adquirente.
- **Flexibilidad comercial**: facilita negociar mejores condiciones y enrutar por costo, aprobación o disponibilidad.
- **Escalabilidad pragmática**: primero se valida tracción y economics; luego se profundiza en verticales de mayor margen.

---

## 2) Propuestas de modelo de negocio (alternativas)

## Modelo 1: Take Rate transaccional
**Cómo monetiza**
- Fee por transacción exitosa sobre GMV procesado.
- Estructura sugerida: `% + fijo` por operación.

**Ventajas**
- Alineado al crecimiento del cliente (si vende más, ambos ganan).
- Fácil de entender y vender.
- Escala naturalmente con volumen.

**Riesgos**
- Sensible a presión de precios de PSP y competencia.
- Margen puede comprimirse con clientes grandes.

**Complejidad operativa**
- Media (reporting de volumen, liquidación de fees, soporte comercial).

**Etapa recomendada**
- **Inicio + crecimiento temprano**.

## Modelo 2: Suscripción SaaS por comercio
**Cómo monetiza**
- Abono mensual por acceso al checkout orquestado, panel y reglas.
- Puede incluir tiers por volumen o funcionalidades.

**Ventajas**
- Ingreso predecible (MRR).
- Menor dependencia de estacionalidad transaccional.
- Mejora valoración del negocio por recurrencia.

**Riesgos**
- Barrera de entrada para comercios pequeños.
- Mayor churn si el valor percibido es bajo.

**Complejidad operativa**
- Baja-media (billing recurrente, gestión de planes, soporte funcional).

**Etapa recomendada**
- **Desde MVP comercial**, con plan freemium/trial.

## Modelo 3: Revenue Share por enrutamiento inteligente
**Cómo monetiza**
- Se captura parte del ahorro generado al optimizar costos y aprobación (smart routing).
- Contrato basado en performance (ejemplo: % del ahorro neto).

**Ventajas**
- Propuesta de valor clara para medianos/grandes comercios.
- Defiende precio con ROI medible.
- Baja fricción comercial cuando hay benchmark previo.

**Riesgos**
- Requiere trazabilidad robusta para demostrar ahorro incremental.
- Posibles discusiones contractuales por metodología de cálculo.

**Complejidad operativa**
- Media-alta (analytics, baseline, acuerdos de medición).

**Etapa recomendada**
- **Crecimiento** (cuando ya hay data histórica).

## Modelo 4: Fee por servicios de valor agregado
**Cómo monetiza**
- Cobro por módulos adicionales: conciliación asistida, alertas de riesgo, recuperación de pagos fallidos, reporting ejecutivo, SLA premium.

**Ventajas**
- Mejora margen bruto sin depender solo del fee transaccional.
- Facilita upsell por vertical o tamaño de cliente.

**Riesgos**
- Riesgo de sobreproducto si se lanzan muchos addons sin demanda validada.
- Mayor exigencia de onboarding y soporte.

**Complejidad operativa**
- Media (paquetización y operación de servicios).

**Etapa recomendada**
- **Crecimiento y consolidación**.

## Modelo 5: Setup + onboarding enterprise
**Cómo monetiza**
- Cargo de implementación inicial (integración, migración, reglas y QA).

**Ventajas**
- Cubre costo de adquisición/implementación temprana.
- Mejora caja en contratos enterprise.

**Riesgos**
- Puede frenar cierre en SMB si el ticket inicial es alto.
- No es recurrente por sí mismo.

**Complejidad operativa**
- Baja-media (proceso comercial y delivery estándar).

**Etapa recomendada**
- **Desde inicio**, principalmente para clientes medianos/grandes.

---

## 3) Comparación ejecutiva de modelos

| Modelo | Ingresos potenciales | Tiempo de implementación | Riesgo regulatorio | Margen estimado |
|---|---|---|---|---|
| Take Rate transaccional | Alto (escala con GMV) | Bajo | Bajo | Medio (8% a 25% sobre ingreso propio) |
| Suscripción SaaS | Medio-alto (MRR acumulativo) | Bajo | Bajo | Alto (50% a 80%) |
| Revenue Share por ahorro | Alto en cuentas grandes | Medio | Bajo | Medio-alto (30% a 60%) |
| Servicios de valor agregado | Medio | Medio | Bajo-medio | Alto (45% a 75%) |
| Setup enterprise | Bajo-medio (no recurrente) | Bajo | Bajo | Medio-alto (35% a 65%) |

> Nota: márgenes orientativos para operación tipo software + partners de pago en Argentina, sin asumir riesgo financiero adquirente propio.

---

## 4) Pricing inicial sugerido (Argentina)

### Esquema recomendado de salida a mercado (rangos)
- **Plan Base (SMB)**
  - Suscripción: **ARS 30.000 a 90.000 / mes**.
  - Fee transaccional plataforma: **0,35% a 0,90% + ARS 30 a 120** por transacción exitosa.

- **Plan Growth (mid-market)**
  - Suscripción: **ARS 120.000 a 350.000 / mes**.
  - Fee transaccional: **0,25% a 0,70% + ARS 20 a 90**.
  - Addons (conciliación/reporting avanzado): **ARS 80.000 a 300.000 / mes**.

- **Plan Enterprise**
  - Setup inicial: **ARS 1,5M a 8M** (único, según complejidad).
  - Suscripción/SLA: **ARS 400.000 a 2,5M / mes**.
  - Revenue share por ahorro: **10% a 30%** del ahorro neto validado.

### Reglas prácticas para pricing en ARS
- Ajuste mensual por inflación (cláusula explícita).
- Piso mínimo de facturación mensual para sostener soporte.
- Descuentos por volumen condicionados a plazo contractual.

---

## 5) Plan de ejecución en 90 días

## Fase 1 (Día 1-30): Validación comercial + base operativa
- Definir propuesta de valor por segmento (SMB, mid, enterprise).
- Cerrar pricing v1 y contratos tipo (MSA + anexos de servicio).
- Implementar métricas core de checkout: conversión, aprobación, costo por transacción.
- Seleccionar 1-2 verticales foco para pilotos.

**Entregables**
- Oferta comercial v1.
- Dashboard ejecutivo mínimo.
- 3 a 5 prospectos calificados en pipeline.

## Fase 2 (Día 31-60): Pilotos pagos + ajuste de modelo
- Lanzar pilotos con fee real (evitar pilotos gratuitos largos).
- Medir impacto en aprobación, costos y tiempos de cobro.
- Ajustar planes y bundles según comportamiento real.
- Diseñar playbook de onboarding repetible.

**Entregables**
- 2 a 4 clientes activos pagando.
- Caso de negocio con ROI comprobable.
- Playbook de implementación comercial-técnica.

## Fase 3 (Día 61-90): Escalado controlado
- Estandarizar contratación y operación de soporte.
- Activar canal de ventas indirectas (partners/implementadores).
- Introducir addon de mayor margen (conciliación o reporting avanzado).
- Consolidar gobernanza de pricing y descuentos.

**Entregables**
- 8 a 15 clientes pagos (según ticket objetivo).
- Unit economics por segmento.
- Plan de expansión trimestral.

---

## 6) KPIs de negocio + hoja de decisión

## KPIs clave (seguimiento semanal/mensual)
- **GMV procesado** por segmento.
- **Take rate efectivo** (ingreso neto / GMV).
- **MRR y expansión neta** (Net Revenue Retention).
- **Tasa de aprobación** y delta vs baseline.
- **Costo por transacción** total (incluyendo proveedores y soporte).
- **Margen bruto** por cliente y por producto.
- **CAC, payback y churn**.
- **Tiempo de onboarding** (días a go-live).

## Hoja de decisión para elegir modelo (score 1-5)

| Criterio | Peso | M1 Take Rate | M2 Suscripción | M3 Rev Share | M4 Addons | M5 Setup |
|---|---:|---:|---:|---:|---:|---:|
| Velocidad de adopción comercial | 25% | 5 | 4 | 3 | 3 | 3 |
| Recurrencia de ingresos | 20% | 3 | 5 | 3 | 4 | 1 |
| Margen esperado | 20% | 3 | 5 | 4 | 4 | 3 |
| Diferenciación competitiva | 15% | 3 | 3 | 5 | 4 | 2 |
| Complejidad operativa (inversa) | 10% | 4 | 4 | 2 | 3 | 4 |
| Riesgo de ejecución (inversa) | 10% | 4 | 4 | 3 | 3 | 4 |
| **Puntaje ponderado orientativo** | **100%** | **3,9** | **4,3** | **3,6** | **3,6** | **2,7** |

Interpretación sugerida:
- Priorizar modelos con puntaje >4 como core.
- Usar modelos 3,5-4 como complementarios por segmento.
- Evitar depender de modelos <3 salvo táctica puntual.

---

## 7) Recomendación concreta: combinación híbrida para este sistema

Para este sistema de consignación con checkout público, la combinación más sólida en fase inicial es:

1. **Core de ingresos: Suscripción SaaS (M2) + Take Rate transaccional (M1)**.
2. **Acelerador de caja en cuentas grandes: Setup enterprise (M5)**.
3. **Expansión de margen en 2da etapa: Addons (M4)**.
4. **Revenue Share (M3) solo para cuentas con volumen y datos suficientes**.

### Por qué esta mezcla es la más pragmática
- Balancea **recurrencia + escalabilidad + caja temprana**.
- Reduce dependencia de una sola fuente de ingresos.
- Mantiene bajo el riesgo regulatorio al sostener el Camino A.
- Permite evolucionar pricing por segmento sin rediseñar el producto base.

### Regla de implementación recomendada
- **Primeros 90 días**: foco M2 + M1 (+ M5 en enterprise).
- **Luego de tracción comprobada**: sumar M4 y abrir M3 selectivo.

En términos ejecutivos: primero capturar mercado y recurrencia con un esquema simple; después optimizar margen con servicios y performance contracts.
