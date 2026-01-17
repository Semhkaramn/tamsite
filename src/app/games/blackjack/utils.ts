import type { Card, CardValue, Suit } from './types'

// Generate unique ID for cards
let cardIdCounter = 0
export function generateCardId(): string {
  return `card-${Date.now()}-${++cardIdCounter}`
}

// Create deck with unique IDs
export function createDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const values: CardValue[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const deck: Card[] = []

  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value, id: generateCardId() })
    }
  }

  return deck
}

// Shuffle deck
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Calculate hand value
export function calculateHandValue(hand: Card[], ignoreHidden = false): number {
  let value = 0
  let aces = 0

  for (const card of hand) {
    if (card.hidden && !ignoreHidden) continue

    if (card.value === 'A') {
      aces++
      value += 11
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10
    } else {
      value += Number.parseInt(card.value)
    }
  }

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

// Calculate soft/hard hand display (for Ace display like "7/17")
export function calculateHandDisplayValue(hand: Card[], ignoreHidden = false): string {
  let value = 0
  let aces = 0
  let usedAces = 0

  for (const card of hand) {
    if (card.hidden && !ignoreHidden) continue

    if (card.value === 'A') {
      aces++
      value += 11
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10
    } else {
      value += Number.parseInt(card.value)
    }
  }

  // Adjust for aces
  while (value > 21 && usedAces < aces) {
    value -= 10
    usedAces++
  }

  // If there's still an ace counted as 11 (soft hand), show both values
  const softAces = aces - usedAces
  if (softAces > 0 && value <= 21) {
    const hardValue = value - 10
    if (hardValue !== value && hardValue > 0) {
      return `${hardValue}/${value}`
    }
  }

  return value.toString()
}

// Check if hand can be split
export function canSplitHand(hand: Card[]): boolean {
  if (hand.length !== 2) return false
  const val1 = hand[0].value
  const val2 = hand[1].value
  // Can split if both cards have same value (including face cards = 10)
  const getCardNumericValue = (v: CardValue) => {
    if (['J', 'Q', 'K'].includes(v)) return 10
    if (v === 'A') return 11
    return Number.parseInt(v)
  }
  return getCardNumericValue(val1) === getCardNumericValue(val2)
}

// Check if hand is a soft hand (has an Ace counted as 11)
export function isSoftHand(hand: Card[], ignoreHidden = false): boolean {
  let value = 0
  let aces = 0

  for (const card of hand) {
    if (card.hidden && !ignoreHidden) continue

    if (card.value === 'A') {
      aces++
      value += 11
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10
    } else {
      value += Number.parseInt(card.value)
    }
  }

  // Count how many aces need to be converted to 1
  let usedAces = 0
  while (value > 21 && usedAces < aces) {
    value -= 10
    usedAces++
  }

  // Soft hand = at least one ace still counted as 11
  return (aces - usedAces) > 0 && value <= 21
}

// Kart suit sembollerini al
const suitSymbols: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
}

/**
 * Kartları formatla - Log için okunabilir string dizisi döndürür
 * Örnek: ['A♠', 'K♥', '5♦']
 */
export function formatCardsForLog(hand: Card[]): string[] {
  return hand.map(card => {
    if (card.hidden) return '?'
    return `${card.value}${suitSymbols[card.suit]}`
  })
}

/**
 * Tüm kartları formatla (gizli kartları da göster)
 */
export function formatAllCardsForLog(hand: Card[]): string[] {
  return hand.map(card => `${card.value}${suitSymbols[card.suit]}`)
}

/**
 * Kart değerini sayısal olarak al
 */
export function getCardNumericValue(value: CardValue): number {
  if (value === 'A') return 11
  if (['J', 'Q', 'K'].includes(value)) return 10
  return Number.parseInt(value)
}

/**
 * Tamamen rastgele kart seç - Dealer için
 * WinRate kaldırıldı - Oyun tamamen şansa dayalı
 */
export function selectCardForDealer(
  deck: Card[],
  _dealerCurrentValue: number
): { selectedCard: Card; remainingDeck: Card[] } {
  if (deck.length === 0) {
    throw new Error('Deck is empty')
  }

  // Tamamen rastgele kart seç
  const randomIndex = Math.floor(Math.random() * deck.length)
  const selectedCard = deck[randomIndex]
  const remainingDeck = [...deck.slice(0, randomIndex), ...deck.slice(randomIndex + 1)]

  return { selectedCard, remainingDeck }
}

/**
 * Tamamen rastgele gizli kart seç - Dealer için
 * WinRate kaldırıldı - Oyun tamamen şansa dayalı
 */
export function selectDealerHiddenCard(
  deck: Card[],
  _dealerVisibleValue: number
): { selectedCard: Card; remainingDeck: Card[] } {
  if (deck.length === 0) {
    throw new Error('Deck is empty')
  }

  // Tamamen rastgele kart seç
  const randomIndex = Math.floor(Math.random() * deck.length)
  const selectedCard = deck[randomIndex]
  const remainingDeck = [...deck.slice(0, randomIndex), ...deck.slice(randomIndex + 1)]

  return { selectedCard, remainingDeck }
}
