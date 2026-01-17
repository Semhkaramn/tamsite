import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Varsayılan oyun ayarları
const DEFAULT_GAME_SETTINGS = {
  blackjack: {
    enabled: true,
    maxBet: 500,
    minBet: 10,
    pendingDisable: false,
  }
}

// GET - Oyun ayarlarını getir (Public - login gerektirmez)
export async function GET(request: NextRequest) {
  try {
    // Settings tablosundan oyun ayarlarını çek
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: [
            'game_blackjack_enabled',
            'game_blackjack_max_bet',
            'game_blackjack_min_bet',
            'game_blackjack_pending_disable'
          ]
        }
      }
    })

    // Settings'i parse et
    const gameSettings = { ...DEFAULT_GAME_SETTINGS }

    for (const setting of settings) {
      if (setting.key === 'game_blackjack_enabled') {
        gameSettings.blackjack.enabled = setting.value === 'true'
      } else if (setting.key === 'game_blackjack_max_bet') {
        gameSettings.blackjack.maxBet = parseInt(setting.value) || 500
      } else if (setting.key === 'game_blackjack_min_bet') {
        gameSettings.blackjack.minBet = parseInt(setting.value) || 10
      } else if (setting.key === 'game_blackjack_pending_disable') {
        gameSettings.blackjack.pendingDisable = setting.value === 'true'
      }
    }

    // pendingDisable true ise enabled false olarak göster
    if (gameSettings.blackjack.pendingDisable) {
      gameSettings.blackjack.enabled = false
    }

    return NextResponse.json(gameSettings)
  } catch (error) {
    console.error('Error fetching game settings:', error)
    // Hata durumunda varsayılan ayarları döndür
    return NextResponse.json(DEFAULT_GAME_SETTINGS)
  }
}
