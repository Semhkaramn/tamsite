'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Volume2, VolumeX, Info, X, RotateCcw, ChevronDown } from 'lucide-react'

// ============================================
// TYPES
// ============================================
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type GameState = 'betting' | 'dealing' | 'playing' | 'dealer_turn' | 'dealer_revealing' | 'game_over'
type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null

interface Card {
  suit: Suit
  value: CardValue
  hidden?: boolean
  id: string
}

// ============================================
// CONSTANTS
// ============================================
const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
}

const SUIT_COLORS: Record<Suit, { main: string; bg: string }> = {
  hearts: { main: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
  diamonds: { main: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
  clubs: { main: '#1f2937', bg: 'rgba(31, 41, 55, 0.1)' },
  spades: { main: '#1f2937', bg: 'rgba(31, 41, 55, 0.1)' }
}

const DEFAULT_CHIPS = [10, 25, 50, 100, 250, 500]

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  10: { bg: 'from-blue-500 to-blue-700', border: 'border-blue-400', text: 'text-blue-100' },
  25: { bg: 'from-green-500 to-green-700', border: 'border-green-400', text: 'text-green-100' },
  50: { bg: 'from-red-500 to-red-700', border: 'border-red-400', text: 'text-red-100' },
  100: { bg: 'from-purple-500 to-purple-700', border: 'border-purple-400', text: 'text-purple-100' },
  250: { bg: 'from-amber-500 to-amber-700', border: 'border-amber-400', text: 'text-amber-100' },
  500: { bg: 'from-slate-600 to-slate-900', border: 'border-slate-400', text: 'text-slate-100' }
}

// ============================================
// UTILITIES
// ============================================
let cardIdCounter = 0
const generateCardId = () => `card-${Date.now()}-${++cardIdCounter}`

function createDeck(): Card[] {
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

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function calculateHandValue(hand: Card[], ignoreHidden = false): number {
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

  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

function calculateDisplayValue(hand: Card[], ignoreHidden = false): string {
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

  while (value > 21 && usedAces < aces) {
    value -= 10
    usedAces++
  }

  const softAces = aces - usedAces
  if (softAces > 0 && value <= 21) {
    const hardValue = value - 10
    if (hardValue !== value && hardValue > 0) {
      return `${hardValue}/${value}`
    }
  }

  return value.toString()
}

function isBlackjack(hand: Card[]): boolean {
  if (hand.length !== 2) return false
  const hasAce = hand.some(c => c.value === 'A')
  const hasTen = hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.value))
  return hasAce && hasTen
}

function canSplit(hand: Card[]): boolean {
  if (hand.length !== 2) return false
  const getVal = (v: CardValue) => {
    if (['J', 'Q', 'K'].includes(v)) return 10
    if (v === 'A') return 11
    return Number.parseInt(v)
  }
  return getVal(hand[0].value) === getVal(hand[1].value)
}

// ============================================
// SOUND HOOK
// ============================================
function useSounds(enabled: boolean) {
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (typeof window !== 'undefined') {
      audioRefs.current = {
        card: new Audio('/sounds/card-deal.mp3'),
        flip: new Audio('/sounds/card-flip.mp3'),
        chip: new Audio('/sounds/chip.mp3'),
        win: new Audio('/sounds/win.mp3'),
        lose: new Audio('/sounds/lose.mp3')
      }
      Object.values(audioRefs.current).forEach(a => {
        a.preload = 'auto'
        a.volume = 0.5
      })
    }
    return () => { mounted.current = false }
  }, [])

  const play = useCallback((type: string) => {
    if (!enabled || !mounted.current) return
    const audio = audioRefs.current[type]
    if (audio) {
      const clone = audio.cloneNode() as HTMLAudioElement
      clone.volume = 0.5
      clone.play().catch(() => {})
    }
  }, [enabled])

  return play
}

// ============================================
// PLAYING CARD COMPONENT - Premium Design
// ============================================
function PlayingCard({
  card,
  index,
  isNew = false,
  isFlipping = false,
  flipDelay = 0,
  dealDelay = 0,
  fromDeck = false
}: {
  card: Card
  index: number
  isNew?: boolean
  isFlipping?: boolean
  flipDelay?: number
  dealDelay?: number
  fromDeck?: boolean
}) {
  const [dealt, setDealt] = useState(!isNew)
  const [flipped, setFlipped] = useState(!card.hidden)
  const [showFace, setShowFace] = useState(!card.hidden)

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setDealt(true), dealDelay)
      return () => clearTimeout(timer)
    }
    setDealt(true)
  }, [isNew, dealDelay])

  useEffect(() => {
    if (isFlipping) {
      const timer1 = setTimeout(() => setFlipped(true), flipDelay)
      const timer2 = setTimeout(() => setShowFace(true), flipDelay + 150)
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
    if (!card.hidden) {
      setFlipped(true)
      setShowFace(true)
    }
  }, [isFlipping, flipDelay, card.hidden])

  const symbol = SUIT_SYMBOLS[card.suit]
  const colors = SUIT_COLORS[card.suit]
  const shouldShowBack = card.hidden && !flipped

  return (
    <div
      className={`absolute transition-all ${dealt ? 'opacity-100' : 'opacity-0'}`}
      style={{
        left: `${index * 28}px`,
        zIndex: index + 1,
        transform: dealt ? 'translateY(0) scale(1)' : (fromDeck ? 'translateY(-200px) translateX(100px) scale(0.5) rotate(-30deg)' : 'translateY(-100px) scale(0.7)'),
        transitionDuration: '500ms',
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        transitionDelay: `${dealDelay}ms`,
        perspective: '1000px'
      }}
    >
      <div
        className="relative w-[68px] h-[100px] sm:w-[80px] sm:h-[118px] md:w-[90px] md:h-[132px] lg:w-[100px] lg:h-[146px]"
        style={{
          transformStyle: 'preserve-3d',
          transform: shouldShowBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Front of card */}
        <div
          className="absolute inset-0 rounded-xl shadow-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)'
          }}
        >
          {/* Card inner design */}
          <div className="absolute inset-[3px] rounded-lg overflow-hidden" style={{ background: colors.bg }}>
            {/* Top left corner */}
            <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none">
              <span
                className="text-sm sm:text-base md:text-lg lg:text-xl font-black"
                style={{ color: colors.main, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
              >
                {card.value}
              </span>
              <span
                className="text-base sm:text-lg md:text-xl lg:text-2xl -mt-0.5"
                style={{ color: colors.main }}
              >
                {symbol}
              </span>
            </div>

            {/* Center symbol */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
                style={{
                  color: colors.main,
                  textShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
                }}
              >
                {symbol}
              </span>
            </div>

            {/* Bottom right corner (rotated) */}
            <div className="absolute bottom-1.5 right-2 flex flex-col items-center leading-none rotate-180">
              <span
                className="text-sm sm:text-base md:text-lg lg:text-xl font-black"
                style={{ color: colors.main, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
              >
                {card.value}
              </span>
              <span
                className="text-base sm:text-lg md:text-xl lg:text-2xl -mt-0.5"
                style={{ color: colors.main }}
              >
                {symbol}
              </span>
            </div>
          </div>

          {/* Shine effect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)'
            }}
          />
        </div>

        {/* Back of card */}
        <div
          className="absolute inset-0 rounded-xl shadow-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(145deg, #1e3a5f 0%, #0f2744 50%, #0a1929 100%)',
            border: '2px solid #2563eb',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
          }}
        >
          {/* Pattern */}
          <div className="absolute inset-2 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <div
              className="absolute inset-0"
              style={{
                background: `
                  repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(59, 130, 246, 0.1) 10px, rgba(59, 130, 246, 0.1) 20px),
                  repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(59, 130, 246, 0.05) 10px, rgba(59, 130, 246, 0.05) 20px)
                `
              }}
            />

            {/* Center emblem */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
                  border: '2px solid rgba(59, 130, 246, 0.4)'
                }}
              >
                <span className="text-blue-400 text-lg sm:text-xl md:text-2xl font-bold opacity-60">BJ</span>
              </div>
            </div>
          </div>

          {/* Shine */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)'
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================
// CHIP COMPONENT - Premium Design
// ============================================
function Chip({
  value,
  selected,
  onClick,
  disabled,
  animate = false
}: {
  value: number
  selected: boolean
  onClick: () => void
  disabled?: boolean
  animate?: boolean
}) {
  const colors = CHIP_COLORS[value] || CHIP_COLORS[10]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        relative w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 rounded-full
        transition-all duration-300 ease-out
        ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}
        ${selected ? 'scale-115 ring-4 ring-white/70 ring-offset-2 ring-offset-transparent' : ''}
        ${animate ? 'animate-bounce' : ''}
      `}
      style={{
        boxShadow: selected
          ? '0 0 30px rgba(255,255,255,0.5), 0 10px 40px rgba(0,0,0,0.4)'
          : '0 6px 20px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)'
      }}
    >
      {/* Chip layers */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.bg}`}
        style={{ boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 4px 8px rgba(255,255,255,0.2)' }}
      />

      {/* Edge pattern */}
      <div
        className="absolute inset-1 rounded-full"
        style={{
          border: '3px dashed rgba(255,255,255,0.3)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
        }}
      />

      {/* Inner circle */}
      <div
        className="absolute inset-2.5 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)'
        }}
      >
        <span className={`font-bold text-sm sm:text-base drop-shadow-lg ${colors.text}`}>
          {value}
        </span>
      </div>
    </button>
  )
}

// ============================================
// CARD HAND COMPONENT
// ============================================
function CardHand({
  cards,
  label,
  value,
  result,
  isActive,
  isDealing,
  revealingIndex,
  bet
}: {
  cards: Card[]
  label?: string
  value?: string
  result?: GameResult
  isActive?: boolean
  isDealing?: boolean
  revealingIndex?: number
  bet?: number
}) {
  const resultColors: Record<string, { bg: string; text: string; border: string }> = {
    blackjack: { bg: 'from-amber-500/30 to-yellow-500/30', text: 'text-amber-400', border: 'border-amber-500/50' },
    win: { bg: 'from-green-500/30 to-emerald-500/30', text: 'text-green-400', border: 'border-green-500/50' },
    lose: { bg: 'from-red-500/30 to-rose-500/30', text: 'text-red-400', border: 'border-red-500/50' },
    push: { bg: 'from-gray-500/30 to-slate-500/30', text: 'text-gray-400', border: 'border-gray-500/50' }
  }

  const resultLabels: Record<string, string> = {
    blackjack: 'BLACKJACK!',
    win: 'KAZANDIN!',
    lose: 'KAYBETTIN',
    push: 'BERABERE'
  }

  return (
    <div className="relative">
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
          <ChevronDown className="w-8 h-8 text-amber-400 animate-bounce" />
        </div>
      )}

      {/* Cards container */}
      <div
        className={`
          relative p-4 rounded-2xl min-h-[140px] sm:min-h-[160px] md:min-h-[180px] lg:min-h-[200px]
          transition-all duration-300
          ${result ? `bg-gradient-to-br ${resultColors[result]?.bg} border ${resultColors[result]?.border}` : ''}
          ${isActive ? 'ring-2 ring-amber-400/50' : ''}
        `}
        style={{
          minWidth: `${Math.max(120, cards.length * 28 + 100)}px`
        }}
      >
        {/* Cards */}
        <div className="relative h-[100px] sm:h-[118px] md:h-[132px] lg:h-[146px]" style={{ minWidth: `${Math.max(68, cards.length * 28 + 68)}px` }}>
          {cards.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-[68px] h-[100px] sm:w-[80px] sm:h-[118px] rounded-xl border-2 border-dashed border-white/20
                          flex items-center justify-center"
              >
                <span className="text-white/30 text-xs">Kart</span>
              </div>
            </div>
          ) : (
            cards.map((card, i) => (
              <PlayingCard
                key={card.id}
                card={card}
                index={i}
                isNew={isDealing}
                isFlipping={revealingIndex !== undefined && i >= revealingIndex}
                flipDelay={revealingIndex !== undefined ? (i - revealingIndex) * 600 : 0}
                dealDelay={isDealing ? i * 400 : 0}
                fromDeck={isDealing}
              />
            ))
          )}
        </div>

        {/* Info section */}
        <div className="mt-4 text-center space-y-1">
          {label && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-white/70 text-sm font-medium">{label}</span>
              {value && (
                <span className="bg-white/10 px-2 py-0.5 rounded-full text-white font-bold text-sm">
                  {value}
                </span>
              )}
            </div>
          )}

          {bet !== undefined && bet > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-amber-500/20 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-400 text-sm font-semibold">{bet} puan</span>
            </div>
          )}

          {result && (
            <div
              className={`
                inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm
                ${resultColors[result]?.text} bg-black/30 backdrop-blur-sm
                animate-pulse
              `}
            >
              {resultLabels[result]}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN GAME COMPONENT
// ============================================
export default function PremiumBlackjack() {
  // State
  const [balance, setBalance] = useState(1000)
  const [bet, setBet] = useState(0)
  const [currentBet, setCurrentBet] = useState(0)
  const [selectedChip, setSelectedChip] = useState<number | null>(null)
  const [gameState, setGameState] = useState<GameState>('betting')
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [result, setResult] = useState<GameResult>(null)
  const [winAmount, setWinAmount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showRules, setShowRules] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dealerRevealIndex, setDealerRevealIndex] = useState<number | undefined>(undefined)
  const [showWinAnimation, setShowWinAnimation] = useState(false)

  // Refs
  const timerRef = useRef<NodeJS.Timeout[]>([])
  const mountedRef = useRef(true)

  // Hooks
  const playSound = useSounds(soundEnabled)

  // Cleanup timers
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      timerRef.current.forEach(clearTimeout)
    }
  }, [])

  const addTimer = useCallback((fn: () => void, delay: number) => {
    const t = setTimeout(() => {
      if (mountedRef.current) fn()
    }, delay)
    timerRef.current.push(t)
    return t
  }, [])

  const clearTimers = useCallback(() => {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
  }, [])

  // Computed values
  const playerValue = useMemo(() => calculateHandValue(playerHand, true), [playerHand])
  const playerDisplayValue = useMemo(() => calculateDisplayValue(playerHand, true), [playerHand])
  const dealerDisplayValue = useMemo(() => {
    if (dealerHand.some(c => c.hidden) && dealerRevealIndex === undefined) return '?'
    return calculateDisplayValue(dealerHand, true)
  }, [dealerHand, dealerRevealIndex])

  const canDoubleDown = gameState === 'playing' && playerHand.length === 2 && balance >= currentBet
  const canSplitHand = gameState === 'playing' && canSplit(playerHand) && balance >= currentBet

  // Draw card from deck
  const drawCard = useCallback((hidden = false): Card => {
    const newDeck = [...deck]
    const card = { ...newDeck.pop()!, id: generateCardId(), hidden }
    setDeck(newDeck)
    return card
  }, [deck])

  // Deal initial cards
  const dealCards = useCallback(async () => {
    if (bet <= 0 || bet > balance || isProcessing) return

    setIsProcessing(true)
    setCurrentBet(bet)
    setBalance(b => b - bet)
    setResult(null)
    setWinAmount(0)
    setDealerRevealIndex(undefined)
    setShowWinAnimation(false)

    // Create and shuffle deck
    const newDeck = shuffleDeck(createDeck())
    setDeck(newDeck.slice(4))

    // Prepare hands
    const pCard1 = { ...newDeck[0], id: generateCardId() }
    const dCard1 = { ...newDeck[1], id: generateCardId() }
    const pCard2 = { ...newDeck[2], id: generateCardId() }
    const dCard2 = { ...newDeck[3], id: generateCardId(), hidden: true }

    setPlayerHand([])
    setDealerHand([])
    setGameState('dealing')

    // Deal animation - card by card
    playSound('card')
    addTimer(() => setPlayerHand([pCard1]), 100)

    addTimer(() => {
      playSound('card')
      setDealerHand([dCard1])
    }, 500)

    addTimer(() => {
      playSound('card')
      setPlayerHand([pCard1, pCard2])
    }, 900)

    addTimer(() => {
      playSound('card')
      setDealerHand([dCard1, dCard2])
    }, 1300)

    // Check for immediate results
    addTimer(() => {
      const pHand = [pCard1, pCard2]
      const dHand = [dCard1, { ...dCard2, hidden: false }]
      const playerBJ = isBlackjack(pHand)
      const dealerBJ = isBlackjack(dHand)

      if (playerBJ || dealerBJ) {
        // Reveal dealer's card
        setDealerRevealIndex(1)
        playSound('flip')

        addTimer(() => {
          setDealerHand([dCard1, { ...dCard2, hidden: false }])

          let gameResult: GameResult
          let payout = 0

          if (playerBJ && dealerBJ) {
            gameResult = 'push'
            payout = bet
          } else if (playerBJ) {
            gameResult = 'blackjack'
            payout = Math.floor(bet * 2.5)
          } else {
            gameResult = 'lose'
            payout = 0
          }

          setResult(gameResult)
          setWinAmount(payout)
          setBalance(b => b + payout)
          setGameState('game_over')
          setIsProcessing(false)

          if (payout > 0) {
            setShowWinAnimation(true)
            playSound('win')
          } else {
            playSound('lose')
          }
        }, 800)
      } else {
        setGameState('playing')
        setIsProcessing(false)
      }
    }, 1700)
  }, [bet, balance, isProcessing, addTimer, playSound])

  // Hit action
  const hit = useCallback(() => {
    if (gameState !== 'playing' || isProcessing) return

    setIsProcessing(true)
    playSound('card')

    const newCard = drawCard()
    const newHand = [...playerHand, newCard]
    setPlayerHand(newHand)

    const value = calculateHandValue(newHand, true)

    addTimer(() => {
      if (value > 21) {
        setResult('lose')
        setGameState('game_over')
        playSound('lose')
      } else if (value === 21) {
        // Auto stand on 21
        stand()
        return
      }
      setIsProcessing(false)
    }, 500)
  }, [gameState, isProcessing, playerHand, drawCard, addTimer, playSound])

  // Stand action - DEALER REVEALS CARDS ONE BY ONE
  const stand = useCallback(() => {
    if ((gameState !== 'playing' && gameState !== 'dealer_turn') || isProcessing) return

    setIsProcessing(true)
    setGameState('dealer_revealing')

    // First reveal the hidden card with animation
    setDealerRevealIndex(1)
    playSound('flip')

    addTimer(() => {
      // Update dealer hand with revealed card
      const revealedHand = dealerHand.map((c, i) => i === 1 ? { ...c, hidden: false } : c)
      setDealerHand(revealedHand)

      // Now dealer draws cards one by one
      let currentHand = [...revealedHand]
      let currentDeck = [...deck]

      const dealerDraw = () => {
        const dealerValue = calculateHandValue(currentHand, true)

        if (dealerValue < 17) {
          // Draw a card with animation
          addTimer(() => {
            playSound('card')
            const newCard = { ...currentDeck.pop()!, id: generateCardId() }
            currentHand = [...currentHand, newCard]
            currentDeck = [...currentDeck]
            setDealerHand([...currentHand])
            setDeck([...currentDeck])

            // Continue drawing
            addTimer(() => dealerDraw(), 800)
          }, 600)
        } else {
          // Dealer done - determine result
          addTimer(() => {
            const pValue = calculateHandValue(playerHand, true)
            const dValue = calculateHandValue(currentHand, true)

            let gameResult: GameResult
            let payout = 0

            if (dValue > 21) {
              gameResult = 'win'
              payout = currentBet * 2
            } else if (pValue > dValue) {
              gameResult = 'win'
              payout = currentBet * 2
            } else if (pValue < dValue) {
              gameResult = 'lose'
              payout = 0
            } else {
              gameResult = 'push'
              payout = currentBet
            }

            setResult(gameResult)
            setWinAmount(payout)
            setBalance(b => b + payout)
            setGameState('game_over')
            setIsProcessing(false)

            if (payout > 0) {
              setShowWinAnimation(true)
              playSound('win')
            } else {
              playSound('lose')
            }
          }, 500)
        }
      }

      dealerDraw()
    }, 800)
  }, [gameState, isProcessing, dealerHand, deck, playerHand, currentBet, addTimer, playSound])

  // Double down
  const doubleDown = useCallback(() => {
    if (!canDoubleDown || isProcessing) return

    setIsProcessing(true)
    setBalance(b => b - currentBet)
    setCurrentBet(c => c * 2)
    playSound('chip')

    addTimer(() => {
      playSound('card')
      const newCard = drawCard()
      const newHand = [...playerHand, newCard]
      setPlayerHand(newHand)

      const value = calculateHandValue(newHand, true)

      addTimer(() => {
        if (value > 21) {
          setResult('lose')
          setGameState('game_over')
          setIsProcessing(false)
          playSound('lose')
        } else {
          stand()
        }
      }, 600)
    }, 300)
  }, [canDoubleDown, isProcessing, currentBet, playerHand, drawCard, addTimer, playSound, stand])

  // New game
  const newGame = useCallback(() => {
    if (isProcessing) return

    clearTimers()
    playSound('chip')

    setPlayerHand([])
    setDealerHand([])
    setGameState('betting')
    setResult(null)
    setBet(0)
    setCurrentBet(0)
    setSelectedChip(null)
    setWinAmount(0)
    setDealerRevealIndex(undefined)
    setShowWinAnimation(false)
    setIsProcessing(false)
  }, [isProcessing, clearTimers, playSound])

  // Add chip to bet
  const addChip = useCallback((value: number) => {
    if (isProcessing || gameState !== 'betting') return

    const newBet = Math.min(bet + value, balance)
    if (newBet <= bet && bet > 0) return

    playSound('chip')
    setBet(newBet)
    setSelectedChip(value)
  }, [bet, balance, isProcessing, gameState, playSound])

  // Clear bet
  const clearBet = useCallback(() => {
    if (isProcessing || gameState !== 'betting') return
    playSound('chip')
    setBet(0)
    setSelectedChip(null)
  }, [isProcessing, gameState, playSound])

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Casino table background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse at center, #0f5132 0%, #0a3622 40%, #052e1c 70%, #021a0f 100%)
          `
        }}
      />

      {/* Table felt texture overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Table edge glow */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent -z-5" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent -z-5" />

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="relative max-w-lg w-full rounded-2xl p-6 animate-in fade-in zoom-in duration-300"
            style={{
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>

            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-400" />
              Blackjack Kurallari
            </h3>

            <div className="space-y-3 text-sm text-gray-300">
              <p><span className="text-amber-400 font-semibold">1.</span> Amac: Elinin degerini 21'e yaklastirmak ama gecmemek.</p>
              <p><span className="text-amber-400 font-semibold">2.</span> Kart degerleri: 2-10 = kendi degeri, J/Q/K = 10, A = 1 veya 11</p>
              <p><span className="text-amber-400 font-semibold">3.</span> <span className="text-amber-300">Blackjack:</span> Ilk 2 kart ile 21 = 3:2 odeme</p>
              <p><span className="text-amber-400 font-semibold">4.</span> <span className="text-green-400">HIT:</span> Yeni kart cek</p>
              <p><span className="text-amber-400 font-semibold">5.</span> <span className="text-red-400">STAND:</span> Kartlarinla kal</p>
              <p><span className="text-amber-400 font-semibold">6.</span> <span className="text-purple-400">DOUBLE:</span> Bahsi ikiye katla, tek kart cek</p>
              <p><span className="text-amber-400 font-semibold">7.</span> Krupiye 17'ye kadar cekmek zorunda</p>
            </div>

            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="w-full mt-6 py-3 rounded-xl font-bold text-white
                        bg-gradient-to-r from-emerald-600 to-green-600
                        hover:from-emerald-500 hover:to-green-500
                        transition-all shadow-lg"
            >
              Anladim
            </button>
          </div>
        </div>
      )}

      {/* Win animation overlay */}
      {showWinAnimation && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
          {/* Coins falling animation */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            >
              {result === 'blackjack' ? '🎰' : '💰'}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-xl"
          style={{
            background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
          }}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <span className="text-lg">💰</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Bakiye</span>
            <span className="text-lg font-bold text-amber-400">{balance.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { playSound('chip'); setSoundEnabled(!soundEnabled) }}
            className={`
              p-3 rounded-xl transition-all
              ${soundEnabled ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'}
            `}
            style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => { playSound('chip'); setShowRules(true) }}
            className="p-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all"
            style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Game area */}
      <div className="flex flex-col items-center min-h-[calc(100vh-80px)] py-4 px-4">
        {/* Dealer section */}
        <div className="text-center mb-6">
          <CardHand
            cards={dealerHand}
            label="Krupiye"
            value={dealerDisplayValue}
            isDealing={gameState === 'dealing'}
            revealingIndex={dealerRevealIndex}
          />
        </div>

        {/* Center decorative element */}
        <div className="relative w-full max-w-md h-16 my-4">
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px]"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.3) 20%, rgba(255,215,0,0.5) 50%, rgba(255,215,0,0.3) 80%, transparent 100%)'
            }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/30 flex items-center justify-center border border-amber-500/30">
            <span className="text-amber-500 text-2xl font-bold">BJ</span>
          </div>
        </div>

        {/* Player section */}
        <div className="text-center mb-6">
          <CardHand
            cards={playerHand}
            label="Sen"
            value={playerDisplayValue}
            result={result}
            bet={currentBet}
            isDealing={gameState === 'dealing'}
            isActive={gameState === 'playing'}
          />
        </div>

        {/* Result display */}
        {result && gameState === 'game_over' && (
          <div
            className={`
              mb-6 px-8 py-4 rounded-2xl text-center animate-in fade-in zoom-in duration-500
              ${result === 'blackjack' ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border-2 border-amber-500/50' : ''}
              ${result === 'win' ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-2 border-green-500/50' : ''}
              ${result === 'lose' ? 'bg-gradient-to-r from-red-500/30 to-rose-500/30 border-2 border-red-500/50' : ''}
              ${result === 'push' ? 'bg-gradient-to-r from-gray-500/30 to-slate-500/30 border-2 border-gray-500/50' : ''}
            `}
          >
            <div
              className={`
                text-2xl sm:text-3xl font-black mb-1
                ${result === 'blackjack' ? 'text-amber-400' : ''}
                ${result === 'win' ? 'text-green-400' : ''}
                ${result === 'lose' ? 'text-red-400' : ''}
                ${result === 'push' ? 'text-gray-400' : ''}
              `}
            >
              {result === 'blackjack' && '🎰 BLACKJACK! 🎰'}
              {result === 'win' && '🏆 KAZANDIN! 🏆'}
              {result === 'lose' && '❌ KAYBETTIN ❌'}
              {result === 'push' && '🤝 BERABERE 🤝'}
            </div>
            {winAmount > 0 && (
              <div className="text-lg font-bold text-amber-300">
                +{winAmount.toLocaleString()} puan
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="w-full max-w-xl space-y-4 mt-auto pb-6">
          {/* Bet display */}
          <div className="text-center">
            <div className="text-white/40 text-xs mb-1">
              {gameState === 'betting' ? 'Bahis Miktari' : 'Mevcut Bahis'}
            </div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400">
              {(gameState === 'betting' ? bet : currentBet) > 0
                ? (gameState === 'betting' ? bet : currentBet).toLocaleString()
                : '-'}
            </div>
          </div>

          {/* Betting phase */}
          {gameState === 'betting' && (
            <>
              {/* Chips */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap px-4">
                {DEFAULT_CHIPS.filter(c => c <= balance || bet > 0).map(chip => (
                  <Chip
                    key={chip}
                    value={chip}
                    selected={selectedChip === chip}
                    onClick={() => addChip(chip)}
                    disabled={chip > balance - bet && chip > balance}
                  />
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={clearBet}
                  disabled={bet === 0}
                  className="px-6 py-3 rounded-xl font-bold text-white
                            bg-gray-600 hover:bg-gray-700 transition-all
                            disabled:opacity-40 shadow-lg"
                >
                  Temizle
                </button>

                <button
                  type="button"
                  onClick={dealCards}
                  disabled={bet === 0 || isProcessing}
                  className="px-10 py-4 rounded-xl font-bold text-lg text-white
                            bg-gradient-to-r from-emerald-600 to-green-600
                            hover:from-emerald-500 hover:to-green-500
                            transition-all shadow-xl shadow-green-500/30
                            disabled:opacity-40 disabled:cursor-default"
                >
                  {isProcessing ? (
                    <RotateCcw className="w-6 h-6 animate-spin" />
                  ) : (
                    'DAGIT'
                  )}
                </button>
              </div>
            </>
          )}

          {/* Playing phase */}
          {gameState === 'playing' && (
            <div className="flex items-center justify-center gap-3 flex-wrap px-4">
              <button
                type="button"
                onClick={() => stand()}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white
                          bg-gradient-to-r from-red-600 to-red-700
                          hover:from-red-500 hover:to-red-600
                          transition-all shadow-lg shadow-red-500/30
                          disabled:opacity-50"
              >
                <span className="w-4 h-4 rounded bg-white/30" />
                STAND
              </button>

              <button
                type="button"
                onClick={hit}
                disabled={isProcessing}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg text-white
                          bg-gradient-to-r from-green-600 to-emerald-600
                          hover:from-green-500 hover:to-emerald-500
                          transition-all shadow-xl shadow-green-500/30 scale-105
                          disabled:opacity-50"
              >
                ✋ HIT
              </button>

              {canDoubleDown && (
                <button
                  type="button"
                  onClick={doubleDown}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white
                            bg-gradient-to-r from-purple-600 to-purple-700
                            hover:from-purple-500 hover:to-purple-600
                            transition-all shadow-lg shadow-purple-500/30
                            disabled:opacity-50"
                >
                  💰 DOUBLE
                </button>
              )}
            </div>
          )}

          {/* Dealer revealing / turn */}
          {(gameState === 'dealer_turn' || gameState === 'dealer_revealing') && (
            <div className="text-center text-white/60">
              <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
              <span className="text-sm">Krupiye oynuyor...</span>
            </div>
          )}

          {/* Game over */}
          {gameState === 'game_over' && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={newGame}
                disabled={isProcessing}
                className="px-8 py-4 rounded-xl font-bold text-lg text-white
                          bg-gradient-to-r from-emerald-600 to-green-600
                          hover:from-emerald-500 hover:to-green-500
                          transition-all shadow-xl shadow-green-500/30"
              >
                YENI OYUN
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall 3s ease-in forwards;
        }
      `}</style>
    </div>
  )
}
