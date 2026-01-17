import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 30 dakikadan eski active oyunları cancelled olarak işaretle
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

    // Eski active oyunları bul
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

    // Oyunları cancelled olarak işaretle
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

    console.log(`[Blackjack Cleanup] ${result.count} eski oyun temizlendi`, {
      games: staleGames.map(g => ({
        odunId: g.odunId,
        siteUsername: g.siteUsername,
        betAmount: g.betAmount,
        createdAt: g.createdAt
      }))
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} eski oyun temizlendi`,
      cleanedCount: result.count,
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
