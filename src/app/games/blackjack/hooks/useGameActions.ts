'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'

import type { Card, GameState, GameResult } from '../types'
import {
  generateCardId,
  createDeck,
  shuffleDeck,
  calculateHandValue,
  drawCard,
  canSplitHand,
  shouldCheckDealerBlackjack,
  isNaturalBlackjack
} from '../utils'

interface UseGameActionsProps {
  // State
  deck: Card[]
  setDeck: (deck: Card[]) => void
  playerHand: Card[]
  setPlayerHand: (hand: Card[]) => void
  splitHand: Card[]
  setSplitHand: (hand: Card[]) => void
  dealerHand: Card[]
  setDealerHand: (hand: Card[]) => void
  gameState: GameState
  setGameState: (state: GameState) => void
  result: GameResult
  setResult: (result: GameResult) => void
  splitResult: GameResult
  setSplitResult: (result: GameResult) => void
  bet: number
  setBet: (bet: number) => void
  setSelectedChip: (chip: number | null) => void
  setIsDealing: (dealing: boolean) => void
  setIsProcessing: (processing: boolean) => void
  setWinAmount: (amount: number) => void
  setAnimatingResult: (animating: boolean) => void
  currentBet: number
  setCurrentBet: (bet: number) => void
  splitBet: number
  setSplitBet: (bet: number) => void
  splitBetRef: React.MutableRefObject<number>
  setIsFlippingDealer: (flipping: boolean) => void
  setDealerCardFlipped: (flipped: boolean) => void
  activeHand: 'main' | 'split'
  setActiveHand: (hand: 'main' | 'split') => void
  hasSplit: boolean
  setHasSplit: (hasSplit: boolean) => void
  gameId: string
  setGameId: (id: string) => void
  setIsSplitAnimating: (animating: boolean) => void
  setSplitAnimationPhase: (phase: 'idle' | 'separating' | 'dealing_right' | 'dealing_left' | 'done') => void
  setSplitCards: (cards: { left: Card | null; right: Card | null }) => void
  setShowBustIndicator: (indicator: 'main' | 'split' | null) => void
  settingsLoading: boolean
  isGameEnabled: boolean
  userPoints: number
  maxBet: number
  isActionLocked: boolean
  isActionLockedRef: React.MutableRefObject<boolean>

  // Functions
  playSound: (type: 'card' | 'cardFlip' | 'chip' | 'win' | 'lose' | 'blackjack' | 'click') => void
  addTimer: (callback: () => void, delay: number) => NodeJS.Timeout
  clearAllTimers: () => void
  isMounted: () => boolean
  resetLocks: () => void
  generateGameId: () => string
  ensureDeckHasCards: (deck: Card[], minCards: number) => Card[]
  saveGameState: (gameId: string, phase: GameState, stateData: {
    playerHand: Card[]
    dealerHand: Card[]
    splitHand: Card[]
    deck: Card[]
    currentBet: number
    splitBet: number
    hasSplit: boolean
    activeHand: 'main' | 'split'
    dealerCardFlipped: boolean
  }) => Promise<void>
  calcPayout: (res: GameResult | null, betAmt: number) => number
  getCombinedResult: (mainRes: GameResult, splitRes: GameResult | null, mainBet: number, splitBet: number) => GameResult
  determineResult: (playerValue: number, dealerValue: number, playerHandCards?: Card[], dealerHandCards?: Card[], isSplitHand?: boolean) => GameResult
  sendGameResult: (action: 'win' | 'lose', payload: Record<string, unknown>) => Promise<Response | null>
  refreshUser: () => Promise<void>
  placeBet: (amount: number, gameId: string) => Promise<{ success: boolean; error?: string }>
  placeSplitBet: (amount: number, gameId: string, currentGameState?: {
    playerHand: Card[]
    dealerHand: Card[]
    splitHand: Card[]
    deck: Card[]
    currentBet: number
    splitBet: number
    hasSplit: boolean
    activeHand: 'main' | 'split'
    dealerCardFlipped: boolean
  }) => Promise<{ success: boolean; error?: string }>
  placeDoubleBet: (amount: number, gameId: string, isSplit: boolean, currentGameState?: {
    playerHand: Card[]
    dealerHand: Card[]
    splitHand: Card[]
    deck: Card[]
    currentBet: number
    splitBet: number
    hasSplit: boolean
    activeHand: 'main' | 'split'
    dealerCardFlipped: boolean
  }) => Promise<{ success: boolean; error?: string }>
  placeHit: (gameId: string, currentGameState: {
    playerHand: Card[]
    dealerHand: Card[]
    splitHand: Card[]
    deck: Card[]
    currentBet: number
    splitBet: number
    hasSplit: boolean
    activeHand: 'main' | 'split'
    dealerCardFlipped: boolean
  }) => Promise<{ success: boolean; error?: string }>
  placeStand: (gameId: string, currentGameState: {
    playerHand: Card[]
    dealerHand: Card[]
    splitHand: Card[]
    deck: Card[]
    currentBet: number
    splitBet: number
    hasSplit: boolean
    activeHand: 'main' | 'split'
    dealerCardFlipped: boolean
  }) => Promise<{ success: boolean; error?: string }>
  placeDealCards: (gameId: string, currentGameState: {
    playerHand: Card[]
    dealerHand: Card[]
    splitHand: Card[]
    deck: Card[]
    currentBet: number
    splitBet: number
    hasSplit: boolean
    activeHand: 'main' | 'split'
    dealerCardFlipped: boolean
  }) => Promise<{ success: boolean; error?: string }>
  placeDealerDraw: (gameId: string, currentGameState: {
    playerHand: Card[]
    dealerHand: Card[]
    splitHand: Card[]
    deck: Card[]
    currentBet: number
    splitBet: number
    hasSplit: boolean
    activeHand: 'main' | 'split'
    dealerCardFlipped: boolean
  }) => Promise<{ success: boolean; error?: string }>
}

export function useGameActions(props: UseGameActionsProps) {
  const {
    deck, setDeck,
    playerHand, setPlayerHand,
    splitHand, setSplitHand,
    dealerHand, setDealerHand,
    gameState, setGameState,
    result, setResult,
    splitResult, setSplitResult,
    bet, setBet,
    setSelectedChip,
    setIsDealing, setIsProcessing,
    setWinAmount, setAnimatingResult,
    currentBet, setCurrentBet,
    splitBet, setSplitBet, splitBetRef,
    setIsFlippingDealer, setDealerCardFlipped,
    activeHand, setActiveHand,
    hasSplit, setHasSplit,
    gameId, setGameId,
    setIsSplitAnimating, setSplitAnimationPhase, setSplitCards,
    setShowBustIndicator,
    settingsLoading, isGameEnabled, userPoints, maxBet,
    isActionLocked, isActionLockedRef,
    playSound, addTimer, clearAllTimers, isMounted, resetLocks,
    generateGameId, ensureDeckHasCards, saveGameState,
    calcPayout, getCombinedResult, determineResult,
    sendGameResult, refreshUser,
    placeBet, placeSplitBet, placeDoubleBet,
    placeHit, placeStand, placeDealCards, placeDealerDraw
  } = props

  // Dealer draw logic
  const executeDealerDraw = useCallback((
    initialHand: Card[],
    initialDeck: Card[],
    playerValue: number,
    splitValue: number | null,
    mainBet: number,
    splitBetAmt: number,
    playerHandCards: Card[],
    splitHandCards: Card[] | null,
    currentGameId: string,
    hasSplitGame: boolean,
    onComplete: (mainResult: GameResult, splitResultVal: GameResult | null, combinedResult: GameResult, finalDealerHand: Card[]) => void
  ) => {
    let currentHand = [...initialHand]
    let currentDeck = [...initialDeck]

    const dealerDraw = () => {
      if (!isMounted()) return

      const dealerValue = calculateHandValue(currentHand, true)
      const shouldDealerHit = dealerValue < 17

      if (shouldDealerHit) {
        currentDeck = ensureDeckHasCards(currentDeck, 1)
        currentHand = currentHand.map(c => ({ ...c, isNew: false }))
        setDealerHand([...currentHand])

        addTimer(() => {
          if (!isMounted()) return
          playSound('card')

          const { card: drawnCard, remainingDeck } = drawCard(currentDeck)
          const newCard: Card = {
            ...drawnCard,
            hidden: false,
            isNew: true,
            id: generateCardId()
          }
          currentHand = [...currentHand, newCard]
          currentDeck = remainingDeck

          setDealerHand([...currentHand])
          setDeck([...currentDeck])

          // ANLIK KAYIT: Dealer her kart çektiğinde kaydet
          placeDealerDraw(currentGameId, {
            playerHand: playerHandCards,
            dealerHand: currentHand,
            splitHand: splitHandCards || [],
            deck: currentDeck,
            currentBet: mainBet,
            splitBet: splitBetAmt,
            hasSplit: hasSplitGame,
            activeHand: 'main',
            dealerCardFlipped: true
          })

          addTimer(dealerDraw, 500)
        }, 700)
      } else {
        addTimer(() => {
          if (!isMounted()) return

          const finalDealerValue = calculateHandValue(currentHand, true)
          const isSplitGame = splitValue !== null
          const mainResult = determineResult(playerValue, finalDealerValue, playerHandCards, currentHand, isSplitGame)
          const splitResultVal = isSplitGame && splitHandCards ? determineResult(splitValue, finalDealerValue, splitHandCards, currentHand, true) : null
          const combinedResult = getCombinedResult(mainResult, splitResultVal, mainBet, splitBetAmt)

          onComplete(mainResult, splitResultVal, combinedResult, currentHand)
        }, 600)
      }
    }

    addTimer(dealerDraw, 600)
  }, [addTimer, playSound, ensureDeckHasCards, isMounted, determineResult, getCombinedResult, setDealerHand, setDeck, placeDealerDraw])

  // Start dealer turn
  const startDealerTurn = useCallback((
    playerValue: number,
    splitValue: number | null,
    currentDealerHand: Card[],
    currentDeck: Card[],
    mainBet: number,
    splitBetAmt: number,
    playerHandCards: Card[],
    splitHandCards: Card[] | null,
    currentGameId: string,
    hasSplitGame: boolean,
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

      // ANLIK KAYIT: Dealer kartı açıldığında kaydet
      placeDealerDraw(currentGameId, {
        playerHand: playerHandCards,
        dealerHand: revealedHand,
        splitHand: splitHandCards || [],
        deck: currentDeck,
        currentBet: mainBet,
        splitBet: splitBetAmt,
        hasSplit: hasSplitGame,
        activeHand: 'main',
        dealerCardFlipped: true
      })

      executeDealerDraw(revealedHand, currentDeck, playerValue, splitValue, mainBet, splitBetAmt, playerHandCards, splitHandCards, currentGameId, hasSplitGame, onComplete)
    }, 700)
  }, [addTimer, playSound, executeDealerDraw, isMounted, setGameState, setIsFlippingDealer, setDealerCardFlipped, setDealerHand, placeDealerDraw])

  // Stand action
  const stand = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing' && gameState !== 'playing_split') return

    setIsProcessing(true)
    isActionLockedRef.current = true

    const currentGameId = gameId
    const splitBetCopy = splitBetRef.current

    if (gameState === 'playing_split' && hasSplit && activeHand === 'split') {
      // Split hand'de stand - main hand'e geç
      const standState = {
        playerHand,
        dealerHand,
        splitHand,
        deck,
        currentBet,
        splitBet: splitBetCopy,
        hasSplit,
        activeHand: 'main' as const,
        dealerCardFlipped: false
      }

      // ANLIK KAYIT: Split hand stand
      await placeStand(currentGameId, standState)

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

    // ANLIK KAYIT: Stand yapıldığında dealer_turn fazını kaydet
    const standState = {
      playerHand,
      dealerHand,
      splitHand,
      deck,
      currentBet,
      splitBet: splitBetCopy,
      hasSplit,
      activeHand: 'main' as const,
      dealerCardFlipped: false
    }
    await placeStand(currentGameId, standState)

    startDealerTurn(playerValue, splitValue, currentDealerHandCopy, currentDeckCopy, mainBetCopy, splitBetCopy, [...playerHand], hasSplit ? [...splitHand] : null, currentGameId, hasSplit, async (mainResult, splitResultVal, combinedResult, _finalDealerHand) => {
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
  }, [
    dealerHand, deck, playerHand, splitHand, gameState, isActionLocked,
    startDealerTurn, hasSplit, currentBet, playSound, refreshUser, addTimer,
    activeHand, calcPayout, gameId, sendGameResult, placeStand,
    setIsProcessing, setGameState, setActiveHand, setResult, setSplitResult,
    setAnimatingResult, setWinAmount, isActionLockedRef, splitBetRef
  ])

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

      const { card: drawnCard, remainingDeck } = drawCard(currentDeck)
      const newCard: Card = {
        ...drawnCard,
        isNew: true,
        id: generateCardId()
      }
      const newHand = [...clearedHand, newCard]

      setDeck(remainingDeck)
      setCurrentHand(newHand)

      const value = calculateHandValue(newHand)

      if (value > 21) {
        // BUST logic
        if (isPlayingSplit) {
          setShowBustIndicator('split')
          setSplitResult('lose')
          playSound('lose')
          // ANLIK KAYIT: Split bust olduğunda main hand'e geçmeden ÖNCE kaydet
          const bustGameState = {
            playerHand,
            dealerHand: currentDealerHandCopy,
            splitHand: newHand,
            deck: remainingDeck,
            currentBet: mainBetCopy,
            splitBet: splitBetCopy,
            hasSplit: true,
            activeHand: 'main' as const,
            dealerCardFlipped: false
          }
          placeHit(currentGameId, bustGameState)
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
          addTimer(() => {
            setShowBustIndicator(null)
            startDealerTurn(value, splitVal, currentDealerHandCopy, remainingDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], currentGameId, true, async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
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
              } catch (err) {
                console.error('[Blackjack] Split hand win result error:', err)
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
            } catch (err) {
              console.error('[Blackjack] Lose result error:', err)
            }

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
          // ANLIK KAYIT: Split hand 21 olduğunda main hand'e geçmeden ÖNCE kaydet
          const got21GameState = {
            playerHand,
            dealerHand: currentDealerHandCopy,
            splitHand: newHand,
            deck: remainingDeck,
            currentBet: mainBetCopy,
            splitBet: splitBetCopy,
            hasSplit: true,
            activeHand: 'main' as const,
            dealerCardFlipped: false
          }
          placeHit(currentGameId, got21GameState)
          addTimer(() => {
            setGameState('playing')
            setActiveHand('main')
            setIsProcessing(false)
            isActionLockedRef.current = false
          }, 600)
        } else if (hasSplit) {
          const splitVal = calculateHandValue(splitHand)
          // ANLIK KAYIT: 21 yapıldığında dealer turn başlamadan ÖNCE kaydet
          const got21SplitGameState = {
            playerHand: newHand,
            dealerHand: currentDealerHandCopy,
            splitHand,
            deck: remainingDeck,
            currentBet: mainBetCopy,
            splitBet: splitBetCopy,
            hasSplit: true,
            activeHand: 'main' as const,
            dealerCardFlipped: false
          }
          placeHit(currentGameId, got21SplitGameState)
          addTimer(() => {
            startDealerTurn(21, splitVal, currentDealerHandCopy, remainingDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], currentGameId, true, async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
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
              } catch (error) {
                console.error('[Blackjack] Win result error (21 with split):', error)
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          }, 700)
        } else {
          // ANLIK KAYIT: 21 single hand - dealer turn başlamadan ÖNCE kaydet
          const got21SingleGameState = {
            playerHand: newHand,
            dealerHand: currentDealerHandCopy,
            splitHand: [],
            deck: remainingDeck,
            currentBet: mainBetCopy,
            splitBet: 0,
            hasSplit: false,
            activeHand: 'main' as const,
            dealerCardFlipped: false
          }
          placeHit(currentGameId, got21SingleGameState)
          addTimer(() => {
            startDealerTurn(21, null, currentDealerHandCopy, remainingDeck, mainBetCopy, 0, [...newHand], null, currentGameId, false, async (mainRes, _, combinedRes, _finalDealerHand) => {
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
              } catch (error) {
                console.error('[Blackjack] Win result error (21 single hand):', error)
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          }, 700)
        }
      } else {
        // Normal hit - ANLIK KAYIT: Kart çekildikten hemen sonra kaydet
        const hitGameState = {
          playerHand: isPlayingSplit ? playerHand : newHand,
          dealerHand: currentDealerHandCopy,
          splitHand: isPlayingSplit ? newHand : splitHand,
          deck: remainingDeck,
          currentBet: mainBetCopy,
          splitBet: splitBetCopy,
          hasSplit,
          activeHand: isPlayingSplit ? 'split' as const : 'main' as const,
          dealerCardFlipped: false
        }
        // Animasyondan ÖNCE kaydet - böylece kullanıcı çıksa bile state kaydedilmiş olur
        placeHit(currentGameId, hitGameState)
        addTimer(() => {
          setIsProcessing(false)
          isActionLockedRef.current = false
        }, 500)
      }
    }, 200)
  }, [
    deck, playerHand, splitHand, dealerHand, gameState, isActionLocked,
    playSound, addTimer, ensureDeckHasCards, hasSplit, startDealerTurn,
    currentBet, refreshUser, isMounted, calcPayout, gameId, sendGameResult,
    placeHit, setDeck, setPlayerHand, setSplitHand, setIsProcessing,
    setShowBustIndicator, setSplitResult, setGameState, setActiveHand,
    setResult, setAnimatingResult, setWinAmount, isActionLockedRef, splitBetRef
  ])

  // Split action
  const split = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing') return
    if (!canSplitHand(playerHand)) return

    setIsProcessing(true)
    isActionLockedRef.current = true
    setIsSplitAnimating(true)

    playSound('chip')

    // API çağrısı ÖNCESI mevcut oyun durumunu hazırla (anlık kayıt için)
    const preCallGameState = {
      playerHand,
      dealerHand,
      splitHand: [],
      deck,
      currentBet,
      splitBet: 0,
      hasSplit: false,
      activeHand: 'main' as const,
      dealerCardFlipped: false
    }

    // Split API çağrısı - mevcut oyun durumunu da gönder
    const result = await placeSplitBet(currentBet, gameId, preCallGameState)
    if (!result.success) {
      toast.error(result.error || 'Split yapılamadı!')
      setIsProcessing(false)
      setIsSplitAnimating(false)
      isActionLockedRef.current = false
      return
    }

    await refreshUser()

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
        const { card: drawnCard1, remainingDeck: deck1 } = drawCard(currentDeck)
        const newCard1: Card = {
          ...drawnCard1,
          isNew: true,
          id: generateCardId()
        }
        setSplitHand([{ ...card2, isNew: false }, newCard1])
        currentDeck = deck1

        addTimer(() => {
          if (!isMounted()) return

          playSound('card')
          const { card: drawnCard2, remainingDeck: deck2 } = drawCard(currentDeck)
          const newCard2: Card = {
            ...drawnCard2,
            isNew: true,
            id: generateCardId()
          }
          setPlayerHand([{ ...card1, isNew: false }, newCard2])
          setDeck(deck2)

          addTimer(() => {
            if (!isMounted()) return

            setActiveHand('split')
            setGameState('playing_split')
            setIsSplitAnimating(false)
            // ANLIK KAYIT: Split kartları dağıtıldıktan sonra HEMEN kaydet
            const splitDealState = {
              playerHand: [{ ...card1, isNew: false }, newCard2],
              dealerHand,
              splitHand: [{ ...card2, isNew: false }, newCard1],
              deck: deck2,
              currentBet,
              splitBet: currentBet,
              hasSplit: true,
              activeHand: 'split' as const,
              dealerCardFlipped: false
            }
            placeDealCards(gameId, splitDealState)
            setIsProcessing(false)
            isActionLockedRef.current = false
          }, 500)
        }, 600)
      }, 400)
    }, 700)
  }, [
    gameState, isActionLocked, playerHand, currentBet, playSound, refreshUser,
    deck, ensureDeckHasCards, addTimer, isMounted, gameId, dealerHand,
    placeSplitBet, placeDealCards, setIsProcessing, setIsSplitAnimating, setSplitAnimationPhase,
    setSplitCards, setPlayerHand, setSplitHand, setSplitBet, setHasSplit,
    setDeck, setActiveHand, setGameState, isActionLockedRef, splitBetRef
  ])

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

    const newGameId = generateGameId()
    setGameId(newGameId)

    const betResult = await placeBet(bet, newGameId)
    if (!betResult.success) {
      toast.error(betResult.error || 'Bahis yapılamadı!')
      setIsProcessing(false)
      setIsDealing(false)
      isActionLockedRef.current = false
      return
    }

    await refreshUser()

    // Draw 4 cards
    let remainingDeck = currentDeck

    const { card: pCard1, remainingDeck: d1 } = drawCard(remainingDeck)
    remainingDeck = d1
    const playerCard1: Card = { ...pCard1, id: generateCardId(), isNew: true }

    const { card: dCard1, remainingDeck: d2 } = drawCard(remainingDeck)
    remainingDeck = d2
    const dealerCard1: Card = { ...dCard1, id: generateCardId(), isNew: true }

    const { card: pCard2, remainingDeck: d3 } = drawCard(remainingDeck)
    remainingDeck = d3
    const playerCard2: Card = { ...pCard2, id: generateCardId(), isNew: true }

    const { card: dCard2, remainingDeck: d4 } = drawCard(remainingDeck)
    remainingDeck = d4
    const dealerCard2: Card = { ...dCard2, hidden: true, id: generateCardId(), isNew: true }

    setDeck(remainingDeck)
    setGameState('playing')

    // ANLIK KAYIT: Kartlar belirlendikten hemen sonra kaydet - animasyondan ÖNCE
    // Bu sayede kullanıcı animasyon sırasında çıksa bile state kaydedilmiş olur
    const initialGameState = {
      playerHand: [playerCard1, playerCard2],
      dealerHand: [dealerCard1, dealerCard2],
      splitHand: [],
      deck: remainingDeck,
      currentBet: bet,
      splitBet: 0,
      hasSplit: false,
      activeHand: 'main' as const,
      dealerCardFlipped: false
    }
    placeDealCards(newGameId, initialGameState)

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

    // Blackjack checks
    addTimer(() => {
      if (!isMounted()) return

      const playerHasBlackjack = isNaturalBlackjack([playerCard1, playerCard2])
      const dealerNeedsBlackjackCheck = shouldCheckDealerBlackjack(dealerCard1)
      const dealerHasBlackjack = isNaturalBlackjack([dealerCard1, { ...dealerCard2, hidden: false }])

      if (dealerNeedsBlackjackCheck && dealerHasBlackjack) {
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

            if (playerHasBlackjack) {
              setResult('push')
              setGameState('game_over')
              setAnimatingResult(true)
              setWinAmount(bet)
              playSound('click')

              try {
                const response = await sendGameResult('win', {
                  amount: bet,
                  result: 'push',
                  betAmount: bet,
                  gameId: newGameId
                })
                if (response?.ok) await refreshUser()
              } catch (error) {
                console.error('[Blackjack] Push result error:', error)
                toast.error('Kazanç eklenirken hata oluştu!')
              }
            } else {
              setResult('lose')
              setGameState('game_over')
              setAnimatingResult(true)
              playSound('lose')

              try {
                await sendGameResult('lose', {
                  betAmount: bet,
                  gameId: newGameId
                })
              } catch (error) {
                console.error('[Blackjack] Dealer blackjack lose result error:', error)
              }
            }

            setIsDealing(false)
            setIsProcessing(false)
            isActionLockedRef.current = false
            addTimer(() => setAnimatingResult(false), 2500)
          }, 400)
        }, 700)
      } else if (playerHasBlackjack) {
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

            setResult('blackjack')
            setGameState('game_over')
            setAnimatingResult(true)

            const payout = Math.floor(bet * 2.5)
            setWinAmount(payout)
            playSound('blackjack')

            try {
              const response = await sendGameResult('win', {
                amount: payout,
                result: 'blackjack',
                betAmount: bet,
                gameId: newGameId
              })
              if (response?.ok) await refreshUser()
            } catch (error) {
              console.error('[Blackjack] Player blackjack result error:', error)
              toast.error('Kazanç eklenirken hata oluştu!')
            }

            setIsDealing(false)
            setIsProcessing(false)
            isActionLockedRef.current = false
            addTimer(() => setAnimatingResult(false), 2500)
          }, 400)
        }, 700)
      } else {
        // Normal game continues - state zaten animasyondan ÖNCE kaydedildi
        setIsDealing(false)
        setIsProcessing(false)
        isActionLockedRef.current = false
      }
    }, 1800)
  }, [
    bet, deck, userPoints, refreshUser, playSound, addTimer, ensureDeckHasCards,
    isActionLocked, isMounted, generateGameId, sendGameResult, settingsLoading,
    isGameEnabled, saveGameState, placeBet, placeDealCards, setIsProcessing, setIsDealing,
    setCurrentBet, setDealerCardFlipped, setHasSplit, setSplitHand, setSplitBet,
    setSplitResult, setActiveHand, setWinAmount, setShowBustIndicator, setResult,
    setGameId, setDeck, setGameState, setPlayerHand, setDealerHand,
    setIsFlippingDealer, setAnimatingResult, isActionLockedRef, splitBetRef
  ])

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

    const doubleAmount = handBet

    setIsProcessing(true)
    isActionLockedRef.current = true

    let currentDeck = ensureDeckHasCards(deck, 6)
    if (currentDeck !== deck) {
      setDeck(currentDeck)
    }

    playSound('chip')

    // API çağrısı ÖNCESI mevcut oyun durumunu hazırla (anlık kayıt için)
    const preCallGameState = {
      playerHand,
      dealerHand,
      splitHand,
      deck: currentDeck,
      currentBet,
      splitBet: splitBetRef.current,
      hasSplit,
      activeHand: isPlayingSplit ? 'split' as const : 'main' as const,
      dealerCardFlipped: false
    }

    // Double API çağrısı - mevcut oyun durumunu da gönder
    const result = await placeDoubleBet(doubleAmount, gameId, isPlayingSplit, preCallGameState)
    if (!result.success) {
      toast.error(result.error || 'Double yapılamadı!')
      setIsProcessing(false)
      isActionLockedRef.current = false
      return
    }

    await refreshUser()

    const newBet = handBet + doubleAmount
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
      const { card: drawnCard, remainingDeck } = drawCard(currentDeck)
      const newCard: Card = {
        ...drawnCard,
        isNew: true,
        id: generateCardId()
      }
      const newHand = [...clearedHand, newCard]

      setDeck(remainingDeck)
      setCurrentHand(newHand)

      const value = calculateHandValue(newHand)

      addTimer(() => {
        if (!isMounted()) return

        if (isPlayingSplit) {
          if (value > 21) {
            setShowBustIndicator('split')
            setSplitResult('lose')
            playSound('lose')
            // ANLIK KAYIT: Split double bust - main hand'e geçmeden ÖNCE kaydet
            const doubleBustSplitState = {
              playerHand,
              dealerHand: currentDealerHandCopy,
              splitHand: newHand,
              deck: remainingDeck,
              currentBet: mainBetCopy,
              splitBet: splitBetCopy,
              hasSplit: true,
              activeHand: 'main' as const,
              dealerCardFlipped: false
            }
            placeHit(currentGameId, doubleBustSplitState)
            addTimer(() => {
              setShowBustIndicator(null)
              setGameState('playing')
              setActiveHand('main')
              setIsProcessing(false)
              isActionLockedRef.current = false
            }, 1200)
          } else {
            // ANLIK KAYIT: Split double normal - main hand'e geçmeden ÖNCE kaydet
            const doubleNormalSplitState = {
              playerHand,
              dealerHand: currentDealerHandCopy,
              splitHand: newHand,
              deck: remainingDeck,
              currentBet: mainBetCopy,
              splitBet: splitBetCopy,
              hasSplit: true,
              activeHand: 'main' as const,
              dealerCardFlipped: false
            }
            placeHit(currentGameId, doubleNormalSplitState)
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
            addTimer(() => {
              setShowBustIndicator(null)
              startDealerTurn(value, splitVal, currentDealerHandCopy, remainingDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], currentGameId, true, async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
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
                } catch (error) {
                  console.error('[Blackjack] Double down bust split result error:', error)
                  toast.error('Kazanç eklenirken hata oluştu!')
                }

                setIsProcessing(false)
                isActionLockedRef.current = false
                addTimer(() => setAnimatingResult(false), 2500)
              })
            }, 1200)
          } else {
            setShowBustIndicator('main')
            setResult('lose')
            setGameState('game_over')
            setAnimatingResult(true)
            playSound('lose')

            sendGameResult('lose', {
              betAmount: mainBetCopy,
              gameId: currentGameId
            }).catch((err) => {
              console.error('[Blackjack] Double bust lose result error:', err)
            })

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
            // ANLIK KAYIT: Double down with split - dealer turn başlamadan ÖNCE kaydet
            const doubleSplitDealerState = {
              playerHand: newHand,
              dealerHand: currentDealerHandCopy,
              splitHand,
              deck: remainingDeck,
              currentBet: mainBetCopy,
              splitBet: splitBetCopy,
              hasSplit: true,
              activeHand: 'main' as const,
              dealerCardFlipped: false
            }
            placeHit(currentGameId, doubleSplitDealerState)
            startDealerTurn(value, splitVal, currentDealerHandCopy, remainingDeck, mainBetCopy, splitBetCopy, [...newHand], [...splitHand], currentGameId, true, async (mainRes, splitResVal, combinedRes, _finalDealerHand) => {
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
              } catch (error) {
                console.error('[Blackjack] Double down split result error:', error)
                toast.error('Kazanç eklenirken hata oluştu!')
              }

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            })
          } else {
            // ANLIK KAYIT: Single hand double - dealer turn başlamadan ÖNCE kaydet
            const doubleSingleDealerState = {
              playerHand: newHand,
              dealerHand: currentDealerHandCopy,
              splitHand: [],
              deck: remainingDeck,
              currentBet: mainBetCopy,
              splitBet: 0,
              hasSplit: false,
              activeHand: 'main' as const,
              dealerCardFlipped: false
            }
            placeHit(currentGameId, doubleSingleDealerState)
            addTimer(() => {
              startDealerTurn(value, null, currentDealerHandCopy, remainingDeck, mainBetCopy, 0, [...newHand], null, currentGameId, false, async (mainRes, _, combinedRes, _finalDealerHand) => {
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
                } catch (error) {
                  console.error('[Blackjack] Double down single hand result error:', error)
                  toast.error('Kazanç eklenirken hata oluştu!')
                }

                setIsProcessing(false)
                isActionLockedRef.current = false
                addTimer(() => setAnimatingResult(false), 2500)
              })
            }, 700)
          }
        }
      }, 700)
    }, 200)
  }, [
    currentBet, splitBet, deck, playerHand, splitHand, dealerHand, gameState,
    userPoints, isActionLocked, refreshUser, playSound, addTimer, ensureDeckHasCards,
    startDealerTurn, hasSplit, isMounted, calcPayout, gameId, sendGameResult,
    placeDoubleBet, placeHit, setIsProcessing, setDeck, setBet, setCurrentBet,
    setSplitBet, setPlayerHand, setSplitHand, setShowBustIndicator, setSplitResult,
    setGameState, setActiveHand, setResult, setAnimatingResult, setWinAmount,
    isActionLockedRef, splitBetRef
  ])

  // New game
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
  }, [
    playSound, clearAllTimers, isActionLocked, resetLocks,
    setDeck, setPlayerHand, setSplitHand, setDealerHand, setGameState,
    setResult, setSplitResult, setBet, setCurrentBet, setSplitBet,
    setSelectedChip, setWinAmount, setIsFlippingDealer, setDealerCardFlipped,
    setIsProcessing, setHasSplit, setActiveHand, setIsSplitAnimating,
    setSplitAnimationPhase, setSplitCards, setShowBustIndicator, setIsDealing,
    setGameId, isActionLockedRef, splitBetRef
  ])

  // Add chip
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
  }, [bet, userPoints, playSound, isActionLocked, maxBet, setBet, setSelectedChip, isActionLockedRef])

  // Clear bet
  const clearBet = useCallback(() => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    playSound('click')
    setBet(0)
    setSelectedChip(null)
  }, [playSound, isActionLocked, setBet, setSelectedChip, isActionLockedRef])

  return {
    hit,
    stand,
    split,
    doubleDown,
    dealCards,
    newGame,
    addChip,
    clearBet
  }
}
