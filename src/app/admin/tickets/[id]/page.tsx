'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  TicketCheck,
  Calendar,
  Users,
  Award,
  Trophy,
  ArrowLeft,
  Clock,
  Loader2,
  Search,
  Banknote,
  Hash,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
  winners?: Array<{
    ticketNumber: {
      ticketNumber: number
      user?: {
        siteUsername?: string
        email?: string
      }
    }
  }>
}

interface TicketEvent {
  id: string
  title: string
  description: string
  status: string
  sponsor: {
    id: string
    name: string
    logoUrl?: string
    description?: string
  }
  totalTickets: number
  ticketPrice: number
  soldTickets: number
  endDate: string
  prizes: Prize[]
  _count?: {
    ticketNumbers: number
  }
  uniqueParticipants?: number
}

interface TicketNumber {
  id: string
  ticketNumber: number
  userId: string
  username: string
  sponsorInfo: string
}

export default function AdminTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<TicketEvent | null>(null)
  const [ticketNumbers, setTicketNumbers] = useState<TicketNumber[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const formatDateTR = (date: string | Date) => {
    const d = new Date(date)
    return d.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('tr-TR')
  }

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadEvent()
  }, [params.id])

  async function loadEvent() {
    try {
      setLoading(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setEvent(data.event)
        setTicketNumbers(data.ticketNumbers || [])
      } else {
        toast.error('Etkinlik bulunamadı')
        router.push('/admin/tickets')
      }
    } catch (error) {
      console.error('Error loading event:', error)
      toast.error('Yükleme hatası')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
      </div>
    )
  }

  if (!event) return null

  const totalPrizePool = event.prizes.reduce((sum, p) => sum + (p.prizeAmount * p.winnerCount), 0)
  const progressPercent = (event.soldTickets / event.totalTickets) * 100

  const displayedTickets = searchTerm.trim() === ''
    ? ticketNumbers
    : ticketNumbers.filter(t =>
        t.ticketNumber.toString().includes(searchTerm.replace('#', '').trim()) ||
        t.username?.toLowerCase().includes(searchTerm.toLowerCase())
      )

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/tickets">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 bg-slate-900 border border-slate-800">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              {event.sponsor.logoUrl && (
                <div className="w-20 h-10 relative flex-shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                  <Image
                    src={event.sponsor.logoUrl}
                    alt={event.sponsor.name}
                    fill
                    sizes="80px"
                    className="object-contain p-1"
                  />
                </div>
              )}
              <div>
                <h1 className="text-lg font-semibold text-white">{event.title}</h1>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{event.sponsor.name}</span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      background: event.status === 'completed' ? 'rgba(71, 85, 105, 0.3)' : event.status === 'waiting_draw' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: event.status === 'completed' ? '#94a3b8' : event.status === 'waiting_draw' ? '#fbbf24' : '#34d399'
                    }}
                  >
                    <span className={`w-1 h-1 rounded-full ${event.status === 'completed' ? 'bg-slate-400' : event.status === 'waiting_draw' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    {event.status === 'completed' ? 'Tamamlandı' : event.status === 'waiting_draw' ? 'Çekiliş' : 'Aktif'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="p-3 rounded-xl text-center bg-slate-900/80 border border-slate-800">
            <Banknote className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-emerald-400">{formatAmount(event.ticketPrice)} TL</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Fiyat</div>
          </div>
          <div className="p-3 rounded-xl text-center bg-slate-900/80 border border-slate-800">
            <TicketCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">{event.totalTickets}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Toplam</div>
          </div>
          <div className="p-3 rounded-xl text-center bg-slate-900/80 border border-slate-800">
            <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">{event.soldTickets}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Satılan</div>
          </div>
          <div className="p-3 rounded-xl text-center bg-slate-900/80 border border-slate-800">
            <Calendar className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-[10px] font-semibold text-white">{formatDateTR(event.endDate)}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Bitiş</div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-4">
            <h3 className="text-xs font-medium text-slate-400 mb-2">Açıklama</h3>
            <p className="text-sm text-white whitespace-pre-line">{event.description}</p>
          </div>
        )}

        {/* Progress */}
        {event.status !== 'completed' && (
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">Doluluk Oranı</span>
              </div>
              <span className="text-xs font-medium text-emerald-400">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Prizes */}
        <div className="rounded-xl overflow-hidden bg-slate-900/80 border border-slate-800 mb-4">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Ödüller
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {event.prizes.map((prize, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10">
                    <Award className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-amber-400 font-semibold text-sm">{formatAmount(prize.prizeAmount)} TL</span>
                    <span className="text-xs text-slate-500 ml-2">x{prize.winnerCount} kişi</span>
                  </div>
                </div>
                <span className="text-xs text-slate-600 font-medium">#{idx + 1}</span>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <span className="text-xs text-slate-400 font-medium">Toplam Ödül Havuzu</span>
              <span className="text-emerald-400 font-bold text-sm">{formatAmount(totalPrizePool)} TL</span>
            </div>
          </div>
        </div>

        {/* Winners */}
        {event.status === 'completed' && (
          <div className="rounded-xl overflow-hidden bg-slate-900/80 border border-slate-800 mb-4">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Kazananlar
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {event.prizes.map((prize, idx) => (
                <div key={prize.id ?? idx} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-400 font-semibold text-sm">{formatAmount(prize.prizeAmount)} TL</span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] bg-slate-700/50 text-slate-400 rounded font-medium">
                      {prize.winnerCount} kişi
                    </span>
                  </div>

                  {prize.winners && prize.winners.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {prize.winners.map((winner: any, widx: number) => (
                        <div key={widx} className="p-2 rounded-lg bg-slate-800 border border-slate-700/50">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Hash className="w-3 h-3 text-amber-400" />
                            <span className="text-white font-bold text-xs">{winner.ticketNumber?.ticketNumber ?? '-'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {winner.ticketNumber?.user?.siteUsername || winner.ticketNumber?.user?.email || '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-slate-600 text-xs">Kazanan yok</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ticket Numbers */}
        {ticketNumbers.length > 0 && (
          <div className="rounded-xl overflow-hidden bg-slate-900/80 border border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <TicketCheck className="w-4 h-4 text-emerald-400" />
                Biletler ({ticketNumbers.length})
              </h3>
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrele..."
                  className="h-8 pl-8 pr-3 text-xs bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                />
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto">
                {displayedTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <Hash className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold text-xs">{ticket.ticketNumber}</span>
                    </div>
                    <div className="text-[10px] text-white truncate font-medium">
                      {ticket.username || 'N/A'}
                    </div>
                    <div className="text-[9px] text-slate-600 truncate">
                      {ticket.sponsorInfo}
                    </div>
                  </div>
                ))}
              </div>

              {displayedTickets.length === 0 && searchTerm.trim() !== '' && (
                <div className="text-center py-8 text-slate-600 text-sm">
                  Sonuç bulunamadı
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
