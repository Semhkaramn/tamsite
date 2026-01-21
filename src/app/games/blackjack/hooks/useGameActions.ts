'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'

import type { Card, GameState, GameResult } from '../types'
import { generateCardId } from '../utils'
import {
  startGame as apiStartGame,
  hitAction as apiHitAction,
  standAction as apiStandAction,
  doubleAction as apiDoubleAction,
  splitAction as apiSplitAction
} from '../lib'

interface UseGameActionsProps {
  // State
  playerHand: Card[]
  setPlayerHand: (hand: Card[]) => void
  splitHand: Card[]
  setSplitHand: (hand: Card[]) => void
  dealerHand: Card[]
  setDealerHand: (hand: Card[]) => void
  gameState: GameState
  setGameState: (state: GameState) => void
  setResult: (result: GameResult) => void
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
  isDoubleDown: boolean
  setIsDoubleDown: (isDouble: boolean) => void
  settingsLoading: boolean
  isGameEnabled: boolean
  userPoints: number
  maxBet: number
  isActionLocked: boolean
  isActionLockedRef: React.MutableRefObject<boolean>
  setServerCanSplit: (canSplit: boolean) => void
  setServerCanDouble: (canDouble: boolean) => void

  // Functions
  playSound: (type: 'card' | 'cardFlip' | 'chip' | 'win' | 'lose' | 'blackjack' | 'click') => void
  addTimer: (callback: () => void, delay: number) => NodeJS.Timeout
  clearAllTimers: () => void
  isMounted: () => boolean
  resetLocks: () => void
  calcPayout: (res: GameResult | null, betAmt: number) => number
  getCombinedResult: (mainRes: GameResult, splitRes: GameResult | null, mainBet: number, splitBet: number) => GameResult
  refreshUser: () => Promise<void>
}

export function useGameActions(props: UseGameActionsProps) {
  const {
    playerHand, setPlayerHand,
    splitHand, setSplitHand,
    dealerHand, setDealerHand,
    gameState, setGameState,
    setResult, setSplitResult,
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
    setIsDoubleDown,
    settingsLoading, isGameEnabled, userPoints, maxBet,
    isActionLocked, isActionLockedRef,
    setServerCanSplit, setServerCanDouble,
    playSound, addTimer, clearAllTimers, isMounted, resetLocks,
    calcPayout, getCombinedResult, refreshUser
  } = props

  // Helper: Animate cards with isNew flag
  const animateCards = useCallback((cards: Card[]): Card[] => {
    return cards.map(card => ({
      ...card,
      id: card.id || generateCardId(),
      isNew: true
    }))
  }, [])

  // Helper: Clear isNew flags
  const clearNewFlags = useCallback((cards: Card[]): Card[] => {
    return cards.map(card => ({ ...card, isNew: false }))
  }, [])

  // Deal initial cards - Server'dan oyun başlat
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

    // Reset state
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

    try {
      // Server'dan oyun başlat
      const response = await apiStartGame(bet)

      if (!response.success) {
        toast.error(response.error || 'Oyun başlatılamadı!')
        setIsProcessing(false)
        setIsDealing(false)
        isActionLockedRef.current = false
        return
      }

      await refreshUser()

      setGameId(response.gameId)
      setServerCanSplit(response.canSplit)
      setServerCanDouble(response.canDouble)
      setGameState('playing')

      // Animate cards one by one
      const playerCards = animateCards(response.playerHand)
      const dealerCards = animateCards(response.dealerHand)

      // First player card
      playSound('card')
      setPlayerHand([playerCards[0]])

      // First dealer card
      addTimer(() => {
        if (!isMounted()) return
        playSound('card')
        setDealerHand([dealerCards[0]])
      }, 450)

      // Second player card
      addTimer(() => {
        if (!isMounted()) return
        playSound('card')
        setPlayerHand([{ ...playerCards[0], isNew: false }, playerCards[1]])
      }, 900)

      // Second dealer card (hidden)
      addTimer(() => {
        if (!isMounted()) return
        playSound('card')
        setDealerHand([{ ...dealerCards[0], isNew: false }, dealerCards[1]])
      }, 1350)

      // Check for immediate result (blackjack)
      addTimer(async () => {
        if (!isMounted()) return

        if (response.immediateResult) {
          // Blackjack veya dealer blackjack
          const result = response.immediateResult.result as GameResult
          const payout = response.immediateResult.payout

          // Dealer kartını göster
          setIsFlippingDealer(true)
          playSound('cardFlip')

          addTimer(() => {
            if (!isMounted()) return

            setIsFlippingDealer(false)
            setDealerCardFlipped(true)

            // Reveal dealer's hidden card
            const revealedDealerHand = dealerCards.map(c => ({ ...c, hidden: false, isNew: false }))
            setDealerHand(revealedDealerHand)

            addTimer(async () => {
              if (!isMounted()) return

              setResult(result)
              setGameState('game_over')
              setAnimatingResult(true)
              setWinAmount(payout)

              if (result === 'blackjack') {
                playSound('blackjack')
              } else if (result === 'push') {
                playSound('click')
              } else {
                playSound('lose')
              }

              await refreshUser()

              setIsDealing(false)
              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            }, 400)
          }, 700)
        } else {
          // Normal game continues
          setIsDealing(false)
          setIsProcessing(false)
          isActionLockedRef.current = false
        }
      }, 1800)

    } catch (error) {
      console.error('[Blackjack] Deal error:', error)
      toast.error('Bir hata oluştu!')
      setIsProcessing(false)
      setIsDealing(false)
      isActionLockedRef.current = false
    }
  }, [
    bet, userPoints, isActionLocked, settingsLoading, isGameEnabled,
    playSound, addTimer, isMounted, refreshUser, animateCards,
    setIsProcessing, setIsDealing, setCurrentBet, setDealerCardFlipped,
    setHasSplit, setSplitHand, setSplitBet, setSplitResult, setActiveHand,
    setWinAmount, setShowBustIndicator, setResult, setGameId, setServerCanSplit,
    setServerCanDouble, setGameState, setPlayerHand, setDealerHand,
    setIsFlippingDealer, setAnimatingResult, isActionLockedRef, splitBetRef
  ])

  // Hit action - Server'dan kart çek
  const hit = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing' && gameState !== 'playing_split') return

    setIsProcessing(true)
    isActionLockedRef.current = true

    const isPlayingSplit = gameState === 'playing_split'
    const currentHand = isPlayingSplit ? splitHand : playerHand
    const setCurrentHand = isPlayingSplit ? setSplitHand : setPlayerHand

    // Clear isNew flags
    setCurrentHand(clearNewFlags(currentHand))

    try {
      playSound('card')
      const response = await apiHitAction(gameId)

      if (!response.success) {
        throw new Error(response.error || 'Hit yapılamadı!')
      }

      // Update hands from server
      const newPlayerHand = animateCards(response.playerHand)
      const newSplitHand = animateCards(response.splitHand)
      const newDealerHand = response.dealerHand

      setPlayerHand(newPlayerHand)
      if (response.splitHand.length > 0) {
        setSplitHand(newSplitHand)
      }

      setActiveHand(response.activeHand)
      setServerCanSplit(false) // Can't split after hit
      setServerCanDouble(false) // Can't double after hit

      if (response.bust) {
        // Bust
        const bustHand = isPlayingSplit ? 'split' : 'main'
        setShowBustIndicator(bustHand)

        if (isPlayingSplit) {
          setSplitResult('lose')
          playSound('lose')
          addTimer(() => {
            setShowBustIndicator(null)
            setGameState(response.phase as GameState)
            setActiveHand(response.activeHand)
            setIsProcessing(false)
            isActionLockedRef.current = false
          }, 1200)
        } else if (response.gameOver) {
          // Game over
          addTimer(async () => {
            if (!isMounted()) return

            if (response.result) {
              setResult(response.result as GameResult)
            }
            if (response.splitResult) {
              setSplitResult(response.splitResult as GameResult)
            }

            // Reveal dealer cards if game is over
            if (response.dealerHand.some((c: Card) => !c.hidden)) {
              setIsFlippingDealer(true)
              playSound('cardFlip')
              addTimer(() => {
                setIsFlippingDealer(false)
                setDealerCardFlipped(true)
                setDealerHand(response.dealerHand)
              }, 700)
            }

            setGameState('game_over')
            setAnimatingResult(true)
            setWinAmount(response.payout)

            const combinedResult = response.splitResult
              ? getCombinedResult(response.result as GameResult, response.splitResult as GameResult, currentBet, splitBetRef.current)
              : response.result

            if (combinedResult === 'win' || combinedResult === 'blackjack') {
              playSound('win')
            } else if (combinedResult === 'lose') {
              playSound('lose')
            } else {
              playSound('click')
            }

            await refreshUser()

            setShowBustIndicator(null)
            setIsProcessing(false)
            isActionLockedRef.current = false
            addTimer(() => setAnimatingResult(false), 2500)
          }, 700)
        } else {
          // Has split, main busted but split continues
          addTimer(() => {
            setShowBustIndicator(null)
            setGameState(response.phase as GameState)
            setActiveHand(response.activeHand)
            setIsProcessing(false)
            isActionLockedRef.current = false
          }, 1200)
        }
      } else if (response.gameOver) {
        // Game over (21 or dealer turn completed)
        addTimer(async () => {
          if (!isMounted()) return

          // Show dealer reveal animation
          setIsFlippingDealer(true)
          playSound('cardFlip')

          addTimer(() => {
            setIsFlippingDealer(false)
            setDealerCardFlipped(true)
            setDealerHand(response.dealerHand)

            addTimer(async () => {
              if (response.result) {
                setResult(response.result as GameResult)
              }
              if (response.splitResult) {
                setSplitResult(response.splitResult as GameResult)
              }

              setGameState('game_over')
              setAnimatingResult(true)
              setWinAmount(response.payout)

              const combinedResult = response.splitResult
                ? getCombinedResult(response.result as GameResult, response.splitResult as GameResult, currentBet, splitBetRef.current)
                : response.result

              if (combinedResult === 'win' || combinedResult === 'blackjack') {
                playSound('win')
              } else if (combinedResult === 'lose') {
                playSound('lose')
              } else {
                playSound('click')
              }

              await refreshUser()

              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            }, 400)
          }, 700)
        }, 500)
      } else {
        // Normal hit, continue playing
        setGameState(response.phase as GameState)
        addTimer(() => {
          setIsProcessing(false)
          isActionLockedRef.current = false
        }, 300)
      }

    } catch (error) {
      console.error('[Blackjack] Hit error:', error)
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu!')
      setIsProcessing(false)
      isActionLockedRef.current = false
    }
  }, [
    gameState, gameId, playerHand, splitHand, currentBet, isActionLocked,
    playSound, addTimer, isMounted, refreshUser, animateCards, clearNewFlags,
    getCombinedResult, setIsProcessing, setPlayerHand, setSplitHand,
    setActiveHand, setServerCanSplit, setServerCanDouble, setShowBustIndicator,
    setSplitResult, setGameState, setResult, setIsFlippingDealer,
    setDealerCardFlipped, setDealerHand, setAnimatingResult, setWinAmount,
    isActionLockedRef, splitBetRef
  ])

  // Stand action - Server'a stand gönder
  const stand = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing' && gameState !== 'playing_split') return

    setIsProcessing(true)
    isActionLockedRef.current = true

    try {
      const response = await apiStandAction(gameId)

      if (!response.success) {
        throw new Error(response.error || 'Stand yapılamadı!')
      }

      if (!response.gameOver) {
        // Split hand stand - switch to main hand
        setGameState(response.phase as GameState)
        setActiveHand(response.activeHand)
        addTimer(() => {
          setIsProcessing(false)
          isActionLockedRef.current = false
        }, 300)
        return
      }

      // Game over - show dealer reveal animation
      setGameState('dealer_turn')
      setIsFlippingDealer(true)
      playSound('cardFlip')

      addTimer(() => {
        if (!isMounted()) return

        setIsFlippingDealer(false)
        setDealerCardFlipped(true)

        // Update dealer hand with revealed cards
        setDealerHand(response.dealerHand)

        addTimer(async () => {
          if (!isMounted()) return

          if (response.result) {
            setResult(response.result as GameResult)
          }
          if (response.splitResult) {
            setSplitResult(response.splitResult as GameResult)
          }

          setGameState('game_over')
          setAnimatingResult(true)
          setWinAmount(response.payout)

          const combinedResult = response.splitResult
            ? getCombinedResult(response.result as GameResult, response.splitResult as GameResult, currentBet, splitBetRef.current)
            : response.result

          if (combinedResult === 'win' || combinedResult === 'blackjack') {
            playSound('win')
          } else if (combinedResult === 'lose') {
            playSound('lose')
          } else {
            playSound('click')
          }

          await refreshUser()

          setIsProcessing(false)
          isActionLockedRef.current = false
          addTimer(() => setAnimatingResult(false), 2500)
        }, 600)
      }, 700)

    } catch (error) {
      console.error('[Blackjack] Stand error:', error)
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu!')
      setIsProcessing(false)
      isActionLockedRef.current = false
    }
  }, [
    gameState, gameId, currentBet, isActionLocked,
    playSound, addTimer, isMounted, refreshUser, getCombinedResult,
    setIsProcessing, setGameState, setActiveHand, setIsFlippingDealer,
    setDealerCardFlipped, setDealerHand, setResult, setSplitResult,
    setAnimatingResult, setWinAmount, isActionLockedRef, splitBetRef
  ])

  // Double action - Server'a double gönder
  const doubleDown = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing' && gameState !== 'playing_split') return

    const isPlayingSplit = gameState === 'playing_split'
    const currentHand = isPlayingSplit ? splitHand : playerHand
    const setCurrentHand = isPlayingSplit ? setSplitHand : setPlayerHand
    const handBet = isPlayingSplit ? splitBet : currentBet

    if (currentHand.length !== 2) return
    if (userPoints < handBet) {
      toast.error('Yetersiz puan!')
      return
    }

    setIsProcessing(true)
    isActionLockedRef.current = true

    playSound('chip')

    try {
      const response = await apiDoubleAction(gameId)

      if (!response.success) {
        throw new Error(response.error || 'Double yapılamadı!')
      }

      await refreshUser()

      // Update bet
      const newBet = handBet * 2
      if (isPlayingSplit) {
        setSplitBet(newBet)
        splitBetRef.current = newBet
      } else {
        setBet(newBet)
        setCurrentBet(newBet)
      }

      setIsDoubleDown(true)
      setServerCanDouble(false)

      // Clear old cards and show new
      setCurrentHand(clearNewFlags(currentHand))

      addTimer(() => {
        if (!isMounted()) return

        playSound('card')

        // Update hands from server
        const newPlayerHand = animateCards(response.playerHand)
        const newSplitHand = animateCards(response.splitHand)

        setPlayerHand(newPlayerHand)
        if (response.splitHand.length > 0) {
          setSplitHand(newSplitHand)
        }

        if (response.bust) {
          const bustHand = isPlayingSplit ? 'split' : 'main'
          setShowBustIndicator(bustHand)

          if (isPlayingSplit) {
            setSplitResult('lose')
            playSound('lose')
            addTimer(() => {
              setShowBustIndicator(null)
              setGameState(response.phase as GameState)
              setActiveHand(response.activeHand)
              setIsProcessing(false)
              isActionLockedRef.current = false
            }, 1200)
          } else if (response.gameOver) {
            addTimer(async () => {
              if (response.result) setResult(response.result as GameResult)
              if (response.splitResult) setSplitResult(response.splitResult as GameResult)

              // Reveal dealer
              if (response.dealerHand.some((c: Card) => !c.hidden)) {
                setIsFlippingDealer(true)
                playSound('cardFlip')
                addTimer(() => {
                  setIsFlippingDealer(false)
                  setDealerCardFlipped(true)
                  setDealerHand(response.dealerHand)
                }, 700)
              }

              setGameState('game_over')
              setAnimatingResult(true)
              setWinAmount(response.payout)
              playSound('lose')

              await refreshUser()

              setShowBustIndicator(null)
              setIsProcessing(false)
              isActionLockedRef.current = false
              addTimer(() => setAnimatingResult(false), 2500)
            }, 700)
          } else {
            addTimer(() => {
              setShowBustIndicator(null)
              setGameState(response.phase as GameState)
              setActiveHand(response.activeHand)
              setIsProcessing(false)
              isActionLockedRef.current = false
            }, 1200)
          }
        } else if (response.gameOver) {
          // Dealer turn completed
          addTimer(() => {
            setIsFlippingDealer(true)
            playSound('cardFlip')

            addTimer(() => {
              setIsFlippingDealer(false)
              setDealerCardFlipped(true)
              setDealerHand(response.dealerHand)

              addTimer(async () => {
                if (response.result) setResult(response.result as GameResult)
                if (response.splitResult) setSplitResult(response.splitResult as GameResult)

                setGameState('game_over')
                setAnimatingResult(true)
                setWinAmount(response.payout)

                const combinedResult = response.splitResult
                  ? getCombinedResult(response.result as GameResult, response.splitResult as GameResult, currentBet, splitBetRef.current)
                  : response.result

                if (combinedResult === 'win' || combinedResult === 'blackjack') {
                  playSound('win')
                } else if (combinedResult === 'lose') {
                  playSound('lose')
                } else {
                  playSound('click')
                }

                await refreshUser()

                setIsProcessing(false)
                isActionLockedRef.current = false
                addTimer(() => setAnimatingResult(false), 2500)
              }, 400)
            }, 700)
          }, 500)
        } else {
          // Split case - switch to main hand
          setGameState(response.phase as GameState)
          setActiveHand(response.activeHand)
          setIsProcessing(false)
          isActionLockedRef.current = false
        }
      }, 200)

    } catch (error) {
      console.error('[Blackjack] Double error:', error)
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu!')
      setIsProcessing(false)
      isActionLockedRef.current = false
    }
  }, [
    gameState, gameId, playerHand, splitHand, currentBet, splitBet, userPoints, isActionLocked,
    playSound, addTimer, isMounted, refreshUser, animateCards, clearNewFlags, getCombinedResult,
    setIsProcessing, setBet, setCurrentBet, setSplitBet, setIsDoubleDown, setServerCanDouble,
    setPlayerHand, setSplitHand, setShowBustIndicator, setSplitResult, setGameState,
    setActiveHand, setResult, setIsFlippingDealer, setDealerCardFlipped, setDealerHand,
    setAnimatingResult, setWinAmount, isActionLockedRef, splitBetRef
  ])

  // Split action - Server'a split gönder
  const split = useCallback(async () => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    if (gameState !== 'playing') return
    if (playerHand.length !== 2) return
    if (userPoints < currentBet) {
      toast.error('Yetersiz puan!')
      return
    }

    setIsProcessing(true)
    isActionLockedRef.current = true
    setIsSplitAnimating(true)

    playSound('chip')

    try {
      const response = await apiSplitAction(gameId)

      if (!response.success) {
        throw new Error(response.error || 'Split yapılamadı!')
      }

      await refreshUser()

      const card1 = playerHand[0]
      const card2 = playerHand[1]

      setSplitAnimationPhase('separating')
      setSplitCards({ left: card1, right: card2 })

      addTimer(() => {
        if (!isMounted()) return

        // Update hands from server response
        const newPlayerHand = animateCards(response.playerHand)
        const newSplitHand = animateCards(response.splitHand)

        setPlayerHand([{ ...newPlayerHand[0], isNew: false }])
        setSplitHand([{ ...newSplitHand[0], isNew: false }])
        setSplitBet(currentBet)
        splitBetRef.current = currentBet
        setHasSplit(true)
        setServerCanSplit(false)

        setSplitAnimationPhase('idle')
        setSplitCards({ left: null, right: null })

        // Animate new cards
        addTimer(() => {
          if (!isMounted()) return
          playSound('card')
          setSplitHand(newSplitHand)

          addTimer(() => {
            if (!isMounted()) return
            playSound('card')
            setPlayerHand(newPlayerHand)

            addTimer(() => {
              if (!isMounted()) return
              setActiveHand('split')
              setGameState('playing_split')
              setServerCanDouble(response.splitHand.length === 2)
              setIsSplitAnimating(false)
              setIsProcessing(false)
              isActionLockedRef.current = false
            }, 500)
          }, 600)
        }, 400)
      }, 700)

    } catch (error) {
      console.error('[Blackjack] Split error:', error)
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu!')
      setIsProcessing(false)
      setIsSplitAnimating(false)
      isActionLockedRef.current = false
    }
  }, [
    gameState, gameId, playerHand, currentBet, userPoints, isActionLocked,
    playSound, addTimer, isMounted, refreshUser, animateCards,
    setIsProcessing, setIsSplitAnimating, setSplitAnimationPhase, setSplitCards,
    setPlayerHand, setSplitHand, setSplitBet, setHasSplit, setServerCanSplit,
    setActiveHand, setGameState, setServerCanDouble, isActionLockedRef, splitBetRef
  ])

  // New game - Reset state
  const newGame = useCallback(() => {
    if (isActionLockedRef.current) return
    if (isActionLocked) return
    clearAllTimers()

    playSound('click')
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
    resetLocks()
  }, [
    playSound, clearAllTimers, isActionLocked, resetLocks,
    setPlayerHand, setSplitHand, setDealerHand, setGameState,
    setResult, setSplitResult, setBet, setCurrentBet, setSplitBet,
    setSelectedChip, setWinAmount, setIsFlippingDealer, setDealerCardFlipped,
    setIsProcessing, setHasSplit, setActiveHand, setIsDoubleDown, setIsSplitAnimating,
    setSplitAnimationPhase, setSplitCards, setShowBustIndicator, setIsDealing,
    setGameId, setServerCanSplit, setServerCanDouble, isActionLockedRef, splitBetRef
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
