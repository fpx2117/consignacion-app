import { prisma } from './src/lib/prisma'

async function main() {
    try {
        console.log('--- Checking UserSession with new fields ---')
        // Check if the client knows about the new fields
        const sessions = await prisma.userSession.findMany({
            take: 1,
            select: {
                id: true,
                browser: true,
                os: true,
                device: true,
                ipAddress: true
            }
        })
        console.log('Fields accessible. Count:', sessions.length)
        console.log('--- DB Check OK ---')
    } catch (err: any) {
        console.error('DB Check FAILED:', err.message)
    } finally {
        await prisma.$disconnect()
    }
}

main()
