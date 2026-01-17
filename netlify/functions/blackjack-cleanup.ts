import { schedule } from '@netlify/functions'
import { getPrisma, disconnectPrisma } from './lib/prisma'

// Her 15 dakikada bir çalışır
const STALE_GAME_MINUTES = 30

const handler = schedule('*/15 * * * *', async () => {
  const prisma = getPrisma()

  try {
    const staleDate = new Date(Date.now() - STALE_GAME_MINUTES * 60 * 1000)

    // Eski active oyunları bul ve cancelled yap
    const staleGames = await prisma.blackjackGame.findMany({
      where: {
        status: 'active',
        createdAt: { lt: staleDate }
      },
      select: {
        id: true,
        odunId: true,
        siteUsername: true,
        betAmount: true,
        splitBetAmount: true
      }
    })

    if (staleGames.length === 0) {
      console.log('[Blackjack Cleanup] Temizlenecek eski oyun yok')
      await disconnectPrisma()
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No stale games found', cleanedCount: 0 })
      }
    }

    const result = await prisma.blackjackGame.updateMany({
      where: {
        status: 'active',
        createdAt: { lt: staleDate }
      },
      data: {
        status: 'cancelled',
        result: 'timeout',
        completedAt: new Date()
      }
    })

    console.log(`[Blackjack Cleanup] ${result.count} eski oyun temizlendi:`,
      staleGames.map(g => `${g.siteUsername || 'unknown'}: ${g.betAmount + g.splitBetAmount} puan`)
    )

    await disconnectPrisma()
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Cleaned ${result.count} stale games`,
        cleanedCount: result.count,
        games: staleGames.map(g => ({
          siteUsername: g.siteUsername,
          totalBet: g.betAmount + g.splitBetAmount
        }))
      })
    }

  } catch (error) {
    console.error('[Blackjack Cleanup] Error:', error)
    await disconnectPrisma()
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Cleanup failed' })
    }
  }
})

export { handler }
