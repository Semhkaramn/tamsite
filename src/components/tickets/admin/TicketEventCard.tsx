'use client'

import { Trophy, Award, Copy, Trash2, Eye, Check, Clock, Users, Banknote, Calendar, TicketCheck } from 'lucide-react'

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
}

interface Sponsor {
  id: string
  name: string
  category: string
}

interface TicketEvent {
  id: string
  title: string
  description: string
  status: string
  sponsor: Sponsor
  totalTickets: number
  ticketPrice: number
  soldTickets: number
  endDate: string
  createdAt: string
  prizes: Prize[]
}

interface TicketEventCardProps {
  event: TicketEvent
  selectedWinners: { [prizeId: string]: number[] }
  ticketNumbers: any[]
  onComplete: (event: TicketEvent) => void
  onDelete: (eventId: string) => void
  onDistributeRewards: (event: TicketEvent) => void
  onCopyWinners: (event: TicketEvent) => void
  onViewDetails: (eventId: string) => void
  onOpenPrizeSelection: (event: TicketEvent, prize: Prize) => void
  onRemoveWinner: (prizeId: string, ticketNumber: number) => void
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
}

export function TicketEventCard({
  event,
  selectedWinners,
  onComplete,
  onDelete,
  onDistributeRewards,
  onCopyWinners,
  onViewDetails,
  onOpenPrizeSelection,
  formatAmount,
  formatDateTR
}: TicketEventCardProps) {
  const isWaitingDraw = event.status === 'waiting_draw'
  const allPrizesSelected = event.prizes.every(p => {
    const winners = selectedWinners[p.id || ''] || []
    return winners.length === p.winnerCount
  })
  const hasAnyWinners = Object.values(selectedWinners).some(winners => winners.length > 0)
  const progressPercent = (event.soldTickets / event.totalTickets) * 100

  return (
    <div className="p-4 md:p-5">
      {/* Status Bar */}
      <div
        className="h-1 -mx-4 md:-mx-5 -mt-4 md:-mt-5 mb-4"
        style={{
          background: isWaitingDraw ? '#f59e0b' : '#10b981'
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-semibold text-white truncate">{event.title}</h3>
            {isWaitingDraw && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 flex-shrink-0">
                <Clock className="w-3 h-3" />
                Çekiliş
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium">{event.sponsor.name}</span>
            <span>-</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDateTR(event.endDate)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDelete(event.id)}
          className="p-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-3 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
          <Banknote className="w-4 h-4 text-slate-400 mx-auto mb-1" />
          <div className="text-sm font-semibold text-white">{formatAmount(event.ticketPrice)}</div>
          <div className="text-[10px] text-slate-500 uppercase">Fiyat</div>
        </div>
        <div className="p-3 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
          <TicketCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
          <div className="text-sm font-semibold text-white">{event.soldTickets}</div>
          <div className="text-[10px] text-slate-500 uppercase">Satılan</div>
        </div>
        <div className="p-3 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
          <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
          <div className="text-sm font-semibold text-white">{event.totalTickets}</div>
          <div className="text-[10px] text-slate-500 uppercase">Toplam</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-3 rounded-lg mb-4 bg-slate-800/30 border border-slate-700/30">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-slate-500">Satış Durumu</span>
          <span className="font-medium text-emerald-400">{progressPercent.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-slate-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Prizes Section */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Ödüller</div>
        {event.prizes.map((prize, idx) => {
          const prizeId = prize.id || ''
          const winners = selectedWinners[prizeId] || []
          const isComplete = winners.length === prize.winnerCount

          return (
            <div
              key={prize.id || idx}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10">
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-400">{formatAmount(prize.prizeAmount)} TL</div>
                  <div className="text-xs text-slate-600">{prize.winnerCount} kişi</div>
                </div>
              </div>

              {isWaitingDraw && (
                <div className="flex items-center gap-2">
                  {winners.length > 0 && (
                    <div className="flex items-center gap-1">
                      {winners.slice(0, 2).map(ticketNum => (
                        <span
                          key={ticketNum}
                          className="px-1.5 py-0.5 text-xs rounded font-mono bg-emerald-500/10 text-emerald-400"
                        >
                          #{ticketNum}
                        </span>
                      ))}
                      {winners.length > 2 && (
                        <span className="text-xs text-slate-600">+{winners.length - 2}</span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => onOpenPrizeSelection(event, prize)}
                    className="h-8 px-3 text-xs rounded-lg font-medium flex items-center transition-colors"
                    style={{
                      background: isComplete ? 'rgba(16, 185, 129, 0.15)' : 'rgba(71, 85, 105, 0.3)',
                      color: isComplete ? '#34d399' : '#94a3b8'
                    }}
                  >
                    {isComplete && <Check className="w-3.5 h-3.5 mr-1" />}
                    {winners.length}/{prize.winnerCount}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isWaitingDraw ? (
          <>
            <button
              onClick={() => onDistributeRewards(event)}
              disabled={!allPrizesSelected}
              className="flex-1 h-11 text-sm font-medium rounded-lg flex items-center justify-center gap-2 bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 disabled:opacity-40  hover:bg-emerald-600/25 transition-colors"
            >
              <Award className="w-4 h-4" />
              Ödülleri Dağıt
            </button>
            <button
              onClick={() => onCopyWinners(event)}
              disabled={!hasAnyWinners}
              className="h-11 w-11 rounded-lg flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700 disabled:opacity-40  hover:bg-slate-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onComplete(event)}
            className="flex-1 h-11 text-sm font-medium rounded-lg flex items-center justify-center gap-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
          >
            <Trophy className="w-4 h-4" />
            Çekilişe Hazırla
          </button>
        )}
        <button
          onClick={() => onViewDetails(event.id)}
          className="h-11 w-11 rounded-lg flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
