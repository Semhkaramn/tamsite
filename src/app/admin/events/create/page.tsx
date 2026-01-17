'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface Sponsor {
  id: string
  name: string
  logoUrl?: string
}

export default function CreateEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sponsors, setSponsors] = useState<Sponsor[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    imagePublicId: '',
    sponsorId: '',
    participantLimit: 10,
    participationType: 'limited' as 'limited' | 'raffle',
    endDate: ''
  })

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      router.push('/admin')
      return
    }
    loadSponsors()
  }, [])

  async function loadSponsors() {
    try {
      const res = await fetch('/api/admin/sponsors', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSponsors(data.sponsors || [])
    } catch {
      toast.error('Sponsorlar yüklenemedi')
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu en fazla 5MB olabilir')
      return
    }

    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('folder', 'events')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Yükleme başarısız')
      }

      const data = await res.json()

      setFormData(prev => ({
        ...prev,
        imageUrl: data.url,
        imagePublicId: data.publicId
      }))
      toast.success('Görsel yüklendi')
    } catch (error: any) {
      toast.error(error.message || 'Görsel yüklenirken hata oluştu')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.title || !formData.sponsorId || !formData.endDate) {
      toast.error('Lütfen tüm gerekli alanları doldurun')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Hata oluştu')
      }

      toast.success('Etkinlik oluşturuldu')
      router.push('/admin/events')
    } catch (error: any) {
      toast.error(error.message || 'Etkinlik oluşturulurken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-slate-400 h-8 px-3"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-white">Yeni Etkinlik Oluştur</h1>
            <p className="text-xs text-slate-500">Yeni bir etkinlik ekle</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-5 bg-slate-900/80 border border-slate-800 rounded-xl">
            {/* Görsel */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-300 font-medium">Etkinlik Görseli</Label>
              {formData.imageUrl ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                  <Image src={formData.imageUrl} alt="Preview" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, imageUrl: '', imagePublicId: '' }))}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-900/80 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 border border-dashed border-slate-700 rounded-lg cursor-pointer bg-slate-800/50">
                  <div className="flex flex-col items-center justify-center py-4">
                    {uploading ? (
                      <Loader2 className="w-8 h-8 mb-2 text-slate-500 animate-spin" />
                    ) : (
                      <ImagePlus className="w-8 h-8 mb-2 text-slate-600" />
                    )}
                    <p className="text-xs text-slate-500">
                      {uploading ? 'Yükleniyor...' : 'Görsel yüklemek için tıklayın'}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Max 5MB</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            {/* Başlık */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs text-slate-300 font-medium">Başlık *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Etkinlik başlığı"
                className="h-9 text-sm bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
                required
              />
            </div>

            {/* Açıklama */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs text-slate-300 font-medium">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Etkinlik açıklaması (isteğe bağlı)"
                className="text-sm bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 min-h-[80px] resize-none"
                rows={3}
              />
            </div>

            {/* Sponsor */}
            <div className="space-y-1.5">
              <Label htmlFor="sponsor" className="text-xs text-slate-300 font-medium">Sponsor *</Label>
              <Select
                value={formData.sponsorId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, sponsorId: value }))}
              >
                <SelectTrigger className="h-9 text-sm bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Sponsor seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {sponsors.map(sponsor => (
                    <SelectItem key={sponsor.id} value={sponsor.id} className="text-sm text-white">
                      {sponsor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Katılımcı Limiti */}
              <div className="space-y-1.5">
                <Label htmlFor="limit" className="text-xs text-slate-300 font-medium">Katılımcı Limiti *</Label>
                <Input
                  id="limit"
                  type="number"
                  min="1"
                  value={formData.participantLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, participantLimit: parseInt(e.target.value) || 1 }))}
                  className="h-9 text-sm bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>

              {/* Katılım Tipi */}
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs text-slate-300 font-medium">Katılım Tipi *</Label>
                <Select
                  value={formData.participationType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, participationType: value as 'limited' | 'raffle' }))}
                >
                  <SelectTrigger className="h-9 text-sm bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="limited" className="text-sm text-white">İlk Gelenler</SelectItem>
                    <SelectItem value="raffle" className="text-sm text-white">Çekiliş</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bitiş Tarihi */}
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-xs text-slate-300 font-medium">Bitiş Tarihi *</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="h-9 text-sm bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
                className="flex-1 h-9 text-sm border-slate-700 text-slate-400 bg-transparent"
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 h-9 text-sm bg-emerald-600 text-white border-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  'Etkinlik Oluştur'
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
