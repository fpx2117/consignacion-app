import { prisma } from './src/lib/prisma';
import fs from 'fs';

async function main() {
    const result = await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5`;
    fs.writeFileSync('mig_status.json', JSON.stringify(result, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
