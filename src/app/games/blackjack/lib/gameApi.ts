'use client'

import type { BlackjackSettings } from './constants'
import type { Card } from '../types'

// API Response Types
export interface StartGameResponse {
  success: boolean
  gameId: string
  playerHand: Card[]
  dealerHand: Card[]
  playerValue: number
  dealerValue: number
  phase: string
  canSplit: boolean
  canDouble: boolean
  balanceAfter: number
  immediateResult?: {
    result: string
    payout: number
  } | null
  error?: string
}

export interface GameActionResponse {
  success: boolean
  playerHand: Card[]
  splitHand: Card[]
  dealerHand: Card[]
  playerValue: number
  splitValue: number | null
  dealerValue: number
  phase: string
  activeHand: 'main' | 'split'
  bust?: boolean
  gameOver: boolean
  result: string | null
  splitResult: string | null
  payout: number
  balanceAfter: number
  hasSplit?: boolean
  error?: string
}

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

// Start new game (action: 'start')
export async function startGame(amount: number): Promise<StartGameResponse> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', amount })
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Oyun başlatılamadı!',
        gameId: '',
        playerHand: [],
        dealerHand: [],
        playerValue: 0,
        dealerValue: 0,
        phase: 'betting',
        canSplit: false,
        canDouble: false,
        balanceAfter: 0
      }
    }

    return { success: true, ...data }
  } catch (error) {
    console.error('[Blackjack] Start game API error:', error)
    return {
      success: false,
      error: 'Bir hata oluştu!',
      gameId: '',
      playerHand: [],
      dealerHand: [],
      playerValue: 0,
      dealerValue: 0,
      phase: 'betting',
      canSplit: false,
      canDouble: false,
      balanceAfter: 0
    }
  }
}

// Hit action (action: 'hit')
export async function hitAction(gameId: string): Promise<GameActionResponse> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hit', gameId })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Hit yapılamadı!')
    }

    return { success: true, ...data }
  } catch (error) {
    console.error('[Blackjack] Hit API error:', error)
    throw error
  }
}

// Stand action (action: 'stand')
export async function standAction(gameId: string): Promise<GameActionResponse> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stand', gameId })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Stand yapılamadı!')
    }

    return { success: true, ...data }
  } catch (error) {
    console.error('[Blackjack] Stand API error:', error)
    throw error
  }
}

// Double action (action: 'double')
export async function doubleAction(gameId: string): Promise<GameActionResponse> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'double', gameId })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Double yapılamadı!')
    }

    return { success: true, ...data }
  } catch (error) {
    console.error('[Blackjack] Double API error:', error)
    throw error
  }
}

// Split action (action: 'split')
export async function splitAction(gameId: string): Promise<GameActionResponse> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'split', gameId })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Split yapılamadı!')
    }

    return { success: true, ...data }
  } catch (error) {
    console.error('[Blackjack] Split API error:', error)
    throw error
  }
}

// Get active game (if exists)
export async function getActiveGame(): Promise<{
  hasActiveGame: boolean
  gameId?: string
  betAmount?: number
  splitBetAmount?: number
  playerHand?: Card[]
  splitHand?: Card[]
  dealerHand?: Card[]
  playerValue?: number
  splitValue?: number | null
  dealerValue?: number
  phase?: string
  activeHand?: 'main' | 'split'
  hasSplit?: boolean
  canSplit?: boolean
  canDouble?: boolean
  expired?: boolean
}> {
  try {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      return { hasActiveGame: false }
    }

    return await response.json()
  } catch (error) {
    console.error('[Blackjack] Get active game error:', error)
    return { hasActiveGame: false }
  }
}

// Legacy functions for backwards compatibility (deprecated)
/** @deprecated Use startGame instead */
export async function placeBet(amount: number, gameId: string): Promise<{ success: boolean; error?: string }> {
  console.warn('[Blackjack] placeBet is deprecated, use startGame instead')
  const result = await startGame(amount)
  return { success: result.success, error: result.error }
}

/** @deprecated Use splitAction instead */
export async function placeSplitBet(amount: number, gameId: string): Promise<{ success: boolean; error?: string }> {
  console.warn('[Blackjack] placeSplitBet is deprecated, use splitAction instead')
  try {
    await splitAction(gameId)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Split yapılamadı!' }
  }
}

/** @deprecated Use doubleAction instead */
export async function placeDoubleBet(amount: number, gameId: string, isSplit: boolean): Promise<{ success: boolean; error?: string }> {
  console.warn('[Blackjack] placeDoubleBet is deprecated, use doubleAction instead')
  try {
    await doubleAction(gameId)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Double yapılamadı!' }
  }
}

/** @deprecated Server handles game results automatically */
export async function sendGameResult(
  action: 'win' | 'lose',
  payload: Record<string, unknown>,
  dedupedFetch: (key: string, url: string, options: RequestInit) => Promise<Response>
): Promise<Response | null> {
  console.warn('[Blackjack] sendGameResult is deprecated, server handles results automatically')
  return null
}
