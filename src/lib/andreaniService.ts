import { Andreani } from "node-andreani";

interface AndreaniConfigProps {
    andreaniContratoDomicilio?: string | null;
    andreaniContratoSucursal?: string | null;
    andreaniCliente?: string | null;
    andreaniUsuario?: string | null;
    andreaniPassword?: string | null;
}

export class AndreaniService {
    private client: any | null = null;
    private config: AndreaniConfigProps | null = null;

    constructor() { }

    /**
     * Inicializa el SDK de node-andreani con las credenciales dadas.
     */
    public init(config: AndreaniConfigProps) {
        this.config = config;

        // Requieren estar los 5 parámetros para poder utilizar el servicio
        if (
            !config.andreaniContratoDomicilio ||
            !config.andreaniContratoSucursal ||
            !config.andreaniCliente ||
            !config.andreaniUsuario ||
            !config.andreaniPassword
        ) {
            this.client = null;
            return;
        }

        this.client = new Andreani({
            credentials: {
                CONTRATO_DOMICILIO: config.andreaniContratoDomicilio,
                CONTRATO_SUCURSAL: config.andreaniContratoSucursal,
                CODIGO_CLIENTE: config.andreaniCliente,
                USER: config.andreaniUsuario,
                PASS: config.andreaniPassword,
            },
            options: {
                use: "production", // Considerar parametrizar o deducir si es production o sandbox
                sandbox_url: "https://apisqa.andreani.com/",
                production_url: "https://apis.andreani.com",
            },
        });
    }

    /**
     * Cotiza un envío dado un código postal destino y otros parámetros opcionales
     */
    public async cotizarEnvio(codigoPostal: string, subtotal: number, pesoKg: number = 1) {
        if (!this.client) {
            throw new Error("El servicio de envíos no está configurado.");
        }

        try {
            // Ejemplo de llamada a la cotización según node-andreani (pseudo-código asumiendo interfaz)
            // Esto debería adaptarse a la respuesta real de node-andreani (`getTarifas` u otro método)
            /*
             * Nota: La librería Node-Andreani maneja `getTarifa` usando el bulto y datos origen/destino.
             */

            // Simulación / Esqueleto para la llamada real que soporte node-andreani v2+.
            // Según la request del prompt, hay que buscar cotizaciones para el código postal.
            const pesoGr = pesoKg * 1000;
            const bultos = {
                volumen: 100,
                kilos: pesoKg,
                largoCm: 10,
                altoCm: 10,
                anchoCm: 10,
                valorDeclarado: subtotal
            };

            const responseDomicilio = await this.client.getTarifa({
                sucursalOrigen: "00001", // TODO: Configurar esto dinámicamente si aplica (Normalmente la cuenta de andreani define una sucursal origen por defecto)
                cpDestino: codigoPostal,
                bultos: [bultos],
                contrato: this.config!.andreaniContratoDomicilio,
            });

            const responseSucursal = await this.client.getTarifa({
                sucursalOrigen: "00001",
                cpDestino: codigoPostal,
                bultos: [bultos],
                contrato: this.config!.andreaniContratoSucursal,
            });

            return {
                domicilio: responseDomicilio?.tarifa || 0,
                sucursal: responseSucursal?.tarifa || 0,
            };

        } catch (error: any) {
            console.error("Error al cotizar envío en Andreani:", error);
            throw new Error("No se pudo obtener las tarifas de envío: " + (error.message || "Error desconocido"));
        }
    }

    /**
     * Obtiene sucursales cercanas por CP
     */
    public async getSucursales(codigoPostal: string) {
        if (!this.client) {
            throw new Error("El servicio de envíos no está configurado.");
        }
        try {
            // Asumiendo que `getSucursales` es un método en node-andreani.
            const result = await this.client.getSucursales({ cp: codigoPostal });
            return result;
        } catch (error: any) {
            console.error("Error al buscar sucursales en Andreani:", error);
            throw new Error("Error obteniendo sucursales de Andreani.");
        }
    }

    /**
     * Valida si la instancia actual está lista para ser usada.
     */
    public isReady() {
        return this.client !== null;
    }
}

// Exportar como Singleton para poder reusarlo en el backend NextJs
export const andreaniService = new AndreaniService();
