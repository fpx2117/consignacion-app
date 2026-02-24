// src/lib/dolarBlue.ts

export interface DolarBlueResponse {
    compra: number;
    venta: number;
    casa: string;
    nombre: string;
    moneda: string;
    fechaActualizacion: string;
}

export async function fetchDolarBlue(): Promise<number> {
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/blue', {
            // Next.js caching strategy to avoid rate limits, cache for 1 hour
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            throw new Error(`Error fetching Dolar Blue: ${response.status}`);
        }

        const data: DolarBlueResponse = await response.json();
        // Return the 'venta' price as it represents the market rate to buy USD with ARS
        return data.venta || 1; // Fallback to 1 to prevent multiplying by 0 or NaN 
    } catch (error) {
        console.error('Failed to fetch Dolar Blue:', error);
        return 1200; // Fallback hardcoded rate in case the API goes down completely
    }
}
