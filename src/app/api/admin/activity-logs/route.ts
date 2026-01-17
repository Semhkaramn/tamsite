import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// Action type'lara göre icon ve renk mapping'i
const actionTypeMapping: Record<string, { icon: string; color: string; label: string }> = {
  'wallet_add': { icon: 'wallet', color: 'emerald', label: 'Cüzdan Ekleme' },
  'wallet_update': { icon: 'wallet', color: 'blue', label: 'Cüzdan Güncelleme' },
  'wallet_delete': { icon: 'wallet', color: 'rose', label: 'Cüzdan Silme' },
  'sponsor_add': { icon: 'sponsor', color: 'purple', label: 'Sponsor Ekleme' },
  'sponsor_update': { icon: 'sponsor', color: 'blue', label: 'Sponsor Güncelleme' },
  'sponsor_delete': { icon: 'sponsor', color: 'rose', label: 'Sponsor Silme' },
  'event_join': { icon: 'calendar', color: 'blue', label: 'Etkinlik Katılım' },
  'event_win': { icon: 'trophy', color: 'amber', label: 'Etkinlik Kazanma' },
  'ticket_request': { icon: 'ticket', color: 'amber', label: 'Bilet Talebi' },
  'ticket_approved': { icon: 'ticket', color: 'emerald', label: 'Bilet Onay' },
  'ticket_rejected': { icon: 'ticket', color: 'rose', label: 'Bilet Red' },
  'wheel_spin': { icon: 'wheel', color: 'orange', label: 'Çark Çevirme' },
  'task_complete': { icon: 'task', color: 'cyan', label: 'Görev Tamamlama' },
  'purchase': { icon: 'shopping', color: 'emerald', label: 'Satın Alma' },
  'promocode_use': { icon: 'promocode', color: 'amber', label: 'Promocode' },
  'telegram_link': { icon: 'telegram', color: 'blue', label: 'Telegram Bağlantı' },
  'telegram_unlink': { icon: 'telegram', color: 'rose', label: 'Telegram Koparma' },
  'register': { icon: 'user', color: 'emerald', label: 'Kayıt' },
  'login': { icon: 'user', color: 'blue', label: 'Giriş' },
  'password_change': { icon: 'admin', color: 'blue', label: 'Şifre Değişikliği' },
  'avatar_change': { icon: 'user', color: 'purple', label: 'Avatar Değişikliği' },
  'admin_points_add': { icon: 'admin', color: 'emerald', label: 'Admin Puan Ekleme' },
  'admin_points_remove': { icon: 'admin', color: 'rose', label: 'Admin Puan Çıkarma' },
  'admin_ban': { icon: 'admin', color: 'rose', label: 'Ban' },
  'admin_unban': { icon: 'admin', color: 'emerald', label: 'Ban Kaldırma' },
  'randy_win': { icon: 'randy', color: 'amber', label: 'Randy Kazanma' },
  'rank_up': { icon: 'trophy', color: 'purple', label: 'Rütbe Yükselme' },
  'blackjack_play': { icon: 'game', color: 'orange', label: 'Blackjack' }
}

// Blackjack sonuç başlıkları
const blackjackResultTitles: Record<string, string> = {
  blackjack: 'Blackjack - BLACKJACK!',
  win: 'Blackjack - Kazandın',
  lose: 'Blackjack - Kaybettin',
  push: 'Blackjack - Berabere',
  timeout: 'Blackjack - Zaman Aşımı'
}

// Blackjack oyununu activity log formatına dönüştür
function formatBlackjackGameAsLog(game: any, user: any) {
  const mapping = actionTypeMapping['blackjack_play']

  // Açıklama oluştur
  let description = ''
  const scoreInfo = game.playerScore !== null && game.dealerScore !== null
    ? ` | Skorlar: Oyuncu ${game.playerScore} vs Krupiye ${game.dealerScore}`
    : ''

  const totalBet = game.betAmount + (game.splitBetAmount || 0)
  const payout = game.payout || 0
  const pointChange = game.balanceAfter !== null && game.balanceBefore !== null
    ? game.balanceAfter - game.balanceBefore
    : payout - totalBet

  if (game.result === 'blackjack') {
    description = `BLACKJACK! 🎉 | Bahis: ${totalBet} | Kazanç: +${payout} (3:2)${scoreInfo}`
  } else if (game.result === 'win') {
    description = `Kazanç! | Bahis: ${totalBet} | Kazanç: +${payout}${scoreInfo}`
  } else if (game.result === 'push') {
    description = `Berabere | Bahis: ${totalBet} (iade)${scoreInfo}`
  } else if (game.result === 'timeout') {
    description = `Zaman aşımı | Bahis: ${totalBet} puan iade edildi`
  } else {
    description = `Kayıp | Bahis: ${totalBet} kaybedildi${scoreInfo}`
  }

  // Puan bilgisi ekle
  if (game.balanceBefore !== null && game.balanceAfter !== null) {
    description += ` | Önceki: ${game.balanceBefore.toLocaleString('tr-TR')} → Sonraki: ${game.balanceAfter.toLocaleString('tr-TR')} (${pointChange >= 0 ? '+' : ''}${pointChange.toLocaleString('tr-TR')})`
  }

  // Aksiyonlar varsa ekle
  let actions = null
  try {
    actions = game.actions ? JSON.parse(game.actions) : null
  } catch (e) {
    actions = null
  }
  if (actions && Array.isArray(actions) && actions.length > 0) {
    description += ` | Aksiyonlar: ${actions.join(' → ')}`
  }

  // Double/Split bilgisi ekle
  if (game.isDoubleDown) {
    description += ' | Double Down yapıldı'
  }
  if (game.isSplit) {
    description += ' | Split yapıldı'
  }

  // Kartları parse et
  let playerCards = null
  let dealerCards = null
  try {
    playerCards = game.playerCards ? JSON.parse(game.playerCards) : null
    dealerCards = game.dealerCards ? JSON.parse(game.dealerCards) : null
  } catch (e) {
    // JSON parse hatası - null bırak
  }

  return {
    id: `bj_${game.id}`, // Blackjack oyunu olduğunu belirtmek için prefix
    userId: game.userId,
    user: user ? {
      siteUsername: user.siteUsername,
      email: user.email,
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      avatar: user.avatar
    } : null,
    actionType: 'blackjack_play',
    actionLabel: mapping.label,
    actionTitle: blackjackResultTitles[game.result] || 'Blackjack',
    actionDescription: description,
    icon: mapping.icon,
    color: mapping.color,
    oldValue: game.balanceBefore !== null ? String(game.balanceBefore) : null,
    newValue: game.balanceAfter !== null ? String(game.balanceAfter) : null,
    relatedId: game.id,
    relatedType: 'blackjack_game',
    metadata: {
      game: 'blackjack',
      gameId: game.odunId,
      result: game.result,
      splitResult: game.splitResult,
      betAmount: game.betAmount,
      splitBetAmount: game.splitBetAmount,
      payout: game.payout,
      balanceBefore: game.balanceBefore,
      balanceAfter: game.balanceAfter,
      playerScore: game.playerScore,
      dealerScore: game.dealerScore,
      playerCards,
      dealerCards,
      actions,
      isDoubleDown: game.isDoubleDown,
      isSplit: game.isSplit,
      gameDuration: game.gameDuration
    },
    ipAddress: game.ipAddress,
    createdAt: game.completedAt || game.createdAt
  }
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission(request, 'canAccessActivityLogs')
    if (authCheck.error) return authCheck.error

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Filters
    const actionType = searchParams.get('actionType') || ''
    const userId = searchParams.get('userId') || ''
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Sadece blackjack_play mı isteniyor?
    const onlyBlackjack = actionType === 'blackjack_play'
    // Blackjack hariç diğer log türleri mi isteniyor?
    const excludeBlackjack = actionType && actionType !== 'all' && actionType !== 'blackjack_play'

    // Build where clause for UserActivityLog
    const where: any = {}

    if (actionType && actionType !== 'all') {
      // Blackjack için UserActivityLog'da arama yapma (BlackjackGame tablosundan alacağız)
      if (actionType !== 'blackjack_play') {
        where.actionType = actionType
      }
    }

    if (userId) {
      where.userId = userId
    }

    if (search) {
      where.OR = [
        { actionTitle: { contains: search, mode: 'insensitive' } },
        { actionDescription: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        where.createdAt.gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // BlackjackGame için where clause
    const blackjackWhere: any = {
      status: { in: ['completed', 'timeout'] } // Tamamlanmış ve zaman aşımı oyunlar
    }

    if (userId) {
      blackjackWhere.userId = userId
    }

    if (startDate || endDate) {
      blackjackWhere.completedAt = {}
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        blackjackWhere.completedAt.gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        blackjackWhere.completedAt.lte = end
      }
    }

    // Search blackjack games by username
    if (search) {
      blackjackWhere.siteUsername = { contains: search, mode: 'insensitive' }
    }

    // Paralel sorgular
    const queries: Promise<any>[] = []

    // UserActivityLog sorguları (blackjack_play hariç, çünkü artık BlackjackGame tablosundan alıyoruz)
    if (!onlyBlackjack) {
      // blackjack_play'i UserActivityLog'dan hariç tut (artık BlackjackGame tablosundan alınıyor)
      const activityLogWhere = { ...where }
      if (!excludeBlackjack) {
        activityLogWhere.actionType = { not: 'blackjack_play' }
      }

      queries.push(
        prisma.userActivityLog.findMany({
          where: activityLogWhere,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            userId: true,
            actionType: true,
            actionTitle: true,
            actionDescription: true,
            oldValue: true,
            newValue: true,
            relatedId: true,
            relatedType: true,
            metadata: true,
            ipAddress: true,
            createdAt: true
          }
        })
      )
      queries.push(prisma.userActivityLog.count({ where: activityLogWhere }))
    } else {
      queries.push(Promise.resolve([]))
      queries.push(Promise.resolve(0))
    }

    // BlackjackGame sorguları
    if (!excludeBlackjack) {
      queries.push(
        prisma.blackjackGame.findMany({
          where: blackjackWhere,
          orderBy: { completedAt: sortOrder as 'asc' | 'desc' },
          select: {
            id: true,
            odunId: true,
            userId: true,
            siteUsername: true,
            betAmount: true,
            splitBetAmount: true,
            result: true,
            splitResult: true,
            payout: true,
            balanceBefore: true,
            balanceAfter: true,
            playerScore: true,
            dealerScore: true,
            playerCards: true,
            dealerCards: true,
            actions: true,
            isDoubleDown: true,
            isSplit: true,
            gameDuration: true,
            ipAddress: true,
            createdAt: true,
            completedAt: true
          }
        })
      )
      queries.push(prisma.blackjackGame.count({ where: blackjackWhere }))
    } else {
      queries.push(Promise.resolve([]))
      queries.push(Promise.resolve(0))
    }

    // Action type counts (UserActivityLog'dan - blackjack_play hariç)
    queries.push(
      prisma.userActivityLog.groupBy({
        by: ['actionType'],
        where: { actionType: { not: 'blackjack_play' } },
        _count: { actionType: true }
      })
    )

    // Blackjack count (ayrı sorgu) - completed ve timeout dahil
    queries.push(prisma.blackjackGame.count({ where: { status: { in: ['completed', 'timeout'] } } }))

    const [logs, logCount, blackjackGames, blackjackCount, actionTypeCounts, totalBlackjackCount] = await Promise.all(queries)

    // Get user details for all logs
    const allUserIds = new Set<string>()
    logs.forEach((log: any) => allUserIds.add(log.userId))
    blackjackGames.forEach((game: any) => allUserIds.add(game.userId))

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: {
        id: true,
        siteUsername: true,
        email: true,
        telegramUsername: true,
        firstName: true,
        avatar: true
      }
    })

    const userMap = new Map(users.map((u: any) => [u.id, u]))

    // Format UserActivityLog logs
    const formattedLogs = logs.map((log: any) => {
      const mapping = actionTypeMapping[log.actionType] || { icon: 'activity', color: 'slate', label: log.actionType }
      const user = userMap.get(log.userId)

      let metadata = null
      try {
        metadata = log.metadata ? JSON.parse(log.metadata) : null
      } catch (e) {
        metadata = null
      }

      return {
        id: log.id,
        userId: log.userId,
        user: user ? {
          siteUsername: user.siteUsername,
          email: user.email,
          telegramUsername: user.telegramUsername,
          firstName: user.firstName,
          avatar: user.avatar
        } : null,
        actionType: log.actionType,
        actionLabel: mapping.label,
        actionTitle: log.actionTitle,
        actionDescription: log.actionDescription,
        icon: mapping.icon,
        color: mapping.color,
        oldValue: log.oldValue,
        newValue: log.newValue,
        relatedId: log.relatedId,
        relatedType: log.relatedType,
        metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt
      }
    })

    // Format BlackjackGame logs
    const formattedBlackjackLogs = blackjackGames.map((game: any) => {
      const user = userMap.get(game.userId)
      return formatBlackjackGameAsLog(game, user)
    })

    // Tüm logları birleştir ve sırala
    let allLogs = [...formattedLogs, ...formattedBlackjackLogs]

    // Tarihe göre sırala
    allLogs.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })

    // Pagination uygula
    const totalCount = (logCount as number) + (blackjackCount as number)
    const paginatedLogs = allLogs.slice(skip, skip + limit)

    // Format action type counts - blackjack'i ayrı ekle
    const actionTypeStats = [
      ...actionTypeCounts.map((item: any) => ({
        actionType: item.actionType,
        label: actionTypeMapping[item.actionType]?.label || item.actionType,
        count: item._count.actionType
      })),
      {
        actionType: 'blackjack_play',
        label: 'Blackjack',
        count: totalBlackjackCount
      }
    ].sort((a, b) => b.count - a.count)

    return NextResponse.json({
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      actionTypeStats,
      actionTypeMapping
    })
  } catch (error) {
    console.error('Activity logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
