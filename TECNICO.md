# Documentación Técnica - Sistema POS & Consignaciones

Este documento detalla la arquitectura técnica, el stack tecnológico y los patrones de implementación utilizados en el proyecto.

## 🛠️ Stack Tecnológico

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router).
- **Frontend**: React 19, Tailwind CSS 4, Shadcn UI / Radix UI.
- **Backend**: Next.js API Routes (Edge-friendly pero corriendo en Node.js Runtime por dependencias).
- **Base de Datos**: PostgreSQL gestionado mediante [Prisma ORM 7](https://www.prisma.io/).
- **Real-time**: [Socket.io](https://socket.io/) (Servidor custom).
- **Autenticación**: JWT (JSON Web Tokens) mediante `jose` y `jsonwebtoken`.
- **Pagos**: MercadoPago SDK y PayPal SDK.
- **Correos**: Resend.

---

## 🏗️ Arquitectura del Servidor

El sistema utiliza un **servidor de Node.js personalizado** (`server.ts`) en lugar del comando `next start` estándar.

### Integración de Socket.io
- El servidor HTTP nativo captura las peticiones que comienzan con `/socket.io` antes de que Next.js las procese.
- **Dispatch Interno**: Existe un endpoint especial `/api/socket/dispatch` que permite a las API Routes de Next.js enviar eventos a Socket.io de forma local.

### Inicialización (System Guard)
- Se utiliza un Route Group `(system-guard)` con un `layout.tsx` que verifica la existencia de usuarios en la DB.
- Si la DB está vacía, redirige automáticamente a `/setup`, garantizando que el sistema no sea accesible sin un administrador configurado.

---

## 🔐 Seguridad y Autenticación

### Flujo de JWT
1. El usuario se loguea y recibe un JWT firmado.
2. El token se almacena en una **HttpOnly Cookie**.
3. **Validación Doble**:
    - Se verifica la firma y expiración del JWT.
    - Se valida el hash del token contra la tabla `UserSession` en la DB para permitir la revocación remota de sesiones.

### Control de Sucursales
- **Admins**: Pueden cambiar de sucursal enviando el header `x-sucursal-id`.
- **Empleados**: El sistema ignora los headers y los bloquea a la `sucursalId` definida en su perfil de usuario.

---

## 📊 Modelo de Datos y Prisma

El esquema de Prisma (`schema.prisma`) está diseñado para soportar:
- **Hard-Deletes vs Soft-Deletes**: Principalmente se usa un campo `activo: boolean`.
- **Relaciones Complejas**: Manejo dinámico de consignaciones, liquidaciones y ventas vinculadas.
- **Tipado Estricto**: Uso intensivo de Enums para estados de venta, notificación y suscripción.

---

## ⚡ Patrones de API y Libs

### apiService.ts
Centraliza todas las peticiones fetch desde el cliente, manejando:
- Headers automáticos (incluyendo el token y branch ID).
- Tipado de respuestas mediante interfaces de TypeScript.
- Manejo de errores global.

### Webhooks
- Procesamiento asíncrono de notificaciones de pago.
- Verificación de firmas para asegurar la autenticidad de las peticiones de MercadoPago y PayPal.

---

## 🚀 Despliegue y Mantenimiento

- **Scripts de Inicio**: 
    - `npm run build`: Genera el cliente de Prisma y hace el build de Next.js.
    - `npm run start`: Ejecuta migraciones (`prisma migrate deploy`) y levanta el servidor custom.
- **Variables de Entorno**: Cruciales para la base de datos (`DATABASE_URL`), JWT (`JWT_SECRET`) y claves de pago.
