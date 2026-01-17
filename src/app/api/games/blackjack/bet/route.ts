import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { extractRequestInfo } from '@/lib/services/activity-log-service'
import { getRedisClient } from '@/lib/telegram/utils/redis-client'

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 dakika
const RATE_LIMIT_MAX = 60 // Dakikada max 60 istek
const ACTION_COOLDOWN = 1000 // 1 saniye cooldown (aynı action için)
const lastActionMap = new Map<string, { action: string; time: number }>()

// In-memory game lock (fallback when Redis unavailable)
const gameLocksMap = new Map<string, { timestamp: number; action: string }>()
const LOCK_TTL = 30000 // 30 saniye

// Oyun ayarları tipi
interface GameSettings {
  enabled: boolean
  maxBet: number
  minBet: number
  pendingDisable: boolean
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

// Oyun ayarlarını getir (tüm değerler DB'den)
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
          startsWith: 'game_blackjack_'
        }
      }
    })

    // Tüm değerler DB'den (fallback değerleri seed'de tanımlı)
    const gameSettings: GameSettings = {
      enabled: getSettingValue(settings, 'game_blackjack_enabled', 'true') === 'true',
      maxBet: parseInt(getSettingValue(settings, 'game_blackjack_max_bet', '500')),
      minBet: parseInt(getSettingValue(settings, 'game_blackjack_min_bet', '10')),
      pendingDisable: getSettingValue(settings, 'game_blackjack_pending_disable', 'false') === 'true',
    }

    // pendingDisable true ise enabled false yap ve cache'i kısa tut
    if (gameSettings.pendingDisable) {
      gameSettings.enabled = false
      // pendingDisable durumunda cache'i kısa tut (5 saniye) - admin değişiklik yaparken hızlı güncellenmesi için
      settingsCacheTime = now - SETTINGS_CACHE_TTL + 5000
    } else {
      settingsCacheTime = now
    }

    cachedSettings = gameSettings

    return gameSettings
  } catch (error) {
    console.error('Error fetching game settings:', error)
    // Hata durumunda varsayılan değerler (seed'deki ile aynı)
    return {
      enabled: true,
      maxBet: 500,
      minBet: 10,
      pendingDisable: false
    }
  }
}

// Distributed lock with Redis
async function acquireGameLock(gameId: string, action: string): Promise<boolean> {
  const redis = getRedisClient()
  const lockKey = `blackjack:lock:${gameId}`

  // Redis varsa distributed lock kullan
  if (redis) {
    try {
      // NX: sadece key yoksa set et, EX: 30 saniye TTL
      const result = await redis.set(lockKey, `${action}:${Date.now()}`, { nx: true, ex: 30 })
      if (result === 'OK' || result === null) {
        // result null ise key zaten var demek - kilitlenemedi
        return result === 'OK'
      }
      return false
    } catch (error) {
      console.error('[Blackjack Lock] Redis error:', error)
      // Redis hatası - in-memory fallback
    }
  }

  // In-memory fallback
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
}, 60000) // Her dakika temizle

function checkRateLimit(userId: string): boolean {
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

function checkActionCooldown(userId: string, action: string): boolean {
  const now = Date.now()
  const key = `${userId}_${action}`
  const lastAction = lastActionMap.get(key)

  if (lastAction && now - lastAction.time < ACTION_COOLDOWN) {
    return false
  }

  lastActionMap.set(key, { action, time: now })
  return true
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

    // Rate limit kontrolü
    if (!checkRateLimit(session.userId)) {
      return NextResponse.json({ error: 'Çok fazla istek. Lütfen bekleyin.' }, { status: 429 })
    }

    // Oyun ayarlarını getir
    const gameSettings = await getGameSettings()

    const {
      amount,
      action,
      result,
      betAmount,
      playerScore,
      dealerScore,
      gameId, // Yeni: Client tarafından gönderilen oyun ID'si
      // Detaylı bilgiler (log için)
      playerCards,
      dealerCards,
      actions,
      isDoubleDown,
      isSplit,
      splitHands,
      gameDuration,
      handNumber,
      // Split result
      splitResult
    } = await request.json()
    const requestInfo = extractRequestInfo(request)

    // Action cooldown kontrolü
    if (!checkActionCooldown(session.userId, action)) {
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

      // Dinamik min/max bahis kontrolü
      if (action === 'bet') {
        if (amount < gameSettings.minBet) {
          return NextResponse.json({ error: `Minimum bahis ${gameSettings.minBet} puandır` }, { status: 400 })
        }
        if (amount > gameSettings.maxBet) {
          return NextResponse.json({ error: `Maksimum bahis ${gameSettings.maxBet} puandır` }, { status: 400 })
        }
      }

      // gameId ZORUNLU (hem bet hem double için)
      if (!gameId) {
        return NextResponse.json({ error: 'Oyun ID gerekli' }, { status: 400 })
      }

      // Transaction ile atomic işlem - Race condition koruması
      const txResult = await prisma.$transaction(async (tx) => {
        // Kullanıcının siteUsername'ini de çek (points ile birlikte)
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

        // Bahis için puan düş
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

        // Yeni oyun oluştur (sadece ilk bet'te)
        if (action === 'bet') {
          // Önce bu gameId ile aktif oyun var mı kontrol et
          const existingGame = await tx.blackjackGame.findUnique({
            where: { odunId: gameId }
          })

          if (existingGame) {
            throw new Error('Bu oyun ID zaten kullanılmış')
          }

          // siteUsername'i zaten currentUser'dan aldık
          // Oyunu oluştur - balanceBefore'u kaydet (oyun başlamadan önceki puan)
          await tx.blackjackGame.create({
            data: {
              odunId: gameId,
              userId: session.userId,
              siteUsername: currentUser.siteUsername || null,
              betAmount: amount,
              status: 'active',
              balanceBefore: balanceBefore, // Oyun başlamadan önceki puan
              ipAddress: requestInfo.ipAddress,
              userAgent: requestInfo.userAgent
            }
          })
        }

        // Double için mevcut oyunun bahsini güncelle
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

          // Split bahsi mi yoksa ana bahis mi?
          if (isSplit) {
            await tx.blackjackGame.update({
              where: { odunId: gameId },
              data: {
                splitBetAmount: game.splitBetAmount + amount,
                isDoubleDown: true
              }
            })
          } else {
            await tx.blackjackGame.update({
              where: { odunId: gameId },
              data: {
                betAmount: game.betAmount + amount,
                isDoubleDown: true
              }
            })
          }
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

        // Split bahsini kaydet ve isSplit flag'ini true yap
        await tx.blackjackGame.update({
          where: { odunId: gameId },
          data: {
            splitBetAmount: amount,
            isSplit: true
          }
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

      // Distributed lock - aynı oyun için sadece bir istek işlenebilir
      const lockAcquired = await acquireGameLock(gameId, 'win')
      if (!lockAcquired) {
        console.log(`[Blackjack] Win isteği engellendi - oyun zaten işleniyor: ${gameId}`)
        return NextResponse.json({ error: 'İstek zaten işleniyor' }, { status: 409 })
      }

      try {
        // Transaction ile race condition koruması
        const transactionResult = await prisma.$transaction(async (tx) => {
          // Aktif oyunu bul - Optimistic locking için version kontrolü
          const game = await tx.blackjackGame.findUnique({
            where: { odunId: gameId }
          })

          if (!game) {
            throw new Error('Oyun bulunamadı')
          }

          // KRITIK: Status kontrolü - zaten tamamlanmış oyun için işlem yapma
          if (game.status !== 'active') {
            throw new Error('Oyun zaten tamamlanmış')
          }

          if (game.userId !== session.userId) {
            throw new Error('Bu oyun size ait değil')
          }

          // Server-side ödeme hesaplama
          let expectedPayout = 0

          if (isSplit) {
            // Split oyununda her iki el için ayrı hesapla
            // ÖNEMLI: Split'te natural blackjack geçerli değil - sadece normal win sayılır
            const mainResultAdjusted = result === 'blackjack' ? 'win' : result // Split'te blackjack -> win
            const splitResultAdjusted = splitResult === 'blackjack' ? 'win' : (splitResult || 'lose')

            expectedPayout = calculatePayout(mainResultAdjusted, game.betAmount) +
              calculatePayout(splitResultAdjusted, game.splitBetAmount)
          } else {
            expectedPayout = calculatePayout(result, game.betAmount)
          }

          // Client'ın gönderdiği amount ile karşılaştır (güvenlik)
          if (amount !== expectedPayout) {
            console.error('Payout mismatch!', {
              expected: expectedPayout,
              received: amount,
              gameId,
              result,
              splitResult,
              betAmount: game.betAmount,
              splitBetAmount: game.splitBetAmount
            })
            // Güvenlik: Server hesaplamasını kullan
          }

          // Kullanıcı bakiyesini al
          const currentUser = await tx.user.findUnique({
            where: { id: session.userId },
            select: { points: true }
          })

          if (!currentUser) {
            throw new Error('Kullanıcı bulunamadı')
          }

          const totalBet = game.betAmount + game.splitBetAmount
          // Bahis başta alındığı için, oyun başlamadan önceki bakiye = game.balanceBefore (daha doğru)
          const balanceBefore = currentUser.points
          const balanceAfter = balanceBefore + expectedPayout

          // Sadeleştirilmiş description
          let description = 'Blackjack Kazanç'
          if (result === 'blackjack') {
            description = 'Blackjack!'
          } else if (result === 'push') {
            description = 'Blackjack Berabere'
          }

          // Puan ekle
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

          // Oyunu tamamla - TÜM DETAYLARI KAYDET (Activity log için)
          await tx.blackjackGame.update({
            where: {
              odunId: gameId,
              status: 'active' // Sadece hala active ise güncelle
            },
            data: {
              status: 'completed',
              result: result || 'win',
              splitResult: splitResult || null,
              payout: expectedPayout,
              balanceAfter: balanceAfter, // Oyun sonrası puan
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

          return { expectedPayout, balanceBefore, balanceAfter, totalBet }
        }, {
          // Transaction isolation level
          isolationLevel: 'Serializable'
        })

        return NextResponse.json({
          success: true,
          action: 'win_credited',
          balanceBefore: transactionResult.balanceBefore,
          balanceAfter: transactionResult.balanceAfter
        })
      } finally {
        // Lock'u her zaman serbest bırak
        await releaseGameLock(gameId)
      }
    }

    // ========== LOSE ACTION ==========
    if (action === 'lose') {
      if (!gameId) {
        return NextResponse.json({ error: 'Oyun ID gerekli' }, { status: 400 })
      }

      // Distributed lock - aynı oyun için sadece bir istek işlenebilir
      const lockAcquired = await acquireGameLock(gameId, 'lose')
      if (!lockAcquired) {
        console.log(`[Blackjack] Lose isteği engellendi - oyun zaten işleniyor: ${gameId}`)
        return NextResponse.json({ error: 'İstek zaten işleniyor' }, { status: 409 })
      }

      try {
        // Transaction ile race condition koruması
        const transactionResult = await prisma.$transaction(async (tx) => {
          const game = await tx.blackjackGame.findUnique({
            where: { odunId: gameId }
          })

          if (!game) {
            throw new Error('Oyun bulunamadı')
          }

          // KRITIK: Status kontrolü
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

          // Oyunu tamamla - TÜM DETAYLARI KAYDET (Activity log için)
          await tx.blackjackGame.update({
            where: {
              odunId: gameId,
              status: 'active' // Sadece hala active ise güncelle
            },
            data: {
              status: 'completed',
              result: 'lose',
              splitResult: splitResult || null,
              payout: 0,
              balanceAfter: balanceAfter, // Oyun sonrası puan
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
        // Lock'u her zaman serbest bırak
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
