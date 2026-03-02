/**
 * tutorial-content.ts
 * Contenido centralizado de tutoriales para TODAS las páginas de settings.
 * Cada módulo tiene su propio array de pasos.
 * Para agregar/editar tutorial de una sección, modificá sólo este archivo.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type TutorialStep = {
    /** Nombre del ícono de lucide-react (string, se resuelve en el componente) */
    iconName: string;
    /** Clases de color del ícono */
    color: string;
    /** Clases de fondo del ícono */
    bg: string;
    /** Título del paso */
    title: string;
    /** Descripción breve del concepto */
    description: string;
    /** Ejemplo práctico */
    example: {
        label: string;
        /** Items positivos (con checkmark verde) — separados por \n */
        on: string;
        /** Item negativo / caso contrario (con X) */
        off: string;
    };
    /** Tip final con emoji */
    tip: string;
};

export type TutorialModule = {
    id: string;
    steps: TutorialStep[];
};

// ─── Tutoriales por módulo ─────────────────────────────────────────────────────

/** Settings/POS — Punto de Venta */
export const POS_TUTORIAL: TutorialStep[] = [
    {
        iconName: "Lock",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        title: "Modo Estricto de Caja",
        description:
            "Controla si tus empleados pueden registrar ventas sin abrir un turno de caja previamente.",
        example: {
            label: "Ejemplo práctico",
            on: "Con el Modo Estricto ACTIVADO: El cajero debe abrir su turno antes de cobrar. El sistema registra quién cobró, cuándo y cuánto.\nAl final del día cerrás el turno y ves el resumen del efectivo por cada cajero.",
            off: "Con el Modo Estricto DESACTIVADO: Cualquiera puede registrar una venta sin asignar quién la realizó. Útil para negocios muy pequeños.",
        },
        tip: "💡 Recomendado para negocios con más de 1 empleado que maneja caja.",
    },
    {
        iconName: "Clock",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        title: "Control de Horarios",
        description:
            "Restringe el acceso al POS según el horario laboral configurado para cada empleado.",
        example: {
            label: "Ejemplo práctico",
            on: "Con Control de Horarios ACTIVADO: Si un empleado tiene turno de 9:00 a 17:00, el sistema NO le permitirá registrar ventas fuera de ese horario.",
            off: "Con Control de Horarios DESACTIVADO: Los empleados pueden acceder al POS en cualquier momento, sin restricción de horario.",
        },
        tip: "💡 Requiere que el Modo Estricto esté activado. Configurá los horarios haciendo click en la fila.",
    },
    {
        iconName: "Percent",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        title: "Porcentajes de Precio",
        description:
            "Dos ajustes numéricos que modifican automáticamente los precios bajo ciertas condiciones.",
        example: {
            label: "Ejemplos de cálculo",
            on: "Ajuste de Consignación al 10%: Un producto que el proveedor entrega a $1.000 se mostrará al cliente como $1.100.\nInterés por Tarjeta al 5%: Si un cliente paga $2.000 con tarjeta, el sistema cobrará $2.100 automáticamente.",
            off: "Sin porcentaje configurado: los precios se muestran tal cual están cargados, sin ningún ajuste automático.",
        },
        tip: "💡 No olvides hacer click en 'Guardar Configuración' después de cambiar los valores.",
    },
    {
        iconName: "ShoppingBag",
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        title: "Tienda Online y Catálogo",
        description:
            "Tres opciones para compartir tus productos en internet, desde una simple lista hasta una tienda completa.",
        example: {
            label: "¿Cuál elegir?",
            on: "Catálogo Público: tus clientes ven productos y precios pero NO pueden comprar online. Ideal para mostrar stock.\nModo Tienda: agrega carrito y pagos con Mercado Pago. Tus clientes eligen y pagan directamente desde el link.\nFiltrar por Sucursal: el link solo muestra el stock de esta sucursal.",
            off: "Sin ninguna opción activada, tu inventario no es visible al público.",
        },
        tip: "💡 Para el Modo Tienda necesitás ingresar tu Public Key y Access Token de Mercado Pago.",
    },
    {
        iconName: "Monitor",
        color: "text-sky-500",
        bg: "bg-sky-500/10",
        title: "Terminales Físicas (Cajas)",
        description:
            "Cada 'Terminal' representa una computadora o dispositivo donde se cobra. Podés tener varias.",
        example: {
            label: "Ejemplos de uso",
            on: "Negocio con 2 mostradores: creás 'Caja Mostrador 1' y 'Caja Mostrador 2'. Cada cajero abre su turno en su terminal.\nAl final del día ves el resumen de cada caja por separado.",
            off: "No es necesario crear una terminal por empleado, sino por dispositivo físico.",
        },
        tip: "💡 Usá nombres descriptivos como 'Caja Principal' o 'Mostrador Planta Baja' para identificarlas fácil.",
    },
];

/** Settings/Branding — Ticket PDF */
export const BRANDING_TUTORIAL: TutorialStep[] = [
    {
        iconName: "Palette",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        title: "Logo del Negocio",
        description:
            "El logo que subas aparecerá en el encabezado de todos los tickets PDF que envíes a tus clientes.",
        example: {
            label: "Recomendaciones",
            on: "Formatos aceptados: PNG, JPG, SVG. Recomendamos PNG con fondo transparente para mejor resultado.\nTamaño ideal: mínimo 200x200 px. El sistema lo escala automáticamente.",
            off: "Sin logo: los tickets mostrarán solo el nombre del negocio en texto plano.",
        },
        tip: "💡 Un logo profesional genera confianza en tus clientes y distingue tus reportes.",
    },
    {
        iconName: "FileText",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        title: "Datos del Negocio",
        description:
            "Nombre, teléfono y dirección que aparecen en el encabezado del ticket junto al logo.",
        example: {
            label: "Dónde aparece",
            on: "Nombre del negocio: aparece en grande en el encabezado del PDF.\nTeléfono y Dirección: se imprimen debajo del nombre para que el cliente pueda contactarte.",
            off: "Sin datos completos, el ticket puede parecer poco profesional o generar confusión al cliente.",
        },
        tip: "💡 Completá todos los campos para que tus clientes puedan identificar y contactar tu negocio fácilmente.",
    },
    {
        iconName: "Scan",
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        title: "Vista Previa del Reporte",
        description:
            "La previsualización muestra exactamente cómo verá el cliente el ticket PDF antes de guardarlo.",
        example: {
            label: "Cómo usarla",
            on: "Hacé click en la previsualización para abrirla en pantalla completa con zoom ajustable.\nCada cambio que hagas (color, logo, datos) se refleja al instante en la vista previa.",
            off: "Si guardás sin revisar la vista previa, el ticket podría tener errores tipográficos o de diseño.",
        },
        tip: "💡 Siempre revisá la vista previa antes de guardar. El botón 'Guardar cambios' aplica todo al sistema.",
    },
];

/** Settings/WhatsApp — Mensajería */
export const WHATSAPP_TUTORIAL: TutorialStep[] = [
    {
        iconName: "MessageCircle",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        title: "Plantillas de WhatsApp",
        description:
            "Configurá los mensajes automáticos que se envían a tus clientes al crear una consignación o registrar una venta.",
        example: {
            label: "Dos tipos de plantilla",
            on: "Remito de Consignación: se envía cuando creás una nueva consignación. Lleva el link al remito digital.\nTicket de Venta POS: se envía al finalizar una venta. Lleva el link al ticket digital.",
            off: "Sin plantilla configurada, el mensaje enviado al cliente estará vacío o usará el texto por defecto.",
        },
        tip: "💡 Usá el botón 'Mensaje Mágico' para generar una plantilla profesional de forma automática.",
    },
    {
        iconName: "Sparkles",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        title: "Variables Dinámicas",
        description:
            "Son etiquetas especiales que se reemplazan automáticamente con datos reales al enviar el mensaje.",
        example: {
            label: "Ejemplo con variables",
            on: "Escribís: 'Hola {name}, tu ticket está en {url}'\nEl cliente recibe: 'Hola Juan Pérez, tu ticket está en https://tuapp.com/t/123'",
            off: "Sin variables, el mensaje es igual para todos los clientes. No se personaliza automáticamente.",
        },
        tip: "💡 Variables disponibles: {name} (nombre), {url} (link), {total} (monto), {items} (cantidad), {date} (fecha).",
    },
    {
        iconName: "Smartphone",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        title: "Formato y Vista Previa",
        description:
            "Aplicá formato de WhatsApp y revisá cómo se verá el mensaje en el teléfono del cliente antes de guardar.",
        example: {
            label: "Formato de texto",
            on: "Texto en negrita: rodealo con asteriscos → *así*\nTexto en cursiva: rodealo con guiones bajos → _así_\nLa vista previa en tiempo real simula un celular Android con WhatsApp.",
            off: "Sin formato, el mensaje aparece completamente en texto plano sin destacar información importante.",
        },
        tip: "💡 Los mensajes cortos tienen 3x más tasa de apertura. Usá negritas solo para datos clave como el total o el link.",
    },
];

/** Settings/Notificaciones — Alertas */
export const NOTIFICATIONS_TUTORIAL: TutorialStep[] = [
    {
        iconName: "PackageSearch",
        color: "text-primary",
        bg: "bg-primary/10",
        title: "Alertas de Stock Bajo",
        description:
            "El sistema te notifica cuando un producto alcanza el nivel mínimo de stock configurado.",
        example: {
            label: "Ejemplo práctico",
            on: "Stock Mínimo Global = 5: cuando cualquier producto baje de 5 unidades, recibirás una alerta.\nPodés definir un mínimo diferente por producto desde el inventario.",
            off: "Sin alertas de stock: podrías quedarte sin productos sin darte cuenta hasta que un cliente lo pida.",
        },
        tip: "💡 Configurá el Stock Mínimo Global según tu rotación promedio. Un valor de 3 a 10 suele ser razonable.",
    },
    {
        iconName: "CalendarClock",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        title: "Alertas de Vencimiento",
        description:
            "Recibirás alertas preventivas antes de que un producto llegue a su fecha de vencimiento.",
        example: {
            label: "Configuración recomendada",
            on: "Anticipación de 7 días: el sistema te avisa 7 días antes del vencimiento para que puedas actuar.\nIdeal para negocios con alimentos, medicamentos o insumos con fecha de caducidad.",
            off: "Sin alertas de vencimiento: podrías vender productos caducados sin saberlo, lo que genera riesgos legales.",
        },
        tip: "💡 Aumentá los días de anticipación si tus productos tardan mucho en liquidarse. 15 días es un buen punto de partida.",
    },
    {
        iconName: "BellRing",
        color: "text-pink-500",
        bg: "bg-pink-500/10",
        title: "Alertas de Ventas y Consignaciones",
        description:
            "Notificaciones en tiempo real cuando se registran ventas, liquidaciones o consignaciones con mucho tiempo activo.",
        example: {
            label: "Qué activa cada alerta",
            on: "Confirmación de Ventas: alerta al procesar cada venta en el POS.\nLiquidaciones: alerta al cerrar una consignación.\nTiempo en Calle: alerta cuando una consignación supera los días configurados sin liquidar.",
            off: "Sin estas alertas, deberías revisar manualmente el estado de cada consignación para detectar atrasos.",
        },
        tip: "💡 Para consignaciones, configurá el tiempo máximo según tu ciclo comercial típico (ej: 30 días).",
    },
];

/** Settings/Security — Seguridad */
export const SECURITY_TUTORIAL: TutorialStep[] = [
    {
        iconName: "Activity",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        title: "Registro de Actividad",
        description:
            "Historial completo de todas las acciones realizadas por cada usuario en el sistema.",
        example: {
            label: "Qué se registra",
            on: "Ventas procesadas: quién vendió, a qué hora y por cuánto.\nCambios en inventario: quién modificó precios o stock.\nAccesos fallidos: intentos de login sin contraseña correcta.",
            off: "Sin revisar el registro, actividades irregulares podrían pasar desapercibidas.",
        },
        tip: "💡 Revisá el registro periódicamente para detectar errores o actividades sospechosas de tus empleados.",
    },
    {
        iconName: "Users",
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        title: "Gestión de Empleados",
        description:
            "Administrá el acceso de cada empleado: qué puede ver, qué puede editar y en qué sucursal trabaja.",
        example: {
            label: "Niveles de acceso",
            on: "Cajero: solo puede registrar ventas en el POS.\nAdmin: puede ver reportes, modificar inventario y configurar el sistema.\nEach empleado tiene sus propias credenciales de ingreso.",
            off: "Sin roles definidos, todos los empleados tienen acceso completo al sistema, lo que representa un riesgo.",
        },
        tip: "💡 Asigná el rol mínimo necesario a cada empleado. El principio de mínimo privilegio protege tu negocio.",
    },
    {
        iconName: "Fingerprint",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        title: "Sesiones Activas",
        description:
            "Controlá qué dispositivos tienen sesión abierta en este momento y podés cerrarlas de forma remota.",
        example: {
            label: "Cuándo usarlo",
            on: "Si un empleado se fue y olvidó cerrar sesión: podés hacerlo de forma remota desde acá.\nSi detectás un dispositivo desconocido: cerrá la sesión inmediatamente y cambiá la contraseña.",
            off: "Sin controlar las sesiones, dispositivos perdidos o robados podrían mantener acceso a tu sistema.",
        },
        tip: "💡 Revisá las sesiones activas cada vez que un empleado deje de trabajar en tu negocio.",
    },
];

/** Settings/Tienda — Tu Tienda Online */
export const TIENDA_TUTORIAL: TutorialStep[] = [
    {
        iconName: "Zap",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        title: "Configuración General de la Tienda",
        description:
            "Personalizá el aspecto visual de tu catálogo público: nombre, colores, tema y redes sociales.",
        example: {
            label: "Qué podés personalizar",
            on: "Nombre y descripción: aparecen en el encabezado de tu tienda pública.\nColor principal: define el color de los botones y acentos visuales.\nRedes sociales: links a Instagram, Facebook u otras plataformas.",
            off: "Sin personalizar, tu tienda muestra valores por defecto que no representan tu marca.",
        },
        tip: "💡 Mantené coherencia entre los colores de tu tienda online y tu branding físico para mayor profesionalismo.",
    },
    {
        iconName: "Image",
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        title: "Banner y Logo de Tienda",
        description:
            "El banner es la imagen principal de tu tienda y el logo identifica tu marca en el encabezado.",
        example: {
            label: "Tamaños recomendados",
            on: "Banner: imagen horizontal, mínimo 1200x400 px. Puede incluir texto, promociones o fotos de productos.\nLogo: imagen cuadrada, mínimo 200x200 px. PNG con fondo transparente es lo ideal.",
            off: "Sin banner ni logo, tu tienda puede parecer incompleta o poco confiable para los clientes.",
        },
        tip: "💡 Actualizá el banner para cada temporada o promoción especial para mantener tu tienda dinámica.",
    },
    {
        iconName: "Globe",
        color: "text-sky-500",
        bg: "bg-sky-500/10",
        title: "Link Público de tu Tienda",
        description:
            "Tu tienda tiene un link único que podés compartir con tus clientes para que vean tus productos.",
        example: {
            label: "Dónde compartirlo",
            on: "Instagram: pegá el link en tu bio para que tus seguidores puedan ver tu catálogo.\nWhatsApp: envialo a tus clientes habituales para que consulten disponibilidad y precios.\nGoogle My Business: agrégalo para mejorar tu presencia local.",
            off: "Si no compartís el link, tu tienda online queda invisible aunque esté habilitada.",
        },
        tip: "💡 Podés copiar el link desde la sección Punto de Venta → Tienda Online.",
    },
];

/** Settings/Branches — Sucursales */
export const BRANCHES_TUTORIAL: TutorialStep[] = [
    {
        iconName: "Store",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        title: "Gestión de Sucursales",
        description:
            "Cada sucursal es un punto de venta o depósito independiente con su propio stock e inventario.",
        example: {
            label: "Ejemplo de estructura",
            on: "Negocio con 2 locales: 'Sucursal Centro' y 'Sucursal Norte' son dos sucursales separadas.\nCada una tiene su propio inventario y puede tener sus propios empleados asignados.",
            off: "Sin sucursales separadas, todo el inventario y las ventas se mezclan en un único punto.",
        },
        tip: "💡 Esta función está disponible en el Plan Enterprise. Contactate con soporte si necesitás activarla.",
    },
    {
        iconName: "MapPin",
        color: "text-sky-500",
        bg: "bg-sky-500/10",
        title: "Depósitos y Zonas",
        description:
            "Podés definir un depósito central que abastezca a múltiples sucursales y rangos de zona de entrega.",
        example: {
            label: "Modelo de distribución",
            on: "Depósito Central: recibe mercadería y la distribuye a las sucursales según la demanda.\nZona de entrega: radio geográfico dentro del cual realizás envíos a domicilio.",
            off: "Sin zonas definidas, el sistema no puede calcular ni filtrar entregas por área geográfica.",
        },
        tip: "💡 Definí las zonas con precisión para optimizar tus rutas de entrega y reducir costos logísticos.",
    },
];

/** Settings/Subscriptions — Plan y Facturación */
export const SUBSCRIPTIONS_TUTORIAL: TutorialStep[] = [
    {
        iconName: "CreditCard",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        title: "Tu Plan Actual",
        description:
            "Revisá qué funciones están incluidas en tu plan, cuándo vence y cómo actualizar tu suscripción.",
        example: {
            label: "Planes disponibles",
            on: "Plan Básico: POS, inventario, 1 sucursal y reportes esenciales.\nPlan Pro: todo lo anterior + tienda online, WhatsApp y múltiples terminales.\nPlan Enterprise: todas las funciones + sucursales múltiples y soporte prioritario.",
            off: "Sin suscripción activa, el acceso al sistema queda limitado a solo lectura.",
        },
        tip: "💡 Actualizá tu plan antes de que venza para no interrumpir el servicio.",
    },
    {
        iconName: "Receipt",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        title: "Historial de Facturación",
        description:
            "Accedé a todas tus facturas y comprobantes de pago desde este módulo.",
        example: {
            label: "Para qué usar el historial",
            on: "Descargá las facturas para presentarlas en tu declaración impositiva.\nVerificá el monto de cada periodo para controlar tus gastos de software.",
            off: "Sin revisar el historial, podrías no darte cuenta de cobros duplicados o incorrectos.",
        },
        tip: "💡 Los pagos se procesan automáticamente con Mercado Pago. Podés actualizar tu método de pago en cualquier momento.",
    },
];

// ─── Mapa de módulos ──────────────────────────────────────────────────────────
/** Usá este mapa para importar el tutorial correcto por módulo ID */
export const TUTORIALS_MAP: Record<string, TutorialStep[]> = {
    pos: POS_TUTORIAL,
    branding: BRANDING_TUTORIAL,
    whatsapp: WHATSAPP_TUTORIAL,
    notifications: NOTIFICATIONS_TUTORIAL,
    security: SECURITY_TUTORIAL,
    tienda: TIENDA_TUTORIAL,
    branches: BRANCHES_TUTORIAL,
    subscriptions: SUBSCRIPTIONS_TUTORIAL,
};
