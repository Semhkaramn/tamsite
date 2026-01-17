import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// Yardımcı fonksiyon: DB'den ayar değerini al
function getSettingValue(settings: { key: string; value: string }[], key: string, defaultValue: string): string {
  const setting = settings.find(s => s.key === key)
  return setting?.value ?? defaultValue
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission(request, 'canAccessGames')
    if (authCheck.error) return authCheck.error
    const admin = authCheck.admin!

    // DB'den tüm oyun ayarlarını çek
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: [
            'game_blackjack_enabled',
            'game_mines_enabled'
          ]
        }
      }
    })

    // Aktif oyun sayısı
    const activeBlackjackGames = await prisma.blackjackGame.count({
      where: { status: 'active' }
    })

    // İstatistikler için tamamlanmış oyunları al
    const completedGames = await prisma.blackjackGame.findMany({
      where: { status: 'completed' },
      select: {
        result: true,
        betAmount: true,
        splitBetAmount: true,
        payout: true
      }
    })

    // İstatistikleri hesapla
    const wins = completedGames.filter(g => g.result === 'win').length
    const losses = completedGames.filter(g => g.result === 'lose').length
    const pushes = completedGames.filter(g => g.result === 'push').length
    const blackjacks = completedGames.filter(g => g.result === 'blackjack').length
    const totalBet = completedGames.reduce((sum, g) => sum + g.betAmount + g.splitBetAmount, 0)
    const totalPayout = completedGames.reduce((sum, g) => sum + (g.payout || 0), 0)
    const houseProfit = totalBet - totalPayout

    return NextResponse.json({
      settings: {
        blackjack: {
          enabled: getSettingValue(settings, 'game_blackjack_enabled', 'true') === 'true',
        },
        mines: {
          enabled: getSettingValue(settings, 'game_mines_enabled', 'true') === 'true',
        }
      },
      activeGames: {
        blackjack: activeBlackjackGames
      },
      statistics: {
        totalGames: completedGames.length + activeBlackjackGames,
        completedGames: completedGames.length,
        wins,
        losses,
        pushes,
        blackjacks,
        winRate: completedGames.length > 0
          ? Math.round(((wins + blackjacks) / completedGames.length) * 100)
          : 0,
        totalBet,
        totalPayout,
        houseProfit,
        houseProfitPercent: totalBet > 0 ? Math.round((houseProfit / totalBet) * 100) : 0
      }
    })
  } catch (error) {
    console.error('Error fetching game settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authCheck = await requirePermission(request, 'canAccessGames')
    if (authCheck.error) return authCheck.error
    const admin = authCheck.admin!

    const { game, settings } = await request.json()

    // Blackjack oyunu ayarları
    if (game === 'blackjack') {
      if (settings.enabled !== undefined) {
        await prisma.settings.upsert({
          where: { key: 'game_blackjack_enabled' },
          update: { value: settings.enabled ? 'true' : 'false' },
          create: {
            key: 'game_blackjack_enabled',
            value: settings.enabled ? 'true' : 'false',
            description: 'Blackjack oyunu durumu',
            category: 'games'
          }
        })

        console.log(`[Admin] ${admin.username} blackjack enabled: ${settings.enabled}`)
        return NextResponse.json({ success: true })
      }
    }

    // Mines oyunu ayarları
    if (game === 'mines') {
      if (settings.enabled !== undefined) {
        await prisma.settings.upsert({
          where: { key: 'game_mines_enabled' },
          update: { value: settings.enabled ? 'true' : 'false' },
          create: {
            key: 'game_mines_enabled',
            value: settings.enabled ? 'true' : 'false',
            description: 'Mines oyunu durumu',
            category: 'games'
          }
        })

        console.log(`[Admin] ${admin.username} mines enabled: ${settings.enabled}`)
        return NextResponse.json({ success: true })
      }
    }

    return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
  } catch (error) {
    console.error('Error updating game settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
