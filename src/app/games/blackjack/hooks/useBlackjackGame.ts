'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'

import type { Card, GameState, GameResult } from '../types'
import {
  generateCardId,
  createDeck,
  shuffleDeck,
  calculateHandValue,
  calculateHandDisplayValue,
  canSplitHand,
  drawCard,
  shouldCheckDealerBlackjack,
  isNaturalBlackjack
} from '../utils'
import type { BlackjackSettings, SavedGameState } from '../lib'
import {
  loadGameSettings,
  checkActiveGame,
  placeBet,
  placeSplitBet,
  placeDoubleBet,
  saveGameState as saveGameStateApi,
  sendGameResult
} from '../lib'
import { useSoundEffects } from './useSoundEffects'
import { useTimerManager } from './useTimerManager'
import { useGameLock } from './useGameLock'

export function useBlackjackGame() {
  const { user, refreshUser } = useAuth()

  // Game state
  const [deck, setDeck] = useState<Card[]>([])
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

  // Settings state
  const [gameSettings, setGameSettings] = useState<BlackjackSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [isRestoringGame, setIsRestoringGame] = useState(false)
  const [hasCheckedActiveGame, setHasCheckedActiveGame] = useState(false)

  // Hooks
  const { playSound } = useSoundEffects(soundEnabled)
  const { addTimer, clearAllTimers, isMounted } = useTimerManager()
  const {
    isGameCompleted,
    markGameCompleted,
    markGameProcessing,
    clearGameProcessing,
    resetLocks,
    dedupedFetch
  } = useGameLock()

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

  // Generate game ID
  const generateGameId = useCallback((): string => {
    const timestamp = Date.now().toString(36)
    const randomPart1 = Math.random().toString(36).substring(2, 11)
    const randomPart2 = Math.random().toString(36).substring(2, 8)
    return `bj_${timestamp}_${randomPart1}${randomPart2}`
  }, [])

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await loadGameSettings()
      setGameSettings(settings)
      setSettingsLoading(false)
    }
    loadSettings()
  }, [])

  // Initialize deck
  useEffect(() => {
    setDeck(shuffleDeck(createDeck()))
  }, [])

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

  // Ensure deck has minimum cards
  const ensureDeckHasCards = useCallback((currentDeck: Card[], minCards: number): Card[] => {
    if (currentDeck.length >= minCards) {
      return currentDeck
    }
    const newDeck = shuffleDeck(createDeck())
    return newDeck
  }, [])

  // Save game state wrapper
  const saveGameState = useCallback(async (
    currentGameId: string,
    phase: GameState,
    stateData: SavedGameState
  ) => {
    await saveGameStateApi(currentGameId, phase, stateData)
  }, [])

  // Restore active game
  const restoreActiveGame = useCallback(async () => {
    if (hasCheckedActiveGame) return
    setHasCheckedActiveGame(true)

    const data = await checkActiveGame()

    if (!data.hasActiveGame || !data.gameState) {
      return
    }

    if (data.expired) {
      toast.error('Önceki oyununuz zaman aşımına uğradı.')
      return
    }

    setIsRestoringGame(true)

    const savedState = data.gameState

    setGameId(data.gameId || '')
    setCurrentBet(data.betAmount || 0)
    setBet(data.betAmount || 0)
    setSplitBet(data.splitBetAmount || 0)
    splitBetRef.current = data.splitBetAmount || 0
    setHasSplit(data.isSplit || false)

    if (savedState.playerHand) setPlayerHand(savedState.playerHand)
    if (savedState.dealerHand) setDealerHand(savedState.dealerHand)
    if (savedState.splitHand) setSplitHand(savedState.splitHand)
    if (savedState.deck) setDeck(savedState.deck)
    if (savedState.activeHand) setActiveHand(savedState.activeHand)
    if (savedState.dealerCardFlipped !== undefined) setDealerCardFlipped(savedState.dealerCardFlipped)
    if (savedState.currentBet !== undefined) setCurrentBet(savedState.currentBet)
    if (savedState.splitBet !== undefined) {
      setSplitBet(savedState.splitBet)
      splitBetRef.current = savedState.splitBet
    }

    const phase = data.gamePhase as GameState
    if (phase === 'playing' || phase === 'playing_split') {
      setGameState(phase)
      toast.info('Önceki oyununuz geri yüklendi. Kaldığınız yerden devam edebilirsiniz.')
    } else if (phase === 'dealer_turn') {
      console.warn('[Blackjack] Game was in dealer_turn phase, cannot safely restore.')
      toast.warning('Önceki oyununuz krupiye sırasındaydı. Lütfen yeni oyun başlatın.')
      setGameState('betting')
    } else {
      setGameState('betting')
    }

    setIsRestoringGame(false)
  }, [hasCheckedActiveGame])

  // Check for active game on mount
  useEffect(() => {
    if (user && !settingsLoading && isGameEnabled && !hasCheckedActiveGame) {
      restoreActiveGame()
    }
  }, [user, settingsLoading, isGameEnabled, hasCheckedActiveGame, restoreActiveGame])

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

  // Determine result
  const determineResult = useCallback((
    playerValue: number,
    dealerValue: number,
    playerHandCards?: Card[],
    dealerHandCards?: Card[],
    isSplitHand = false
  ): GameResult => {
    if (playerValue > 21) return 'lose'

    if (!isSplitHand && playerHandCards && playerHandCards.length === 2 && playerValue === 21 && isNaturalBlackjack(playerHandCards)) {
      if (dealerHandCards && dealerHandCards.length === 2 && dealerValue === 21 && isNaturalBlackjack(dealerHandCards)) {
        return 'push'
      }
      return 'blackjack'
    }

    if (dealerHandCards && dealerHandCards.length === 2 && dealerValue === 21 && isNaturalBlackjack(dealerHandCards)) {
      return 'lose'
    }

    if (dealerValue > 21) return 'win'
    if (playerValue > dealerValue) return 'win'
    if (playerValue < dealerValue) return 'lose'
    return 'push'
  }, [])

  // Display values
  const playerDisplayValue = useMemo(() => calculateHandDisplayValue(playerHand), [playerHand])
  const splitDisplayValue = useMemo(() => calculateHandDisplayValue(splitHand), [splitHand])
  const dealerDisplayValue = useMemo(() => {
    if (dealerHand.some(c => c.hidden) && !dealerCardFlipped) return '?'
    return calculateHandDisplayValue(dealerHand)
  }, [dealerHand, dealerCardFlipped])

  // Can double/split checks
  const canDouble = (gameState === 'playing' && playerHand.length === 2 && userPoints >= currentBet) ||
    (gameState === 'playing_split' && splitHand.length === 2 && userPoints >= splitBet)
  const canSplit = gameState === 'playing' && canSplitHand(playerHand) && userPoints >= currentBet && !hasSplit
  const displayBet = gameState === 'betting' ? bet : currentBet

  const displayResult = useMemo(() => {
    if (!result) return null
    if (hasSplit && splitResult) {
      return getCombinedResult(result, splitResult, currentBet, splitBet)
    }
    return result
  }, [result, splitResult, hasSplit, currentBet, splitBet, getCombinedResult])

  // Send game result wrapper
  const sendGameResultWrapper = useCallback(async (
    action: 'win' | 'lose',
    payload: Record<string, unknown>
  ): Promise<Response | null> => {
    const currentGameId = payload.gameId as string
    if (!currentGameId) return null

    if (isGameCompleted(currentGameId)) {
      console.log(`[Blackjack] Oyun zaten tamamlanmış: ${currentGameId}`)
      return null
    }

    if (!markGameProcessing(currentGameId)) {
      console.log(`[Blackjack] Oyun zaten işleniyor: ${currentGameId}`)
      return null
    }

    try {
      const response = await sendGameResult(action, payload, dedupedFetch)
      markGameCompleted(currentGameId)
      return response
    } catch (error) {
      console.error(`[Blackjack] ${action} isteği hatası:`, error)
      markGameCompleted(currentGameId)
      throw error
    }
  }, [isGameCompleted, markGameProcessing, markGameCompleted, dedupedFetch])

  return {
    // State
    deck,
    setDeck,
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
    isRestoringGame,

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
    generateGameId,
    ensureDeckHasCards,
    saveGameState,
    calcPayout,
    getCombinedResult,
    determineResult,
    sendGameResult: sendGameResultWrapper,
    refreshUser,

    // API functions
    placeBet,
    placeSplitBet,
    placeDoubleBet
  }
}
