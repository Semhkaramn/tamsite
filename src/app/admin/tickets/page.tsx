'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PromptDialog } from '@/components/PromptDialog'
import { TicketCreateForm } from '@/components/tickets/admin/TicketCreateForm'
import { TicketEventCard } from '@/components/tickets/admin/TicketEventCard'
import { TicketHistoryCard } from '@/components/tickets/admin/TicketHistoryCard'
import { RequestsTable } from '@/components/tickets/admin/RequestsTable'
import { RequestDetailModal } from '@/components/tickets/admin/RequestDetailModal'
import { WinnerSelector } from '@/components/tickets/admin/WinnerSelector'
import { TicketCheck, Plus, Search, Gift, History, Loader2, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface Sponsor {
  id: string
  name: string
  category: string
}

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
}

interface TicketEvent {
  id: string
  title: string
  description: string
  sponsor: Sponsor
  totalTickets: number
  ticketPrice: number
  soldTickets: number
  endDate: string
  status: string
  createdAt: string
  prizes: Prize[]
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

export default function AdminTicketsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('active')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'requests') {
      setActiveTab('requests')
    }
  }, [searchParams])

  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [events, setEvents] = useState<TicketEvent[]>([])
  const [requests, setRequests] = useState<TicketRequest[]>([])
  const [historyEvents, setHistoryEvents] = useState<TicketEvent[]>([])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEventId, setFilterEventId] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')

  const [selectedWinners, setSelectedWinners] = useState<{ [prizeId: string]: number[] }>({})
  const [selectedEventForWinners, setSelectedEventForWinners] = useState<TicketEvent | null>(null)
  const [selectedPrizeForSelection, setSelectedPrizeForSelection] = useState<(Prize & { eventId: string }) | null>(null)
  const [ticketNumbers, setTicketNumbers] = useState<any[]>([])
  const [showPrizeSelectionModal, setShowPrizeSelectionModal] = useState(false)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [eventToComplete, setEventToComplete] = useState<TicketEvent | null>(null)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [requestToApprove, setRequestToApprove] = useState<string | null>(null)
  const [rejectPromptOpen, setRejectPromptOpen] = useState(false)
  const [requestToReject, setRequestToReject] = useState<string | null>(null)

  const [showRequestDetailModal, setShowRequestDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<TicketRequest | null>(null)

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
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadData()
  }, [activeTab, filterEventId, filterStatus])

  async function loadData() {
    try {
      setLoading(true)
      const token = localStorage.getItem('admin_token')

      const sponsorsRes = await fetch('/api/admin/sponsors', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const sponsorsData = await sponsorsRes.json()
      setSponsors(sponsorsData.sponsors || [])

      if (activeTab === 'active') {
        const eventsRes = await fetch('/api/admin/tickets?status=active', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const eventsData = await eventsRes.json()

        const waitingRes = await fetch('/api/admin/tickets?status=waiting_draw', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const waitingData = await waitingRes.json()

        setEvents([...(eventsData.events || []), ...(waitingData.events || [])])
      } else if (activeTab === 'requests') {
        const requestsRes = await fetch(`/api/admin/tickets/requests?eventId=${filterEventId}&status=${filterStatus}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const requestsData = await requestsRes.json()
        setRequests(requestsData.requests || [])
      } else if (activeTab === 'history') {
        const historyRes = await fetch('/api/admin/tickets?status=completed', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const historyData = await historyRes.json()
        setHistoryEvents(historyData.events || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Veri yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSuccess() {
    setShowCreateForm(false)
    loadData()
  }

  async function handleRequestAction(requestId: string, action: 'approve' | 'reject', reason?: string) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, rejectionReason: reason }),
      })

      if (res.ok) {
        const data = await res.json()
        if (action === 'approve') {
          let message = `Onaylandı (${data.ticketCount} bilet)`
          if (data.isPartialApproval) {
            message += ` - Kısmi: ${data.requestedTicketCount} talep, ${data.ticketCount} verildi`
          }
          toast.success(message)
        } else {
          toast.success('Talep reddedildi')
        }

        setApproveConfirmOpen(false)
        setRejectPromptOpen(false)
        setRequestToApprove(null)
        setRequestToReject(null)
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Error handling request:', error)
      toast.error('İşlem sırasında hata oluştu')
    }
  }

  async function deleteEvent(eventId: string) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (res.ok) {
        toast.success('Etkinlik silindi')
        setDeleteConfirmOpen(false)
        setEventToDelete(null)
        loadData()
      } else {
        toast.error('Silinemedi')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Silme başarısız')
    }
  }

  async function completeEvent(event: TicketEvent) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${event.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'prepare_draw' }),
      })

      if (res.ok) {
        toast.success('Çekiliş hazır!')

        const initialWinners: { [prizeId: string]: number[] } = {}
        event.prizes.forEach(prize => {
          initialWinners[prize.id || ''] = []
        })
        setSelectedWinners(initialWinners)

        setCompleteConfirmOpen(false)
        setEventToComplete(null)
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Hazırlanamadı')
      }
    } catch (error) {
      console.error('Error preparing draw:', error)
      toast.error('Hazırlama başarısız')
    }
  }

  async function distributeRewards(event: TicketEvent) {
    if (!event) {
      toast.error('Etkinlik seçilmedi')
      return
    }

    for (const prize of event.prizes) {
      const prizeId = prize.id || ''
      if (!selectedWinners[prizeId] || selectedWinners[prizeId].length !== prize.winnerCount) {
        toast.error(`${formatAmount(prize.prizeAmount)} TL için ${prize.winnerCount} kazanan seçin!`)
        return
      }
    }

    try {
      const token = localStorage.getItem('admin_token')
      const winners = Object.entries(selectedWinners)
        .filter(([prizeId, ticketNumbers]) => ticketNumbers.length > 0)
        .map(([prizeId, ticketNumbers]) => ({ prizeId, ticketNumbers }))

      const res = await fetch(`/api/admin/tickets/${event.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete_draw',
          winners,
        }),
      })

      if (res.ok) {
        toast.success('Ödüller dağıtıldı!')
        setSelectedEventForWinners(null)
        setTicketNumbers([])
        setSelectedWinners({})
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Dağıtılamadı')
      }
    } catch (error) {
      console.error('Error distributing rewards:', error)
      toast.error('Dağıtım başarısız')
    }
  }

  async function openPrizeSelectionModal(event: TicketEvent, prize: Prize) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${event.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setTicketNumbers(data.ticketNumbers || [])
        setSelectedEventForWinners(event)
        setSelectedPrizeForSelection({ ...prize, eventId: event.id })

        if (!selectedWinners[prize.id || '']) {
          setSelectedWinners(prev => ({ ...prev, [prize.id || '']: [] }))
        }

        setShowPrizeSelectionModal(true)
      } else {
        toast.error('Biletler yüklenemedi')
      }
    } catch (error) {
      console.error('Error loading tickets:', error)
      toast.error('Yükleme hatası')
    }
  }

  function toggleWinnerSelection(prizeId: string, ticketNumber: number) {
    const prize = selectedPrizeForSelection
    if (!prize) return

    setSelectedWinners(prev => {
      const current = prev[prizeId] || []
      const index = current.indexOf(ticketNumber)

      if (index >= 0) {
        return { ...prev, [prizeId]: current.filter(tn => tn !== ticketNumber) }
      } else {
        if (current.length >= prize.winnerCount) {
          toast.error(`Max ${prize.winnerCount} kazanan`)
          return prev
        }
        return { ...prev, [prizeId]: [...current, ticketNumber] }
      }
    })
  }

  function removeWinnerFromPrize(prizeId: string, ticketNumber: number) {
    setSelectedWinners(prev => ({
      ...prev,
      [prizeId]: (prev[prizeId] || []).filter(tn => tn !== ticketNumber)
    }))
  }

  async function copyWinnersToClipboard(event: TicketEvent, isCompleted = false) {
    try {
      let text = ''

      if (isCompleted) {
        const token = localStorage.getItem('admin_token')
        const res = await fetch(`/api/admin/tickets/${event.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          const sortedPrizes = [...data.event.prizes].sort((a: Prize, b: Prize) => b.prizeAmount - a.prizeAmount)

          for (const prize of sortedPrizes) {
            if (prize.winners && prize.winners.length > 0) {
              text += `\n${formatAmount(prize.prizeAmount)} TL:\n`
              prize.winners.forEach((winner: any) => {
                const username = winner.ticketNumber?.user?.siteUsername || winner.ticketNumber?.user?.email || '-'
                text += `${username} - ${formatAmount(prize.prizeAmount)} TL\n`
              })
            }
          }
        }
      } else {
        let tickets = ticketNumbers
        if (tickets.length === 0) {
          const token = localStorage.getItem('admin_token')
          const res = await fetch(`/api/admin/tickets/${event.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (res.ok) {
            const data = await res.json()
            tickets = data.ticketNumbers || []
          }
        }

        const sortedPrizes = [...event.prizes].sort((a, b) => b.prizeAmount - a.prizeAmount)
        for (const prize of sortedPrizes) {
          const prizeId = prize.id || ''
          const winners = selectedWinners[prizeId] || []

          if (winners.length > 0) {
            text += `\n${formatAmount(prize.prizeAmount)} TL:\n`
            winners.forEach(ticketNum => {
              const ticket = tickets.find(t => t.ticketNumber === ticketNum)
              const username = ticket?.username || '-'
              text += `${username} - ${formatAmount(prize.prizeAmount)} TL\n`
            })
          }
        }
      }

      if (text.trim() === '') {
        toast.error('Kazanan yok')
        return
      }

      await navigator.clipboard.writeText(text.trim())
      toast.success('Kopyalandı!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Kopyalanamadı')
    }
  }

  const filteredRequests = requests.filter(req =>
    req.user?.siteUsername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.sponsorInfo?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeEvents = events.filter(e => e.status === 'active' || e.status === 'waiting_draw')
  const pendingRequests = requests.filter(r => r.status === 'pending')

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white mb-0.5">Bilet Yönetimi</h1>
            <p className="text-sm text-slate-500">Bilet etkinliklerini ve talepleri yönet</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="font-medium rounded-lg px-5 h-11 text-sm flex items-center justify-center gap-2 w-full md:w-auto"
            style={{
              background: showCreateForm ? '#dc2626' : '#059669',
              color: 'white'
            }}
          >
            <Plus className={`w-5 h-5 ${showCreateForm ? 'rotate-45' : ''}`} style={{ transition: 'transform 0.2s' }} />
            {showCreateForm ? 'Kapat' : 'Yeni Etkinlik'}
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 rounded-xl overflow-hidden bg-slate-900/80 border border-slate-800">
            <TicketCreateForm
              sponsors={sponsors}
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500 mb-3" />
            <p className="text-slate-500 text-sm">Yükleniyor...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab List */}
            <div className="overflow-x-auto -mx-4 px-4 mb-5">
              <div className="inline-flex p-1 rounded-lg bg-slate-900 border border-slate-800 min-w-max">
                <TabsList className="bg-transparent p-0 h-auto gap-0.5">
                  <TabsTrigger
                    value="active"
                    className="px-4 py-2.5 rounded-md text-sm font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-500"
                  >
                    <Gift className="w-4 h-4 mr-2" />
                    Aktif ({activeEvents.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="requests"
                    className="px-4 py-2.5 rounded-md text-sm font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-500"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Talepler ({pendingRequests.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="px-4 py-2.5 rounded-md text-sm font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-500"
                  >
                    <History className="w-4 h-4 mr-2" />
                    Geçmiş ({historyEvents.length})
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Active Tab */}
            <TabsContent value="active" className="mt-0">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-slate-900/50 border border-slate-800">
                  <TicketCheck className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Aktif Etkinlik Yok</h3>
                  <p className="text-xs text-slate-600">Yeni bir bilet etkinliği oluşturun</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {events.map(event => (
                    <div
                      key={event.id}
                      className="rounded-xl overflow-hidden bg-slate-900/80 border border-slate-800"
                    >
                      <TicketEventCard
                        event={event}
                        selectedWinners={selectedWinners}
                        ticketNumbers={ticketNumbers}
                        onComplete={(evt) => {
                          setEventToComplete(evt)
                          setCompleteConfirmOpen(true)
                        }}
                        onDelete={(id) => {
                          setEventToDelete(id)
                          setDeleteConfirmOpen(true)
                        }}
                        onDistributeRewards={(evt) => {
                          setSelectedEventForWinners(evt)
                          distributeRewards(evt)
                        }}
                        onCopyWinners={(evt) => copyWinnersToClipboard(evt)}
                        onViewDetails={(id) => router.push(`/admin/tickets/${id}`)}
                        onOpenPrizeSelection={openPrizeSelectionModal}
                        onRemoveWinner={removeWinnerFromPrize}
                        formatAmount={formatAmount}
                        formatDateTR={formatDateTR}
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Requests Tab */}
            <TabsContent value="requests" className="mt-0 space-y-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 rounded-lg text-sm bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="Kullanıcı ara..."
                  />
                </div>
                <div className="flex gap-3">
                  <Select value={filterEventId} onValueChange={setFilterEventId}>
                    <SelectTrigger className="w-full md:w-44 h-11 rounded-lg text-sm bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Etkinlik" />
                    </SelectTrigger>
                    <SelectContent
                      className="bg-slate-800 border-slate-700 max-h-[250px] overflow-y-auto z-[100]"
                    >
                      <SelectItem value="" className="text-sm text-white">Tümü</SelectItem>
                      {events.map(event => (
                        <SelectItem key={event.id} value={event.id} className="text-sm text-white">{event.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full md:w-36 h-11 rounded-lg text-sm bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Durum" />
                    </SelectTrigger>
                    <SelectContent
                      className="bg-slate-800 border-slate-700 max-h-[200px] overflow-y-auto z-[100]"
                    >
                      <SelectItem value="" className="text-sm text-white">Tümü</SelectItem>
                      <SelectItem value="pending" className="text-sm text-white">Bekleyen</SelectItem>
                      <SelectItem value="approved" className="text-sm text-white">Onaylanan</SelectItem>
                      <SelectItem value="rejected" className="text-sm text-white">Reddedilen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-slate-900/50 border border-slate-800">
                  <FileText className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Talep Yok</h3>
                  <p className="text-xs text-slate-600">Seçili filtrelere uygun talep bulunamadı</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <RequestsTable
                    requests={filteredRequests}
                    onApprove={(id) => {
                      setRequestToApprove(id)
                      setApproveConfirmOpen(true)
                    }}
                    onReject={(id) => {
                      setRequestToReject(id)
                      setRejectPromptOpen(true)
                    }}
                    onViewDetails={(req) => {
                      setSelectedRequest(req)
                      setShowRequestDetailModal(true)
                    }}
                    formatAmount={formatAmount}
                    formatDateTR={formatDateTR}
                  />
                </ScrollArea>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-0">
              {historyEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-slate-900/50 border border-slate-800">
                  <History className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Geçmiş Etkinlik Yok</h3>
                  <p className="text-xs text-slate-600">Tamamlanan etkinlikler burada görünecek</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {historyEvents.map(event => (
                    <TicketHistoryCard
                      key={event.id}
                      event={event}
                      onCopyWinners={(evt) => copyWinnersToClipboard(evt, true)}
                      onViewDetails={(id) => router.push(`/admin/tickets/${id}`)}
                      formatAmount={formatAmount}
                      formatDateTR={formatDateTR}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Dialogs */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          onConfirm={() => eventToDelete && deleteEvent(eventToDelete)}
          title="Etkinliği Sil"
          description="Bu etkinliği silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
          confirmText="Sil"
          variant="destructive"
        />

        <ConfirmDialog
          open={completeConfirmOpen}
          onOpenChange={setCompleteConfirmOpen}
          onConfirm={() => eventToComplete && completeEvent(eventToComplete)}
          title="Çekilişi Başlat"
          description="Etkinlik çekiliş hazırlama aşamasına geçecek. Devam etmek istiyor musunuz?"
          confirmText="Başlat"
          variant="default"
        />

        <ConfirmDialog
          open={approveConfirmOpen}
          onOpenChange={setApproveConfirmOpen}
          onConfirm={() => {
            if (requestToApprove) {
              handleRequestAction(requestToApprove, 'approve')
              setRequestToApprove(null)
            }
          }}
          title="Talebi Onayla"
          description="Kullanıcıya bilet tahsis edilecek. Onaylamak istiyor musunuz?"
          confirmText="Onayla"
          variant="default"
        />

        <PromptDialog
          open={rejectPromptOpen}
          onOpenChange={setRejectPromptOpen}
          onConfirm={(reason) => {
            if (requestToReject) {
              handleRequestAction(requestToReject, 'reject', reason || undefined)
              setRequestToReject(null)
            }
          }}
          title="Talebi Reddet"
          description="Red nedeni girin (opsiyonel):"
          label="Neden"
          placeholder="Örn: Yatırım doğrulanamadı"
          confirmText="Reddet"
        />

        {showRequestDetailModal && selectedRequest && (
          <RequestDetailModal
            request={selectedRequest}
            onClose={() => {
              setShowRequestDetailModal(false)
              setSelectedRequest(null)
            }}
            formatAmount={formatAmount}
            formatDateTR={formatDateTR}
          />
        )}

        {showPrizeSelectionModal && selectedPrizeForSelection && selectedEventForWinners && (
          <WinnerSelector
            event={selectedEventForWinners}
            prize={selectedPrizeForSelection}
            ticketNumbers={ticketNumbers}
            selectedWinners={selectedWinners[selectedPrizeForSelection.id || ''] || []}
            allSelectedWinners={selectedWinners}
            onToggleWinner={(ticketNumber) => toggleWinnerSelection(selectedPrizeForSelection.id || '', ticketNumber)}
            onClearSelection={() => {
              const prizeId = selectedPrizeForSelection.id || ''
              setSelectedWinners(prev => ({ ...prev, [prizeId]: [] }))
            }}
            onClose={() => {
              setShowPrizeSelectionModal(false)
              setSelectedPrizeForSelection(null)
            }}
            formatAmount={formatAmount}
          />
        )}
      </div>
    </div>
  )
}
