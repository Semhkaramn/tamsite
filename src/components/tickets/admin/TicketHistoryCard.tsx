'use client'

import { Trophy, Copy, Eye, Award, Users, Calendar, Banknote, ChevronRight } from 'lucide-react'

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

interface TicketHistoryCardProps {
  event: TicketEvent
  onCopyWinners: (event: TicketEvent) => void
  onViewDetails: (eventId: string) => void
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
}

export function TicketHistoryCard({
  event,
  onCopyWinners,
  onViewDetails,
  formatAmount,
  formatDateTR
}: TicketHistoryCardProps) {
  const progressPercent = (event.soldTickets / event.totalTickets) * 100
  const totalPrize = event.prizes.reduce((sum, p) => sum + (p.prizeAmount * p.winnerCount), 0)

  return (
    <div
      onClick={() => onViewDetails(event.id)}
      className="relative cursor-pointer rounded-xl overflow-hidden bg-slate-900/80 border border-slate-800"
    >
      {/* Status Indicator Bar */}
      <div className="h-0.5 bg-slate-600" />

      <div className="p-4">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">
                {event.title}
              </h3>
              <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/50 text-slate-400">
                <span className="w-1 h-1 rounded-full bg-slate-400" />
                Tamamlandı
              </span>
              <span className="text-[10px] text-slate-500">{event.sponsor.name}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
            <Banknote className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
            <div className="text-sm font-semibold text-emerald-400">{formatAmount(event.ticketPrice)}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Fiyat</div>
          </div>
          <div className="p-2 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
            <Users className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
            <div className="text-sm font-semibold text-white">{event.soldTickets}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Satılan</div>
          </div>
          <div className="p-2 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
            <div className="text-[10px] font-semibold text-white">{formatDateTR(event.endDate)}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Bitiş</div>
          </div>
        </div>

        {/* Prizes Section */}
        <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-slate-500">Ödüller</span>
            </div>
            <span className="text-xs font-semibold text-amber-400">{formatAmount(totalPrize)} TL</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {event.prizes.map((prize, idx) => (
              <div
                key={prize.id || idx}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
              >
                <Award className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-amber-400 font-medium text-[10px]">{formatAmount(prize.prizeAmount)}</span>
                <span className="text-[9px] text-slate-600">x{prize.winnerCount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onViewDetails(event.id)}
            className="flex-1 h-8 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700"
          >
            <Eye className="w-3.5 h-3.5" />
            Detay
          </button>
          <button
            onClick={() => onCopyWinners(event)}
            className="h-8 px-4 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 bg-emerald-600/15 text-emerald-400 border border-emerald-500/30"
          >
            <Copy className="w-3.5 h-3.5" />
            Kopyala
          </button>
        </div>
      </div>
    </div>
  )
}
