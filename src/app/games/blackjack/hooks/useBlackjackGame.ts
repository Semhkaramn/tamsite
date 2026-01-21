'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'

import type { Card, GameState, GameResult } from '../types'
import { calculateHandDisplayValue, canSplitHand } from '../utils'
import type { BlackjackSettings } from '../lib'
import {
  loadGameSettings,
  startGame,
  hitAction,
  standAction,
  doubleAction,
  splitAction,
  getActiveGame
} from '../lib'
import { useSoundEffects } from './useSoundEffects'
import { useTimerManager } from './useTimerManager'
import { useGameLock } from './useGameLock'

export function useBlackjackGame() {
  const { user, refreshUser } = useAuth()

  // Game state - Server'dan gelen verilerle senkronize
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [splitHand, setSplitHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [gameState, setGameState] = useState<GameState>('betting')
  const [result, setResult] = useState<GameResult>(null)
  const [splitResult, setSplitResult] = useState<GameResult>(null)
  const [bet, setBet] = useState(0)
  const [selectedChip, setSelectedChip] = useState<number | null>(null)
  const [isDealing, setIsDealing] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showRules, setShowRules] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [winAmount, setWinAmount] = useState(0)
  const [animatingResult, setAnimatingResult] = useState(false)
  const [currentBet, setCurrentBet] = useState(0)
  const [splitBet, setSplitBet] = useState(0)
  const splitBetRef = useRef(0)
  const [isFlippingDealer, setIsFlippingDealer] = useState(false)
  const [dealerCardFlipped, setDealerCardFlipped] = useState(false)
  const [activeHand, setActiveHand] = useState<'main' | 'split'>('main')
  const [hasSplit, setHasSplit] = useState(false)
  const [gameId, setGameId] = useState<string>('')
  const [isSplitAnimating, setIsSplitAnimating] = useState(false)
  const [splitAnimationPhase, setSplitAnimationPhase] = useState<'idle' | 'separating' | 'dealing_right' | 'dealing_left' | 'done'>('idle')
  const [splitCards, setSplitCards] = useState<{ left: Card | null; right: Card | null }>({ left: null, right: null })
  const [showBustIndicator, setShowBustIndicator] = useState<'main' | 'split' | null>(null)

  // Server'dan gelen canSplit ve canDouble değerleri
  const [serverCanSplit, setServerCanSplit] = useState(false)
  const [serverCanDouble, setServerCanDouble] = useState(false)

  // Settings state
  const [gameSettings, setGameSettings] = useState<BlackjackSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [isDoubleDown, setIsDoubleDown] = useState(false)

  // Hooks
  const { playSound } = useSoundEffects(soundEnabled)
  const { addTimer, clearAllTimers, isMounted } = useTimerManager()
  const { resetLocks } = useGameLock()

  // Derived values
  const userPoints = user?.points || 0
  const minBet = gameSettings?.minBet || 10
  const maxBet = gameSettings?.maxBet || 500
  const isGameEnabled = !settingsLoading && gameSettings !== null && gameSettings.enabled === true && gameSettings.pendingDisable !== true

  // Action locked ref for sync checks
  const isActionLockedRef = useRef(false)

  const isActionLocked = useMemo(() => {
    return isProcessing || isDealing || isSplitAnimating || showBustIndicator !== null
  }, [isProcessing, isDealing, isSplitAnimating, showBustIndicator])

  useEffect(() => {
    isActionLockedRef.current = isActionLocked
  }, [isActionLocked])

  // Dynamic chips based on min/max bet
  const chips = useMemo(() => {
    const baseChips = [10, 25, 50, 100, 250, 500]
    return baseChips.filter(chip => chip >= minBet && chip <= maxBet)
  }, [minBet, maxBet])

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await loadGameSettings()
      setGameSettings(settings)
      setSettingsLoading(false)
    }
    loadSettings()
  }, [])

  // Check for active game on mount
  useEffect(() => {
    const checkActiveGame = async () => {
      try {
        const activeGame = await getActiveGame()
        if (activeGame.hasActiveGame && activeGame.gameId) {
          // Aktif oyun var, durumu yükle
          setGameId(activeGame.gameId)
          setPlayerHand(activeGame.playerHand || [])
          setSplitHand(activeGame.splitHand || [])
          setDealerHand(activeGame.dealerHand || [])
          setCurrentBet(activeGame.betAmount || 0)
          setSplitBet(activeGame.splitBetAmount || 0)
          splitBetRef.current = activeGame.splitBetAmount || 0
          setHasSplit(activeGame.hasSplit || false)
          setActiveHand(activeGame.activeHand || 'main')
          setServerCanSplit(activeGame.canSplit || false)
          setServerCanDouble(activeGame.canDouble || false)

          // Phase'i GameState'e çevir
          const phase = activeGame.phase as GameState
          if (phase === 'playing' || phase === 'playing_split' || phase === 'dealer_turn' || phase === 'game_over') {
            setGameState(phase)
          }

          toast.info('Devam eden oyununuz yüklendi')
        }
      } catch (error) {
        console.error('Error checking active game:', error)
      }
    }

    if (!settingsLoading) {
      checkActiveGame()
    }
  }, [settingsLoading])

  // Prevent leaving during active game
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (gameState === 'playing' || gameState === 'dealer_turn') {
        e.preventDefault()
        e.returnValue = 'Oyun devam ediyor! Sayfadan ayrılırsanız bahsinizi kaybedebilirsiniz.'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [gameState])

  // Calculate payout (for display only, server calculates actual)
  const calcPayout = useCallback((res: GameResult | null, betAmt: number): number => {
    if (!res) return 0
    switch (res) {
      case 'blackjack': return Math.floor(betAmt * 2.5)
      case 'win': return betAmt * 2
      case 'push': return betAmt
      default: return 0
    }
  }, [])

  // Get combined result for split hands (for display)
  const getCombinedResult = useCallback((mainRes: GameResult, splitRes: GameResult | null, mainBet: number, splitBetAmt: number): GameResult => {
    if (!splitRes) return mainRes
    const totalBet = mainBet + splitBetAmt
    const totalPayout = calcPayout(mainRes, mainBet) + calcPayout(splitRes, splitBetAmt)
    if (totalPayout > totalBet) return 'win'
    if (totalPayout < totalBet) return 'lose'
    return 'push'
  }, [calcPayout])

  // Display values - Server'dan gelen kartlarla hesapla
  const playerDisplayValue = useMemo(() => calculateHandDisplayValue(playerHand), [playerHand])
  const splitDisplayValue = useMemo(() => calculateHandDisplayValue(splitHand), [splitHand])
  const dealerDisplayValue = useMemo(() => {
    if (dealerHand.some(c => c.hidden) && !dealerCardFlipped) return '?'
    return calculateHandDisplayValue(dealerHand)
  }, [dealerHand, dealerCardFlipped])

  // Can double/split checks - Server'dan gelen değerleri kullan
  const canDouble = serverCanDouble && !isDoubleDown && userPoints >= currentBet
  const canSplit = serverCanSplit && !hasSplit && userPoints >= currentBet
  const displayBet = gameState === 'betting' ? bet : currentBet

  const displayResult = useMemo(() => {
    if (!result) return null
    if (hasSplit && splitResult) {
      return getCombinedResult(result, splitResult, currentBet, splitBet)
    }
    return result
  }, [result, splitResult, hasSplit, currentBet, splitBet, getCombinedResult])

  return {
    // State
    playerHand,
    setPlayerHand,
    splitHand,
    setSplitHand,
    dealerHand,
    setDealerHand,
    gameState,
    setGameState,
    result,
    setResult,
    splitResult,
    setSplitResult,
    bet,
    setBet,
    selectedChip,
    setSelectedChip,
    isDealing,
    setIsDealing,
    soundEnabled,
    setSoundEnabled,
    showRules,
    setShowRules,
    isProcessing,
    setIsProcessing,
    winAmount,
    setWinAmount,
    animatingResult,
    setAnimatingResult,
    currentBet,
    setCurrentBet,
    splitBet,
    setSplitBet,
    splitBetRef,
    isFlippingDealer,
    setIsFlippingDealer,
    dealerCardFlipped,
    setDealerCardFlipped,
    activeHand,
    setActiveHand,
    hasSplit,
    setHasSplit,
    gameId,
    setGameId,
    isSplitAnimating,
    setIsSplitAnimating,
    splitAnimationPhase,
    setSplitAnimationPhase,
    splitCards,
    setSplitCards,
    showBustIndicator,
    setShowBustIndicator,
    gameSettings,
    settingsLoading,
    isDoubleDown,
    setIsDoubleDown,
    serverCanSplit,
    setServerCanSplit,
    serverCanDouble,
    setServerCanDouble,

    // Derived
    userPoints,
    minBet,
    maxBet,
    isGameEnabled,
    chips,
    isActionLocked,
    isActionLockedRef,
    canDouble,
    canSplit,
    displayBet,
    displayResult,
    playerDisplayValue,
    splitDisplayValue,
    dealerDisplayValue,

    // Functions
    playSound,
    addTimer,
    clearAllTimers,
    isMounted,
    resetLocks,
    calcPayout,
    getCombinedResult,
    refreshUser,

    // API functions
    startGame,
    hitAction,
    standAction,
    doubleAction,
    splitAction
  }
}
