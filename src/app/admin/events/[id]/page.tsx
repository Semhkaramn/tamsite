'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Users, Trophy, ArrowLeft, Loader2, Search, Calendar, Copy, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface Event {
  id: string
  title: string
  description: string
  imageUrl?: string
  status: string
  sponsor: { id: string; name: string; logoUrl?: string }
  participantLimit: number
  participationType: string
  participantCount: number
  endDate: string
  participants?: Array<{
    id: string
    user: { siteUsername?: string; email?: string; telegramUsername?: string; firstName?: string }
    sponsorInfo: string
    createdAt: string
  }>
  winners?: Array<{
    id: string
    status: string
    statusMessage: string
    userId: string
    user: { siteUsername?: string; email?: string }
  }>
  _count?: { participants: number; winners: number }
}

const statusOptions = [
  { value: 'prize_added', label: 'Ödül Eklendi' },
  { value: 'no_investment', label: 'Yatırım Yok' },
  { value: 'no_bonus', label: 'No Bonus' },
  { value: 'multi', label: 'Multi' },
  { value: 'last_transaction', label: 'Son İşlem Bonus' },
  { value: 'active_balance', label: 'Aktif Bakiye' },
  { value: 'different_btag', label: 'Farklı Btag' }
]

export default function AdminEventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<Event | null>(null)
  const [search, setSearch] = useState('')
  const [winnerSearch, setWinnerSearch] = useState('')
  const [processing, setProcessing] = useState(false)
  const [winnerStatuses, setWinnerStatuses] = useState<Record<string, { status: string; statusMessage: string }>>({})
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) return router.push('/admin')
    loadEvent()
  }, [params.id])

  async function loadEvent() {
    try {
      const res = await fetch(`/api/admin/events/${params.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvent(data.event)

      if (data.event.winners) {
        const statuses: Record<string, { status: string; statusMessage: string }> = {}
        data.event.winners.forEach((w: any) => {
          statuses[w.userId] = {
            status: w.status === 'pending' ? 'prize_added' : w.status,
            statusMessage: w.status === 'pending' ? 'Ödül Eklendi' : w.statusMessage
          }
        })
        setWinnerStatuses(statuses)
      }
    } catch {
      toast.error('Hata')
      router.push('/admin/events')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action: 'end') {
    setShowEndConfirm(false)
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/events/${params.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(data.message || 'Başarılı')
      loadEvent()
    } catch {
      toast.error('Hata')
    } finally {
      setProcessing(false)
    }
  }

  async function handleComplete() {
    setShowCompleteConfirm(false)
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/events/${params.id}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ winnerStatuses })
      })
      if (!res.ok) throw new Error()
      toast.success('Etkinlik tamamlandı')
      loadEvent()
    } catch {
      toast.error('Hata')
    } finally {
      setProcessing(false)
    }
  }

  function updateWinnerStatus(userId: string, statusValue: string) {
    const option = statusOptions.find(opt => opt.value === statusValue)
    if (option) {
      setWinnerStatuses(prev => ({
        ...prev,
        [userId]: {
          status: option.value,
          statusMessage: option.label
        }
      }))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
    </div>
  )
  if (!event) return null

  const filtered = event.participants?.filter(p => {
    const s = search.toLowerCase()
    return p.user.siteUsername?.toLowerCase().includes(s) ||
           p.user.email?.toLowerCase().includes(s) ||
           p.user.telegramUsername?.toLowerCase().includes(s) ||
           p.sponsorInfo.toLowerCase().includes(s)
  }) || []

  const filteredWinners = event.winners?.filter(w => {
    const s = winnerSearch.toLowerCase()
    const participant = event.participants?.find(p => p.user.siteUsername === w.user.siteUsername || p.user.email === w.user.email)
    return w.user.siteUsername?.toLowerCase().includes(s) ||
           w.user.email?.toLowerCase().includes(s) ||
           participant?.sponsorInfo?.toLowerCase().includes(s)
  }) || []

  const progress = (event.participantCount / event.participantLimit) * 100

  const allWinnersHaveStatus = event.winners?.every(w =>
    winnerStatuses[w.userId]?.status &&
    winnerStatuses[w.userId]?.status !== 'pending'
  ) ?? false

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/events')}
            className="text-slate-400 h-10 px-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <Badge
            className="text-xs font-medium px-3 py-1"
            style={{
              background: event.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : event.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(71, 85, 105, 0.3)',
              color: event.status === 'active' ? '#34d399' : event.status === 'pending' ? '#fbbf24' : '#94a3b8',
              border: 'none'
            }}
          >
            {event.status === 'active' ? 'Aktif' : event.status === 'pending' ? 'Beklemede' : 'Tamamlandı'}
          </Badge>
        </div>

        {/* Event Image */}
        <div className="relative w-full h-48 md:h-56 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
          <Image
            src={event.imageUrl || event.sponsor.logoUrl || '/logo.png'}
            alt={event.title}
            fill
            className="object-contain p-4"
          />
        </div>

        {/* Event Info Card */}
        <div className="p-5 space-y-5 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div>
            <h1 className="text-xl font-semibold text-white">{event.title}</h1>
            {event.description && <p className="text-sm text-slate-500 mt-2">{event.description}</p>}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Users className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
              <p className="font-semibold text-white text-lg">{event.participantCount}</p>
              <p className="text-xs text-slate-500">Katılımcı</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Trophy className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
              <p className="font-semibold text-white text-lg">{event.participantLimit}</p>
              <p className="text-xs text-slate-500">Limit</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Calendar className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
              <p className="font-semibold text-white text-sm">{formatDate(event.endDate)}</p>
              <p className="text-xs text-slate-500">Bitiş</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Trophy className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
              <p className="font-semibold text-white text-lg">{event._count?.winners || 0}</p>
              <p className="text-xs text-slate-500">Kazanan</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Doluluk</span>
              <span className="text-emerald-400 font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Action Button */}
          {event.status === 'active' && (
            <Button
              onClick={() => setShowEndConfirm(true)}
              disabled={processing}
              className="w-full h-12 text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {event.participationType === 'raffle' ? 'Sonlandır ve Çekiliş Yap' : 'Sonlandır'}
            </Button>
          )}
        </div>

        {/* Participants Card */}
        <div className="p-5 space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="font-medium text-base text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              Katılımcılar ({event.participants?.length || 0})
            </h2>
            <div className="relative w-full md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Katılımcı ara..."
                className="h-10 pl-10 text-sm bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <ScrollArea className="max-h-[400px] md:max-h-[500px] pr-2 -mr-2">
            <div className="space-y-2">
              {filtered.length > 0 ? filtered.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-white truncate">
                      {p.user.siteUsername || p.user.email || p.user.telegramUsername || p.user.firstName || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{p.sponsorInfo}</p>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="w-10 h-10 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-600">
                    {search ? 'Katılımcı bulunamadı' : 'Henüz katılımcı yok'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Winners Card */}
        {event.winners && event.winners.length > 0 && (
          <div className="p-5 space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="font-medium text-base text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-emerald-400" />
                  Kazananlar ({event.winners.length})
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      const winnersText = event.winners?.map((w) => {
                        const participant = event.participants?.find(p => p.user.siteUsername === w.user.siteUsername || p.user.email === w.user.email)
                        const sponsorInfo = participant?.sponsorInfo || 'Sponsor bilgisi yok'
                        if (event.status === 'completed') {
                          const status = winnerStatuses[w.userId]?.statusMessage || w.statusMessage || 'Durum yok'
                          return `${sponsorInfo} - ${status}`
                        } else {
                          return sponsorInfo
                        }
                      }).join('\n') || ''
                      navigator.clipboard.writeText(winnersText)
                      toast.success('Kopyalandı')
                    }}
                    size="sm"
                    className="h-9 px-4 text-xs bg-slate-800 text-slate-400 border border-slate-700"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Kopyala
                  </Button>
                  {event.status === 'pending' && (
                    <Button
                      onClick={() => setShowCompleteConfirm(true)}
                      disabled={processing || !allWinnersHaveStatus}
                      size="sm"
                      className="h-9 px-4 text-xs bg-emerald-600 text-white disabled:opacity-40"
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Tamamla
                    </Button>
                  )}
                </div>
              </div>

              <div className="relative w-full md:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={winnerSearch}
                  onChange={(e) => setWinnerSearch(e.target.value)}
                  placeholder="Kazanan ara..."
                  className="h-10 pl-10 text-sm bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <ScrollArea className="max-h-[400px] md:max-h-[500px] pr-2 -mr-2">
              <div className="space-y-2">
                {filteredWinners.length > 0 ? filteredWinners.map((w) => {
                  const participant = event.participants?.find(p => p.user.siteUsername === w.user.siteUsername || p.user.email === w.user.email)
                  return (
                    <div key={w.id} className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium text-sm text-white truncate">{w.user.siteUsername || w.user.email || 'User'}</p>
                        <p className="text-xs text-slate-500 truncate">{participant?.sponsorInfo || 'Sponsor bilgisi yok'}</p>
                      </div>
                      {event.status === 'pending' ? (
                        <Select
                          value={winnerStatuses[w.userId]?.status || 'prize_added'}
                          onValueChange={(value) => updateWinnerStatus(w.userId, value)}
                        >
                          <SelectTrigger className="w-full md:w-44 h-10 text-xs bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Durum seçin" />
                          </SelectTrigger>
                          <SelectContent
                            className="bg-slate-800 border-slate-700 max-h-[200px] overflow-y-auto z-[100]"
                          >
                            {statusOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs text-white cursor-pointer hover:bg-slate-700">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-right">
                          <span className="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-300">{w.status}</span>
                          <p className="text-xs text-slate-500 mt-1">{w.statusMessage}</p>
                        </div>
                      )}
                    </div>
                  )
                }) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Trophy className="w-10 h-10 text-slate-700 mb-3" />
                    <p className="text-sm text-slate-600">
                      {winnerSearch ? 'Kazanan bulunamadı' : 'Henüz kazanan yok'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* End Event Confirmation Dialog */}
        <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
          <AlertDialogContent className="bg-slate-900 border-slate-800 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white text-lg">Etkinliği Sonlandır</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 text-sm">
                {event?.participationType === 'raffle'
                  ? 'Etkinlik sonlandırılacak ve çekiliş yapılacak. Emin misiniz?'
                  : 'Etkinliği sonlandırmak istediğinizden emin misiniz?'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="h-10 text-sm bg-slate-800 text-slate-300 border-slate-700">
                İptal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction('end')}
                className="h-10 text-sm bg-red-600 text-white hover:bg-red-700"
              >
                Evet, Sonlandır
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Complete Event Confirmation Dialog */}
        <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
          <AlertDialogContent className="bg-slate-900 border-slate-800 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white text-lg">Etkinliği Tamamla</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 text-sm">
                Etkinliği tamamlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="h-10 text-sm bg-slate-800 text-slate-300 border-slate-700">
                İptal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleComplete}
                className="h-10 text-sm bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Evet, Tamamla
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
