# Rate limiting operativo en auth recovery

## Objetivo

Documentar los thresholds iniciales de la Fase 4 y dejar una guia de tuning segura para `login`, `forgot-password` y `reset-password`.

## Thresholds iniciales

| Endpoint          | Regla              | Default       | Ventana |
| ----------------- | ------------------ | ------------- | ------- |
| `login`           | Por IP             | `30` intentos | `15m`   |
| `login`           | Por IP + identidad | `10` intentos | `15m`   |
| `forgot-password` | Por IP             | `10` intentos | `15m`   |
| `forgot-password` | Por IP + identidad | `3` intentos  | `30m`   |
| `reset-password`  | Por IP             | `10` intentos | `15m`   |
| `reset-password`  | Por token          | `5` intentos  | `30m`   |
| `reset-password`  | Por IP + token     | `3` intentos  | `30m`   |

## Variables de entorno soportadas

Todos los limites aceptan override por entorno sin cambiar codigo:

- `AUTH_RATE_LIMIT_LOGIN_IP_MAX`
- `AUTH_RATE_LIMIT_LOGIN_IP_WINDOW_MS`
- `AUTH_RATE_LIMIT_LOGIN_IDENTITY_MAX`
- `AUTH_RATE_LIMIT_LOGIN_IDENTITY_WINDOW_MS`
- `AUTH_RATE_LIMIT_FORGOT_IP_MAX`
- `AUTH_RATE_LIMIT_FORGOT_IP_WINDOW_MS`
- `AUTH_RATE_LIMIT_FORGOT_IDENTITY_MAX`
- `AUTH_RATE_LIMIT_FORGOT_IDENTITY_WINDOW_MS`
- `AUTH_RATE_LIMIT_RESET_IP_MAX`
- `AUTH_RATE_LIMIT_RESET_IP_WINDOW_MS`
- `AUTH_RATE_LIMIT_RESET_TOKEN_MAX`
- `AUTH_RATE_LIMIT_RESET_TOKEN_WINDOW_MS`
- `AUTH_RATE_LIMIT_RESET_IP_TOKEN_MAX`
- `AUTH_RATE_LIMIT_RESET_IP_TOKEN_WINDOW_MS`

## Observabilidad minima esperada

- Los bloqueos generan `AUTH_RATE_LIMIT_BLOCK` en auditoria cuando el contexto puede escribir audit log.
- Los budgets cercanos al agotamiento generan `AUTH_RATE_LIMIT_WARNING` para facilitar tuning.
- Los logs de consola solo exponen endpoint e IP; las identidades y tokens se registran hasheados en `details`.

## Guia de tuning segura

1. Revisar `401`, `400` y `429` por endpoint durante la ventana inicial post deploy.
2. Si aparecen falsos positivos en oficinas con IP compartida, subir primero los limites por IP y mantener mas estricta la llave compuesta por identidad/token.
3. Si persiste abuso residual, bajar primero las reglas compuestas (`IP + identidad`, `IP + token`) antes de endurecer el limite solo por IP.
4. Documentar cada ajuste con fecha, responsable, motivo y nuevo threshold.
5. No relajar mensajes ni respuestas: el tuning solo cambia ventanas y budgets.

## Pendiente operativo

La validacion en trafico real y el ajuste definitivo de thresholds deben completarse despues del despliegue controlado. Hasta entonces estos valores se consideran baseline conservador.
