import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminSession, hasPermission } from '@/lib/admin-middleware'
import { logAdminActivity, AdminAction } from '@/lib/services/activity-log-service'

// Yardımcı fonksiyon: DB'den ayar değerini al
function getSettingValue(settings: { key: string; value: string }[], key: string, defaultValue: string): string {
  const setting = settings.find(s => s.key === key)
  return setting?.value ?? defaultValue
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminSession(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(admin, 'canAccessGames')) {
      return NextResponse.json({ error: 'Bu sayfaya erişim yetkiniz yok' }, { status: 403 })
    }

    // DB'den tüm blackjack ayarlarını çek
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          startsWith: 'game_blackjack_'
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
          maxBet: parseInt(getSettingValue(settings, 'game_blackjack_max_bet', '500')),
          minBet: parseInt(getSettingValue(settings, 'game_blackjack_min_bet', '10')),
          pendingDisable: getSettingValue(settings, 'game_blackjack_pending_disable', 'false') === 'true',
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
    const admin = await verifyAdminSession(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(admin, 'canAccessGames')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { game, settings } = await request.json()

    if (game === 'blackjack') {
      const updates: { key: string; value: string; description: string }[] = []

      // Enabled ayarı
      if (settings.enabled !== undefined) {
        // Eğer kapatılıyorsa ve aktif oyun varsa, pending_disable yap
        if (!settings.enabled) {
          const activeGames = await prisma.blackjackGame.count({
            where: { status: 'active' }
          })

          if (activeGames > 0) {
            // Pending disable moduna al
            updates.push({
              key: 'game_blackjack_pending_disable',
              value: 'true',
              description: 'Blackjack bekleyen kapatma durumu'
            })
          } else {
            // Hemen kapat
            updates.push({
              key: 'game_blackjack_enabled',
              value: 'false',
              description: 'Blackjack oyunu durumu'
            })
            updates.push({
              key: 'game_blackjack_pending_disable',
              value: 'false',
              description: 'Blackjack bekleyen kapatma durumu'
            })
          }
        } else {
          // Açılıyorsa
          updates.push({
            key: 'game_blackjack_enabled',
            value: 'true',
            description: 'Blackjack oyunu durumu'
          })
          updates.push({
            key: 'game_blackjack_pending_disable',
            value: 'false',
            description: 'Blackjack bekleyen kapatma durumu'
          })
        }
      }

      // Max bet ayarı
      if (settings.maxBet !== undefined) {
        const maxBet = Math.max(1, parseInt(settings.maxBet) || 500)
        updates.push({
          key: 'game_blackjack_max_bet',
          value: maxBet.toString(),
          description: 'Blackjack maksimum bahis'
        })
      }

      // Min bet ayarı
      if (settings.minBet !== undefined) {
        const minBet = Math.max(1, parseInt(settings.minBet) || 10)
        updates.push({
          key: 'game_blackjack_min_bet',
          value: minBet.toString(),
          description: 'Blackjack minimum bahis'
        })
      }

      // Tüm güncellemeleri uygula
      for (const update of updates) {
        await prisma.settings.upsert({
          where: { key: update.key },
          update: { value: update.value },
          create: {
            key: update.key,
            value: update.value,
            description: update.description,
            category: 'games'
          }
        })
      }

      // Activity log
      await logAdminActivity({
        adminId: admin.id,
        action: AdminAction.SETTINGS_UPDATED,
        targetType: 'game_settings',
        details: {
          game: 'blackjack',
          changes: settings
        },
        request
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
  } catch (error) {
    console.error('Error updating game settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
