'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
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
  order?: number
}

interface TicketCreateFormProps {
  sponsors: Sponsor[]
  onSuccess: () => void
  onCancel: () => void
}

export function TicketCreateForm({ sponsors, onSuccess, onCancel }: TicketCreateFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sponsorId: '',
    totalTickets: 100,
    ticketPrice: 100,
    endDate: '',
  })
  const [prizes, setPrizes] = useState<Prize[]>([{ prizeAmount: 1000, winnerCount: 1 }])
  const [creating, setCreating] = useState(false)

  function addPrize() {
    setPrizes([...prizes, { prizeAmount: 1000, winnerCount: 1 }])
  }

  function removePrize(index: number) {
    setPrizes(prizes.filter((_, i) => i !== index))
  }

  async function createEvent() {
    try {
      setCreating(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          prizes,
        }),
      })

      if (res.ok) {
        toast.success('Bilet etkinliği oluşturuldu')
        onSuccess()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bilet etkinliği oluşturulamadı')
      }
    } catch (error) {
      console.error('Error creating event:', error)
      toast.error('Bilet etkinliği oluşturulurken hata oluştu')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
          <h3 className="text-lg font-bold text-white">Yeni Bilet Etkinliği</h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Ana Başlık *</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="admin-input"
              placeholder="Örn: 10.000 TL Bilet Çekilişi"
            />
          </div>

          <div>
            <label className="admin-label">Sponsor *</label>
            <Select value={formData.sponsorId} onValueChange={(val) => setFormData({ ...formData, sponsorId: val })}>
              <SelectTrigger className="admin-input">
                <SelectValue placeholder="Sponsor seçin" />
              </SelectTrigger>
              <SelectContent className="admin-dialog">
                {sponsors.map(sponsor => (
                  <SelectItem key={sponsor.id} value={sponsor.id}>
                    {sponsor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="admin-label">Açıklama</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="admin-textarea"
            placeholder="Bilet etkinliği açıklaması...&#10;Satır satır yazabilirsiniz."
            rows={3}
          />
          <p className="admin-text-muted text-xs mt-1">
            Açıklama satır satır yazılabilir (Enter ile alt satıra geçebilirsiniz)
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="admin-label">Toplam Bilet Sayısı *</label>
            <input
              type="number"
              value={formData.totalTickets}
              onChange={(e) => setFormData({ ...formData, totalTickets: e.target.value === '' ? '' as any : Number(e.target.value) })}
              className="admin-input"
            />
          </div>

          <div>
            <label className="admin-label">Bir Bilet Fiyatı (TL) *</label>
            <input
              type="number"
              value={formData.ticketPrice}
              onChange={(e) => setFormData({ ...formData, ticketPrice: e.target.value === '' ? '' as any : Number(e.target.value) })}
              className="admin-input"
            />
          </div>

          <div>
            <label className="admin-label">Bitiş Tarihi *</label>
            <input
              type="datetime-local"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="admin-input"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="admin-label">Ödüller *</label>
            <button
              type="button"
              onClick={addPrize}
              className="admin-btn-primary text-xs p-1.5 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Ödül Ekle
            </button>
          </div>

          <div className="space-y-2">
            {prizes.map((prize, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="admin-label text-xs">Ödül Miktarı (TL)</label>
                  <input
                    type="number"
                    value={prize.prizeAmount}
                    onChange={(e) => {
                      const newPrizes = [...prizes]
                      newPrizes[index].prizeAmount = e.target.value === '' ? '' as any : Number(e.target.value)
                      setPrizes(newPrizes)
                    }}
                    className="admin-input"
                  />
                </div>

                <div className="flex-1">
                  <label className="admin-label text-xs">Kazanan Sayısı</label>
                  <input
                    type="number"
                    value={prize.winnerCount}
                    onChange={(e) => {
                      const newPrizes = [...prizes]
                      newPrizes[index].winnerCount = e.target.value === '' ? '' as any : Number(e.target.value)
                      setPrizes(newPrizes)
                    }}
                    className="admin-input"
                  />
                </div>

                {prizes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePrize(index)}
                    className="admin-btn-danger p-1.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-3">
          <button
            onClick={createEvent}
            disabled={creating}
            className="admin-btn-primary flex-1 py-2 text-sm disabled:opacity-50"
          >
            {creating ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
          <button
            onClick={onCancel}
            disabled={creating}
            className="admin-btn-secondary flex-1 py-2 text-sm"
          >
            İptal
          </button>
        </div>
      </div>
    </Card>
  )
}
