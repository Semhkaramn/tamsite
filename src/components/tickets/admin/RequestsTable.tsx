'use client'

import { User, Banknote, Hash, Check, X, Eye } from 'lucide-react'

interface Sponsor {
  id: string
  name: string
  category: string
}

interface TicketRequest {
  id: string
  userId: string
  sponsorInfo: string
  investmentAmount: number
  investmentDate: string
  note?: string
  status: string
  createdAt: string
  event: {
    title: string
    sponsor: Sponsor
    ticketPrice: number
  }
  user?: {
    siteUsername: string
    email: string
  }
  ticketNumbers: any[]
}

interface RequestsTableProps {
  requests: TicketRequest[]
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  onViewDetails: (request: TicketRequest) => void
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
}

export function RequestsTable({
  requests,
  onApprove,
  onReject,
  onViewDetails,
  formatAmount,
  formatDateTR
}: RequestsTableProps) {
  return (
    <div className="space-y-1">
      {requests.map((request) => (
        <div
          key={request.id}
          onClick={() => onViewDetails(request)}
          className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer"
        >
          {/* User */}
          <div className="flex items-center gap-1.5 min-w-0 w-32">
            <User className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span className="text-white text-xs font-medium truncate">
              {request.user?.siteUsername || request.user?.email?.split('@')[0] || '-'}
            </span>
          </div>

          {/* Sponsor Info */}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-cyan-400 truncate block">
              {request.sponsorInfo}
            </span>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded flex-shrink-0">
            <Banknote className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-xs">{formatAmount(request.investmentAmount)}</span>
          </div>

          {/* Tickets */}
          {request.ticketNumbers.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Hash className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-400 font-mono">
                {request.ticketNumbers.length}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {request.status === 'pending' && (
              <>
                <button
                  onClick={() => onApprove(request.id)}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onReject(request.id)}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/30"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {request.status === 'approved' && (
              <span className="px-2 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium">
                Onaylandı
              </span>
            )}
            {request.status === 'rejected' && (
              <span className="px-2 py-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded font-medium">
                Reddedildi
              </span>
            )}
            <button
              onClick={() => onViewDetails(request)}
              className="w-7 h-7 rounded-md flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
