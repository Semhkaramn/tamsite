'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ArrowLeft, Plus, Edit, Trash2, BarChart3, Coins } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Rank {
  id: string
  name: string
  minXp: number
  icon: string
  color: string
  order: number
  pointsReward: number
  _count?: {
    users: number
  }
}

export default function AdminRanksPage() {
  const router = useRouter()
  const [ranks, setRanks] = useState<Rank[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRank, setEditingRank] = useState<Rank | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    minXp: 0,
    icon: '⭐',
    color: '#FFD700',
    order: 0,
    pointsReward: 0
  })

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadRanks()
  }, [])

  async function loadRanks() {
    try {
      const response = await fetch('/api/admin/ranks')
      const data = await response.json()
      setRanks(data.ranks || [])
    } catch (error) {
      console.error('Error loading ranks:', error)
      toast.error('Rütbeler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function openDialog(rank?: Rank) {
    if (rank) {
      setEditingRank(rank)
      setFormData({
        name: rank.name,
        minXp: rank.minXp,
        icon: rank.icon,
        color: rank.color,
        order: rank.order,
        pointsReward: rank.pointsReward || 0
      })
    } else {
      setEditingRank(null)
      setFormData({
        name: '',
        minXp: 0,
        icon: '⭐',
        color: '#FFD700',
        order: ranks.length,
        pointsReward: 0
      })
    }
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingRank
        ? `/api/admin/ranks/${editingRank.id}`
        : '/api/admin/ranks'

      const method = editingRank ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.rank) {
        toast.success(editingRank ? 'Rütbe güncellendi' : 'Rütbe eklendi')
        setDialogOpen(false)
        loadRanks()
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
      const response = await fetch(`/api/admin/ranks/${deleteId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Rütbe silindi')
        loadRanks()
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="admin-page-title flex items-center gap-2">
              <BarChart3 className="w-8 h-8" />
              Rütbe Sistemi
            </h1>
            <p className="admin-page-subtitle">Rütbeleri yönetin</p>
          </div>
          <Button
            onClick={() => openDialog()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Rütbe Ekle
          </Button>
        </div>

        {/* Ranks Table */}
        <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
          {ranks.length === 0 ? (
            <div className="p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="admin-text-muted">Henüz rütbe eklenmemiş</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/40 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">İkon</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Rütbe Adı</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Minimum XP</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Puan Ödülü</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Kullanıcı</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ranks.map((rank, index) => (
                    <tr key={rank.id} className={index % 2 === 0 ? 'bg-[#1e1e2e]' : 'bg-[#252535]'} >
                      <td className="px-6 py-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${rank.color}20`, color: rank.color }}
                        >
                          {rank.icon}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-semibold" style={{ color: rank.color }}>
                          {rank.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-purple-400">{rank.minXp.toLocaleString('tr-TR')} XP</span>
                      </td>
                      <td className="px-6 py-4">
                        {rank.pointsReward > 0 ? (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Coins className="w-4 h-4" />
                            +{rank.pointsReward.toLocaleString('tr-TR')}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {rank._count && (
                          <span className="text-green-400">{rank._count.users}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => openDialog(rank)}
                            className="bg-blue-500 hover:bg-blue-600 admin-text-primary"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDelete(rank.id)}
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
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="admin-dialog max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="admin-text-primary">
              {editingRank ? 'Rütbeyi Düzenle' : 'Yeni Rütbe Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="admin-text-primary">Rütbe Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="admin-card text-white mt-1"
                placeholder="Örn: Altın Üye"
                required
              />
            </div>

            <div>
              <Label htmlFor="minXp" className="admin-text-primary">Minimum XP</Label>
              <Input
                id="minXp"
                type="number"
                value={formData.minXp}
                onChange={(e) => setFormData({ ...formData, minXp: parseInt(e.target.value) })}
                className="admin-card text-white mt-1"
                min="0"
                required
              />
            </div>

            <div>
              <Label htmlFor="pointsReward" className="admin-text-primary flex items-center gap-1">
                <Coins className="w-4 h-4 text-amber-400" />
                Puan Ödülü (Rütbe Yükselme Bonusu)
              </Label>
              <Input
                id="pointsReward"
                type="number"
                value={formData.pointsReward}
                onChange={(e) => setFormData({ ...formData, pointsReward: parseInt(e.target.value) || 0 })}
                className="admin-card text-white mt-1"
                min="0"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bu rütbeye ulaşıldığında kullanıcıya verilecek puan
              </p>
            </div>

            <div>
              <Label htmlFor="icon" className="admin-text-primary">İkon (Emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="admin-card text-white mt-1"
                placeholder="⭐"
                required
              />
              <p className="text-xs admin-page-subtitle">
                Emoji seçmek için Windows: Win + . veya Mac: Cmd + Ctrl + Space
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
                  placeholder="#FFD700"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="order" className="admin-text-primary">Sıralama</Label>
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
                {editingRank ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Rütbe Silme"
        description="Bu rütbeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
