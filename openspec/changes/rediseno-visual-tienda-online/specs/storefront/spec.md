# Especificación de Storefront Visual Configurable

## Propósito

Definir el comportamiento visual y de configuración del storefront público (`/lista`), estableciendo que toda la identidad visual DEBE ser configurable desde el panel admin sin modificar código fuente. El storefront DEBE ser genérico y adaptable a cualquier rubro comercial.

---

## Requisitos

### Requisito: Sistema de Configuración Visual Unificado

El sistema DEBE exponer un tipo `OnlineStoreSettings` que unifique toda la configuración visual del storefront. Este objeto DEBE ser obtenible desde el cliente mediante un hook `useOnlineStoreSettings()` que combine la configuración real del backend con valores por defecto seguros.

#### Escenario: Carga inicial con configuración vacía

- DADO QUE el comercio no ha configurado ningún valor de `OnlineStoreSettings`
- CUANDO el cliente renderiza el storefront
- ENTONCES se DEBEN aplicar los valores por defecto (`primaryColor: "#007AFF"`, `whatsappColor: "#25D366"`, `backgroundColor: "#F5F6F8"`, etc.)
- Y el storefront DEBE renderizarse correctamente sin errores visuales

#### Escenario: Carga con configuración parcial

- DADO QUE el comercio solo configuró `theme.primaryColor: "#FF0000"` y `catalog.showPrices: false`
- CUANDO el cliente renderiza el storefront
- ENTONCES los precios NO DEBEN mostrarse
- Y el color primario DEBE ser `#FF0000`
- Y el resto de los valores DEBEN usar los defaults (whatsappColor, backgroundColor, etc.)

#### Escenario: Configuración completa desde admin

- DADO QUE el administrador configuró TODOS los campos de `OnlineStoreSettings`
- CUANDO el cliente renderiza el storefront
- ENTONCES todos los valores DEBEN reflejar exactamente lo configurado
- Y ningún valor por defecto DEBE sobrescribir la configuración explícita

---

### Requisito: CSS Variables para Colores Dinámicos

El sistema DEBE inyectar CSS variables dinámicas en el wrapper principal del storefront para colores configurables. NO DEBE usar clases Tailwind arbitrarias del tipo `bg-[#XXXXXX]` para colores que vienen de la base de datos.

Las variables requeridas son:

- `--store-primary`
- `--store-secondary`
- `--store-background`
- `--store-surface`
- `--store-text`
- `--store-muted`
- `--store-whatsapp`

#### Escenario: Aplicación de colores desde configuración

- DADO QUE `settings.theme.primaryColor = "#007AFF"`
- CUANDO se renderiza un botón primario
- ENTONCES el botón DEBE usar `background-color: var(--store-primary)` o equivalente
- Y el color DEBE ser exactamente `#007AFF`

#### Escenario: Cambio dinámico de colores sin recompilación

- DADO QUE el administrador cambia `primaryColor` de `#007AFF` a `#FF5722`
- CUANDO se recarga la página
- ENTONCES todos los elementos que usan `var(--store-primary)` DEBEN reflejar el nuevo color
- Y no DEBE requerirse una recompilación de Tailwind

---

### Requisito: Header de Tienda Configurable

El storefront DEBE mostrar un header con los siguientes elementos configurables:

- Banner/imagen de fondo del comercio (opcional, con overlay suave o blur)
- Logo/avatar del comercio (opcional)
- Nombre público de la tienda
- Badge de verificación azul (opcional, configurable)
- Horarios de atención (opcional)
- Dirección o zona de entrega (opcional)
- Botón circular de acceso al carrito con contador

Todo el contenido DEBE venir desde `OnlineStoreSettings` o del modelo `Branding` existente.

#### Escenario: Header con todos los datos

- DADO QUE `storeName = "Mi Tienda"`, `storeBannerUrl` tiene una URL válida, `storeLogoUrl` tiene una URL válida, `openingHours = "Lun a Vie 9-18hs"`, y `addressText = "Palermo, CABA"`
- CUANDO se renderiza el header
- ENTONCES DEBE mostrarse: banner de fondo con overlay, logo circular, nombre en negrita, badge de verificación, horarios, dirección, y botón de carrito
- Y todos los textos DEBEN ser los configurados

#### Escenario: Header sin datos opcionales

- DADO QUE el comercio no configuró banner, horarios ni dirección
- CUANDO se renderiza el header
- ENTONCES el banner, horarios y dirección NO DEBEN mostrarse
- Y el nombre de la tienda, el botón de carrito y el logo (si existe) DEBEN mostrarse normalmente

---

### Requisito: Buscador de Productos

El storefront DEBE mostrar una barra de búsqueda con:

- Fondo gris claro, bordes muy redondeados
- Icono de lupa a la izquierda
- Placeholder configurable (default: "Buscar productos")
- Input mobile moderno con buen padding

La lógica de búsqueda existente NO DEBE modificarse.

#### Escenario: Búsqueda con placeholder por defecto

- DADO QUE el comercio no configuró `searchPlaceholder`
- CUANDO se renderiza la barra de búsqueda
- ENTONCES el placeholder DEBE ser "Buscar productos"

#### Escenario: Búsqueda funcional

- DADO QUE el usuario escribe "café" en la barra de búsqueda
- CUANDO se ejecuta la búsqueda
- ENTONCES DEBEN mostrarse solo los productos cuyo nombre contenga "café"
- Y el comportamiento DEBE ser idéntico al sistema de búsqueda actual

---

### Requisito: Tabs de Categorías Horizontales

Si `catalog.showCategories = true`, el storefront DEBE mostrar las categorías como tabs horizontales con scroll. La categoría activa DEBE mostrarse en negrita con una línea azul debajo. Las categorías inactivas DEBEN mostrarse en gris.

Si `showCategories = false`, la sección NO DEBE renderizarse.

#### Escenario: Categorías con scroll horizontal

- DADO QUE el comercio tiene 12 categorías
- CUANDO se renderizan los tabs
- ENTONCES las categorías DEBEN mostrarse en una fila horizontal con scroll
- Y la categoría activa DEBE tener un indicador visual azul

#### Escenario: Categorías desactivadas

- DADO QUE `catalog.showCategories = false`
- CUANDO se renderiza el storefront
- ENTONCES la sección de categorías NO DEBE mostrarse

#### Escenario: Cambio de categoría

- DADO QUE el usuario toca una categoría inactiva
- CUANDO se selecciona
- ENTONCES los productos DEBEN filtrarse por esa categoría
- Y el tab DEBE mostrarse como activo (negrita + línea azul)

---

### Requisito: Promociones Visuales Configurables

Si `promotions.enabled = true` y existen items de promoción visibles, el storefront DEBE mostrar un carrusel horizontal de cards de promociones. Cada card DEBE mostrar: icono, título, descripción, y colores configurables.

Si no hay promociones visibles o `enabled = false`, la sección NO DEBE renderizarse.

#### Escenario: Promociones activas

- DADO QUE hay 3 promociones visibles configuradas
- CUANDO se renderiza el storefront
- ENTONCES DEBEN mostrarse 3 cards desplazables horizontalmente
- Y cada card DEBE mostrar su icono, título y descripción configurados

#### Escenario: Promociones desactivadas

- DADO QUE `promotions.enabled = false`
- CUANDO se renderiza el storefront
- ENTONCES la sección de promociones NO DEBE mostrarse

#### Escenario: Sin promociones visibles

- DADO QUE `promotions.enabled = true` pero todos los items tienen `visible = false`
- CUANDO se renderiza el storefront
- ENTONCES la sección de promociones NO DEBE mostrarse

---

### Requisito: Tarjeta de Producto Configurable

Cada producto DEBE renderizarse en una card con diseño limpio, imagen centrada (o placeholder si está desactivada), nombre, precio (si está habilitado), y botón de agregar.

La posición del botón de agregar DEBE ser configurable: flotante sobre la imagen o debajo del producto.

#### Escenario: Producto con todos los elementos visibles

- DADO QUE `showProductImages = true`, `showPrices = true`, `addButtonPosition = "floating"`
- CUANDO se renderiza una card de producto
- ENTONCES DEBE mostrarse la imagen del producto
- Y el precio en negrita
- Y el botón "+" flotando sobre la esquina de la imagen
- Y el nombre del producto debajo

#### Escenario: Producto con imágenes ocultas

- DADO QUE `showProductImages = false`
- CUANDO se renderiza una card de producto
- ENTONCES NO DEBE mostrarse la imagen del producto
- Y DEBE mostrarse un placeholder genérico o layout sin imagen
- Y el nombre y precio DEBEN mostrarse normalmente

#### Escenario: Producto con precios ocultos

- DADO QUE `showPrices = false`
- CUANDO se renderiza una card de producto
- ENTONCES NO DEBE mostrarse el precio
- Y el botón de agregar y la imagen DEBEN mostrarse normalmente

#### Escenario: Botón de agregar debajo del producto

- DADO QUE `addButtonPosition = "below"`
- CUANDO se renderiza una card de producto
- ENTONCES el botón "+" DEBE aparecer debajo del nombre/precio
- Y NO DEBE estar flotando sobre la imagen

---

### Requisito: Sección de Productos por Categoría

Los productos DEBEN poder agruparse por categoría en secciones con: título en negrita, cantidad de productos en gris, link "Ver todo →" configurable, y layout de productos configurable (`grid`, `horizontal`, `compact`).

#### Escenario: Sección con "Ver todo" habilitado

- DADO QUE `showViewAll = true` y hay más productos de los que se muestran por sección
- CUANDO se renderiza una sección de categoría
- ENTONCES DEBE mostrarse el link "Ver todo →" alineado a la derecha
- Y al hacer click DEBE filtrar por esa categoría

#### Escenario: Layout en grilla de 2 columnas

- DADO QUE `productLayout = "grid"`
- CUANDO se renderizan los productos de una sección
- ENTONCES DEBEN mostrarse en una grilla de 2 columnas en mobile

#### Escenario: Layout en carrusel horizontal

- DADO QUE `productLayout = "horizontal"`
- CUANDO se renderizan los productos de una sección
- ENTONCES DEBEN mostrarse en un carrusel con scroll horizontal

---

### Requisito: Carrito como Bottom Sheet

En mobile, el carrito DEBE renderizarse como un bottom sheet con:

- Overlay semi-transparente
- Borde superior redondeado
- Barra indicadora horizontal para deslizar
- Botón de cerrar en esquina superior derecha
- Animación de slide-up/down

En desktop, el modo de visualización DEBE ser configurable (`bottom-sheet`, `modal` centrado, `drawer` lateral).

#### Escenario: Apertura de bottom sheet en mobile

- DADO QUE el usuario está en mobile y agrega un producto al carrito
- CUANDO se abre el carrito
- ENTONCES DEBE aparecer deslizándose desde abajo
- Y DEBE mostrarse un overlay gris detrás
- Y el borde superior DEBE ser redondeado

#### Escenario: Cierre de bottom sheet

- DADO QUE el carrito está abierto como bottom sheet
- CUANDO el usuario toca el overlay o desliza hacia abajo
- ENTONCES el carrito DEBE cerrarse con animación de slide-down

#### Escenario: Carrito en desktop con drawer lateral

- DADO QUE `cart.displayMode = "drawer"` y la pantalla es desktop
- CUANDO se abre el carrito
- ENTONCES DEBE mostrarse como panel lateral derecho
- Y el contenido principal DEBE ajustarse (no superponerse)

---

### Requisito: Vista Previa de Mensaje WhatsApp

Si `cart.showWhatsappPreview = true`, el carrito DEBE mostrar una card que simule visualmente un mensaje de WhatsApp con: encabezado verde (nombre del comercio + "en línea"), y caja de mensaje con el texto del pedido (saludo, productos, subtotal, total, texto final).

Si `showWhatsappPreview = false`, la previsualización NO DEBE mostrarse.

#### Escenario: Preview de WhatsApp activo

- DADO QUE `showWhatsappPreview = true` y hay productos en el carrito
- CUANDO se abre el carrito
- ENTONCES DEBE mostrarse una card con diseño de burbuja de WhatsApp
- Y el encabezado DEBE mostrar el nombre del comercio y "en línea"
- Y el contenido DEBE incluir el saludo, los productos, el subtotal y el total

#### Escenario: Preview de WhatsApp desactivado

- DADO QUE `showWhatsappPreview = false`
- CUANDO se abre el carrito
- ENTONCES NO DEBE mostrarse la preview de WhatsApp

---

### Requisito: Botón Final de WhatsApp

El carrito DEBE tener un botón verde (`var(--store-whatsapp)`) con texto configurable (default: "Enviar pedido por WhatsApp"), icono de WhatsApp, ancho completo, bordes redondeados, y sombra verde suave.

La lógica de envío por WhatsApp existente NO DEBE modificarse.

#### Escenario: Botón de WhatsApp funcional

- DADO QUE hay productos en el carrito
- CUANDO el usuario toca el botón "Enviar pedido por WhatsApp"
- ENTONCES DEBE abrirse WhatsApp con el mensaje generado usando la lógica existente
- Y el mensaje DEBE incluir los productos, cantidades y totales correctos

---

### Requisito: Panel de Configuración Admin

El panel `settings/tienda` DEBE incluir una sección "Online Store" (o extenderse) con sub-secciones para: Identidad, Apariencia, Catálogo, Promociones, Carrito y Responsive.

La configuración DEBE guardarse mediante el sistema de API existente (`/api/settings`).

#### Escenario: Guardado de configuración

- DADO QUE el administrador modifica `primaryColor` a `#FF0000` y `showPrices` a `false`
- CUANDO guarda la configuración
- ENTONCES los valores DEBEN persistirse en la base de datos
- Y al recargar el storefront, DEBEN aplicarse los nuevos valores

#### Escenario: Preview visual en admin

- DADO QUE el administrador está configurando la tienda
- CUANDO modifica cualquier valor visual
- ENTONCES DEBERÍA mostrarse una previsualización en tiempo real de cómo se verá la tienda
- (No es obligatorio si complica demasiado la implementación)

---

### Requisito: No Romper Funcionalidad Existente

La implementación NO DEBE modificar la lógica de:

- Carrito (agregar, quitar, cantidades)
- Búsqueda de productos
- Filtrado por categorías
- Cálculo de precios y descuentos
- Generación y envío de mensajes por WhatsApp
- Checkout y pasarela de pagos
- Autenticación y permisos

#### Escenario: Funcionalidad de carrito intacta

- DADO QUE se aplicó el rediseño visual
- CUANDO un usuario agrega productos al carrito, modifica cantidades, y envía por WhatsApp
- ENTONCES el comportamiento DEBE ser idéntico al que existía antes del rediseño
- Y los totales, subtotales y el mensaje de WhatsApp DEBEN calcularse correctamente

#### Escenario: Temas existentes preservados

- DADO QUE el comercio tenía configurado `themeIdentifier = "ocean"`
- CUANDO se renderiza el storefront después del rediseño
- ENTONCES los colores del tema "ocean" DEBEN seguir aplicándose
- Y los nuevos componentes DEBEN adaptarse a esos colores mediante CSS variables

---

### Requisito: Responsive Design Configurable

En mobile, el storefront DEBE verse como una app nativa (header compacto, buscador grande, productos fáciles de tocar, bottom sheet para carrito).

En desktop, el layout DEBE ser configurable:

- `mobile-centered`: contenido centrado con ancho máximo tipo app
- `wide-ecommerce`: layout ancho tipo tienda online tradicional
- `with-cart-sidebar`: catálogo a la izquierda, carrito lateral a la derecha

#### Escenario: Mobile-centered en desktop

- DADO QUE `responsive.desktopLayout = "mobile-centered"` y la pantalla es desktop
- CUANDO se renderiza el storefront
- ENTONCES el contenido DEBE estar centrado con `max-width` similar a un dispositivo móvil (~430px)
- Y el fondo exterior DEBE ser gris claro

#### Escenario: Wide ecommerce en desktop

- DADO QUE `responsive.desktopLayout = "wide-ecommerce"` y la pantalla es desktop
- CUANDO se renderiza el storefront
- ENTONCES el contenido DEBE ocupar todo el ancho disponible
- Y la grilla de productos DEBE tener más columnas

---

### Requisito: Helpers Visuales

El sistema DEBE proporcionar funciones helper puras que traduzcan valores de configuración a clases CSS:

- `getRadiusClass(value)` → clase de border-radius
- `getShadowClass(value)` → clase de sombra
- `getCardStyleClass(value)` → clase de estilo de tarjeta
- `getButtonStyleClass(value)` → clase de estilo de botón
- `getProductLayoutClass(value)` → clase de layout de productos

#### Escenario: Helper de radio de borde

- DADO QUE `settings.theme.borderRadius = "2xl"`
- CUANDO se llama a `getRadiusClass("2xl")`
- ENTONCES DEBE devolver una clase CSS que aplique border-radius extra grande

#### Escenario: Helper con valor desconocido

- DADO QUE se pasa un valor no reconocido a `getShadowClass("invalid")`
- CUANDO se ejecuta la función
- ENTONCES DEBE devolver el valor por defecto (`"soft"`)
