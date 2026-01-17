'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Users, Calendar, Gift, Trophy, Loader2, Clock, Target, Sparkles, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'
import { optimizeCloudinaryImage } from '@/lib/utils'

interface Event {
  id: string
  title: string
  imageUrl?: string
  sponsor: { name: string; logoUrl?: string }
  participantLimit: number
  participationType: 'limited' | 'raffle'
  participantCount: number
  endDate: string
  status: 'active' | 'pending' | 'completed'
  _count?: { participants: number; winners: number }
}

export default function AdminEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) return router.push('/admin')
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const res = await fetch('/api/admin/events', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data.events || [])
    } catch {
      toast.error('Etkinlikler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })

  const getTimeRemaining = (endDate: string) => {
    const now = new Date().getTime()
    const end = new Date(endDate).getTime()
    const diff = end - now

    if (diff <= 0) return 'Sona erdi'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days} gün ${hours} saat`
    return `${hours} saat`
  }

  const activeEvents = events.filter(e => e.status === 'active' || e.status === 'pending')
  const pastEvents = events.filter(e => e.status === 'completed')

  const EventCard = ({ event }: { event: Event }) => {
    const progress = (event.participantCount / event.participantLimit) * 100
    const isRaffle = event.participationType === 'raffle'
    const isCompleted = event.status === 'completed'
    const isPending = event.status === 'pending'

    return (
      <div
        onClick={() => router.push(`/admin/events/${event.id}`)}
        className="relative cursor-pointer rounded-xl overflow-hidden bg-slate-900/80 border border-slate-800"
      >
        {/* Status Indicator Bar */}
        <div
          className="h-0.5"
          style={{
            background: isCompleted
              ? '#475569'
              : isPending
              ? '#f59e0b'
              : '#10b981'
          }}
        />

        <div className="p-4">
          {/* Header Section */}
          <div className="flex items-start gap-3 mb-4">
            {/* Image Container */}
            <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden relative bg-slate-800 border border-slate-700">
              <Image
                src={optimizeCloudinaryImage(event.imageUrl || event.sponsor.logoUrl || '/logo.webp', 112, 112)}
                alt={event.title}
                fill
                className="object-contain p-1.5"
              />
            </div>

            {/* Title & Status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">
                  {event.title}
                </h3>
                <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Badge */}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    background: isCompleted ? 'rgba(71, 85, 105, 0.3)' : isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isCompleted ? '#94a3b8' : isPending ? '#fbbf24' : '#34d399'
                  }}
                >
                  <span className={`w-1 h-1 rounded-full ${isCompleted ? 'bg-slate-400' : isPending ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  {isCompleted ? 'Tamamlandı' : isPending ? 'Beklemede' : 'Aktif'}
                </span>

                {/* Type Badge */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                  {isRaffle ? <Sparkles className="w-2.5 h-2.5" /> : <Target className="w-2.5 h-2.5" />}
                  {isRaffle ? 'Çekiliş' : 'İlk Gelen'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {/* Participants */}
            <div className="p-2 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
              <Users className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
              <div className="text-sm font-semibold text-white">{event.participantCount}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">Katılımcı</div>
            </div>

            {/* Winner Count / Limit */}
            <div className="p-2 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
              <Trophy className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
              <div className="text-sm font-semibold text-white">{event.participantLimit}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">
                {isRaffle ? 'Kazanan' : 'Limit'}
              </div>
            </div>

            {/* End Date */}
            <div className="p-2 rounded-lg text-center bg-slate-800/50 border border-slate-700/50">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
              <div className="text-[10px] font-semibold text-white">{formatDate(event.endDate)}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">Bitiş</div>
            </div>
          </div>

          {/* Progress Section - Only for active events */}
          {!isCompleted && (
            <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] text-slate-500">Kalan Süre</span>
                </div>
                <span className="text-[10px] font-medium text-slate-300">{getTimeRemaining(event.endDate)}</span>
              </div>

              {!isRaffle && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-500">Doluluk</span>
                    <span className="text-emerald-400 font-medium">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden bg-slate-700">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white mb-0.5">Etkinlik Yönetimi</h1>
            <p className="text-xs text-slate-500">Etkinlikleri görüntüle ve yönet</p>
          </div>
          <Link href="/admin/events/create">
            <Button className="font-medium rounded-lg px-4 h-9 text-sm bg-emerald-600 text-white border-0">
              <Plus className="w-4 h-4 mr-1.5" />
              Yeni Etkinlik
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500 mb-3" />
            <p className="text-slate-500 text-sm">Etkinlikler yükleniyor...</p>
          </div>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            {/* Tab List */}
            <div className="inline-flex p-1 rounded-lg mb-5 bg-slate-900 border border-slate-800">
              <TabsList className="bg-transparent p-0 h-auto gap-0.5">
                <TabsTrigger
                  value="active"
                  className="px-4 py-2 rounded-md text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-500"
                >
                  <Gift className="w-3.5 h-3.5 mr-1.5" />
                  Aktif ({activeEvents.length})
                </TabsTrigger>
                <TabsTrigger
                  value="past"
                  className="px-4 py-2 rounded-md text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-500"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Geçmiş ({pastEvents.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Active Tab Content */}
            <TabsContent value="active" className="mt-0">
              {activeEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-slate-900/50 border border-slate-800">
                  <Gift className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Aktif Etkinlik Yok</h3>
                  <p className="text-xs text-slate-600">Yeni bir etkinlik oluşturmak için yukarıdaki butonu kullanın</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Past Tab Content */}
            <TabsContent value="past" className="mt-0">
              {pastEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-slate-900/50 border border-slate-800">
                  <Calendar className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Geçmiş Etkinlik Yok</h3>
                  <p className="text-xs text-slate-600">Tamamlanan etkinlikler burada görünecek</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pastEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
