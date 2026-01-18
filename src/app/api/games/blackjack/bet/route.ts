import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { extractRequestInfo, logActivity } from '@/lib/services/activity-log-service'
import { getRedisClient } from '@/lib/telegram/utils/redis-client'

// Sabit bahis limitleri - değiştirilemez
const FIXED_MIN_BET = 10
const FIXED_MAX_BET = 500

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 dakika
const RATE_LIMIT_MAX = 60 // Dakikada max 60 istek
const ACTION_COOLDOWN = 1000 // 1 saniye cooldown (aynı action için)
const lastActionMap = new Map<string, { action: string; time: number }>()

// In-memory game lock (fallback when Redis unavailable)
const gameLocksMap = new Map<string, { timestamp: number; action: string }>()
const LOCK_TTL = 30000 // 30 saniye

// Oyun ayarları tipi (sadece enabled kontrolü için)
interface GameSettings {
  enabled: boolean
  pendingDisable: boolean
}

// Kart tipleri - server-side doğrulama için
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

interface Card {
  suit: Suit
  value: CardValue
  hidden?: boolean
  id?: string
}

// Ayarları cache'le - her 30 saniyede bir güncelle
let cachedSettings: GameSettings | null = null
let settingsCacheTime = 0
const SETTINGS_CACHE_TTL = 30000 // 30 saniye

// Yardımcı fonksiyon: DB'den ayar değerini al
function getSettingValue(settings: { key: string; value: string }[], key: string, defaultValue: string): string {
  const setting = settings.find(s => s.key === key)
  return setting?.value ?? defaultValue
}

// Cache'i temizle - ayarlar değiştiğinde çağrılabilir
export function clearGameSettingsCache() {
  cachedSettings = null
  settingsCacheTime = 0
}

// Oyun ayarlarını getir (sadece enabled kontrolü için - min/max sabit)
async function getGameSettings(): Promise<GameSettings> {
  const now = Date.now()

  // Cache'den döndür
  if (cachedSettings && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return cachedSettings
  }

  try {
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: ['game_blackjack_enabled', 'game_blackjack_pending_disable']
        }
      }
    })

    const gameSettings: GameSettings = {
      enabled: getSettingValue(settings, 'game_blackjack_enabled', 'true') === 'true',
      pendingDisable: getSettingValue(settings, 'game_blackjack_pending_disable', 'false') === 'true',
    }

    // pendingDisable true ise enabled false yap ve cache'i kısa tut
    if (gameSettings.pendingDisable) {
      gameSettings.enabled = false
      settingsCacheTime = now - SETTINGS_CACHE_TTL + 5000
    } else {
      settingsCacheTime = now
    }

    cachedSettings = gameSettings

    return gameSettings
  } catch (error) {
    console.error('Error fetching game settings:', error)
    return {
      enabled: true,
      pendingDisable: false
    }
  }
}

// Distributed lock with Redis - FIXED
async function acquireGameLock(gameId: string, action: string): Promise<boolean> {
  const redis = getRedisClient()
  const lockKey = `blackjack:lock:${gameId}`

  if (redis) {
    try {
      const result = await redis.set(lockKey, `${action}:${Date.now()}`, { nx: true, ex: 30 })
      // FIXED: result === null means lock was NOT acquired (key already exists)
      return result === 'OK'
    } catch (error) {
      console.error('[Blackjack Lock] Redis error:', error)
      // Fall through to in-memory lock
    }
  }

  // In-memory fallback (only works for single instance)
  const now = Date.now()
  const existingLock = gameLocksMap.get(gameId)

  if (existingLock && now - existingLock.timestamp < LOCK_TTL) {
    console.log(`[Blackjack Lock] In-memory lock exists for ${gameId}: ${existingLock.action}`)
    return false
  }

  gameLocksMap.set(gameId, { timestamp: now, action })
  return true
}

async function releaseGameLock(gameId: string): Promise<void> {
  const redis = getRedisClient()
  const lockKey = `blackjack:lock:${gameId}`

  if (redis) {
    try {
      await redis.del(lockKey)
    } catch (error) {
      console.error('[Blackjack Lock] Redis release error:', error)
    }
  }

  gameLocksMap.delete(gameId)
}

// Cleanup old in-memory locks periodically
setInterval(() => {
  const now = Date.now()
  for (const [gameId, lock] of gameLocksMap.entries()) {
    if (now - lock.timestamp > LOCK_TTL) {
      gameLocksMap.delete(gameId)
    }
  }
}, 60000)

// Redis-based rate limiter with in-memory fallback
async function checkRateLimit(userId: string): Promise<boolean> {
  const redis = getRedisClient()
  const rateLimitKey = `blackjack:ratelimit:${userId}`

  if (redis) {
    try {
      const count = await redis.incr(rateLimitKey)

      // İlk istek ise TTL ayarla
      if (count === 1) {
        await redis.expire(rateLimitKey, Math.ceil(RATE_LIMIT_WINDOW / 1000))
      }

      if (count > RATE_LIMIT_MAX) {
        console.log(`[Blackjack RateLimit] Redis: User ${userId} exceeded limit (${count}/${RATE_LIMIT_MAX})`)
        return false
      }

      return true
    } catch (error) {
      console.error('[Blackjack RateLimit] Redis error, falling back to in-memory:', error)
      // Redis hatası durumunda in-memory'ye düş
    }
  }

  // In-memory fallback
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now - userLimit.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { count: 1, lastReset: now })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false
  }

  userLimit.count++
  return true
}

// Redis-based action cooldown with in-memory fallback
async function checkActionCooldown(userId: string, action: string): Promise<boolean> {
  const redis = getRedisClient()
  const cooldownKey = `blackjack:cooldown:${userId}:${action}`

  if (redis) {
    try {
      const exists = await redis.exists(cooldownKey)

      if (exists) {
        return false
      }

      // Cooldown ayarla
      await redis.set(cooldownKey, '1', { ex: Math.ceil(ACTION_COOLDOWN / 1000) })
      return true
    } catch (error) {
      console.error('[Blackjack Cooldown] Redis error, falling back to in-memory:', error)
    }
  }

  // In-memory fallback
  const now = Date.now()
  const key = `${userId}_${action}`
  const lastAction = lastActionMap.get(key)

  if (lastAction && now - lastAction.time < ACTION_COOLDOWN) {
    return false
  }

  lastActionMap.set(key, { action, time: now })
  return true
}

// ========== SERVER-SIDE KART HESAPLAMA FONKSİYONLARI ==========

// El değerini hesapla
function calculateHandValue(hand: Card[]): number {
  let value = 0
  let aces = 0

  for (const card of hand) {
    if (card.hidden) continue

    if (card.value === 'A') {
      aces++
      value += 11
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10
    } else {
      value += Number.parseInt(card.value)
    }
  }

  // As ayarlaması
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

// Natural blackjack kontrolü
function isNaturalBlackjack(hand: Card[]): boolean {
  if (hand.length !== 2) return false
  const hasAce = hand.some(c => c.value === 'A')
  const hasTenValue = hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.value))
  return hasAce && hasTenValue
}

// Oyun sonucunu belirle - SERVER SIDE
function determineGameResult(
  playerHand: Card[],
  dealerHand: Card[],
  isSplitHand = false
): 'win' | 'lose' | 'push' | 'blackjack' {
  const playerValue = calculateHandValue(playerHand)
  const dealerValue = calculateHandValue(dealerHand)

  // Bust kontrolü
  if (playerValue > 21) return 'lose'

  // Natural blackjack kontrolü (split hand için blackjack olmaz)
  if (!isSplitHand && playerHand.length === 2 && isNaturalBlackjack(playerHand)) {
    if (dealerHand.length === 2 && isNaturalBlackjack(dealerHand)) {
      return 'push'
    }
    return 'blackjack'
  }

  // Dealer blackjack kontrolü
  if (dealerHand.length === 2 && isNaturalBlackjack(dealerHand)) {
    return 'lose'
  }

  // Normal karşılaştırma
  if (dealerValue > 21) return 'win'
  if (playerValue > dealerValue) return 'win'
  if (playerValue < dealerValue) return 'lose'
  return 'push'
}

// Ödeme hesaplama fonksiyonu - SERVER-SIDE
function calculatePayout(result: string, betAmount: number): number {
  switch (result) {
    case 'blackjack':
      return Math.floor(betAmount * 2.5)
    case 'win':
      return betAmount * 2
    case 'push':
      return betAmount
    case 'lose':
    default:
      return 0
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)

    if (!session) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    // Rate limit kontrolü (Redis-based with fallback)
    if (!(await checkRateLimit(session.userId))) {
      return NextResponse.json({ error: 'Çok fazla istek. Lütfen bekleyin.' }, { status: 429 })
    }

    // Oyun enabled kontrolü için ayarları getir
    const gameSettings = await getGameSettings()

    const {
      amount,
      action,
      result,
      betAmount,
      playerScore,
      dealerScore,
      gameId,
      playerCards,
      dealerCards,
      actions,
      isDoubleDown,
      isSplit,
      splitHands,
      gameDuration,
      handNumber,
      splitResult
    } = await request.json()
    const requestInfo = extractRequestInfo(request)

    // Action cooldown kontrolü (async fonksiyon)
    if (!(await checkActionCooldown(session.userId, action))) {
      return NextResponse.json({ error: 'Lütfen bekleyin' }, { status: 429 })
    }

    // ========== BET ACTION ==========
    if (action === 'bet' || action === 'double') {
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Geçersiz miktar' }, { status: 400 })
      }

      // Oyun kapalıysa yeni oyun başlatılamaz (sadece bet için kontrol)
      if (action === 'bet' && !gameSettings.enabled) {
        return NextResponse.json({ error: 'Blackjack oyunu şu anda kapalı' }, { status: 403 })
      }

      // Sabit min/max bahis kontrolü
      if (action === 'bet') {
        if (amount < FIXED_MIN_BET) {
          return NextResponse.json({ error: `Minimum bahis ${FIXED_MIN_BET} puandır` }, { status: 400 })
        }
        if (amount > FIXED_MAX_BET) {
          return NextResponse.json({ error: `Maksimum bahis ${FIXED_MAX_BET} puandır` }, { status: 400 })
        }
      }

      if (!gameId) {
        return NextResponse.json({ error: 'Oyun ID gerekli' }, { status: 400 })
      }

      const txResult = await prisma.$transaction(async (tx) => {
        const currentUser = await tx.user.findUnique({
          where: { id: session.userId },
          select: { points: true, siteUsername: true }
        })

        if (!currentUser) {
          throw new Error('Kullanıcı bulunamadı')
        }

        if (currentUser.points < amount) {
          throw new Error('Yetersiz puan')
        }

        const balanceBefore = currentUser.points
        const balanceAfter = balanceBefore - amount

        await tx.user.update({
          where: { id: session.userId },
          data: {
            points: { decrement: amount },
            pointHistory: {
              create: {
                amount: -amount,
                type: 'GAME_BET',
                description: action === 'double' ? 'Blackjack Double' : 'Blackjack Bahis',
                balanceBefore,
                balanceAfter
              }
            }
          }
        })

        if (action === 'bet') {
          const existingGame = await tx.blackjackGame.findUnique({
            where: { odunId: gameId }
          })

          if (existingGame) {
            throw new Error('Bu oyun ID zaten kullanılmış')
          }

          await tx.blackjackGame.create({
            data: {
              odunId: gameId,
              userId: session.userId,
              siteUsername: currentUser.siteUsername || null,
              betAmount: amount,
              status: 'active',
              balanceBefore: balanceBefore,
              gamePhase: 'playing',
              lastActionAt: new Date(),
              ipAddress: requestInfo.ipAddress,
              userAgent: requestInfo.userAgent
            }
          })
        }

        if (action === 'double') {
          const game = await tx.blackjackGame.findUnique({
            where: { odunId: gameId }
          })

          if (!game || game.status !== 'active') {
            throw new Error('Aktif oyun bulunamadı')
          }

          if (game.userId !== session.userId) {
            throw new Error('Bu oyun size ait değil')
          }

          // DOUBLE DOWN DOĞRULAMASI: Tam bahis miktarı gerekli
          const requiredAmount = isSplit ? game.splitBetAmount : game.betAmount
          if (amount !== requiredAmount) {
            throw new Error(`Double için tam bahis miktarı (${requiredAmount} puan) gerekli`)
          }

          if (requiredAmount <= 0) {
            throw new Error('Geçersiz bahis miktarı')
          }

          // Double update data
          const updateData: Record<string, unknown> = {
            isDoubleDown: true,
            lastActionAt: new Date()
          }

          if (isSplit) {
            updateData.splitBetAmount = game.splitBetAmount + amount
          } else {
            updateData.betAmount = game.betAmount + amount
          }

          await tx.blackjackGame.update({
            where: { odunId: gameId },
            data: updateData
          })
        }

        return { success: true, balanceBefore, balanceAfter }
      })

      return NextResponse.json({
        success: true,
        action: 'bet_placed',
        balanceBefore: txResult.balanceBefore,
        balanceAfter: txResult.balanceAfter
      })
    }

    // ========== SPLIT ACTION ==========
    if (action === 'split') {
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Geçersiz miktar' }, { status: 400 })
      }

      if (!gameId) {
        return NextResponse.json({ error: 'Oyun ID gerekli' }, { status: 400 })
      }

      const splitTxResult = await prisma.$transaction(async (tx) => {
        const game = await tx.blackjackGame.findUnique({
          where: { odunId: gameId }
        })

        if (!game || game.status !== 'active') {
          throw new Error('Aktif oyun bulunamadı')
        }

        if (game.userId !== session.userId) {
          throw new Error('Bu oyun size ait değil')
        }

        // SPLIT DOĞRULAMASI: Tam bahis miktarı gerekli
        if (amount !== game.betAmount) {
          throw new Error(`Split için tam bahis miktarı (${game.betAmount} puan) gerekli`)
        }

        const currentUser = await tx.user.findUnique({
          where: { id: session.userId },
          select: { points: true }
        })

        if (!currentUser || currentUser.points < amount) {
          throw new Error('Yetersiz puan')
        }

        const balanceBefore = currentUser.points
        const balanceAfter = balanceBefore - amount

        await tx.user.update({
          where: { id: session.userId },
          data: {
            points: { decrement: amount },
            pointHistory: {
              create: {
                amount: -amount,
                type: 'GAME_BET',
                description: 'Blackjack Split',
                balanceBefore,
                balanceAfter
              }
            }
          }
        })

        // Split update data
        const updateData: Record<string, unknown> = {
          splitBetAmount: amount,
          isSplit: true,
          gamePhase: 'playing_split',
          lastActionAt: new Date()
        }

        await tx.blackjackGame.update({
          where: { odunId: gameId },
          data: updateData
        })

        return { success: true, balanceBefore, balanceAfter }
      })

      return NextResponse.json({
        success: true,
        action: 'split_placed',
        balanceBefore: splitTxResult.balanceBefore,
        balanceAfter: splitTxResult.balanceAfter
      })
    }

    // ========== WIN ACTION ==========
    if (action === 'win') {
      if (!gameId) {
        return NextResponse.json({ error: 'Oyun ID gerekli' }, { status: 400 })
      }

      const lockAcquired = await acquireGameLock(gameId, 'win')
      if (!lockAcquired) {
        console.log(`[Blackjack] Win isteği engellendi - oyun zaten işleniyor: ${gameId}`)
        return NextResponse.json({ error: 'İstek zaten işleniyor' }, { status: 409 })
      }

      try {
        const transactionResult = await prisma.$transaction(async (tx) => {
          const game = await tx.blackjackGame.findUnique({
            where: { odunId: gameId }
          })

          if (!game) {
            throw new Error('Oyun bulunamadı')
          }

          if (game.status !== 'active') {
            throw new Error('Oyun zaten tamamlanmış')
          }

          if (game.userId !== session.userId) {
            throw new Error('Bu oyun size ait değil')
          }

          // Ödeme hesaplama - client'tan gelen sonuçları kullan
          let serverValidatedResult = result
          let serverValidatedSplitResult = splitResult
          let expectedPayout = 0

          // Ödeme hesaplama
          if (isSplit || game.isSplit) {
            // Split durumunda blackjack olmaz, win olarak hesapla
            const mainResultAdjusted = serverValidatedResult === 'blackjack' ? 'win' : serverValidatedResult
            const splitResultAdjusted = serverValidatedSplitResult === 'blackjack' ? 'win' : (serverValidatedSplitResult || 'lose')

            expectedPayout = calculatePayout(mainResultAdjusted, game.betAmount) +
              calculatePayout(splitResultAdjusted, game.splitBetAmount)
          } else {
            expectedPayout = calculatePayout(serverValidatedResult, game.betAmount)
          }

          // Ödeme tutarsızlığı kontrolü
          if (amount !== expectedPayout) {
            console.error('🚨 PAYOUT MISMATCH DETECTED!', {
              expected: expectedPayout,
              received: amount,
              gameId,
              serverResult: serverValidatedResult,
              clientResult: result,
              betAmount: game.betAmount,
              splitBetAmount: game.splitBetAmount
            })

            // Şüpheli aktivite kaydı - Admin bildirimi için
            await logActivity({
              userId: session.userId,
              actionType: 'suspicious_activity',
              actionTitle: 'Blackjack Payout Uyuşmazlığı',
              actionDescription: `Beklenen: ${expectedPayout}, Gelen: ${amount}, Fark: ${amount - expectedPayout}`,
              relatedId: gameId,
              relatedType: 'blackjack_game',
              metadata: {
                type: 'payout_mismatch',
                expected: expectedPayout,
                received: amount,
                difference: amount - expectedPayout,
                serverResult: serverValidatedResult,
                clientResult: result,
                splitResult: serverValidatedSplitResult,
                betAmount: game.betAmount,
                splitBetAmount: game.splitBetAmount,
                isSplit: game.isSplit
              },
              ipAddress: requestInfo.ipAddress,
              userAgent: requestInfo.userAgent
            })
          }

          const currentUser = await tx.user.findUnique({
            where: { id: session.userId },
            select: { points: true }
          })

          if (!currentUser) {
            throw new Error('Kullanıcı bulunamadı')
          }

          const totalBet = game.betAmount + game.splitBetAmount
          const balanceBefore = currentUser.points
          const balanceAfter = balanceBefore + expectedPayout

          let description = 'Blackjack Kazanç'
          if (serverValidatedResult === 'blackjack') {
            description = 'Blackjack!'
          } else if (serverValidatedResult === 'push') {
            description = 'Blackjack Berabere'
          }

          await tx.user.update({
            where: { id: session.userId },
            data: {
              points: { increment: expectedPayout },
              pointHistory: {
                create: {
                  amount: expectedPayout,
                  type: 'GAME_WIN',
                  description,
                  balanceBefore,
                  balanceAfter
                }
              }
            }
          })

          await tx.blackjackGame.update({
            where: {
              odunId: gameId,
              status: 'active'
            },
            data: {
              status: 'completed',
              result: serverValidatedResult || 'win',
              splitResult: serverValidatedSplitResult || null,
              payout: expectedPayout,
              balanceAfter: balanceAfter,
              playerScore: playerScore || null,
              dealerScore: dealerScore || null,
              playerCards: playerCards ? JSON.stringify(playerCards) : null,
              dealerCards: dealerCards ? JSON.stringify(dealerCards) : null,
              actions: actions ? JSON.stringify(actions) : null,
              isDoubleDown: isDoubleDown || false,
              isSplit: isSplit || game.isSplit || false,
              gameDuration: gameDuration || null,
              ipAddress: requestInfo.ipAddress,
              userAgent: requestInfo.userAgent,
              completedAt: new Date()
            }
          })

          return { expectedPayout, balanceBefore, balanceAfter, totalBet }
        }, {
          isolationLevel: 'Serializable'
        })

        return NextResponse.json({
          success: true,
          action: 'win_credited',
          balanceBefore: transactionResult.balanceBefore,
          balanceAfter: transactionResult.balanceAfter
        })
      } finally {
        await releaseGameLock(gameId)
      }
    }

    // ========== LOSE ACTION ==========
    if (action === 'lose') {
      if (!gameId) {
        return NextResponse.json({ error: 'Oyun ID gerekli' }, { status: 400 })
      }

      const lockAcquired = await acquireGameLock(gameId, 'lose')
      if (!lockAcquired) {
        console.log(`[Blackjack] Lose isteği engellendi - oyun zaten işleniyor: ${gameId}`)
        return NextResponse.json({ error: 'İstek zaten işleniyor' }, { status: 409 })
      }

      try {
        const transactionResult = await prisma.$transaction(async (tx) => {
          const game = await tx.blackjackGame.findUnique({
            where: { odunId: gameId }
          })

          if (!game) {
            throw new Error('Oyun bulunamadı')
          }

          if (game.status !== 'active') {
            throw new Error('Oyun zaten tamamlanmış')
          }

          if (game.userId !== session.userId) {
            throw new Error('Bu oyun size ait değil')
          }

          const currentUser = await tx.user.findUnique({
            where: { id: session.userId },
            select: { points: true }
          })

          const balanceAfter = currentUser?.points || 0

          await tx.blackjackGame.update({
            where: {
              odunId: gameId,
              status: 'active'
            },
            data: {
              status: 'completed',
              result: 'lose',
              splitResult: splitResult || null,
              payout: 0,
              balanceAfter: balanceAfter,
              playerScore: playerScore || null,
              dealerScore: dealerScore || null,
              playerCards: playerCards ? JSON.stringify(playerCards) : null,
              dealerCards: dealerCards ? JSON.stringify(dealerCards) : null,
              actions: actions ? JSON.stringify(actions) : null,
              isDoubleDown: isDoubleDown || false,
              isSplit: isSplit || false,
              gameDuration: gameDuration || null,
              ipAddress: requestInfo.ipAddress,
              userAgent: requestInfo.userAgent,
              completedAt: new Date()
            }
          })

          return { balanceAfter }
        }, {
          isolationLevel: 'Serializable'
        })

        return NextResponse.json({
          success: true,
          action: 'loss_logged',
          balanceAfter: transactionResult.balanceAfter
        })
      } finally {
        await releaseGameLock(gameId)
      }
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })

  } catch (error) {
    console.error('Blackjack bet error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// ========== GET - Aktif oyun yok (kaydetme/geri yükleme devre dışı) ==========
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)

    if (!session) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    // Oyun kaydetme/geri yükleme devre dışı - her zaman aktif oyun yok döndür
    return NextResponse.json({ hasActiveGame: false })

  } catch (error) {
    console.error('Blackjack get active game error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
