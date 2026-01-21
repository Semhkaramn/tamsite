'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ThemedCard, ThemedButton } from '@/components/ui/themed'
import {
  ArrowLeft, Volume2, VolumeX, Info, Coins, RefreshCw,
  Hand, Square, SplitSquareVertical, Trophy, Sparkles, AlertCircle
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type GameState = 'betting' | 'playing' | 'playing_split' | 'dealer_turn' | 'game_over'
type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null

interface Card {
  suit: Suit
  value: CardValue
  hidden?: boolean
  isNew?: boolean
  id?: string
}

interface BlackjackSettings {
  enabled: boolean
  maxBet: number
  minBet: number
  pendingDisable: boolean
}

// ============================================
// CONSTANTS
// ============================================
const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const SUIT_COLORS: Record<Suit, string> = { hearts: '#ef4444', diamonds: '#ef4444', clubs: '#1f2937', spades: '#1f2937' }
const DEFAULT_CHIPS = [10, 25, 50, 100, 250, 500]

const RESULT_CONFIG: Record<string, { title: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  blackjack: { title: 'BLACKJACK!', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)', icon: <Sparkles className="w-5 h-5 sm:w-7 sm:h-7" /> },
  win: { title: 'KAZANDIN!', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: <Trophy className="w-5 h-5 sm:w-7 sm:h-7" /> },
  lose: { title: 'KAYBETTİN', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: <AlertCircle className="w-5 h-5 sm:w-7 sm:h-7" /> },
  push: { title: 'BERABERE', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)', icon: <RefreshCw className="w-5 h-5 sm:w-7 sm:h-7" /> }
}

// ============================================
// UTILS
// ============================================
let cardIdCounter = 0
const generateCardId = () => `card-${Date.now()}-${++cardIdCounter}`

function calculateHandValue(hand: Card[], ignoreHidden = false): number {
  let value = 0, aces = 0
  for (const card of hand) {
    if (card.hidden && !ignoreHidden) continue
    if (card.value === 'A') { aces++; value += 11 }
    else if (['J', 'Q', 'K'].includes(card.value)) value += 10
    else value += Number.parseInt(card.value)
  }
  while (value > 21 && aces > 0) { value -= 10; aces-- }
  return value
}

function calculateHandDisplayValue(hand: Card[], ignoreHidden = false): string {
  let value = 0, aces = 0, usedAces = 0
  for (const card of hand) {
    if (card.hidden && !ignoreHidden) continue
    if (card.value === 'A') { aces++; value += 11 }
    else if (['J', 'Q', 'K'].includes(card.value)) value += 10
    else value += Number.parseInt(card.value)
  }
  while (value > 21 && usedAces < aces) { value -= 10; usedAces++ }
  const softAces = aces - usedAces
  if (softAces > 0 && value <= 21) {
    const hardValue = value - 10
    if (hardValue !== value && hardValue > 0) return `${hardValue}/${value}`
  }
  return value.toString()
}

// ============================================
// API CALLS
// ============================================
async function loadGameSettings(): Promise<BlackjackSettings | null> {
  try {
    const res = await fetch('/api/games/settings')
    if (res.ok) { const data = await res.json(); return data.blackjack }
    return null
  } catch { return null }
}

async function apiCall(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/games/blackjack/bet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'İşlem başarısız')
  return data
}

async function getActiveGame() {
  try {
    const res = await fetch('/api/games/blackjack/bet')
    if (!res.ok) return { hasActiveGame: false }
    return await res.json()
  } catch { return { hasActiveGame: false } }
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
        cardFlip: new Audio('/sounds/card-flip.mp3'),
        chip: new Audio('/sounds/chip.mp3'),
        win: new Audio('/sounds/win.mp3'),
        lose: new Audio('/sounds/lose.mp3')
      }
      Object.values(audioRefs.current).forEach(a => { a.preload = 'auto'; a.volume = 0.5 })
    }
    return () => { mounted.current = false }
  }, [])

  const play = useCallback((type: string) => {
    if (!enabled || !mounted.current) return
    const audio = type === 'blackjack' ? audioRefs.current.win : audioRefs.current[type]
    if (audio) {
      const clone = audio.cloneNode() as HTMLAudioElement
      clone.volume = 0.5
      clone.play().catch(() => {})
    }
  }, [enabled])

  return play
}

// ============================================
// TIMER HOOK
// ============================================
function useTimers() {
  const mounted = useRef(true)
  const timers = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      timers.current.forEach(clearTimeout)
    }
  }, [])

  const add = useCallback((fn: () => void, delay: number) => {
    const t = setTimeout(() => { if (mounted.current) fn() }, delay)
    timers.current.push(t)
    return t
  }, [])

  const clear = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = [] }, [])
  const isMounted = useCallback(() => mounted.current, [])

  return { add, clear, isMounted }
}

// ============================================
// PLAYING CARD COMPONENT
// ============================================
function PlayingCard({ card, index, isDealing = false, delay = 0, isFlipping = false, hasFlipped = false }: {
  card: Card; index: number; isDealing?: boolean; delay?: number; isFlipping?: boolean; hasFlipped?: boolean
}) {
  const [visible, setVisible] = useState(!isDealing && !card.isNew)
  const [showFront, setShowFront] = useState(!card.hidden)

  useEffect(() => {
    if (isDealing || card.isNew) {
      setVisible(false)
      const t = setTimeout(() => setVisible(true), delay + 50)
      return () => clearTimeout(t)
    }
    setVisible(true)
  }, [isDealing, card.isNew, delay])

  useEffect(() => {
    if (isFlipping) {
      const t = setTimeout(() => setShowFront(true), 250)
      return () => clearTimeout(t)
    }
    if (hasFlipped) setShowFront(true)
    else if (!isFlipping) setShowFront(!card.hidden)
  }, [isFlipping, hasFlipped, card.hidden])

  const symbol = SUIT_SYMBOLS[card.suit]
  const color = SUIT_COLORS[card.suit]
  const shouldShowBack = card.hidden && !isFlipping && !hasFlipped
  const rotateY = shouldShowBack ? 180 : (isFlipping && !showFront ? 180 : 0)

  return (
    <div
      className={`relative w-[72px] h-[108px] sm:w-[80px] sm:h-[120px] md:w-[88px] md:h-[132px] transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0'}`}
      style={{ perspective: '1000px' }}
    >
      <div className="relative w-full h-full transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: `rotateY(${rotateY}deg)` }}>
        {/* Front */}
        <div className="absolute inset-0 rounded-lg shadow-xl bg-white border border-gray-300" style={{ backfaceVisibility: 'hidden' }}>
          <div className="absolute top-1 left-1 flex flex-col items-center">
            <span className="text-xs sm:text-sm font-bold" style={{ color }}>{card.value}</span>
            <span className="text-sm sm:text-base" style={{ color }}>{symbol}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl sm:text-3xl md:text-4xl" style={{ color }}>{symbol}</span>
          </div>
          <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
            <span className="text-xs sm:text-sm font-bold" style={{ color }}>{card.value}</span>
            <span className="text-sm sm:text-base" style={{ color }}>{symbol}</span>
          </div>
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 rounded-lg shadow-xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e40af 0%, #172554 100%)', border: '2px solid #3b82f6', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-blue-400/40 flex items-center justify-center bg-blue-900/30">
              <span className="text-blue-300/60 text-sm font-bold">BJ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// CHIP COMPONENT
// ============================================
function Chip({ value, selected, onClick, disabled }: { value: number; selected: boolean; onClick: () => void; disabled?: boolean }) {
  const colors: Record<number, string> = {
    10: 'from-blue-500 to-blue-700', 25: 'from-green-500 to-green-700', 50: 'from-red-500 to-red-700',
    100: 'from-purple-500 to-purple-700', 250: 'from-amber-500 to-amber-700', 500: 'from-slate-600 to-slate-800'
  }
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg transition-all ${selected ? 'scale-110 ring-4 ring-white/60' : 'hover:scale-105'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} bg-gradient-to-br ${colors[value] || colors[10]}`}
    >
      <span className="font-bold text-xs sm:text-sm text-white drop-shadow-md">{value}</span>
    </button>
  )
}

// ============================================
// CARD HAND COMPONENT
// ============================================
function CardHand({ cards, isDealing, isFlippingIndex, hasFlippedIndex, label, value, bet, result, isActive, showActiveIndicator }: {
  cards: Card[]; isDealing?: boolean; isFlippingIndex?: number; hasFlippedIndex?: number
  label?: string; value?: string; bet?: number; result?: string | null; isActive?: boolean; showActiveIndicator?: boolean
}) {
  return (
    <div className="relative p-2 sm:p-3 rounded-xl">
      {showActiveIndicator && isActive && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
          <span className="text-amber-400 text-xl animate-bounce">▼</span>
        </div>
      )}
      <div className="relative min-h-[115px] sm:min-h-[130px] flex items-center justify-center">
        {cards.length === 0 ? (
          <div className="w-[72px] h-[108px] rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center">
            <span className="text-white/30 text-xs">Kart</span>
          </div>
        ) : (
          cards.map((card, i) => (
            <div key={card.id || `${i}-${card.suit}-${card.value}`} className="absolute" style={{ left: `${i * 32}px`, zIndex: i + 1 }}>
              <PlayingCard card={card} index={i} isDealing={isDealing && card.isNew} delay={i * 100} isFlipping={isFlippingIndex === i} hasFlipped={hasFlippedIndex === i} />
            </div>
          ))
        )}
      </div>
      <div className="text-center mt-2 space-y-1 min-h-[50px]">
        {(label || value) && (
          <div className="text-white/80 text-xs sm:text-sm font-semibold">
            {label && <span>{label}</span>}
            {value && <span className="ml-1 text-white font-bold">({value})</span>}
          </div>
        )}
        {bet !== undefined && bet > 0 && (
          <div className="inline-flex items-center gap-1 text-amber-400 text-[10px] sm:text-xs bg-amber-400/10 px-2 py-0.5 rounded-full">
            <span className="text-amber-500">●</span>{bet} puan
          </div>
        )}
        {result && RESULT_CONFIG[result] && (
          <div className="inline-block text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: RESULT_CONFIG[result].bgColor, color: RESULT_CONFIG[result].color }}>
            {RESULT_CONFIG[result].title}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// MAIN BLACKJACK GAME COMPONENT
// ============================================
export default function BlackjackGame() {
  const { user, refreshUser } = useAuth()
  const { theme } = useUserTheme()

  // Settings
  const [settings, setSettings] = useState<BlackjackSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showRules, setShowRules] = useState(false)

  // Game state
  const [gameId, setGameId] = useState('')
  const [gameState, setGameState] = useState<GameState>('betting')
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [splitHand, setSplitHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [result, setResult] = useState<GameResult>(null)
  const [splitResult, setSplitResult] = useState<GameResult>(null)
  const [activeHand, setActiveHand] = useState<'main' | 'split'>('main')
  const [hasSplit, setHasSplit] = useState(false)

  // Betting
  const [bet, setBet] = useState(0)
  const [currentBet, setCurrentBet] = useState(0)
  const [splitBet, setSplitBet] = useState(0)
  const [selectedChip, setSelectedChip] = useState<number | null>(null)
  const [winAmount, setWinAmount] = useState(0)

  // UI state
  const [isDealing, setIsDealing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFlippingDealer, setIsFlippingDealer] = useState(false)
  const [dealerCardFlipped, setDealerCardFlipped] = useState(false)
  const [animatingResult, setAnimatingResult] = useState(false)
  const [serverCanSplit, setServerCanSplit] = useState(false)
  const [serverCanDouble, setServerCanDouble] = useState(false)

  // Hooks
  const playSound = useSounds(soundEnabled)
  const timer = useTimers()
  const lockRef = useRef(false)

  // Derived values
  const userPoints = user?.points || 0
  const minBet = settings?.minBet || 10
  const maxBet = settings?.maxBet || 500
  const isGameEnabled = !settingsLoading && settings?.enabled && !settings?.pendingDisable
  const isLocked = isProcessing || isDealing
  const chips = useMemo(() => DEFAULT_CHIPS.filter(c => c >= minBet && c <= maxBet), [minBet, maxBet])
  const canDouble = serverCanDouble && userPoints >= currentBet
  const canSplit = serverCanSplit && !hasSplit && userPoints >= currentBet

  const playerDisplayValue = useMemo(() => calculateHandDisplayValue(playerHand), [playerHand])
  const splitDisplayValue = useMemo(() => calculateHandDisplayValue(splitHand), [splitHand])
  const dealerDisplayValue = useMemo(() => {
    if (dealerHand.some(c => c.hidden) && !dealerCardFlipped) return '?'
    return calculateHandDisplayValue(dealerHand)
  }, [dealerHand, dealerCardFlipped])

  const displayResult = useMemo(() => {
    if (!result) return null
    if (hasSplit && splitResult) {
      const mainPayout = result === 'blackjack' ? currentBet * 2.5 : result === 'win' ? currentBet * 2 : result === 'push' ? currentBet : 0
      const splitPayout = splitResult === 'win' ? splitBet * 2 : splitResult === 'push' ? splitBet : 0
      const total = mainPayout + splitPayout
      const totalBet = currentBet + splitBet
      if (total > totalBet) return 'win'
      if (total < totalBet) return 'lose'
      return 'push'
    }
    return result
  }, [result, splitResult, hasSplit, currentBet, splitBet])

  // Load settings
  useEffect(() => {
    loadGameSettings().then(s => { setSettings(s); setSettingsLoading(false) })
  }, [])

  // Check active game
  useEffect(() => {
    if (!settingsLoading) {
      getActiveGame().then(g => {
        if (g.hasActiveGame && g.gameId) {
          setGameId(g.gameId)
          setPlayerHand(g.playerHand || [])
          setSplitHand(g.splitHand || [])
          setDealerHand(g.dealerHand || [])
          setCurrentBet(g.betAmount || 0)
          setSplitBet(g.splitBetAmount || 0)
          setHasSplit(g.hasSplit || false)
          setActiveHand(g.activeHand || 'main')
          setServerCanSplit(g.canSplit || false)
          setServerCanDouble(g.canDouble || false)
          if (['playing', 'playing_split', 'dealer_turn', 'game_over'].includes(g.phase)) {
            setGameState(g.phase)
          }
          toast.info('Devam eden oyununuz yüklendi')
        }
      })
    }
  }, [settingsLoading])

  // Helpers
  const animateCards = (cards: Card[]) => cards.map(c => ({ ...c, id: c.id || generateCardId(), isNew: true }))

  const handleGameOver = async (res: any) => {
    setIsFlippingDealer(true)
    playSound('cardFlip')
    timer.add(() => {
      setIsFlippingDealer(false)
      setDealerCardFlipped(true)
      setDealerHand(res.dealerHand)
      timer.add(async () => {
        if (res.result) setResult(res.result)
        if (res.splitResult) setSplitResult(res.splitResult)
        setGameState('game_over')
        setAnimatingResult(true)
        setWinAmount(res.payout)
        playSound(res.payout > 0 ? 'win' : 'lose')
        await refreshUser()
        setIsProcessing(false)
        lockRef.current = false
        timer.add(() => setAnimatingResult(false), 2500)
      }, 400)
    }, 700)
  }

  // Actions
  const dealCards = async () => {
    if (lockRef.current || isLocked || !isGameEnabled || bet === 0 || bet > userPoints) return
    lockRef.current = true
    setIsProcessing(true)
    setIsDealing(true)
    setCurrentBet(bet)
    setDealerCardFlipped(false)
    setHasSplit(false)
    setSplitHand([])
    setSplitBet(0)
    setSplitResult(null)
    setResult(null)
    setWinAmount(0)

    try {
      const res = await apiCall('start', { amount: bet })
      await refreshUser()
      setGameId(res.gameId)
      setServerCanSplit(res.canSplit)
      setServerCanDouble(res.canDouble)
      setGameState('playing')

      const pCards = animateCards(res.playerHand)
      const dCards = animateCards(res.dealerHand)

      playSound('card')
      setPlayerHand([pCards[0]])
      timer.add(() => { playSound('card'); setDealerHand([dCards[0]]) }, 450)
      timer.add(() => { playSound('card'); setPlayerHand([{ ...pCards[0], isNew: false }, pCards[1]]) }, 900)
      timer.add(() => { playSound('card'); setDealerHand([{ ...dCards[0], isNew: false }, dCards[1]]) }, 1350)

      timer.add(async () => {
        if (res.immediateResult) {
          setIsFlippingDealer(true)
          playSound('cardFlip')
          timer.add(() => {
            setIsFlippingDealer(false)
            setDealerCardFlipped(true)
            setDealerHand(dCards.map((c: Card) => ({ ...c, hidden: false, isNew: false })))
            timer.add(async () => {
              setResult(res.immediateResult.result)
              setGameState('game_over')
              setAnimatingResult(true)
              setWinAmount(res.immediateResult.payout)
              playSound(res.immediateResult.result === 'blackjack' ? 'blackjack' : res.immediateResult.payout > 0 ? 'win' : 'lose')
              await refreshUser()
              setIsDealing(false)
              setIsProcessing(false)
              lockRef.current = false
              timer.add(() => setAnimatingResult(false), 2500)
            }, 400)
          }, 700)
        } else {
          setIsDealing(false)
          setIsProcessing(false)
          lockRef.current = false
        }
      }, 1800)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata!')
      setIsProcessing(false)
      setIsDealing(false)
      lockRef.current = false
    }
  }

  const hit = async () => {
    if (lockRef.current || isLocked || (gameState !== 'playing' && gameState !== 'playing_split')) return
    lockRef.current = true
    setIsProcessing(true)
    playSound('card')

    try {
      const res = await apiCall('hit', { gameId })
      setPlayerHand(animateCards(res.playerHand))
      if (res.splitHand?.length) setSplitHand(animateCards(res.splitHand))
      setActiveHand(res.activeHand)
      setServerCanSplit(false)
      setServerCanDouble(false)

      if (res.bust) {
        playSound('lose')
        if (res.gameOver) {
          timer.add(() => handleGameOver(res), 700)
        } else {
          setGameState(res.phase)
          timer.add(() => { setIsProcessing(false); lockRef.current = false }, 300)
        }
      } else if (res.gameOver) {
        timer.add(() => handleGameOver(res), 500)
      } else {
        setGameState(res.phase)
        timer.add(() => { setIsProcessing(false); lockRef.current = false }, 300)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata!')
      setIsProcessing(false)
      lockRef.current = false
    }
  }

  const stand = async () => {
    if (lockRef.current || isLocked || (gameState !== 'playing' && gameState !== 'playing_split')) return
    lockRef.current = true
    setIsProcessing(true)

    try {
      const res = await apiCall('stand', { gameId })
      if (!res.gameOver) {
        setGameState(res.phase)
        setActiveHand(res.activeHand)
        timer.add(() => { setIsProcessing(false); lockRef.current = false }, 300)
      } else {
        setGameState('dealer_turn')
        handleGameOver(res)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata!')
      setIsProcessing(false)
      lockRef.current = false
    }
  }

  const double = async () => {
    if (lockRef.current || isLocked || !canDouble) return
    lockRef.current = true
    setIsProcessing(true)
    playSound('chip')

    try {
      const res = await apiCall('double', { gameId })
      await refreshUser()
      setCurrentBet(c => c * 2)
      setServerCanDouble(false)
      playSound('card')
      setPlayerHand(animateCards(res.playerHand))
      if (res.splitHand?.length) setSplitHand(animateCards(res.splitHand))

      if (res.gameOver) {
        timer.add(() => handleGameOver(res), 500)
      } else {
        setGameState(res.phase)
        setActiveHand(res.activeHand)
        timer.add(() => { setIsProcessing(false); lockRef.current = false }, 300)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata!')
      setIsProcessing(false)
      lockRef.current = false
    }
  }

  const split = async () => {
    if (lockRef.current || isLocked || !canSplit) return
    lockRef.current = true
    setIsProcessing(true)
    playSound('chip')

    try {
      const res = await apiCall('split', { gameId })
      await refreshUser()
      setSplitBet(currentBet)
      setHasSplit(true)
      setServerCanSplit(false)

      timer.add(() => {
        playSound('card')
        setSplitHand(animateCards(res.splitHand))
        timer.add(() => {
          playSound('card')
          setPlayerHand(animateCards(res.playerHand))
          timer.add(() => {
            setActiveHand('split')
            setGameState('playing_split')
            setServerCanDouble(res.splitHand?.length === 2)
            setIsProcessing(false)
            lockRef.current = false
          }, 500)
        }, 600)
      }, 400)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata!')
      setIsProcessing(false)
      lockRef.current = false
    }
  }

  const newGame = () => {
    if (lockRef.current || isLocked) return
    timer.clear()
    playSound('chip')
    setPlayerHand([]); setSplitHand([]); setDealerHand([])
    setGameState('betting'); setResult(null); setSplitResult(null)
    setBet(0); setCurrentBet(0); setSplitBet(0); setSelectedChip(null)
    setWinAmount(0); setIsFlippingDealer(false); setDealerCardFlipped(false)
    setHasSplit(false); setActiveHand('main'); setGameId('')
    setServerCanSplit(false); setServerCanDouble(false)
    lockRef.current = false
  }

  const addChip = (value: number) => {
    if (lockRef.current || isLocked) return
    let newBet = Math.min(bet + value, maxBet, userPoints)
    if (newBet <= 0) { toast.error('Yetersiz puan!'); return }
    playSound('chip')
    setBet(newBet)
    setSelectedChip(value)
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(180deg, #0d4f3c 0%, #063528 50%, #021f17 100%)' }} />

      {/* Game Disabled */}
      {!settingsLoading && !isGameEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <ThemedCard className="max-w-md w-full p-6 text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-amber-500" />
            <h2 className="text-xl font-bold text-white">Blackjack Şu Anda Kapalı</h2>
            <p className="text-white/70 text-sm">Blackjack oyunu geçici olarak devre dışı bırakılmıştır.</p>
            <Link href="/games"><ThemedButton className="w-full"><ArrowLeft className="w-4 h-4 mr-2" />Oyunlara Dön</ThemedButton></Link>
          </ThemedCard>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <ThemedCard className="max-w-md w-full p-4 sm:p-6 space-y-3">
            <h3 className="text-lg font-bold" style={{ color: theme.colors.text }}>Blackjack Kuralları</h3>
            <div className="space-y-2 text-xs sm:text-sm" style={{ color: theme.colors.textMuted }}>
              <p><strong>1.</strong> Amaç: Elinizin değerini 21'e yaklaştırmak, ama 21'i geçmemek.</p>
              <p><strong>2.</strong> Kart değerleri: 2-10 kendi değerleri, J/Q/K = 10, A = 1 veya 11</p>
              <p><strong>3.</strong> Blackjack: İlk 2 kart ile 21 = 3:2 ödeme</p>
              <p><strong>4.</strong> <span className="text-green-400">HIT</span>: Yeni kart çek</p>
              <p><strong>5.</strong> <span className="text-red-400">STAND</span>: Kartlarınla kal</p>
              <p><strong>6.</strong> <span className="text-amber-400">DOUBLE</span>: Bahsi ikiye katla, tek kart çek</p>
              <p><strong>7.</strong> <span className="text-purple-400">SPLIT</span>: Aynı değerde 2 kart varsa eli böl</p>
              <p><strong>8.</strong> Krupiye 17'ye kadar çekmek zorunda</p>
            </div>
            <ThemedButton onClick={() => setShowRules(false)} className="w-full">Anladım</ThemedButton>
          </ThemedCard>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center p-2 sm:p-4">
        <div className="w-full max-w-4xl flex items-center justify-between mb-2">
          <Link href="/games">
            <ThemedButton variant="secondary" className="gap-1.5 text-sm px-3 py-2">
              <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Geri</span>
            </ThemedButton>
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { playSound('chip'); setSoundEnabled(!soundEnabled) }}
              className="p-2.5 rounded-xl transition-all hover:scale-105"
              style={{ background: soundEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: soundEnabled ? '#22c55e' : '#ef4444' }}>
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button type="button" onClick={() => { playSound('chip'); setShowRules(true) }}
              className="p-2.5 rounded-xl transition-all hover:scale-105" style={{ background: theme.colors.backgroundSecondary, color: theme.colors.textMuted }}>
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>
        <ThemedCard className="px-4 py-2 flex items-center gap-2 shadow-xl">
          <Coins className="w-5 h-5 text-amber-400" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-white/50 uppercase tracking-wider">Puanın</span>
            <span className="text-lg font-bold text-amber-400">{userPoints.toLocaleString()}</span>
          </div>
        </ThemedCard>
      </div>

      {/* Game Area */}
      <div className="flex flex-col items-center min-h-[calc(100vh-120px)] py-2 px-2">
        {/* Dealer */}
        <div className="text-center space-y-2 h-[145px] sm:h-[165px] flex flex-col justify-end">
          <div className="text-white/60 text-xs font-medium flex items-center justify-center gap-1.5">
            <span>Krupiye</span>
            {gameState !== 'betting' && <span className="bg-white/10 px-2 py-0.5 rounded text-white/80 font-bold">{dealerDisplayValue}</span>}
          </div>
          <CardHand cards={dealerHand} isDealing={isDealing} isFlippingIndex={isFlippingDealer ? 1 : undefined} hasFlippedIndex={dealerCardFlipped ? 1 : undefined} />
        </div>

        {/* Player */}
        <div className="text-center space-y-2">
          {hasSplit && splitHand.length > 0 ? (
            <div className="flex items-start justify-center gap-3 sm:gap-6 min-h-[240px]">
              <CardHand cards={playerHand} value={playerDisplayValue} bet={currentBet} result={result} isActive={activeHand === 'main'} showActiveIndicator={gameState === 'playing' || gameState === 'playing_split'} />
              <CardHand cards={splitHand} value={splitDisplayValue} bet={splitBet} result={splitResult} isActive={activeHand === 'split'} showActiveIndicator={gameState === 'playing' || gameState === 'playing_split'} />
            </div>
          ) : (
            <CardHand cards={playerHand} isDealing={isDealing} label={gameState !== 'betting' ? 'Sen' : undefined} value={gameState !== 'betting' ? playerDisplayValue : undefined} />
          )}
        </div>

        {/* Result Display */}
        <div className="h-[70px] sm:h-[90px] flex items-center justify-center relative w-full">
          {displayResult && gameState === 'game_over' && RESULT_CONFIG[displayResult] && (
            <div className={`absolute inset-x-0 flex justify-center transition-all duration-500 ${animatingResult ? 'scale-110' : 'scale-100'}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl shadow-2xl" style={{ background: RESULT_CONFIG[displayResult].bgColor, border: `2px solid ${RESULT_CONFIG[displayResult].color}`, color: RESULT_CONFIG[displayResult].color }}>
                {RESULT_CONFIG[displayResult].icon}
                <div>
                  <div className="text-base sm:text-2xl font-bold">{RESULT_CONFIG[displayResult].title}</div>
                  {winAmount > 0 && <div className="text-xs sm:text-base font-medium opacity-80">+{winAmount.toLocaleString()} puan</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full max-w-xl space-y-3 flex-1 flex flex-col justify-end pb-3 px-2">
          {/* Bet Display */}
          <div className="text-center">
            <div className="text-white/40 text-[10px] mb-1">{gameState === 'betting' ? `Bahis Miktarı (Maks: ${maxBet})` : 'Bahis'}</div>
            <div className="text-xl sm:text-3xl font-bold text-amber-400">
              {(gameState === 'betting' ? bet : (hasSplit ? currentBet + splitBet : currentBet)) > 0 ? (gameState === 'betting' ? bet : (hasSplit ? currentBet + splitBet : currentBet)).toLocaleString() : '-'}
            </div>
          </div>

          {gameState === 'betting' && (
            <>
              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap px-2">
                {chips.map(c => <Chip key={c} value={c} selected={selectedChip === c} onClick={() => addChip(c)} disabled={isLocked || bet >= maxBet} />)}
              </div>
              <div className="flex items-center justify-center gap-4">
                <button type="button" onClick={() => { if (!isLocked && bet > 0) { playSound('chip'); setBet(0); setSelectedChip(null) } }} disabled={bet === 0 || isLocked}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 bg-gray-600 hover:bg-gray-700 active:scale-95 text-white">Temizle</button>
                <button type="button" onClick={dealCards} disabled={bet === 0 || isLocked}
                  className="px-8 py-3 rounded-xl text-base font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white shadow-lg shadow-emerald-500/30">
                  {isLocked ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'DAĞIT'}
                </button>
              </div>
            </>
          )}

          {(gameState === 'playing' || gameState === 'playing_split') && (
            <div className="flex items-center justify-center gap-2 flex-wrap px-2">
              <button type="button" onClick={stand} disabled={isLocked}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95 text-white shadow-lg shadow-red-500/30">
                <Square className="w-4 h-4" />STAND
              </button>
              <button type="button" onClick={hit} disabled={isLocked}
                className="flex items-center gap-1.5 px-6 py-3 rounded-xl text-base font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:scale-95 text-white shadow-lg shadow-green-500/30 scale-105">
                <Hand className="w-5 h-5" />HIT
              </button>
              {canDouble && (
                <button type="button" onClick={double} disabled={isLocked}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white shadow-lg shadow-amber-500/30">
                  <Coins className="w-4 h-4" />DOUBLE
                </button>
              )}
              {canSplit && (
                <button type="button" onClick={split} disabled={isLocked}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:scale-95 text-white shadow-lg shadow-purple-500/30">
                  <SplitSquareVertical className="w-3 h-3" />SPLIT
                </button>
              )}
            </div>
          )}

          {gameState === 'dealer_turn' && (
            <div className="text-center text-white/60 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Krupiye oynuyor...
            </div>
          )}

          {gameState === 'game_over' && (
            <div className="flex items-center justify-center">
              <button type="button" onClick={newGame} disabled={isLocked}
                className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white shadow-lg shadow-emerald-500/30">
                YENİ OYUN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
