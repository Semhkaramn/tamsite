'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ArrowLeft, Plus, Edit, Trash2, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface WheelPrize {
  id: string
  name: string
  points: number
  probability: number
  color: string
  isActive: boolean
  order: number
  _count?: {
    wheelSpins: number
  }
}

export default function AdminWheelPage() {
  const router = useRouter()
  const [prizes, setPrizes] = useState<WheelPrize[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrize, setEditingPrize] = useState<WheelPrize | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    points: 0,
    probability: 1.0,
    color: '#FF6B6B',
    order: 0
  })

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadPrizes()
  }, [])

  async function loadPrizes() {
    try {
      const response = await fetch('/api/admin/wheel')
      const data = await response.json()
      setPrizes(data.prizes || [])
    } catch (error) {
      console.error('Error loading prizes:', error)
      toast.error('Ödüller yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function openDialog(prize?: WheelPrize) {
    if (prize) {
      setEditingPrize(prize)
      setFormData({
        name: prize.name,
        points: prize.points,
        probability: prize.probability,
        color: prize.color,
        order: prize.order
      })
    } else {
      setEditingPrize(null)
      setFormData({
        name: '',
        points: 0,
        probability: 1.0,
        color: '#FF6B6B',
        order: prizes.length
      })
    }
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingPrize
        ? `/api/admin/wheel/${editingPrize.id}`
        : '/api/admin/wheel'

      const method = editingPrize ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.prize) {
        toast.success(editingPrize ? 'Ödül güncellendi' : 'Ödül eklendi')
        setDialogOpen(false)
        loadPrizes()
      } else {
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return

    try {
      const response = await fetch(`/api/admin/wheel/${deleteId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Ödül silindi')
        loadPrizes()
      } else {
        toast.error(data.error || 'Silme başarısız')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setConfirmOpen(false)
      setDeleteId(null)
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const response = await fetch(`/api/admin/wheel/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive })
      })

      const data = await response.json()

      if (data.prize) {
        toast.success('Durum güncellendi')
        loadPrizes()
      } else {
        toast.error(data.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Toggle error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="admin-page-title flex items-center gap-2">
              <Ticket className="w-8 h-8" />
              Çark Ödülleri
            </h1>
            <p className="admin-page-subtitle">Şans çarkı ödüllerini yönetin</p>
          </div>
          <Button
            onClick={() => openDialog()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Ödül Ekle
          </Button>
        </div>

        {/* Prizes Table */}
        <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
          {prizes.length === 0 ? (
            <div className="p-12 text-center">
              <Ticket className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="admin-text-muted">Henüz ödül eklenmemiş</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-black/40 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Renk</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Ödül Adı</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Puan</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Olasılık</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Kazanım</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Durum</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {prizes.map((prize, index) => (
                  <tr key={prize.id} className={index % 2 === 0 ? 'bg-[#1e1e2e]' : 'bg-[#252535]'}>
                    <td className="px-6 py-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: prize.color }}
                      >
                        {prize.points}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-semibold">{prize.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-yellow-400">{prize.points}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-purple-400">{prize.probability}</span>
                    </td>
                    <td className="px-6 py-4">
                      {prize._count && (
                        <span className="text-green-400">{prize._count.wheelSpins}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        prize.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {prize.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => toggleActive(prize.id, prize.isActive)}
                          className={`${prize.isActive ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                        >
                          {prize.isActive ? 'Devre Dışı' : 'Aktif Et'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openDialog(prize)}
                          className="bg-blue-500 hover:bg-blue-600 admin-text-primary"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDelete(prize.id)}
                          className="bg-red-500 hover:bg-red-600 admin-text-primary"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle className="admin-text-primary">
              {editingPrize ? 'Ödülü Düzenle' : 'Yeni Ödül Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="admin-text-primary">Ödül Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="admin-card text-white mt-1"
                placeholder="Örn: Büyük Ödül"
                required
              />
            </div>

            <div>
              <Label htmlFor="points" className="admin-text-primary">Puan</Label>
              <Input
                id="points"
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                className="admin-card text-white mt-1"
                min="0"
                required
              />
            </div>

            <div>
              <Label htmlFor="probability" className="admin-text-primary">Olasılık (1.0 = Normal)</Label>
              <Input
                id="probability"
                type="number"
                step="0.1"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: parseFloat(e.target.value) })}
                className="admin-card text-white mt-1"
                min="0.1"
                max="10"
                required
              />
              <p className="text-xs admin-page-subtitle">
                Yüksek değer = Daha sık çıkar
              </p>
            </div>

            <div>
              <Label htmlFor="color" className="admin-text-primary">Renk</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="admin-card text-white w-20 h-10"
                  required
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="admin-card text-white flex-1"
                  placeholder="#FF6B6B"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="order" className="admin-text-primary">Sıralama (Çarkta gösterim sırası)</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="admin-card text-white mt-1"
                min="0"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1 admin-btn-outline"
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                {editingPrize ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Ödülü Sil"
        description="Bu ödülü silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
