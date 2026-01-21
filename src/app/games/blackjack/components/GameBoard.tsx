'use client'

import type { Card, GameState, GameResult } from '../types'
import { CardHand, PlayingCard } from './PlayingCard'

interface GameBoardProps {
  // Dealer
  dealerHand: Card[]
  dealerDisplayValue: string
  isDealing: boolean
  isFlippingDealer: boolean
  dealerCardFlipped: boolean

  // Player
  playerHand: Card[]
  playerDisplayValue: string
  splitHand: Card[]
  splitDisplayValue: string
  hasSplit: boolean
  activeHand: 'main' | 'split'

  // Game state
  gameState: GameState
  result: GameResult
  splitResult: GameResult
  currentBet: number
  splitBet: number

  // Split animation
  isSplitAnimating: boolean
  splitAnimationPhase: 'idle' | 'separating' | 'dealing_right' | 'dealing_left' | 'done'
  splitCards: { left: Card | null; right: Card | null }
}

export function GameBoard({
  dealerHand,
  dealerDisplayValue,
  isDealing,
  isFlippingDealer,
  dealerCardFlipped,
  playerHand,
  playerDisplayValue,
  splitHand,
  splitDisplayValue,
  hasSplit,
  activeHand,
  gameState,
  result,
  splitResult,
  currentBet,
  splitBet,
  isSplitAnimating,
  splitAnimationPhase,
  splitCards
}: GameBoardProps) {
  return (
    <>
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
    </>
  )
}
