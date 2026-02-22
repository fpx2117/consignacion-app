import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const sessionCount = await prisma.userSession.count()
        console.log('Total sessions:', sessionCount)

        const sessions = await prisma.userSession.findMany({
            include: { user: true }
        })
        console.log('Sessions:', JSON.stringify(sessions, null, 2))
    } catch (error) {
        console.error('Database Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
