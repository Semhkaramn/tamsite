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
        userId: true,
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

    // Her bir oyun için bahis iadesi yap
    let totalRefunded = 0
    let cleanedCount = 0

    for (const game of staleGames) {
      try {
        const totalBet = game.betAmount + game.splitBetAmount

        await prisma.$transaction(async (tx: typeof prisma) => {
          // Kullanıcının puanını geri ver
          const user = await tx.user.findUnique({
            where: { id: game.userId },
            select: { points: true }
          })

          if (user && totalBet > 0) {
            const balanceBefore = user.points
            const balanceAfter = balanceBefore + totalBet

            await tx.user.update({
              where: { id: game.userId },
              data: {
                points: { increment: totalBet },
                pointHistory: {
                  create: {
                    amount: totalBet,
                    type: 'GAME_WIN',
                    description: 'Blackjack Zaman Aşımı İadesi',
                    balanceBefore,
                    balanceAfter
                  }
                }
              }
            })

            totalRefunded += totalBet
          }

          // Oyunu cancelled olarak işaretle
          await tx.blackjackGame.update({
            where: { id: game.id },
            data: {
              status: 'cancelled',
              result: 'timeout',
              payout: totalBet,
              completedAt: new Date()
            }
          })
        })

        cleanedCount++
      } catch (err) {
        console.error(`[Blackjack Cleanup] Oyun iade hatası (${game.odunId}):`, err)
      }
    }

    console.log(`[Blackjack Cleanup] ${cleanedCount} eski oyun temizlendi, toplam iade: ${totalRefunded}:`,
      staleGames.map(g => `${g.siteUsername || 'unknown'}: ${g.betAmount + g.splitBetAmount} puan`)
    )

    await disconnectPrisma()
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Cleaned ${cleanedCount} stale games, refunded ${totalRefunded} points`,
        cleanedCount,
        totalRefunded,
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
