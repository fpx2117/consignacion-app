
import { prisma } from "./src/lib/prisma";

async function main() {
    console.log("Checking prisma.gastoSucursal...");
    if (prisma.gastoSucursal) {
        console.log("prisma.gastoSucursal is DEFINED");
    } else {
        console.log("prisma.gastoSucursal is UNDEFINED");
    }

    console.log("Checking Gasto fields...");
    // Use prisma.$queryRaw or lookup the internal dmmf if possible, 
    // but a simple check of the client is better.
    try {
        const fields = (prisma as any)._dmmf?.modelMap?.Gasto?.fields;
        if (fields) {
            const hasEsCompartido = fields.some((f: any) => f.name === "esCompartido");
            console.log("Gasto has esCompartido:", hasEsCompartido);
        } else {
            console.log("Could not find Gasto model in DMMF");
        }
    } catch (e) {
        console.log("Error checking dmmf:", e);
    }
}

main().catch(console.error);
