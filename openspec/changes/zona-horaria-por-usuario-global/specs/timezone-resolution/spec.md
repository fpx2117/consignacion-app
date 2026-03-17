# Especificación de Resolución Global de Zona Horaria

## Propósito

Definir el comportamiento esperado para resolver una única zona horaria efectiva en todo el sistema, reemplazando el enfoque previo centrado solo en sucursal del change `configuracion-zona-horaria`.

## Requisitos

### Requisito: Precedencia global obligatoria

El sistema DEBE resolver la zona horaria efectiva con precedencia estricta `usuario > sucursal > fallback técnico` para cualquier cálculo o presentación que dependa del tiempo.

#### Escenario: Se usa la preferencia del usuario cuando existe

- DADO QUE un usuario autenticado tiene una zona horaria propia válida
- Y la sucursal activa también tiene una zona horaria configurada
- CUANDO el sistema resuelve la zona horaria efectiva para una operación
- ENTONCES DEBE usar la zona horaria del usuario
- Y NO DEBE usar la zona horaria de la sucursal ni el fallback técnico

#### Escenario: Se hereda la zona horaria de la sucursal

- DADO QUE un usuario autenticado no tiene zona horaria propia configurada
- Y la sucursal activa tiene una zona horaria válida
- CUANDO el sistema resuelve la zona horaria efectiva
- ENTONCES DEBE usar la zona horaria de la sucursal
- Y DEBE informar que el origen efectivo es sucursal

### Requisito: Fallback técnico temporal y no deseado

El sistema DEBERÁ usar el fallback técnico solo como compatibilidad temporal cuando no exista una zona horaria válida ni en usuario ni en sucursal. El fallback técnico NO DEBE tratarse como comportamiento deseado del producto.

#### Escenario: Solo se usa el fallback cuando faltan ambos niveles

- DADO QUE un usuario autenticado no tiene zona horaria propia válida
- Y la sucursal activa no tiene zona horaria válida
- CUANDO el sistema resuelve la zona horaria efectiva
- ENTONCES DEBE usar el fallback técnico temporal
- Y DEBE informar que el origen efectivo es fallback

#### Escenario: El fallback no desplaza configuraciones válidas

- DADO QUE existe una zona horaria válida en usuario o sucursal
- CUANDO el sistema resuelve la zona horaria efectiva
- ENTONCES NO DEBE elegir el fallback técnico

### Requisito: Consistencia transversal de resolución

El sistema DEBE aplicar la misma zona horaria efectiva en backend, utilidades compartidas, reportes y UI dentro de un mismo contexto funcional.

#### Escenario: Un mismo contexto mantiene una única zona horaria efectiva

- DADO QUE un usuario opera dentro de una misma sesión autenticada
- CUANDO consulta datos, ejecuta acciones operativas y visualiza resultados relacionados
- ENTONCES todas esas interacciones DEBEN usar la misma zona horaria efectiva resuelta

#### Escenario: No se admiten resoluciones paralelas contradictorias

- DADO QUE dos módulos distintos participan de una misma operación de negocio
- CUANDO ambos necesitan calcular o formatear fechas de esa operación
- ENTONCES ambos DEBEN basarse en la misma zona horaria efectiva
- Y NO DEBEN producir resultados inconsistentes entre sí

### Requisito: Vista global sin supuestos fijos de sucursal

El sistema DEBE resolver la zona horaria efectiva en vistas globales sin asumir una sucursal fija predefinida como fuente implícita.

#### Escenario: Vista global con preferencia de usuario

- DADO QUE el usuario está en una vista global
- Y el usuario tiene una zona horaria propia válida
- CUANDO el sistema resuelve la zona horaria efectiva
- ENTONCES DEBE usar la zona horaria del usuario
- Y NO DEBE depender de una sucursal implícita

#### Escenario: Vista global sin preferencia de usuario

- DADO QUE el usuario está en una vista global
- Y el usuario no tiene zona horaria propia válida
- CUANDO el sistema necesita una referencia de sucursal para resolver la zona horaria
- ENTONCES DEBE usar una sucursal válida definida por reglas del sistema
- Y NO DEBE asumir por defecto una sucursal fija hardcodeada
