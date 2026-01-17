import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Blackjack Cleanup API
 *
 * Status değerleri standardizasyonu:
 * - 'active': Oyun devam ediyor
 * - 'completed': Oyun normal şekilde tamamlandı (win/lose/push/blackjack)
 * - 'timeout': Zaman aşımı nedeniyle oyun sonlandırıldı ve bahis iade edildi
 *
 * NOT: 'cancelled' artık kullanılmıyor, tüm timeout durumları 'timeout' olarak işaretlenir.
 */

// 30 dakikadan eski active oyunları timeout olarak işaretle
// Bu endpoint admin tarafından veya cron job ile çağrılabilir
const STALE_GAME_MINUTES = 30

export async function POST(request: NextRequest) {
  try {
    // API key kontrolü (basit güvenlik)
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.CLEANUP_API_KEY || 'cleanup-secret-key'

    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const staleDate = new Date(Date.now() - STALE_GAME_MINUTES * 60 * 1000)

    // Eski active oyunları bul (userId dahil)
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
        splitBetAmount: true,
        createdAt: true
      }
    })

    if (staleGames.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Temizlenecek eski oyun bulunamadı',
        cleanedCount: 0
      })
    }

    // Her bir oyun için bahis iadesi yap ve cancelled olarak işaretle
    let totalRefunded = 0
    for (const game of staleGames) {
      try {
        await prisma.$transaction(async (tx) => {
          const totalBet = game.betAmount + game.splitBetAmount

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
                    description: 'Blackjack Zaman Aşımı İadesi (Cleanup)',
                    balanceBefore,
                    balanceAfter
                  }
                }
              }
            })

            totalRefunded += totalBet
          }

          // Oyunu timeout olarak işaretle - TUTARLI STATUS (diğer cleanup fonksiyonları ile aynı)
          await tx.blackjackGame.update({
            where: { id: game.id },
            data: {
              status: 'timeout', // FIXED: 'cancelled' yerine 'timeout' - tutarlılık için
              result: 'timeout',
              payout: totalBet,
              completedAt: new Date()
            }
          })
        })
      } catch (err) {
        console.error(`[Blackjack Cleanup] Oyun iade hatası (${game.odunId}):`, err)
      }
    }

    const result = { count: staleGames.length }

    console.log(`[Blackjack Cleanup] ${result.count} eski oyun temizlendi, toplam iade: ${totalRefunded}`, {
      games: staleGames.map(g => ({
        odunId: g.odunId,
        siteUsername: g.siteUsername,
        betAmount: g.betAmount,
        createdAt: g.createdAt
      }))
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} eski oyun temizlendi, ${totalRefunded} puan iade edildi`,
      cleanedCount: result.count,
      totalRefunded,
      cleanedGames: staleGames.map(g => ({
        odunId: g.odunId,
        siteUsername: g.siteUsername,
        betAmount: g.betAmount + g.splitBetAmount,
        createdAt: g.createdAt
      }))
    })

  } catch (error) {
    console.error('Blackjack cleanup error:', error)
    return NextResponse.json(
      { error: 'Temizleme sırasında hata oluştu' },
      { status: 500 }
    )
  }
}

// GET ile durum kontrolü
export async function GET() {
  try {
    const staleDate = new Date(Date.now() - STALE_GAME_MINUTES * 60 * 1000)

    const [activeCount, staleCount, totalCount] = await Promise.all([
      prisma.blackjackGame.count({ where: { status: 'active' } }),
      prisma.blackjackGame.count({
        where: {
          status: 'active',
          createdAt: { lt: staleDate }
        }
      }),
      prisma.blackjackGame.count()
    ])

    return NextResponse.json({
      activeGames: activeCount,
      staleGames: staleCount,
      totalGames: totalCount,
      staleThresholdMinutes: STALE_GAME_MINUTES
    })

  } catch (error) {
    console.error('Blackjack status error:', error)
    return NextResponse.json(
      { error: 'Durum kontrolü sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
