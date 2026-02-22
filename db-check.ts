import { prisma } from './src/lib/prisma'

async function main() {
    try {
        console.log('--- Checking UserSession ---')
        const sessions = await (prisma as any).userSession.findMany({ take: 5 })
        console.log('Sessions found:', sessions.length)

        console.log('--- Checking AuditLog ---')
        const logs = await (prisma as any).auditLog.findMany({ take: 5 })
        console.log('Logs found:', logs.length)

        console.log('--- DB Check OK ---')
    } catch (err: any) {
        console.error('DB Check FAILED:', err.message)
        if (err.code) console.log('Prisma Error Code:', err.code)
    }
}

main()
