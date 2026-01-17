'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { ThemedCard, ThemedButton } from '@/components/ui/themed'
import {
  ArrowLeft,
  RefreshCw,
  Volume2,
  VolumeX,
  Info,
  Coins,
  Trophy,
  Sparkles,
  AlertCircle,
  SplitSquareVertical,
  Hand,
  Square
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import type { Card, GameState, GameResult } from './types'
import {
  generateCardId,
  createDeck,
  shuffleDeck,
  calculateHandValue,
  calculateHandDisplayValue,
  canSplitHand,
  selectCardForDealer,
  selectDealerHiddenCard,
  getCardNumericValue
} from './utils'
import { PlayingCard, Chip, CardHand } from './components'
import { useSoundEffects, useTimerManager, useGameLock } from './hooks'

// Oyun ayarları tipi
interface BlackjackSettings {
  enabled: boolean
  maxBet: number
  minBet: number
  pendingDisable: boolean
}

function BlackjackGame() {
  const { theme } = useUserTheme()
  const { user, refreshUser } = useAuth()

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

  // Unique game ID for server-side validation
  const [gameId, setGameId] = useState<string>('')

  const [isSplitAnimating, setIsSplitAnimating] = useState(false)
  const [splitAnimationPhase, setSplitAnimationPhase] = useState<'idle' | 'separating' | 'dealing_right' | 'dealing_left' | 'done'>('idle')
  const [splitCards, setSplitCards] = useState<{ left: Card | null; right: Card | null }>({ left: null, right: null })

  const [showBustIndicator, setShowBustIndicator] = useState<'main' | 'split' | null>(null)

  // Oyun ayarları - API'den yüklenir
  const [gameSettings, setGameSettings] = useState<BlackjackSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const { playSound } = useSoundEffects(soundEnabled)
  const { addTimer, clearAllTimers, isMounted } = useTimerManager()

  // Oyun kilidi hook'u - Çoklu istek engelleme
  const {
    isGameCompleted,
    markGameCompleted,
    markGameProcessing,
    clearGameProcessing,
    resetLocks,
    dedupedFetch
  } = useGameLock()

  const userPoints = user?.points || 0

  // Dinamik chip değerleri - min/max bet'e göre ayarla
  const minBet = gameSettings?.minBet || 10
  const maxBet = gameSettings?.maxBet || 500
  // Oyun aktif mi kontrolü - settings yüklenene kadar veya null ise false kabul et
  const isGameEnabled = !settingsLoading && gameSettings !== null && gameSettings.enabled === true && gameSettings.pendingDisable !== true

  const chips = useMemo(() => {
    const baseChips = [10, 25, 50, 100, 250, 500]
    return baseChips.filter(chip => chip >= minBet && chip <= maxBet)
  }, [minBet, maxBet])

  // Oyun ayarlarını yükle
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/games/settings')
        if (res.ok) {
          const data = await res.json()
          setGameSettings(data.blackjack)
        }
      } catch (error) {
        console.error('Error loading game settings:', error)
      } finally {
        setSettingsLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Oyun aktifken sayfadan ayrılmayı engelle
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

  // isActionLocked - senkron ref kontrolü de ekle
  const isActionLockedRef = useRef(false)

  const isActionLocked = useMemo(() => {
    return isProcessing || isDealing || isSplitAnimating || showBustIndicator !== null
  }, [isProcessing, isDealing, isSplitAnimating, showBustIndicator])

  // isActionLocked değiştiğinde ref'i de güncelle
  useEffect(() => {
    isActionLockedRef.current = isActionLocked
  }, [isActionLocked])

  // Generate unique game ID for server-side validation
  // Daha güvenli bir ID generator - timestamp + random değerler
  const generateGameId = useCallback((): string => {
    const timestamp = Date.now().toString(36)
    const randomPart1 = Math.random().toString(36).substring(2, 11)
    const randomPart2 = Math.random().toString(36).substring(2, 8)
    return `bj_${timestamp}_${randomPart1}${randomPart2}`
  }, [])

  const ensureDeckHasCards = useCallback((currentDeck: Card[], minCards: number): Card[] => {
    if (currentDeck.length >= minCards) {
      return currentDeck
    }
    const newDeck = shuffleDeck(createDeck())
    // Deste yenilendi bildirimi kaldırıldı - kart sayanlara avantaj sağlamamak için
    return newDeck
  }, [])

  useEffect(() => {
    setDeck(shuffleDeck(createDeck()))
  }, [])

  const getCombinedResult = useCallback((mainRes: GameResult, splitRes: GameResult | null, mainBet: number, splitBetAmt: number): GameResult => {
    if (!splitRes) return mainRes
    const calcPayout = (res: GameResult | null, betAmt: number): number => {
      if (!res) return 0
      switch (res) {
        case 'blackjack': return Math.floor(betAmt * 2.5)
        case 'win': return betAmt * 2
        case 'push': return betAmt
        default: return 0
      }
    }
    const totalBet = mainBet + splitBetAmt
    const totalPayout = calcPayout(mainRes, mainBet) + calcPayout(splitRes, splitBetAmt)
    if (totalPayout > totalBet) return 'win'
    if (totalPayout < totalBet) return 'lose'
    return 'push'
  }, [])

  // Check if a hand is a natural blackjack (Ace + 10-value card)
  const isNaturalBlackjack = useCallback((hand: Card[]): boolean => {
    if (hand.length !== 2) return false
    const hasAce = hand.some(c => c.value === 'A')
    const hasTenValue = hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.value))
    return hasAce && hasTenValue
  }, [])

  // Oyun sonucunu belirle - isSplitHand parametresi eklendi
  // Split hand'lerde natural blackjack yerine sadece 'win' döner
  const determineResult = useCallback((playerValue: number, dealerValue: number, playerHand?: Card[], dealerHand?: Card[], isSplitHand = false): GameResult => {
    if (playerValue > 21) return 'lose'

    // Check for natural blackjack - BUT NOT for split hands!
    // In split hands, 21 with 2 cards is just a regular win, not blackjack
    if (!isSplitHand && playerHand && playerHand.length === 2 && playerValue === 21 && isNaturalBlackjack(playerHand)) {
      // Player has blackjack (only possible in non-split hands)
      if (dealerHand && dealerHand.length === 2 && dealerValue === 21 && isNaturalBlackjack(dealerHand)) {
        return 'push' // Both have blackjack
      }
      return 'blackjack'
    }

    if (dealerValue > 21) return 'win'
    if (playerValue > dealerValue) return 'win'
    if (playerValue < dealerValue) return 'lose'
    return 'push'
  }, [isNaturalBlackjack])

  // Dealer draw logic - tamamen rastgele kart seçimi
  const executeDealerDraw = useCallback((
    initialHand: Card[],
    initialDeck: Card[],
    playerValue: number,
    splitValue: number | null,
    mainBet: number,
    splitBetAmt: number,
    playerHandCards: Card[],
    splitHandCards: Card[] | null,
    onComplete: (mainResult: GameResult, splitResultVal: GameResult | null, combinedResult: GameResult, finalDealerHand: Card[]) => void
  ) => {
    let currentHand = [...initialHand]
    let currentDeck = [...initialDeck]

    const dealerDraw = () => {
      if (!isMounted()) return

      const dealerValue = calculateHandValue(currentHand, true)
      // Krupiyer 17 ve üzerinde durur (soft 17 dahil - Ace 11 olarak sayılır)
      const shouldDealerHit = dealerValue < 17

      if (shouldDealerHit) {
        currentDeck = ensureDeckHasCards(currentDeck, 1)
        currentHand = currentHand.map(c => ({ ...c, isNew: false }))
        setDealerHand([...currentHand])

        addTimer(() => {
          if (!isMounted()) return
          playSound('card')

          // WinRate'e göre kart seç - dealer için avantajlı/dezavantajlı
          const { selectedCard, remainingDeck } = selectCardForDealer(
            currentDeck,
            dealerValue,
            currentWinRate
          )

          const newCard: Card = {
            ...selectedCard,
            hidden: false,
            isNew: true,
            id: generateCardId()
          }
          currentHand = [...currentHand, newCard]
          currentDeck = remainingDeck

          setDealerHand([...currentHand])
          setDeck([...currentDeck])

          addTimer(dealerDraw, 500)
        }, 700)
      } else {
        addTimer(() => {
          if (!isMounted()) return

          const finalDealerValue = calculateHandValue(currentHand, true)
          // Split hand'lerde blackjack yerine win döndürülmeli - isSplitHand parametresi ile kontrol
          const isSplitGame = splitValue !== null
          const mainResult = determineResult(playerValue, finalDealerValue, playerHandCards, currentHand, isSplitGame)
          const splitResultVal = isSplitGame && splitHandCards ? determineResult(splitValue, finalDealerValue, splitHandCards, currentHand, true) : null
          const combinedResult = getCombinedResult(mainResult, splitResultVal, mainBet, splitBetAmt)

          onComplete(mainResult, splitResultVal, combinedResult, currentHand)
        }, 600)
      }
    }

    addTimer(dealerDraw, 600)
  }, [addTimer, playSound, ensureDeckHasCards, isMounted, determineResult, getCombinedResult])

  // Reveal dealer card and start dealer turn
  const startDealerTurn = useCallback((
    playerValue: number,
    splitValue: number | null,
    currentDealerHand: Card[],
    currentDeck: Card[],
    mainBet: number,
    splitBetAmt: number,
    playerHandCards: Card[],
    splitHandCards: Card[] | null,
    onComplete: (mainResult: GameResult, splitResultVal: GameResult | null, combinedResult: GameResult, finalDealerHand: Card[]) => void
  ) => {
    if (!isMounted()) return

    setGameState('dealer_turn')
    setIsFlippingDealer(true)
    playSound('cardFlip')

    addTimer(() => {
      if (!isMounted()) return

      setIsFlippingDealer(false)
      setDealerCardFlipped(true)

      const revealedHand: Card[] = currentDealerHand.map(card => ({
        ...card,
        hidden: false
      }))
      setDealerHand(revealedHand)

      executeDealerDraw(revealedHand, currentDeck, playerValue, splitValue, mainBet, splitBetAmt, playerHandCards, splitHandCards, onComplete)
    }, 700)
  }, [addTimer, playSound, executeDealerDraw, isMounted])

  const calcPayout = useCallback((res: GameResult | null, betAmt: number): number => {
    if (!res) return 0
    switch (res) {
      case 'blackjack': return Math.floor(betAmt * 2.5)
      case 'win': return betAmt * 2
      case 'push': return betAmt
      default: return 0
    }
  }, [])

  // Win/Lose API çağrısı - Dedupe edilmiş
  const sendGameResult = useCallback(async (
    action: 'win' | 'lose',
    payload: Record<string, unknown>
  ): Promise<Response | null> => {
    const currentGameId = payload.gameId as string
    if (!currentGameId) return null

    // Oyun zaten tamamlanmış mı kontrol et
    if (isGameCompleted(currentGameId)) {
      console.log(`[Blackjack] Oyun zaten tamamlanmış, istek engellendi: ${currentGameId}`)
      return null
    }

    // İşleme başlatmayı dene
    if (!markGameProcessing(currentGameId)) {
      console.log(`[Blackjack] Oyun zaten işleniyor, istek engellendi: ${currentGameId}`)
      return null
    }

    try {
      const requestKey = `${currentGameId}_${action}`
      const response = await dedupedFetch(
        requestKey,
        '/api/games/blackjack/bet',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action })
        }
      )

      // Başarılı olsun ya da olmasın, oyunu tamamlandı olarak işaretle
      markGameCompleted(currentGameId)

      return response
    } catch (error) {
      console.error(`[Blackjack] ${action} isteği hatası:`, error)
      // KRITIK: Network hatası durumunda da oyunu tamamlandı olarak işaretle
      // Çünkü sunucu isteği almış olabilir - duplicate request engellemek için
      // Kullanıcı yeni oyun başlatabilir
      markGameCompleted(currentGameId)
      throw error
    }
  }, [isGameCompleted, markGameProcessing, markGameCompleted, dedupedFetch])

  // Stand action
  const stand = useCallback(() => {
    // Senkron kilit kontrolü
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing' && gameState !== 'playing_split') return

    setIsProcessing(true)
    isActionLockedRef.current = true

    if (gameState === 'playing_split' && hasSplit && activeHand === 'split') {
      setGameState('playing')
      setActiveHand('main')
      addTimer(() => {
        setIsProcessing(false)
        isActionLockedRef.current = false
      }, 300)
      return
    }

    const playerValue = calculateHandValue(playerHand)
    const splitValue = hasSplit ? calculateHandValue(splitHand) : null
    const currentDealerHandCopy = [...dealerHand]
    const currentDeckCopy = [...deck]
    const mainBetCopy = currentBet
    const splitBetCopy = splitBetRef.current
    const currentGameId = gameId

    startDealerTurn(playerValue, splitValue, currentDealerHandCopy, currentDeckCopy, mainBetCopy, splitBetCopy, [...playerHand], hasSplit ? [...splitHand] : null, async (mainResult, splitResultVal, combinedResult, _finalDealerHand) => {
      setResult(mainResult)
      if (splitResultVal !== null) {
        setSplitResult(splitResultVal)
      }
      setGameState('game_over')
      setAnimatingResult(true)

      const totalPayout = calcPayout(mainResult, mainBetCopy) + (splitResultVal ? calcPayout(splitResultVal, splitBetCopy) : 0)
      setWinAmount(totalPayout)

      if (combinedResult === 'win' || combinedResult === 'blackjack') playSound('win')
      else if (combinedResult === 'lose') playSound('lose')
      else playSound('click')

      // Sonucu gönder - dedupe edilmiş
      try {
        if (totalPayout > 0) {
          const response = await sendGameResult('win', {
            amount: totalPayout,
            result: mainResult,
            betAmount: mainBetCopy + splitBetCopy,
            gameId: currentGameId,
            isSplit: hasSplit,
            splitResult: splitResultVal
          })

          if (response?.ok) {
            await refreshUser()
          } else if (response) {
            const data = await response.json().catch(() => ({}))
            if (data.error !== 'İstek zaten işleniyor' && data.error !== 'Oyun zaten tamamlanmış') {
              toast.error(data.error || 'Kazanç eklenirken hata oluştu!')
            }
          }
        } else {
          await sendGameResult('lose', {
            betAmount: mainBetCopy + splitBetCopy,
            gameId: currentGameId,
            isSplit: hasSplit,
            splitResult: splitResultVal
          })
        }
      } catch (err) {
        console.error('Game result error:', err)
        toast.error('Bağlantı hatası!')
      }

      setIsProcessing(false)
      isActionLockedRef.current = false
      addTimer(() => setAnimatingResult(false), 2500)
    })
  }, [dealerHand, deck, playerHand, splitHand, gameState, isActionLocked, startDealerTurn, hasSplit, currentBet, playSound, refreshUser, addTimer, activeHand, calcPayout, gameId, sendGameResult, winRate])

  // Hit action
  const hit = useCallback(() => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing' && gameState !== 'playing_split') return

    setIsProcessing(true)
    isActionLockedRef.current = true

    const isPlayingSplit = gameState === 'playing_split'
    const currentHand = isPlayingSplit ? splitHand : playerHand
    const setCurrentHand = isPlayingSplit ? setSplitHand : setPlayerHand

    let currentDeck = ensureDeckHasCards(deck, 1)
    if (currentDeck !== deck) {
      setDeck(currentDeck)
    }

    const clearedHand = currentHand.map(c => ({ ...c, isNew: false }))
    setCurrentHand(clearedHand)

    const currentDealerHandCopy = [...dealerHand]
    const mainBetCopy = currentBet
    const splitBetCopy = splitBetRef.current
    const currentGameId = gameId

    addTimer(() => {
      if (!isMounted()) return
      playSound('card')

      const newDeck = [...currentDeck]
      const newCard: Card = {
        ...newDeck.pop()!,
        isNew: true,
        id: generateCardId()
      }
      const newHand = [...clearedHand, newCard]

      setDeck(newDeck)
      setCurrentHand(newHand)

      const value = calculateHandValue(newHand)

      if (value > 21) {
        // BUST
        if (isPlayingSplit) {
          setShowBustIndicator('split')
          setSplitResult('lose')
          playSound('lose')
          addTimer(() => {
            setShowBustIndicator(null)
            setGameState('playing')
            setActiveHand('main')
            setIsProcessing(false)
            isActionLockedRef.current = false
          }, 1200)
        } else if (hasSplit) {
          setShowBustIndicator('main')
          setResult('lose')
          playSound('lose')
          const splitVal = calculateHandValue(splitHand)
          // DÜZELTME: Bust durumunda gerçek değeri gönder (>21), determineResult doğru çalışsın
          const mainBustValue = value // value > 21 olduğu için bust
          addTimer(() => {
            setShowBustIndicator(null)
            startDealerTurn(mainBustValue, splitVal, currentDealerHandCopy, newDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
              if (splitResVal !== null) setSplitResult(splitResVal)
              setGameState('game_over')
              setAnimatingResult(true)

              const totalPayout = calcPayout(splitResVal, splitBetCopy)
              setWinAmount(totalPayout)

              if (combinedRes === 'win' || combinedRes === 'blackjack') playSound('win')
              else if (combinedRes === 'lose') playSound('lose')
              else playSound('click')

              try {
                if (totalPayout > 0) {
                  const response = await sendGameResult('win', {
                    amount: totalPayout,
                    result: splitResVal,
                    betAmount: mainBetCopy + splitBetCopy,
                    gameId: currentGameId,
                    isSplit: true,
                    splitResult: splitResVal
                  })
                  if (response?.ok) {
                    await refreshUser()
                  }
                } else {
                  await sendGameResult('lose', {
                    betAmount: mainBetCopy + splitBetCopy,
                    gameId: currentGameId,
                    isSplit: true,
                    splitResult: splitResVal
                  })
                }
              } catch (err) {
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          }, 1200)
        } else {
          // Single hand bust
          setShowBustIndicator('main')
          addTimer(async () => {
            setResult('lose')
            setGameState('game_over')
            setAnimatingResult(true)
            playSound('lose')

            try {
              await sendGameResult('lose', {
                betAmount: mainBetCopy,
                gameId: currentGameId
              })
            } catch {}

            setIsProcessing(false)
            isActionLockedRef.current = false
            addTimer(() => {
              setAnimatingResult(false)
              setShowBustIndicator(null)
            }, 2500)
          }, 700)
        }
      } else if (value === 21) {
        // Got 21 - auto proceed
        if (isPlayingSplit) {
          addTimer(() => {
            setGameState('playing')
            setActiveHand('main')
            setIsProcessing(false)
            isActionLockedRef.current = false
          }, 600)
        } else if (hasSplit) {
          const splitVal = calculateHandValue(splitHand)
          addTimer(() => {
            startDealerTurn(21, splitVal, currentDealerHandCopy, newDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
              setResult(mainRes)
              if (splitResVal !== null) setSplitResult(splitResVal)
              setGameState('game_over')
              setAnimatingResult(true)

              const totalPayout = calcPayout(mainRes, mainBetCopy) + calcPayout(splitResVal, splitBetCopy)
              setWinAmount(totalPayout)

              if (combinedRes === 'win' || combinedRes === 'blackjack') playSound('win')
              else if (combinedRes === 'lose') playSound('lose')
              else playSound('click')

              try {
                if (totalPayout > 0) {
                  const response = await sendGameResult('win', {
                    amount: totalPayout,
                    result: mainRes,
                    betAmount: mainBetCopy + splitBetCopy,
                    gameId: currentGameId,
                    isSplit: true,
                    splitResult: splitResVal
                  })
                  if (response?.ok) await refreshUser()
                } else {
                  await sendGameResult('lose', {
                    betAmount: mainBetCopy + splitBetCopy,
                    gameId: currentGameId,
                    isSplit: true,
                    splitResult: splitResVal
                  })
                }
              } catch {
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          }, 700)
        } else {
          addTimer(() => {
            startDealerTurn(21, null, currentDealerHandCopy, newDeck, mainBetCopy, 0, [...newHand], null, winRate, async (mainRes, _, combinedRes, _finalDealerHand) => {
              setResult(mainRes)
              setGameState('game_over')
              setAnimatingResult(true)

              const payout = calcPayout(mainRes, mainBetCopy)
              setWinAmount(payout)

              if (mainRes === 'win' || mainRes === 'blackjack') playSound('win')
              else if (mainRes === 'lose') playSound('lose')
              else playSound('click')

              try {
                if (payout > 0) {
                  const response = await sendGameResult('win', {
                    amount: payout,
                    result: mainRes,
                    betAmount: mainBetCopy,
                    gameId: currentGameId
                  })
                  if (response?.ok) await refreshUser()
                } else {
                  await sendGameResult('lose', {
                    betAmount: mainBetCopy,
                    gameId: currentGameId
                  })
                }
              } catch {
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          }, 700)
        }
      } else {
        addTimer(() => {
          setIsProcessing(false)
          isActionLockedRef.current = false
        }, 500)
      }
    }, 200)
  }, [deck, playerHand, splitHand, dealerHand, gameState, isActionLocked, playSound, addTimer, ensureDeckHasCards, hasSplit, startDealerTurn, currentBet, refreshUser, isMounted, calcPayout, gameId, sendGameResult, winRate])

  // Split action
  const split = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing') return
    if (!canSplitHand(playerHand)) return
    if (currentBet > userPoints) {
      toast.error('Yetersiz puan!')
      return
    }

    setIsProcessing(true)
    isActionLockedRef.current = true
    setIsSplitAnimating(true)

    playSound('chip')

    try {
      const response = await fetch('/api/games/blackjack/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: currentBet,
          action: 'split',
          gameId
        })
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Split yapılamadı!')
        setIsProcessing(false)
        setIsSplitAnimating(false)
        isActionLockedRef.current = false
        return
      }

      await refreshUser()
    } catch {
      toast.error('Bir hata oluştu!')
      setIsProcessing(false)
      setIsSplitAnimating(false)
      isActionLockedRef.current = false
      return
    }

    const card1 = playerHand[0]
    const card2 = playerHand[1]

    setSplitAnimationPhase('separating')
    setSplitCards({ left: card1, right: card2 })

    let currentDeck = ensureDeckHasCards(deck, 2)

    addTimer(() => {
      if (!isMounted()) return

      setPlayerHand([{ ...card1, isNew: false }])
      setSplitHand([{ ...card2, isNew: false }])
      setSplitBet(currentBet)
      splitBetRef.current = currentBet
      setHasSplit(true)

      setSplitAnimationPhase('idle')
      setSplitCards({ left: null, right: null })

      addTimer(() => {
        if (!isMounted()) return

        playSound('card')
        const newCard1: Card = {
          ...currentDeck.pop()!,
          isNew: true,
          id: generateCardId()
        }
        setSplitHand([{ ...card2, isNew: false }, newCard1])

        addTimer(() => {
          if (!isMounted()) return

          playSound('card')
          const newCard2: Card = {
            ...currentDeck.pop()!,
            isNew: true,
            id: generateCardId()
          }
          setPlayerHand([{ ...card1, isNew: false }, newCard2])
          setDeck(currentDeck)

          addTimer(() => {
            if (!isMounted()) return

            setActiveHand('split')
            setGameState('playing_split')
            setIsSplitAnimating(false)
            setIsProcessing(false)
            isActionLockedRef.current = false
          }, 500)
        }, 600)
      }, 400)
    }, 700)
  }, [gameState, isActionLocked, playerHand, currentBet, userPoints, playSound, refreshUser, deck, ensureDeckHasCards, addTimer, isMounted, gameId])

  // Deal initial cards
  const dealCards = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (settingsLoading) {
      toast.error('Ayarlar yükleniyor...')
      return
    }
    if (!isGameEnabled) {
      toast.error('Blackjack şu anda kapalı!')
      return
    }
    if (bet === 0) {
      toast.error('Lütfen bahis miktarını seçin!')
      return
    }

    if (bet > userPoints) {
      toast.error('Yetersiz puan!')
      return
    }

    setIsProcessing(true)
    isActionLockedRef.current = true
    setIsDealing(true)

    let currentDeck = ensureDeckHasCards(deck, 10)

    setCurrentBet(bet)
    setDealerCardFlipped(false)
    setHasSplit(false)
    setSplitHand([])
    setSplitBet(0)
    splitBetRef.current = 0
    setSplitResult(null)
    setActiveHand('main')
    setWinAmount(0)
    setShowBustIndicator(null)
    setResult(null)

    // Generate new game ID for server-side validation
    const newGameId = generateGameId()
    setGameId(newGameId)

    try {
      const response = await fetch('/api/games/blackjack/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bet, action: 'bet', gameId: newGameId })
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Bahis yapılamadı!')
        setIsProcessing(false)
        setIsDealing(false)
        isActionLockedRef.current = false
        return
      }

      await refreshUser()
    } catch {
      toast.error('Bir hata oluştu!')
      setIsProcessing(false)
      setIsDealing(false)
      isActionLockedRef.current = false
      return
    }

    let newDeck = [...currentDeck]
    const playerCard1: Card = { ...newDeck.pop()!, id: generateCardId(), isNew: true }
    const dealerCard1: Card = { ...newDeck.pop()!, id: generateCardId(), isNew: true }
    const playerCard2: Card = { ...newDeck.pop()!, id: generateCardId(), isNew: true }

    // Dealer hidden kartı için winRate'e göre kart seç
    const dealerVisibleValue = getCardNumericValue(dealerCard1.value)
    const { selectedCard: hiddenCard, remainingDeck } = selectDealerHiddenCard(newDeck, dealerVisibleValue, winRate)
    const dealerCard2: Card = { ...hiddenCard, hidden: true, id: generateCardId(), isNew: true }
    newDeck = remainingDeck

    setDeck(newDeck)
    setGameState('playing')

    playSound('card')
    setPlayerHand([playerCard1])

    addTimer(() => {
      if (!isMounted()) return
      playSound('card')
      setDealerHand([dealerCard1])
    }, 450)

    addTimer(() => {
      if (!isMounted()) return
      playSound('card')
      setPlayerHand([{ ...playerCard1, isNew: false }, playerCard2])
    }, 900)

    addTimer(() => {
      if (!isMounted()) return
      playSound('card')
      setDealerHand([{ ...dealerCard1, isNew: false }, dealerCard2])
    }, 1350)

    // Blackjack check
    addTimer(() => {
      if (!isMounted()) return

      const playerValue = calculateHandValue([playerCard1, playerCard2])

      if (playerValue === 21) {
        setIsFlippingDealer(true)
        playSound('cardFlip')

        addTimer(() => {
          if (!isMounted()) return

          setIsFlippingDealer(false)
          setDealerCardFlipped(true)

          const revealedDealerHand = [dealerCard1, { ...dealerCard2, hidden: false }]
          setDealerHand(revealedDealerHand)

          addTimer(async () => {
            if (!isMounted()) return

            const dealerValue = calculateHandValue(revealedDealerHand, true)
            const gameResult = dealerValue === 21 ? 'push' : 'blackjack'
            setResult(gameResult)
            setGameState('game_over')
            setAnimatingResult(true)

            const payout = gameResult === 'blackjack' ? Math.floor(bet * 2.5) : bet
            setWinAmount(payout)

            if (gameResult === 'blackjack') playSound('blackjack')
            else playSound('click')

            try {
              if (payout > 0) {
                const response = await sendGameResult('win', {
                  amount: payout,
                  result: gameResult,
                  betAmount: bet,
                  gameId: newGameId
                })
                if (response?.ok) await refreshUser()
              } else {
                await sendGameResult('lose', {
                  betAmount: bet,
                  gameId: newGameId
                })
              }
            } catch {
              toast.error('Kazanç eklenirken hata oluştu!')
            }

            setIsDealing(false)
            setIsProcessing(false)
            isActionLockedRef.current = false
            addTimer(() => setAnimatingResult(false), 2500)
          }, 400)
        }, 700)
      } else {
        setIsDealing(false)
        setIsProcessing(false)
        isActionLockedRef.current = false
      }
    }, 1800)
  }, [bet, deck, userPoints, refreshUser, playSound, addTimer, ensureDeckHasCards, isActionLocked, isMounted, generateGameId, sendGameResult, winRate, settingsLoading, isGameEnabled])

  // Double down
  const doubleDown = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing' && gameState !== 'playing_split') return

    const isPlayingSplit = gameState === 'playing_split'
    const currentHand = isPlayingSplit ? splitHand : playerHand
    const setCurrentHand = isPlayingSplit ? setSplitHand : setPlayerHand
    const handBet = isPlayingSplit ? splitBet : currentBet

    if (currentHand.length !== 2) return

    const maxAdditionalBet = Math.min(handBet, userPoints)

    if (maxAdditionalBet <= 0) {
      toast.error('Yetersiz puan!')
      return
    }

    setIsProcessing(true)
    isActionLockedRef.current = true

    let currentDeck = ensureDeckHasCards(deck, 6)
    if (currentDeck !== deck) {
      setDeck(currentDeck)
    }

    playSound('chip')

    try {
      const response = await fetch('/api/games/blackjack/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: maxAdditionalBet,
          action: 'double',
          gameId,
          isSplit: isPlayingSplit
        })
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Double yapılamadı!')
        setIsProcessing(false)
        isActionLockedRef.current = false
        return
      }

      await refreshUser()
    } catch {
      toast.error('Bir hata oluştu!')
      setIsProcessing(false)
      isActionLockedRef.current = false
      return
    }

    const newBet = handBet + maxAdditionalBet
    if (isPlayingSplit) {
      setSplitBet(newBet)
      splitBetRef.current = newBet
    } else {
      setBet(newBet)
      setCurrentBet(newBet)
    }

    const clearedHand = currentHand.map(c => ({ ...c, isNew: false }))
    setCurrentHand(clearedHand)

    const currentDealerHandCopy = [...dealerHand]
    const mainBetCopy = isPlayingSplit ? currentBet : newBet
    const splitBetCopy = isPlayingSplit ? newBet : splitBetRef.current
    const currentGameId = gameId

    addTimer(() => {
      if (!isMounted()) return

      playSound('card')
      const newDeck = [...currentDeck]
      const newCard: Card = {
        ...newDeck.pop()!,
        isNew: true,
        id: generateCardId()
      }
      const newHand = [...clearedHand, newCard]

      setDeck(newDeck)
      setCurrentHand(newHand)

      const value = calculateHandValue(newHand)

      addTimer(() => {
        if (!isMounted()) return

        if (isPlayingSplit) {
          if (value > 21) {
            setShowBustIndicator('split')
            setSplitResult('lose')
            playSound('lose')
            addTimer(() => {
              setShowBustIndicator(null)
              setGameState('playing')
              setActiveHand('main')
              setIsProcessing(false)
              isActionLockedRef.current = false
            }, 1200)
          } else {
            setGameState('playing')
            setActiveHand('main')
            setIsProcessing(false)
            isActionLockedRef.current = false
          }
        } else if (value > 21) {
          if (hasSplit) {
            setShowBustIndicator('main')
            setResult('lose')
            playSound('lose')
            const splitVal = calculateHandValue(splitHand)
            // Ana el bust oldu - bust değerini (value > 21) gönder, 0 değil
            const mainBustValue = value
            addTimer(() => {
              setShowBustIndicator(null)
              startDealerTurn(mainBustValue, splitVal, currentDealerHandCopy, newDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
                if (splitResVal !== null) setSplitResult(splitResVal)
                setGameState('game_over')
                setAnimatingResult(true)

                const totalPayout = calcPayout(splitResVal, splitBetCopy)
                setWinAmount(totalPayout)

                if (combinedRes === 'win' || combinedRes === 'blackjack') playSound('win')
                else if (combinedRes === 'lose') playSound('lose')
                else playSound('click')

                try {
                  if (totalPayout > 0) {
                    const response = await sendGameResult('win', {
                      amount: totalPayout,
                      result: splitResVal,
                      betAmount: mainBetCopy + splitBetCopy,
                      gameId: currentGameId,
                      isSplit: true,
                      splitResult: splitResVal
                    })
                    if (response?.ok) await refreshUser()
                  } else {
                    await sendGameResult('lose', {
                      betAmount: mainBetCopy + splitBetCopy,
                      gameId: currentGameId,
                      isSplit: true,
                      splitResult: splitResVal
                    })
                  }
                } catch {
                  toast.error('Kazanç eklenirken hata oluştu!')
                }

                setIsProcessing(false)
                isActionLockedRef.current = false
                addTimer(() => setAnimatingResult(false), 2500)
              })
            }, 1200)
          } else {
            // Single hand bust with double
            setShowBustIndicator('main')
            setResult('lose')
            setGameState('game_over')
            setAnimatingResult(true)
            playSound('lose')

            sendGameResult('lose', {
              betAmount: mainBetCopy,
              gameId: currentGameId
            }).catch(() => {})

            setIsProcessing(false)
            isActionLockedRef.current = false
            addTimer(() => {
              setAnimatingResult(false)
              setShowBustIndicator(null)
            }, 2500)
          }
        } else {
          if (hasSplit) {
            const splitVal = calculateHandValue(splitHand)
            startDealerTurn(value, splitVal, currentDealerHandCopy, newDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
              setResult(mainRes)
              if (splitResVal !== null) setSplitResult(splitResVal)
              setGameState('game_over')
              setAnimatingResult(true)

              const totalPayout = calcPayout(mainRes, mainBetCopy) + calcPayout(splitResVal, splitBetCopy)
              setWinAmount(totalPayout)

              if (combinedRes === 'win' || combinedRes === 'blackjack') playSound('win')
              else if (combinedRes === 'lose') playSound('lose')
              else playSound('click')

              try {
                if (totalPayout > 0) {
                  const response = await sendGameResult('win', {
                    amount: totalPayout,
                    result: mainRes,
                    betAmount: mainBetCopy + splitBetCopy,
                    gameId: currentGameId,
                    isSplit: true,
                    splitResult: splitResVal
                  })
                  if (response?.ok) await refreshUser()
                } else {
                  await sendGameResult('lose', {
                    betAmount: mainBetCopy + splitBetCopy,
                    gameId: currentGameId,
                    isSplit: true,
                    splitResult: splitResVal
                  })
                }
              } catch {
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          } else {
            startDealerTurn(value, null, currentDealerHandCopy, newDeck, mainBetCopy, 0, [...newHand], null, winRate, async (mainRes, _, combinedRes, _finalDealerHand) => {
              setResult(mainRes)
              setGameState('game_over')
              setAnimatingResult(true)

              const payout = calcPayout(mainRes, mainBetCopy)
              setWinAmount(payout)

              if (mainRes === 'win' || mainRes === 'blackjack') playSound('win')
              else if (mainRes === 'lose') playSound('lose')
              else playSound('click')

              try {
                if (payout > 0) {
                  const response = await sendGameResult('win', {
                    amount: payout,
                    result: mainRes,
                    betAmount: mainBetCopy,
                    gameId: currentGameId
                  })
                  if (response?.ok) await refreshUser()
                } else {
                  await sendGameResult('lose', {
                    betAmount: mainBetCopy,
                    gameId: currentGameId
                  })
                }
              } catch {
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          }
        }
      }, 700)
    }, 200)
  }, [currentBet, splitBet, deck, playerHand, splitHand, dealerHand, gameState, userPoints, isActionLocked, refreshUser, playSound, addTimer, ensureDeckHasCards, startDealerTurn, hasSplit, isMounted, calcPayout, gameId, sendGameResult, winRate])

  const newGame = useCallback(() => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    clearAllTimers()

    playSound('click')
    setDeck(shuffleDeck(createDeck()))
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
    setIsSplitAnimating(false)
    setSplitAnimationPhase('idle')
    setSplitCards({ left: null, right: null })
    setShowBustIndicator(null)
    setIsDealing(false)
    setGameId('')
    resetLocks()
  }, [playSound, clearAllTimers, isActionLocked, resetLocks])

  const addChip = useCallback((value: number) => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return

    let newBet = bet + value

    if (newBet > maxBet) {
      newBet = maxBet
    }

    if (newBet > userPoints) {
      newBet = Math.min(userPoints, maxBet)
    }

    if (newBet <= 0) {
      toast.error('Yetersiz puan!')
      return
    }

    playSound('chip')
    setBet(newBet)
    setSelectedChip(value)
  }, [bet, userPoints, playSound, isActionLocked, maxBet])

  const clearBet = useCallback(() => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    playSound('click')
    setBet(0)
    setSelectedChip(null)
  }, [playSound, isActionLocked])

  const playerDisplayValue = useMemo(() => calculateHandDisplayValue(playerHand), [playerHand])
  const splitDisplayValue = useMemo(() => calculateHandDisplayValue(splitHand), [splitHand])
  const dealerDisplayValue = useMemo(() => {
    if (dealerHand.some(c => c.hidden) && !dealerCardFlipped) return '?'
    return calculateHandDisplayValue(dealerHand)
  }, [dealerHand, dealerCardFlipped])

  // Double ve Split için yeterli puan gerekli (en az currentBet kadar puan olmalı)
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

  const resultMessages: Record<string, { title: string; color: string; bgColor: string; icon: React.ReactNode }> = {
    blackjack: {
      title: 'BLACKJACK!',
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.15)',
      icon: <Sparkles className="w-5 h-5 sm:w-7 sm:h-7" />
    },
    win: {
      title: 'KAZANDIN!',
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.15)',
      icon: <Trophy className="w-5 h-5 sm:w-7 sm:h-7" />
    },
    lose: {
      title: 'KAYBETTİN',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
      icon: <AlertCircle className="w-5 h-5 sm:w-7 sm:h-7" />
    },
    push: {
      title: 'BERABERE',
      color: '#6b7280',
      bgColor: 'rgba(107, 114, 128, 0.15)',
      icon: <RefreshCw className="w-5 h-5 sm:w-7 sm:h-7" />
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'linear-gradient(180deg, #0d4f3c 0%, #063528 50%, #021f17 100%)'
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 100%)'
        }}
      />

      {/* Oyun Kapalı Uyarısı */}
      {!settingsLoading && !isGameEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <ThemedCard className="max-w-md w-full p-6 text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-amber-500" />
            <h2 className="text-xl font-bold text-white">Blackjack Şu Anda Kapalı</h2>
            <p className="text-white/70 text-sm">
              Blackjack oyunu geçici olarak devre dışı bırakılmıştır. Lütfen daha sonra tekrar deneyin.
            </p>
            <Link href="/games">
              <ThemedButton className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Oyunlara Dön
              </ThemedButton>
            </Link>
          </ThemedCard>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center p-2 sm:p-4 md:p-5">
        <div className="w-full max-w-4xl flex items-center justify-between mb-2 sm:mb-4">
          <Link href="/games">
            <ThemedButton variant="secondary" className="gap-1.5 sm:gap-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-2.5">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Geri</span>
            </ThemedButton>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                playSound('click')
                setSoundEnabled(!soundEnabled)
              }}
              className="p-2.5 sm:p-3 rounded-xl transition-all duration-200 hover:scale-105"
              style={{
                background: soundEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: soundEnabled ? '#22c55e' : '#ef4444'
              }}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click')
                setShowRules(!showRules)
              }}
              className="p-2.5 sm:p-3 rounded-xl transition-all duration-200 hover:scale-105"
              style={{
                background: theme.colors.backgroundSecondary,
                color: theme.colors.textMuted
              }}
            >
              <Info className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Score Display */}
        <div className="flex flex-col items-center">
          <ThemedCard className="px-4 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 shadow-xl">
            <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] sm:text-xs text-white/50 uppercase tracking-wider">Puanın</span>
              <span className="text-lg sm:text-2xl font-bold text-amber-400">
                {userPoints.toLocaleString()}
              </span>
            </div>
          </ThemedCard>
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <ThemedCard className="max-w-md w-full p-4 sm:p-6 space-y-3 sm:space-y-4">
            <h3 className="text-lg sm:text-xl font-bold" style={{ color: theme.colors.text }}>
              Blackjack Kuralları
            </h3>
            <div className="space-y-2 text-xs sm:text-sm" style={{ color: theme.colors.textMuted }}>
              <p><strong>1.</strong> Amaç: Elinizin değerini 21'e yaklaştırmak, ama 21'i geçmemek.</p>
              <p><strong>2.</strong> Kart değerleri: 2-10 kendi değerleri, J/Q/K = 10, A = 1 veya 11</p>
              <p><strong>3.</strong> Blackjack: İlk 2 kart ile 21 = 3:2 ödeme</p>
              <p><strong>4.</strong> <span className="text-green-400">HIT</span>: Yeni kart çek</p>
              <p><strong>5.</strong> <span className="text-red-400">STAND</span>: Kartlarınla kal</p>
              <p><strong>6.</strong> <span className="text-amber-400">DOUBLE</span>: Bahsi ikiye katla, tek kart çek</p>
              <p><strong>7.</strong> <span className="text-purple-400">SPLIT</span>: Aynı değerde 2 kart varsa eli böl</p>
              <p><strong>8.</strong> Krupiye 17'ye kadar çekmek zorunda</p>
              <p><strong>9.</strong> 21'i geçersen kaybedersin (Bust)</p>
            </div>
            <ThemedButton onClick={() => setShowRules(false)} className="w-full text-sm sm:text-base">
              Anladım
            </ThemedButton>
          </ThemedCard>
        </div>
      )}

      {/* Game Area */}
      <div className="flex flex-col items-center min-h-[calc(100vh-120px)] sm:min-h-[calc(100vh-150px)] py-2 sm:py-4 px-2 sm:px-4">

        {/* Dealer Area */}
        <div className="text-center space-y-2 sm:space-y-3 h-[145px] sm:h-[165px] md:h-[185px] flex flex-col justify-end">
          <div className="text-white/60 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5">
            <span>Krupiye</span>
            {gameState !== 'betting' && (
              <span className="bg-white/10 px-2 py-0.5 rounded text-white/80 font-bold">
                {dealerDisplayValue}
              </span>
            )}
          </div>
          <CardHand
            cards={dealerHand}
            isDealing={isDealing}
            isFlippingIndex={isFlippingDealer ? 1 : undefined}
            hasFlippedIndex={dealerCardFlipped ? 1 : undefined}
          />
        </div>

        {/* Middle Area - Result display */}
        <div className="h-[70px] sm:h-[90px] md:h-[100px] flex items-center justify-center relative w-full">
          {displayResult && gameState === 'game_over' && (
            <div
              className={`absolute inset-x-0 flex justify-center transition-all duration-500 ${
                animatingResult ? 'scale-110' : 'scale-100'
              }`}
            >
              <div
                className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-4 rounded-xl sm:rounded-2xl shadow-2xl"
                style={{
                  background: resultMessages[displayResult].bgColor,
                  border: `2px solid ${resultMessages[displayResult].color}`,
                  color: resultMessages[displayResult].color
                }}
              >
                {resultMessages[displayResult].icon}
                <div>
                  <div className="text-base sm:text-2xl font-bold">
                    {resultMessages[displayResult].title}
                  </div>
                  {winAmount > 0 && (
                    <div className="text-xs sm:text-base font-medium opacity-80">
                      +{winAmount.toLocaleString()} puan
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}
        </div>

        {/* Player Hands Area */}
        <div className="text-center space-y-2 sm:space-y-3">
          {isSplitAnimating && splitAnimationPhase === 'separating' && splitCards.left && splitCards.right ? (
            <div className="relative min-h-[220px] sm:min-h-[250px] md:min-h-[280px] flex items-start justify-center gap-10 sm:gap-14 md:gap-20 pt-2">
              <div
                className="relative transition-all duration-700 ease-out"
                style={{ transform: 'translateX(-20px)' }}
              >
                <div className="relative min-h-[115px] sm:min-h-[130px] flex items-center justify-center">
                  <PlayingCard card={splitCards.left} index={0} isDealing={false} delay={0} />
                </div>

              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="text-amber-400 text-lg sm:text-xl font-bold animate-pulse drop-shadow-lg">
                  SPLIT!
                </div>
              </div>

              <div
                className="relative transition-all duration-700 ease-out"
                style={{ transform: 'translateX(20px)' }}
              >
                <div className="relative min-h-[115px] sm:min-h-[130px] flex items-center justify-center">
                  <PlayingCard card={splitCards.right} index={0} isDealing={false} delay={0} />
                </div>

              </div>
            </div>
          ) : hasSplit && splitHand.length > 0 ? (
            <div className="flex items-start justify-center gap-3 sm:gap-6 md:gap-10 relative min-h-[240px] sm:min-h-[270px] md:min-h-[300px]">
              {/* Left Hand (Main) */}
              <CardHand
                cards={playerHand}
                value={playerDisplayValue}
                bet={currentBet}
                result={result}
                isActive={activeHand === 'main'}
                showActiveIndicator={!isSplitAnimating && (gameState === 'playing' || gameState === 'playing_split')}
                reserveInfoSpace={true}
              />

              {/* Right Hand (Split) */}
              <CardHand
                cards={splitHand}
                value={splitDisplayValue}
                bet={splitBet}
                result={splitResult}
                isActive={activeHand === 'split'}
                showActiveIndicator={!isSplitAnimating && (gameState === 'playing' || gameState === 'playing_split')}
                reserveInfoSpace={true}
              />
            </div>
          ) : (
            <div>
              <CardHand
                cards={playerHand}
                isDealing={isDealing}
                label={gameState !== 'betting' ? 'Sen' : undefined}
                value={gameState !== 'betting' ? playerDisplayValue : undefined}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full max-w-xl space-y-3 sm:space-y-4 flex-1 flex flex-col justify-end pb-3 sm:pb-4 px-2">

          {/* Bet display */}
          <div className="text-center">
            <div className="text-white/40 text-[10px] sm:text-xs mb-1">
              {gameState === 'betting' ? `Bahis Miktarı (Maks: ${maxBet.toLocaleString()})` : 'Bahis'}
            </div>
            <div className="text-xl sm:text-3xl font-bold text-amber-400">
              {displayBet > 0 ? (hasSplit && gameState !== 'betting' ? `${currentBet + splitBet}` : displayBet.toLocaleString()) : '-'}
            </div>
          </div>

          {gameState === 'betting' && (
            <>
              {/* Chips */}
              <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-3 flex-wrap px-2">
                {chips.map((chip) => (
                  <Chip
                    key={chip}
                    value={chip}
                    selected={selectedChip === chip}
                    onClick={() => addChip(chip)}
                    disabled={isActionLocked || bet >= maxBet || (bet + chip > userPoints && bet >= userPoints)}
                  />
                ))}
              </div>

              {/* Betting actions */}
              <div className="flex items-center justify-center gap-4 sm:gap-5">
                <button
                  type="button"
                  onClick={clearBet}
                  disabled={bet === 0 || isActionLocked}
                  className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl sm:rounded-xl font-bold text-sm sm:text-base transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-700 active:scale-95 text-white"
                >
                  Temizle
                </button>
                <button
                  type="button"
                  onClick={dealCards}
                  disabled={bet === 0 || isActionLocked}
                  className="px-8 sm:px-12 py-3 sm:py-4 rounded-xl sm:rounded-xl text-base sm:text-xl font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white shadow-lg shadow-emerald-500/30"
                >
                  {isActionLocked ? (
                    <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  ) : (
                    'DAĞIT'
                  )}
                </button>
              </div>
            </>
          )}

          {(gameState === 'playing' || gameState === 'playing_split') && (
            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap px-2">
              {/* STAND */}
              <button
                type="button"
                onClick={stand}
                disabled={isActionLocked}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-xl text-sm sm:text-base font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95 text-white shadow-lg shadow-red-500/30"
              >
                <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                STAND
              </button>
              {/* HIT */}
              <button
                type="button"
                onClick={hit}
                disabled={isActionLocked}
                className="flex items-center gap-1.5 sm:gap-2 px-6 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-xl text-base sm:text-lg font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:scale-95 text-white shadow-lg shadow-green-500/30 scale-105"
              >
                <Hand className="w-5 h-5 sm:w-6 sm:h-6" />
                HIT
              </button>
              {/* DOUBLE */}
              {canDouble && (
                <button
                  type="button"
                  onClick={doubleDown}
                  disabled={isActionLocked}
                  className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-xl text-sm sm:text-base font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white shadow-lg shadow-amber-500/30"
                >
                  <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
                  DOUBLE
                </button>
              )}
              {/* SPLIT */}
              {canSplit && (
                <button
                  type="button"
                  onClick={split}
                  disabled={isActionLocked}
                  className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-xl text-sm sm:text-base font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:scale-95 text-white shadow-lg shadow-purple-500/30"
                >
                  <SplitSquareVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                  SPLIT
                </button>
              )}
            </div>
          )}

          {gameState === 'dealer_turn' && (
            <div className="text-center text-white/60 text-sm sm:text-base">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto mb-2" />
              Krupiye oynuyor...
            </div>
          )}

          {gameState === 'game_over' && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={newGame}
                disabled={isActionLocked}
                className="px-6 sm:px-10 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl text-sm sm:text-lg font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white shadow-lg shadow-emerald-500/30"
              >
                YENİ OYUN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BlackjackPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <BlackjackGame />
    </ProtectedRoute>
  )
}
