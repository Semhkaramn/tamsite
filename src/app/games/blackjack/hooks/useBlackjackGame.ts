'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'

import type { Card, GameState, GameResult } from '../types'
import {
  calculateHandDisplayValue,
  canSplitHand
} from '../utils'
import type { BlackjackSettings } from '../lib'
import {
  loadGameSettings,
  getActiveGame,
  startGame,
  hitAction,
  standAction,
  doubleAction,
  splitAction,
  type GameResponse
} from '../lib'
import { useSoundEffects } from './useSoundEffects'
import { useTimerManager } from './useTimerManager'

export function useBlackjackGame() {
  const { user, refreshUser } = useAuth()

  // Game state - simplified, all data comes from server
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

  // Server-side can flags
  const [serverCanSplit, setServerCanSplit] = useState(false)
  const [serverCanDouble, setServerCanDouble] = useState(false)

  // Settings state
  const [gameSettings, setGameSettings] = useState<BlackjackSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [isDoubleDown, setIsDoubleDown] = useState(false)

  // Hooks
  const { playSound } = useSoundEffects(soundEnabled)
  const { addTimer, clearAllTimers, isMounted } = useTimerManager()

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
      if (!user) return

      const activeGame = await getActiveGame()
      if (activeGame.hasActiveGame && activeGame.gameId) {
        // Restore active game state
        setGameId(activeGame.gameId)
        setCurrentBet(activeGame.betAmount || 0)
        setSplitBet(activeGame.splitBetAmount || 0)
        splitBetRef.current = activeGame.splitBetAmount || 0
        setPlayerHand(activeGame.playerHand || [])
        setSplitHand(activeGame.splitHand || [])
        setDealerHand(activeGame.dealerHand || [])
        setGameState(activeGame.phase || 'playing')
        setActiveHand(activeGame.activeHand || 'main')
        setHasSplit(activeGame.hasSplit || false)
        setServerCanSplit(activeGame.canSplit || false)
        setServerCanDouble(activeGame.canDouble || false)

        toast.info('Devam eden oyununuz yüklendi!')
      }
    }

    checkActiveGame()
  }, [user])

  // Prevent leaving during active game
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (gameState === 'playing' || gameState === 'dealer_turn' || gameState === 'playing_split') {
        e.preventDefault()
        e.returnValue = 'Oyun devam ediyor! Sayfadan ayrılırsanız bahsinizi kaybedebilirsiniz.'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [gameState])

  // Calculate payout
  const calcPayout = useCallback((res: GameResult | null, betAmt: number): number => {
    if (!res) return 0
    switch (res) {
      case 'blackjack': return Math.floor(betAmt * 2.5)
      case 'win': return betAmt * 2
      case 'push': return betAmt
      default: return 0
    }
  }, [])

  // Get combined result for split hands
  const getCombinedResult = useCallback((mainRes: GameResult, splitRes: GameResult | null, mainBet: number, splitBetAmt: number): GameResult => {
    if (!splitRes) return mainRes
    const totalBet = mainBet + splitBetAmt
    const totalPayout = calcPayout(mainRes, mainBet) + calcPayout(splitRes, splitBetAmt)
    if (totalPayout > totalBet) return 'win'
    if (totalPayout < totalBet) return 'lose'
    return 'push'
  }, [calcPayout])

  // Display values
  const playerDisplayValue = useMemo(() => calculateHandDisplayValue(playerHand), [playerHand])
  const splitDisplayValue = useMemo(() => calculateHandDisplayValue(splitHand), [splitHand])
  const dealerDisplayValue = useMemo(() => {
    if (dealerHand.some(c => c.hidden) && !dealerCardFlipped) return '?'
    return calculateHandDisplayValue(dealerHand)
  }, [dealerHand, dealerCardFlipped])

  // Can double/split - use server flags or local fallback
  const originalBetForDouble = isDoubleDown ? Math.floor(currentBet / 2) : currentBet
  const canDouble = serverCanDouble && !isDoubleDown && userPoints >= originalBetForDouble
  const canSplit = serverCanSplit && canSplitHand(playerHand) && userPoints >= currentBet && !hasSplit
  const displayBet = gameState === 'betting' ? bet : currentBet

  const displayResult = useMemo(() => {
    if (!result) return null
    if (hasSplit && splitResult) {
      return getCombinedResult(result, splitResult, currentBet, splitBet)
    }
    return result
  }, [result, splitResult, hasSplit, currentBet, splitBet, getCombinedResult])

  // Update state from server response
  const updateFromResponse = useCallback((response: GameResponse) => {
    if (response.playerHand) {
      // Mark new cards
      const existingIds = new Set(playerHand.map(c => c.id))
      const updatedHand = response.playerHand.map(c => ({
        ...c,
        isNew: !existingIds.has(c.id)
      }))
      setPlayerHand(updatedHand)
    }
    if (response.splitHand) {
      const existingIds = new Set(splitHand.map(c => c.id))
      const updatedHand = response.splitHand.map(c => ({
        ...c,
        isNew: !existingIds.has(c.id)
      }))
      setSplitHand(updatedHand)
    }
    if (response.dealerHand) {
      const existingIds = new Set(dealerHand.map(c => c.id))
      const updatedHand = response.dealerHand.map(c => ({
        ...c,
        isNew: !existingIds.has(c.id)
      }))
      setDealerHand(updatedHand)
    }
    if (response.phase) setGameState(response.phase)
    if (response.activeHand) setActiveHand(response.activeHand)
    if (response.hasSplit !== undefined) setHasSplit(response.hasSplit)
    if (response.canSplit !== undefined) setServerCanSplit(response.canSplit)
    if (response.canDouble !== undefined) setServerCanDouble(response.canDouble)
    if (response.result) setResult(response.result)
    if (response.splitResult) setSplitResult(response.splitResult)
    if (response.payout !== undefined) setWinAmount(response.payout)
  }, [playerHand, splitHand, dealerHand])

  // Reset game state
  const resetGame = useCallback(() => {
    clearAllTimers()
    setPlayerHand([])
    setSplitHand([])
    setDealerHand([])
    setGameState('betting')
    setResult(null)
    setSplitResult(null)
    setBet(0)
    setCurrentBet(0)
    setSplitBet(0)
    splitBetRef.current = 0
    setSelectedChip(null)
    setWinAmount(0)
    setIsFlippingDealer(false)
    setDealerCardFlipped(false)
    setIsProcessing(false)
    setHasSplit(false)
    setActiveHand('main')
    setIsDoubleDown(false)
    setIsSplitAnimating(false)
    setSplitAnimationPhase('idle')
    setSplitCards({ left: null, right: null })
    setShowBustIndicator(null)
    setIsDealing(false)
    setGameId('')
    setServerCanSplit(false)
    setServerCanDouble(false)
  }, [clearAllTimers])

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
    calcPayout,
    getCombinedResult,
    updateFromResponse,
    resetGame,
    refreshUser,

    // API functions - new server-side functions
    startGame,
    hitAction,
    standAction,
    doubleAction,
    splitAction
  }
}
