'use client'

import type { BlackjackSettings } from './constants'

// Load game settings
export async function loadGameSettings(): Promise<BlackjackSettings | null> {
  try {
    const res = await fetch('/api/games/settings')
    if (res.ok) {
      const data = await res.json()
      return data.blackjack
    }
    return null
  } catch (error) {
    console.error('Error loading game settings:', error)
    return null
  }
}

// Place bet
export async function placeBet(amount: number, gameId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, action: 'bet', gameId })
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || 'Bahis yapılamadı!' }
    }

    return { success: true }
  } catch (error) {
    console.error('[Blackjack] Bet API error:', error)
    return { success: false, error: 'Bir hata oluştu!' }
  }
}

// Split bet
export async function placeSplitBet(
  amount: number,
  gameId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        action: 'split',
        gameId
      })
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || 'Split yapılamadı!' }
    }

    return { success: true }
  } catch (error) {
    console.error('[Blackjack] Split API error:', error)
    return { success: false, error: 'Bir hata oluştu!' }
  }
}

// Double down bet
export async function placeDoubleBet(
  amount: number,
  gameId: string,
  isSplit: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        action: 'double',
        gameId,
        isSplit
      })
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || 'Double yapılamadı!' }
    }

    return { success: true }
  } catch (error) {
    console.error('[Blackjack] Double down API error:', error)
    return { success: false, error: 'Bir hata oluştu!' }
  }
}

// Send game result (win/lose)
export async function sendGameResult(
  action: 'win' | 'lose',
  payload: Record<string, unknown>,
  dedupedFetch: (key: string, url: string, options: RequestInit) => Promise<Response>
): Promise<Response | null> {
  const gameId = payload.gameId as string
  if (!gameId) return null

  try {
    const requestKey = `${gameId}_${action}`
    return await dedupedFetch(
      requestKey,
      '/api/games/blackjack/bet',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, action })
      }
    )
  } catch (error) {
    console.error(`[Blackjack] ${action} request error:`, error)
    throw error
  }
}
