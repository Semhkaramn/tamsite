'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Gamepad2,
  Spade,
  Users,
  TrendingUp,
  RefreshCw,
  Loader2,
  Clock,
  Coins,
  XCircle,
  Settings2,
  ChevronDown,
  ChevronUp,
  Trophy,
  TrendingDown,
  BarChart3,
  Scale
} from 'lucide-react'
import AdminPermissionGuard from '@/components/AdminPermissionGuard'

interface GameSettings {
  blackjack: {
    enabled: boolean
    maxBet: number
    minBet: number
    pendingDisable: boolean
  }
}

interface GameStatistics {
  totalGames: number
  completedGames: number
  wins: number
  losses: number
  pushes: number
  blackjacks: number
  winRate: number
  totalBet: number
  totalPayout: number
  houseProfit: number
  houseProfitPercent: number
}

interface ActiveGame {
  id: string
  odunId: string
  userId: string
  siteUsername: string | null
  betAmount: number
  splitBetAmount: number
  isDoubleDown: boolean
  isSplit: boolean
  createdAt: string
  ipAddress: string | null
  user: {
    username: string
    points: number
  } | null
  totalBet: number
  duration: number
}

export default function GamesPage() {
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [activeGames, setActiveGames] = useState<{ blackjack: number }>({ blackjack: 0 })
  const [statistics, setStatistics] = useState<GameStatistics | null>(null)
  const [blackjackGames, setBlackjackGames] = useState<ActiveGame[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showActiveGames, setShowActiveGames] = useState(false)
  const [loadingGames, setLoadingGames] = useState(false)

  // Ayarları yükle
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/games/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        setActiveGames(data.activeGames)
        setStatistics(data.statistics)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Ayarlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  // Aktif oyunları yükle
  const loadActiveGames = useCallback(async () => {
    setLoadingGames(true)
    try {
      const res = await fetch('/api/admin/games/blackjack/active')
      if (res.ok) {
        const data = await res.json()
        setBlackjackGames(data.games)
        setActiveGames(prev => ({ ...prev, blackjack: data.count }))
      }
    } catch (error) {
      console.error('Error loading active games:', error)
    } finally {
      setLoadingGames(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (showActiveGames) {
      loadActiveGames()
      // Her 5 saniyede bir güncelle
      const interval = setInterval(loadActiveGames, 5000)
      return () => clearInterval(interval)
    }
  }, [showActiveGames, loadActiveGames])

  // Ayarları kaydet
  const saveSettings = async (game: string, newSettings: Partial<GameSettings['blackjack']>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/games/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, settings: newSettings })
      })

      if (res.ok) {
        toast.success('Ayarlar kaydedildi')
        await loadSettings()
      } else {
        toast.error('Ayarlar kaydedilemedi')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  // Oyunu iptal et
  const cancelGame = async (gameId: string) => {
    if (!confirm('Bu oyunu iptal etmek istediğinize emin misiniz? Bahis kullanıcıya iade edilecek.')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/games/blackjack/active?gameId=${gameId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Oyun iptal edildi')
        loadActiveGames()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Oyun iptal edilemedi')
      }
    } catch (error) {
      console.error('Error cancelling game:', error)
      toast.error('Bir hata oluştu')
    }
  }

  // Süreyi formatla
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} sn`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} dk ${secs} sn`
  }

  if (loading) {
    return (
      <AdminPermissionGuard permission="canAccessGames">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
        </div>
      </AdminPermissionGuard>
    )
  }

  return (
    <AdminPermissionGuard permission="canAccessGames">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Gamepad2 className="w-7 h-7 text-fuchsia-500" />
              Oyun Yönetimi
            </h1>
            <p className="text-gray-400 mt-1">
              Oyun ayarlarını yönetin ve aktif oyunları takip edin
            </p>
          </div>
          <Button
            onClick={loadSettings}
            variant="outline"
            className="border-slate-600 hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
        </div>

        {/* İstatistikler */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Toplam Oyun</p>
                    <p className="text-xl font-bold text-gray-100">{statistics.totalGames.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Trophy className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Kazanç</p>
                    <p className="text-xl font-bold text-green-400">{statistics.wins + statistics.blackjacks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Kayıp</p>
                    <p className="text-xl font-bold text-red-400">{statistics.losses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Oyuncu Kazanma</p>
                    <p className="text-xl font-bold text-yellow-400">%{statistics.winRate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Coins className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Toplam Bahis</p>
                    <p className="text-xl font-bold text-amber-400">{statistics.totalBet.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${statistics.houseProfit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                    <Scale className={`w-5 h-5 ${statistics.houseProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Kasa Karı</p>
                    <p className={`text-xl font-bold ${statistics.houseProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {statistics.houseProfit >= 0 ? '+' : ''}{statistics.houseProfit.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Blackjack Card */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600">
                  <Spade className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-100">Blackjack</CardTitle>
                  <CardDescription className="text-gray-400">
                    21 kart oyunu - Tamamen şansa dayalı
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Aktif oyun sayısı */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-200 font-medium">{activeGames.blackjack}</span>
                  <span className="text-gray-400 text-sm">aktif</span>
                </div>

                {/* Durum badge */}
                {settings?.blackjack.enabled ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Aktif
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    Kapalı
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Ayarlar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Oyun Durumu */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Oyun Durumu
                  </Label>
                  <Switch
                    checked={settings?.blackjack.enabled}
                    onCheckedChange={(checked) => saveSettings('blackjack', { enabled: checked })}
                    disabled={saving}
                  />
                </div>
                {activeGames.blackjack > 0 && (
                  <p className="text-xs text-blue-400">
                    {activeGames.blackjack} aktif oyun var
                  </p>
                )}
              </div>

              {/* Min Bahis */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <Label className="text-gray-300 flex items-center gap-2 mb-3">
                  <Coins className="w-4 h-4" />
                  Min Bahis
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={settings?.blackjack.minBet || 10}
                    onChange={(e) => {
                      if (settings) {
                        setSettings({
                          ...settings,
                          blackjack: { ...settings.blackjack, minBet: parseInt(e.target.value) || 10 }
                        })
                      }
                    }}
                    onBlur={(e) => saveSettings('blackjack', { minBet: parseInt(e.target.value) || 10 })}
                    className="bg-slate-900 border-slate-600 text-gray-200 w-24"
                    disabled={saving}
                  />
                  <span className="text-gray-400">puan</span>
                </div>
              </div>

              {/* Max Bahis */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <Label className="text-gray-300 flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4" />
                  Max Bahis
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={settings?.blackjack.maxBet || 500}
                    onChange={(e) => {
                      if (settings) {
                        setSettings({
                          ...settings,
                          blackjack: { ...settings.blackjack, maxBet: parseInt(e.target.value) || 500 }
                        })
                      }
                    }}
                    onBlur={(e) => saveSettings('blackjack', { maxBet: parseInt(e.target.value) || 500 })}
                    className="bg-slate-900 border-slate-600 text-gray-200 w-24"
                    disabled={saving}
                  />
                  <span className="text-gray-400">puan</span>
                </div>
              </div>
            </div>

            {/* Aktif Oyunlar Bölümü */}
            <div className="border-t border-slate-700 pt-4">
              <button
                onClick={() => setShowActiveGames(!showActiveGames)}
                className="flex items-center gap-2 text-gray-300 hover:text-gray-100 transition-colors"
              >
                {showActiveGames ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <span className="font-medium">Aktif Oyunlar</span>
                <Badge variant="secondary" className="ml-2">
                  {activeGames.blackjack}
                </Badge>
              </button>

              {showActiveGames && (
                <div className="mt-4">
                  {loadingGames ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : blackjackGames.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aktif oyun yok
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {blackjackGames.map((game) => (
                        <div
                          key={game.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-slate-800 border border-slate-700"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
                              <Spade className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-200">
                                {game.user?.username || game.siteUsername || 'Anonim'}
                              </p>
                              <div className="flex items-center gap-3 text-sm text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Coins className="w-3 h-3" />
                                  {game.totalBet} puan
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(game.duration)}
                                </span>
                                {game.isSplit && (
                                  <Badge className="text-xs bg-blue-500/20 text-blue-400">
                                    Split
                                  </Badge>
                                )}
                                {game.isDoubleDown && (
                                  <Badge className="text-xs bg-purple-500/20 text-purple-400">
                                    Double
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {game.ipAddress?.split(',')[0] || 'IP yok'}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelGame(game.odunId)}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              İptal Et
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bilgi Kutusu */}
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <h4 className="font-medium text-green-400 mb-2">Tamamen Şansa Dayalı</h4>
              <p className="text-sm text-gray-400">
                Bu oyun tamamen rastgele kart dağıtımı ile çalışır. Hiçbir manipülasyon yoktur.
                Gerçek bir blackjack oyunu gibi adil ve şansa dayalıdır.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Gelecek Oyunlar Placeholder */}
        <Card className="bg-slate-900 border-slate-700 border-dashed opacity-50">
          <CardContent className="py-8 text-center">
            <Gamepad2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">Yeni oyunlar yakında eklenecek...</p>
          </CardContent>
        </Card>
      </div>
    </AdminPermissionGuard>
  )
}
