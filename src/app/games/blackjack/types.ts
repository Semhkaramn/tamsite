// Card types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  suit: Suit
  value: CardValue
  hidden?: boolean
  isNew?: boolean
  id?: string // Unique identifier for React keys
}

export type GameState = 'betting' | 'playing' | 'playing_split' | 'dealer_turn' | 'game_over'
export type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null

// Suit symbols
export const suitSymbols: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
}

export const suitColors: Record<Suit, string> = {
  hearts: '#ef4444',
  diamonds: '#ef4444',
  clubs: '#1f2937',
  spades: '#1f2937'
}
