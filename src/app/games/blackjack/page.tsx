'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Volume2, VolumeX, Info, X, RotateCcw, ChevronDown, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/components/providers/auth-provider'

// ============================================
// TYPES
// ============================================
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type GamePhase = 'betting' | 'playing' | 'playing_split' | 'dealer_turn' | 'game_over'
type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null

interface Card {
  suit: Suit
  value: CardValue
  hidden?: boolean
  id: string
}

interface GameStateFromServer {
  gameId: string
  playerHand: Card[]
  splitHand: Card[]
  dealerHand: Card[]
  playerValue: number
  splitValue: number | null
  dealerValue: number | string
  phase: GamePhase
  activeHand: 'main' | 'split'
  hasSplit: boolean
  canSplit: boolean
  canDouble: boolean
  result?: string | null
  splitResult?: string | null
  payout?: number
  balanceAfter: number
  gameOver?: boolean
  bust?: boolean
  immediateResult?: { result: string; payout: number } | null
}

// ============================================
// CONSTANTS - Server-side'da da aynı değerler var
// ============================================
const MIN_BET = 10
const MAX_BET = 500

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
// PLAYING CARD COMPONENT
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
          <div className="absolute inset-[3px] rounded-lg overflow-hidden" style={{ background: colors.bg }}>
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
// CHIP COMPONENT
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
      className={`relative w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 rounded-full transition-all duration-300 ease-out ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-110 active:scale-95'} ${selected ? 'scale-115 ring-4 ring-white/70 ring-offset-2 ring-offset-transparent' : ''} ${animate ? 'animate-bounce' : ''}`}
      style={{
        boxShadow: selected
          ? '0 0 30px rgba(255,255,255,0.5), 0 10px 40px rgba(0,0,0,0.4)'
          : '0 6px 20px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)'
      }}
    >
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.bg}`}
        style={{ boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 4px 8px rgba(255,255,255,0.2)' }}
      />

      <div
        className="absolute inset-1 rounded-full"
        style={{
          border: '3px dashed rgba(255,255,255,0.3)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
        }}
      />

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
  value?: string | number
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
      {isActive && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
          <ChevronDown className="w-8 h-8 text-amber-400 animate-bounce" />
        </div>
      )}

      <div
        className={`relative p-4 rounded-2xl min-h-[140px] sm:min-h-[160px] md:min-h-[180px] lg:min-h-[200px] transition-all duration-300 ${result ? `bg-gradient-to-br ${resultColors[result]?.bg} border ${resultColors[result]?.border}` : ''} ${isActive ? 'ring-2 ring-amber-400/50' : ''}`}
        style={{
          minWidth: `${Math.max(120, cards.length * 28 + 100)}px`
        }}
      >
        <div className="relative h-[100px] sm:h-[118px] md:h-[132px] lg:h-[146px]" style={{ minWidth: `${Math.max(68, cards.length * 28 + 68)}px` }}>
          {cards.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[68px] h-[100px] sm:w-[80px] sm:h-[118px] rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center">
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

        <div className="mt-4 text-center space-y-1">
          {label && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-white/70 text-sm font-medium">{label}</span>
              {value !== undefined && (
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
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm ${resultColors[result]?.text} bg-black/30 backdrop-blur-sm animate-pulse`}>
              {resultLabels[result]}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN GAME COMPONENT - All logic is server-side
// ============================================
function BlackjackGame() {
  const { user, refreshUser } = useAuth()

  // UI State
  const [balance, setBalance] = useState(0)
  const [bet, setBet] = useState(0)
  const [selectedChip, setSelectedChip] = useState<number | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showRules, setShowRules] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showWinAnimation, setShowWinAnimation] = useState(false)

  // Game State from Server
  const [gameId, setGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState<GamePhase>('betting')
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [splitHand, setSplitHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [playerValue, setPlayerValue] = useState<number>(0)
  const [splitValue, setSplitValue] = useState<number | null>(null)
  const [dealerValue, setDealerValue] = useState<number | string>(0)
  const [activeHand, setActiveHand] = useState<'main' | 'split'>('main')
  const [hasSplit, setHasSplit] = useState(false)
  const [canSplit, setCanSplit] = useState(false)
  const [canDouble, setCanDouble] = useState(false)
  const [result, setResult] = useState<GameResult>(null)
  const [splitResult, setSplitResult] = useState<GameResult>(null)
  const [currentBet, setCurrentBet] = useState(0)
  const [splitBet, setSplitBet] = useState(0)
  const [payout, setPayout] = useState(0)

  // Hooks
  const playSound = useSounds(soundEnabled)

  // Sync balance with user
  useEffect(() => {
    if (user) {
      setBalance(user.points)
    }
  }, [user])

  // Check for active game on mount
  useEffect(() => {
    checkActiveGame()
  }, [])

  // Check for active game
  const checkActiveGame = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/games/blackjack/bet')
      const data = await response.json()

      if (data.hasActiveGame) {
        // Restore active game state
        setGameId(data.gameId)
        setPlayerHand(data.playerHand || [])
        setSplitHand(data.splitHand || [])
        setDealerHand(data.dealerHand || [])
        setPlayerValue(data.playerValue || 0)
        setSplitValue(data.splitValue)
        setDealerValue(data.dealerValue || 0)
        setPhase(data.phase || 'playing')
        setActiveHand(data.activeHand || 'main')
        setHasSplit(data.hasSplit || false)
        setCanSplit(data.canSplit || false)
        setCanDouble(data.canDouble || false)
        setCurrentBet(data.betAmount || 0)
        setSplitBet(data.splitBetAmount || 0)
        toast.info('Devam eden oyununuz yüklendi')
      } else if (data.expired) {
        toast.error('Önceki oyununuz zaman aşımına uğradı')
      }
    } catch (error) {
      console.error('Error checking active game:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // API call helper
  const callAPI = async (action: string, data: Record<string, unknown> = {}) => {
    const response = await fetch('/api/games/blackjack/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Bir hata oluştu')
    }

    return result
  }

  // Update game state from server response
  const updateGameState = (data: GameStateFromServer) => {
    if (data.gameId) setGameId(data.gameId)
    if (data.playerHand) setPlayerHand(data.playerHand)
    if (data.splitHand) setSplitHand(data.splitHand)
    if (data.dealerHand) setDealerHand(data.dealerHand)
    if (data.playerValue !== undefined) setPlayerValue(data.playerValue)
    if (data.splitValue !== undefined) setSplitValue(data.splitValue)
    if (data.dealerValue !== undefined) setDealerValue(data.dealerValue)
    if (data.phase) setPhase(data.phase)
    if (data.activeHand) setActiveHand(data.activeHand)
    if (data.hasSplit !== undefined) setHasSplit(data.hasSplit)
    if (data.canSplit !== undefined) setCanSplit(data.canSplit)
    if (data.canDouble !== undefined) setCanDouble(data.canDouble)
    if (data.balanceAfter !== undefined) setBalance(data.balanceAfter)
    if (data.result) setResult(data.result as GameResult)
    if (data.splitResult) setSplitResult(data.splitResult as GameResult)
    if (data.payout !== undefined) setPayout(data.payout)
  }

  // Start game - calls server API
  const startGame = async () => {
    if (bet <= 0 || bet > balance || isProcessing) return

    // Client-side validation
    if (bet < MIN_BET) {
      toast.error(`Minimum bahis ${MIN_BET} puandır`)
      return
    }

    if (bet > MAX_BET) {
      toast.error(`Maksimum bahis ${MAX_BET} puandır`)
      return
    }

    setIsProcessing(true)
    playSound('chip')

    try {
      const data = await callAPI('start', { amount: bet })

      if (data.success) {
        setCurrentBet(bet)
        updateGameState(data)
        playSound('card')

        // Check for immediate blackjack result
        if (data.immediateResult) {
          const { result: gameResult, payout: gamePayout } = data.immediateResult
          setResult(gameResult as GameResult)
          setPayout(gamePayout)
          setPhase('game_over')

          if (gamePayout > 0) {
            setShowWinAnimation(true)
            playSound('win')
            setTimeout(() => setShowWinAnimation(false), 3000)
          } else {
            playSound('lose')
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Hit - calls server API
  const hit = async () => {
    if (!gameId || isProcessing) return
    if (phase !== 'playing' && phase !== 'playing_split') return

    setIsProcessing(true)
    playSound('card')

    try {
      const data = await callAPI('hit', { gameId })

      if (data.success) {
        updateGameState(data)

        if (data.gameOver) {
          if (data.payout > 0) {
            setShowWinAnimation(true)
            playSound('win')
            setTimeout(() => setShowWinAnimation(false), 3000)
          } else {
            playSound('lose')
          }
        } else if (data.bust) {
          playSound('lose')
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Stand - calls server API
  const stand = async () => {
    if (!gameId || isProcessing) return
    if (phase !== 'playing' && phase !== 'playing_split') return

    setIsProcessing(true)
    playSound('flip')

    try {
      const data = await callAPI('stand', { gameId })

      if (data.success) {
        updateGameState(data)

        if (data.gameOver) {
          if (data.payout > 0) {
            setShowWinAnimation(true)
            playSound('win')
            setTimeout(() => setShowWinAnimation(false), 3000)
          } else if (data.result === 'lose' || data.splitResult === 'lose') {
            playSound('lose')
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Double - calls server API
  const doubleDown = async () => {
    if (!gameId || isProcessing || !canDouble) return

    const doubleAmount = phase === 'playing_split' ? splitBet : currentBet
    if (balance < doubleAmount) {
      toast.error('Yetersiz puan')
      return
    }

    setIsProcessing(true)
    playSound('chip')

    try {
      const data = await callAPI('double', { gameId })

      if (data.success) {
        playSound('card')
        updateGameState(data)

        if (data.gameOver) {
          if (data.payout > 0) {
            setShowWinAnimation(true)
            playSound('win')
            setTimeout(() => setShowWinAnimation(false), 3000)
          } else {
            playSound('lose')
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Split - calls server API
  const split = async () => {
    if (!gameId || isProcessing || !canSplit) return

    if (balance < currentBet) {
      toast.error('Yetersiz puan')
      return
    }

    setIsProcessing(true)
    playSound('chip')

    try {
      const data = await callAPI('split', { gameId })

      if (data.success) {
        setSplitBet(currentBet)
        playSound('card')
        updateGameState(data)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  // New game - reset state
  const newGame = () => {
    if (isProcessing) return

    playSound('chip')

    setGameId(null)
    setPlayerHand([])
    setSplitHand([])
    setDealerHand([])
    setPlayerValue(0)
    setSplitValue(null)
    setDealerValue(0)
    setPhase('betting')
    setActiveHand('main')
    setHasSplit(false)
    setCanSplit(false)
    setCanDouble(false)
    setResult(null)
    setSplitResult(null)
    setBet(0)
    setCurrentBet(0)
    setSplitBet(0)
    setPayout(0)
    setSelectedChip(null)
    setShowWinAnimation(false)

    // Refresh user balance from server
    refreshUser()
  }

  // Add chip to bet
  const addChip = (value: number) => {
    if (isProcessing || phase !== 'betting') return

    const newBet = bet + value

    // Check MAX_BET limit
    if (newBet > MAX_BET) {
      toast.error(`Maksimum bahis ${MAX_BET} puandır`)
      return
    }

    // Check balance
    if (newBet > balance) {
      toast.error('Yetersiz puan')
      return
    }

    playSound('chip')
    setBet(newBet)
    setSelectedChip(value)
  }

  // Clear bet
  const clearBet = () => {
    if (isProcessing || phase !== 'betting') return
    playSound('chip')
    setBet(0)
    setSelectedChip(null)
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #0f5132 0%, #0a3622 40%, #052e1c 70%, #021a0f 100%)' }}>
        <div className="text-center">
          <RotateCcw className="w-12 h-12 animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-white/70">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Casino table background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse at center, #0f5132 0%, #0a3622 40%, #052e1c 70%, #021a0f 100%)'
        }}
      />

      {/* Table felt texture overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

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
              <p><span className="text-amber-400 font-semibold">Bahis Limitleri:</span> Min: {MIN_BET} - Max: {MAX_BET} puan</p>
              <p><span className="text-amber-400 font-semibold">1.</span> Amac: Elinin degerini 21'e yaklastirmak ama gecmemek.</p>
              <p><span className="text-amber-400 font-semibold">2.</span> Kart degerleri: 2-10 = kendi degeri, J/Q/K = 10, A = 1 veya 11</p>
              <p><span className="text-amber-400 font-semibold">3.</span> <span className="text-amber-300">Blackjack:</span> Ilk 2 kart ile 21 = 3:2 odeme</p>
              <p><span className="text-amber-400 font-semibold">4.</span> <span className="text-green-400">HIT:</span> Yeni kart cek</p>
              <p><span className="text-amber-400 font-semibold">5.</span> <span className="text-red-400">STAND:</span> Kartlarinla kal</p>
              <p><span className="text-amber-400 font-semibold">6.</span> <span className="text-purple-400">DOUBLE:</span> Bahsi ikiye katla, tek kart cek</p>
              <p><span className="text-amber-400 font-semibold">7.</span> <span className="text-blue-400">SPLIT:</span> Ayni degerli 2 karti bol</p>
              <p><span className="text-amber-400 font-semibold">8.</span> Krupiye 17'ye kadar cekmek zorunda (Soft 17'de hit)</p>
            </div>

            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="w-full mt-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 transition-all shadow-lg"
            >
              Anladim
            </button>
          </div>
        </div>
      )}

      {/* Win animation overlay */}
      {showWinAnimation && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
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
        <div className="flex items-center gap-3">
          <Link
            href="/games"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
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
        </div>

        {/* Bet limits indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <span className="text-xs text-white/50">Bahis:</span>
          <span className="text-xs text-amber-400 font-medium">{MIN_BET} - {MAX_BET}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { playSound('chip'); setSoundEnabled(!soundEnabled) }}
            className={`p-3 rounded-xl transition-all ${soundEnabled ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'}`}
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
            value={dealerValue}
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

        {/* Split hand section */}
        {hasSplit && (
          <div className="text-center mb-4">
            <CardHand
              cards={splitHand}
              label="Split El"
              value={splitValue ?? 0}
              result={splitResult}
              bet={splitBet}
              isActive={phase === 'playing_split' && activeHand === 'split'}
            />
          </div>
        )}

        {/* Player section */}
        <div className="text-center mb-6">
          <CardHand
            cards={playerHand}
            label={hasSplit ? "Ana El" : "Sen"}
            value={playerValue}
            result={result}
            bet={currentBet}
            isActive={(phase === 'playing' || phase === 'playing_split') && activeHand === 'main'}
          />
        </div>

        {/* Result display */}
        {phase === 'game_over' && (result || splitResult) && (
          <div
            className={`mb-6 px-8 py-4 rounded-2xl text-center animate-in fade-in zoom-in duration-500 ${result === 'blackjack' ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border-2 border-amber-500/50' : ''} ${result === 'win' ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-2 border-green-500/50' : ''} ${result === 'lose' && !splitResult ? 'bg-gradient-to-r from-red-500/30 to-rose-500/30 border-2 border-red-500/50' : ''} ${result === 'push' ? 'bg-gradient-to-r from-gray-500/30 to-slate-500/30 border-2 border-gray-500/50' : ''}`}
          >
            <div className={`text-2xl sm:text-3xl font-black mb-1 ${result === 'blackjack' ? 'text-amber-400' : ''} ${result === 'win' ? 'text-green-400' : ''} ${result === 'lose' && !splitResult ? 'text-red-400' : ''} ${result === 'push' ? 'text-gray-400' : ''}`}>
              {result === 'blackjack' && '🎰 BLACKJACK! 🎰'}
              {result === 'win' && '🏆 KAZANDIN! 🏆'}
              {result === 'lose' && !splitResult && '❌ KAYBETTIN ❌'}
              {result === 'push' && '🤝 BERABERE 🤝'}
              {hasSplit && '🃏 OYUN BITTI 🃏'}
            </div>
            {payout > 0 && (
              <div className="text-lg font-bold text-amber-300">
                +{payout.toLocaleString()} puan
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="w-full max-w-xl space-y-4 mt-auto pb-6">
          {/* Bet display */}
          <div className="text-center">
            <div className="text-white/40 text-xs mb-1">
              {phase === 'betting' ? 'Bahis Miktari' : 'Mevcut Bahis'}
            </div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400">
              {(phase === 'betting' ? bet : currentBet) > 0
                ? (phase === 'betting' ? bet : currentBet).toLocaleString()
                : '-'}
            </div>
            {phase === 'betting' && bet > 0 && (
              <div className="text-xs text-white/40 mt-1">
                Max: {MAX_BET} | Kalan: {MAX_BET - bet}
              </div>
            )}
          </div>

          {/* Betting phase */}
          {phase === 'betting' && (
            <>
              {/* Chips */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap px-4">
                {DEFAULT_CHIPS.map(chip => {
                  const wouldExceedMax = bet + chip > MAX_BET
                  const wouldExceedBalance = bet + chip > balance
                  const isDisabled = wouldExceedMax || wouldExceedBalance

                  return (
                    <Chip
                      key={chip}
                      value={chip}
                      selected={selectedChip === chip}
                      onClick={() => addChip(chip)}
                      disabled={isDisabled}
                    />
                  )
                })}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={clearBet}
                  disabled={bet === 0}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-gray-600 hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                >
                  Temizle
                </button>

                <button
                  type="button"
                  onClick={startGame}
                  disabled={bet < MIN_BET || bet > MAX_BET || isProcessing}
                  className="px-10 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 transition-all shadow-xl shadow-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
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
          {(phase === 'playing' || phase === 'playing_split') && (
            <div className="flex items-center justify-center gap-3 flex-wrap px-4">
              <button
                type="button"
                onClick={stand}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-4 h-4 rounded bg-white/30" />
                STAND
              </button>

              <button
                type="button"
                onClick={hit}
                disabled={isProcessing}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30 scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✋ HIT
              </button>

              {canDouble && (
                <button
                  type="button"
                  onClick={doubleDown}
                  disabled={isProcessing || balance < currentBet}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💰 DOUBLE
                </button>
              )}

              {canSplit && !hasSplit && (
                <button
                  type="button"
                  onClick={split}
                  disabled={isProcessing || balance < currentBet}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✂️ SPLIT
                </button>
              )}
            </div>
          )}

          {/* Dealer turn */}
          {phase === 'dealer_turn' && (
            <div className="text-center text-white/60">
              <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
              <span className="text-sm">Krupiye oynuyor...</span>
            </div>
          )}

          {/* Game over */}
          {phase === 'game_over' && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={newGame}
                disabled={isProcessing}
                className="px-8 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 transition-all shadow-xl shadow-green-500/30"
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

// ============================================
// EXPORTED PAGE COMPONENT WITH AUTH
// ============================================
export default function BlackjackPage() {
  return (
    <ProtectedRoute requireAuth>
      <BlackjackGame />
    </ProtectedRoute>
  )
}
