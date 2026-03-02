export function getThemeStyles(themeIdentifier: string | undefined | null) {
    const theme = themeIdentifier || "modern";

    // 1. Configuración de Bordes (Border Radius)
    let radiusClass = "rounded-xl"; // Default fallback
    let buttonRadiusClass = "rounded-xl"; // Default buttons
    let inputRadiusClass = "rounded-xl"; // Default inputs

    switch (theme) {
        // Redondeado extremo (amigable)
        case "modern":
        case "ocean":
        case "barbie":
            radiusClass = "rounded-[2rem]";
            buttonRadiusClass = "rounded-full";
            inputRadiusClass = "rounded-full";
            break;
        // Redondeado estándar suave
        case "nature":
        case "sunset":
            radiusClass = "rounded-2xl";
            buttonRadiusClass = "rounded-2xl";
            inputRadiusClass = "rounded-xl";
            break;
        // Ligeramente redondeado (tecnológico)
        case "tech":
            radiusClass = "rounded-lg";
            buttonRadiusClass = "rounded-md";
            inputRadiusClass = "rounded-md";
            break;
        // Bordes rectos y afilados (elegancia/minimalismo)
        case "minimal":
        case "luxury":
            radiusClass = "rounded-none";
            buttonRadiusClass = "rounded-none";
            inputRadiusClass = "rounded-none";
            break;
    }

    // 2. Comportamiento en Hovers para Botones
    let buttonHoverClass = "hover:scale-[1.05]"; // Default
    switch (theme) {
        case "minimal":
            buttonHoverClass = "hover:bg-neutral-800 transition-colors";
            break;
        case "luxury":
            buttonHoverClass = "hover:bg-transparent hover:text-primary border-2 border-primary transition-all";
            break;
        case "tech":
            buttonHoverClass = "hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] transition-shadow";
            break;
    }

    // 3. Colores de Fondo (Backgrounds)
    let pageBgClass = "bg-neutral-50";
    let cardBgClass = "bg-white";
    let headerBgClass = "bg-white/90";

    switch (theme) {
        case "nature":
            pageBgClass = "bg-green-50/40";
            cardBgClass = "bg-white";
            headerBgClass = "bg-green-50/80";
            break;
        case "ocean":
            pageBgClass = "bg-sky-50/40";
            cardBgClass = "bg-white";
            headerBgClass = "bg-sky-50/80";
            break;
        case "sunset":
            pageBgClass = "bg-orange-50/40";
            cardBgClass = "bg-white";
            headerBgClass = "bg-orange-50/80";
            break;
        case "luxury":
            pageBgClass = "bg-amber-50/20";
            cardBgClass = "bg-white";
            headerBgClass = "bg-white/90";
            break;
        case "minimal":
            pageBgClass = "bg-white";
            cardBgClass = "bg-white";
            headerBgClass = "bg-white/95";
            break;
        case "barbie":
            pageBgClass = "bg-pink-50/40";
            cardBgClass = "bg-white";
            headerBgClass = "bg-pink-50/80";
            break;
        case "tech":
            pageBgClass = "bg-indigo-50/20";
            cardBgClass = "bg-white";
            headerBgClass = "bg-indigo-50/80";
            break;
        case "modern":
        default:
            pageBgClass = "bg-neutral-50";
            cardBgClass = "bg-white";
            headerBgClass = "bg-white/90";
            break;
    }

    return {
        theme,
        radiusClass,
        buttonRadiusClass,
        inputRadiusClass,
        buttonHoverClass,
        pageBgClass,
        cardBgClass,
        headerBgClass
    };
}
