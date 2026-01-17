import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Grid size
const GRID_SIZE = 25 // 5x5

// Sabit bahis limitleri - değiştirilemez
const FIXED_MIN_BET = 10
const FIXED_MAX_BET = 500

// In-memory game sessions (in production, use Redis)
const gameSessions = new Map<string, {
  odUnderuserId: number
  bet: number
  mineCount: number
  minePositions: number[]
  revealedPositions: number[]
  currentMultiplier: number
  createdAt: number
  completed: boolean
}>()

// Rate limiting
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 120 // Max 120 requests per minute

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now()
  const maxAge = 30 * 60 * 1000 // 30 minutes
  for (const [gameId, session] of gameSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      gameSessions.delete(gameId)
    }
  }
}, 5 * 60 * 1000) // Run every 5 minutes

// Calculate multiplier
function calculateMultiplier(mineCount: number, revealedCount: number): number {
  if (revealedCount === 0) return 1

  const safeSpots = GRID_SIZE - mineCount
  let multiplier = 1

  for (let i = 0; i < revealedCount; i++) {
    const remainingSafe = safeSpots - i
    const remainingTotal = GRID_SIZE - i
    // House edge of ~3%
    multiplier *= (remainingTotal / remainingSafe) * 0.97
  }

  return Math.round(multiplier * 100) / 100
}

// Generate random mine positions
function generateMinePositions(mineCount: number): number[] {
  const positions: number[] = []
  const available = Array.from({ length: GRID_SIZE }, (_, i) => i)

  for (let i = 0; i < mineCount; i++) {
    const randomIndex = Math.floor(Math.random() * available.length)
    positions.push(available[randomIndex])
    available.splice(randomIndex, 1)
  }

  return positions
}

// Generate unique game ID
function generateGameId(): string {
  return `mines_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Yardımcı fonksiyon: DB'den ayar değerini al
function getSettingValue(settings: { key: string; value: string }[], key: string, defaultValue: string): string {
  const setting = settings.find(s => s.key === key)
  return setting?.value ?? defaultValue
}

// Get game settings - Mines için ayrı enabled ayarı
async function getGameSettings() {
  try {
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: ['game_mines_enabled']
        }
      }
    })

    return {
      enabled: getSettingValue(settings, 'game_mines_enabled', 'true') === 'true',
      // Sabit değerler - DB'den okunmaz
      maxBet: FIXED_MAX_BET,
      minBet: FIXED_MIN_BET
    }
  } catch {
    return {
      enabled: true,
      maxBet: FIXED_MAX_BET,
      minBet: FIXED_MIN_BET
    }
  }
}

// Rate limit check
function checkRateLimit(userId: number): boolean {
  const key = `mines_${userId}`
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now - record.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, lastReset: now })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const userId = session.user.id

    // Rate limit check
    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: 'Çok fazla istek. Lütfen bekleyin.' }, { status: 429 })
    }

    const body = await request.json()
    const { action, gameId, bet, mineCount, cellId } = body

    // Get game settings - Mines için ayrı enabled kontrolü
    const settings = await getGameSettings()

    if (!settings.enabled) {
      return NextResponse.json({ error: 'Mines oyunu şu anda kapalı' }, { status: 400 })
    }

    // Handle different actions
    switch (action) {
      case 'start': {
        // Validate bet - Sabit değerler kullanılır
        if (!bet || bet < FIXED_MIN_BET) {
          return NextResponse.json({ error: `Minimum bahis ${FIXED_MIN_BET} puan` }, { status: 400 })
        }
        if (bet > FIXED_MAX_BET) {
          return NextResponse.json({ error: `Maksimum bahis ${FIXED_MAX_BET} puan` }, { status: 400 })
        }

        // Validate mine count
        if (!mineCount || mineCount < 1 || mineCount > 24) {
          return NextResponse.json({ error: 'Geçersiz mayın sayısı' }, { status: 400 })
        }

        // Get user and check balance
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { points: true }
        })

        if (!user || user.points < bet) {
          return NextResponse.json({ error: 'Yetersiz puan' }, { status: 400 })
        }

        // Check for existing active game
        for (const [existingGameId, existingSession] of gameSessions.entries()) {
          if (existingSession.odUnderuserId === userId && !existingSession.completed) {
            // Complete the old game as loss
            gameSessions.delete(existingGameId)
          }
        }

        // Deduct bet from user
        await prisma.user.update({
          where: { id: userId },
          data: { points: { decrement: bet } }
        })

        // Generate mines and create session
        const minePositions = generateMinePositions(mineCount)
        const newGameId = generateGameId()

        gameSessions.set(newGameId, {
          odUnderuserId: userId,
          bet,
          mineCount,
          minePositions,
          revealedPositions: [],
          currentMultiplier: 1,
          createdAt: Date.now(),
          completed: false
        })

        return NextResponse.json({
          success: true,
          gameId: newGameId
        })
      }

      case 'reveal': {
        if (!gameId || cellId === undefined) {
          return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
        }

        const gameSession = gameSessions.get(gameId)
        if (!gameSession) {
          return NextResponse.json({ error: 'Oyun bulunamadı' }, { status: 400 })
        }

        if (gameSession.odUnderuserId !== userId) {
          return NextResponse.json({ error: 'Bu oyuna erişim yetkiniz yok' }, { status: 403 })
        }

        if (gameSession.completed) {
          return NextResponse.json({ error: 'Bu oyun zaten tamamlandı' }, { status: 400 })
        }

        if (gameSession.revealedPositions.includes(cellId)) {
          return NextResponse.json({ error: 'Bu kare zaten açıldı' }, { status: 400 })
        }

        if (cellId < 0 || cellId >= GRID_SIZE) {
          return NextResponse.json({ error: 'Geçersiz kare' }, { status: 400 })
        }

        // Check if it's a mine
        const isMine = gameSession.minePositions.includes(cellId)

        if (isMine) {
          // Game over - player loses
          gameSession.completed = true

          return NextResponse.json({
            success: true,
            isMine: true,
            minePositions: gameSession.minePositions
          })
        }

        // Safe cell - update session
        gameSession.revealedPositions.push(cellId)
        const newMultiplier = calculateMultiplier(gameSession.mineCount, gameSession.revealedPositions.length)
        gameSession.currentMultiplier = newMultiplier

        const potentialWin = Math.floor(gameSession.bet * newMultiplier)

        return NextResponse.json({
          success: true,
          isMine: false,
          multiplier: newMultiplier,
          potentialWin,
          revealedCount: gameSession.revealedPositions.length
        })
      }

      case 'cashout': {
        if (!gameId) {
          return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
        }

        const gameSession = gameSessions.get(gameId)
        if (!gameSession) {
          return NextResponse.json({ error: 'Oyun bulunamadı' }, { status: 400 })
        }

        if (gameSession.odUnderuserId !== userId) {
          return NextResponse.json({ error: 'Bu oyuna erişim yetkiniz yok' }, { status: 403 })
        }

        if (gameSession.completed) {
          return NextResponse.json({ error: 'Bu oyun zaten tamamlandı' }, { status: 400 })
        }

        if (gameSession.revealedPositions.length === 0) {
          return NextResponse.json({ error: 'En az bir kare açmalısınız' }, { status: 400 })
        }

        // Calculate winnings
        const winAmount = Math.floor(gameSession.bet * gameSession.currentMultiplier)

        // Mark game as completed
        gameSession.completed = true

        // Add winnings to user
        await prisma.user.update({
          where: { id: userId },
          data: { points: { increment: winAmount } }
        })

        return NextResponse.json({
          success: true,
          winAmount,
          minePositions: gameSession.minePositions
        })
      }

      default:
        return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Mines API error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
