'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Gamepad2,
  Spade,
  TrendingUp,
  RefreshCw,
  Loader2,
  Clock,
  Coins,
  ChevronDown,
  ChevronUp,
  Trophy,
  TrendingDown,
  BarChart3,
  Scale,
  Bomb,
  Calendar,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react'
import AdminPermissionGuard from '@/components/AdminPermissionGuard'

// Sabit bahis limitleri
const FIXED_MIN_BET = 10
const FIXED_MAX_BET = 500

interface GameSettings {
  blackjack: {
    enabled: boolean
    pendingDisable: boolean
  }
  mines: {
    enabled: boolean
  }
}

interface BlackjackStatistics {
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

interface DetailedBlackjackStats {
  totalGames: number
  gamesToday: number
  gamesWeek: number
  gamesMonth: number
  totalBets: number
  totalWins: number
  betsToday: number
  winsToday: number
  netProfit: number
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
  const [statistics, setStatistics] = useState<BlackjackStatistics | null>(null)
  const [detailedStats, setDetailedStats] = useState<DetailedBlackjackStats | null>(null)
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

  // Detaylı istatistikleri yükle (dashboard API'sinden)
  const loadDetailedStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setDetailedStats(data.blackjack)
      }
    } catch (error) {
      console.error('Error loading detailed stats:', error)
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
    loadDetailedStats()
  }, [loadSettings, loadDetailedStats])

  useEffect(() => {
    if (showActiveGames) {
      loadActiveGames()
      // Her 5 saniyede bir güncelle
      const interval = setInterval(loadActiveGames, 5000)
      return () => clearInterval(interval)
    }
  }, [showActiveGames, loadActiveGames])

  // Ayarları kaydet (sadece enabled toggle)
  const saveSettings = async (game: 'blackjack' | 'mines', enabled: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/games/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, settings: { enabled } })
      })

      if (res.ok) {
        toast.success(`${game === 'blackjack' ? 'Blackjack' : 'Mines'} ${enabled ? 'açıldı' : 'kapatıldı'}`)
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



  // Süreyi formatla
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} sn`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} dk ${secs} sn`
  }

  const handleRefresh = () => {
    loadSettings()
    loadDetailedStats()
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
              Oyunları açın/kapatın ve istatistikleri takip edin
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="border-slate-600 hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
        </div>

        {/* Oyun Toggle Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Blackjack Toggle Card */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600">
                    <Spade className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-100">Blackjack</CardTitle>
                    <CardDescription className="text-gray-400">
                      21 kart oyunu
                    </CardDescription>
                  </div>
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
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-3">
                  <Label className="text-gray-300 font-medium">Oyun Durumu</Label>
                  {activeGames.blackjack > 0 && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      {activeGames.blackjack} aktif oyun
                    </Badge>
                  )}
                </div>
                <Switch
                  checked={settings?.blackjack.enabled}
                  onCheckedChange={(checked) => saveSettings('blackjack', checked)}
                  disabled={saving}
                />
              </div>

              {/* Bahis Bilgisi */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                  <p className="text-xs text-gray-500 mb-1">Min Bahis</p>
                  <p className="text-lg font-bold text-amber-400">{FIXED_MIN_BET}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                  <p className="text-xs text-gray-500 mb-1">Max Bahis</p>
                  <p className="text-lg font-bold text-amber-400">{FIXED_MAX_BET}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mines Toggle Card */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                    <Bomb className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-100">Mines</CardTitle>
                    <CardDescription className="text-gray-400">
                      Mayın tarlası oyunu
                    </CardDescription>
                  </div>
                </div>
                {/* Durum badge */}
                {settings?.mines?.enabled ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Aktif
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    Kapalı
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <Label className="text-gray-300 font-medium">Oyun Durumu</Label>
                <Switch
                  checked={settings?.mines?.enabled}
                  onCheckedChange={(checked) => saveSettings('mines', checked)}
                  disabled={saving}
                />
              </div>

              {/* Bilgi */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                  <p className="text-xs text-gray-500 mb-1">Grid</p>
                  <p className="text-lg font-bold text-cyan-400">5x5</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                  <p className="text-xs text-gray-500 mb-1">Mayın Aralığı</p>
                  <p className="text-lg font-bold text-red-400">1-24</p>
                </div>
              </div>

              {/* Bahis Bilgisi */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                  <p className="text-xs text-gray-500 mb-1">Min Bahis</p>
                  <p className="text-lg font-bold text-amber-400">{FIXED_MIN_BET}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                  <p className="text-xs text-gray-500 mb-1">Max Bahis</p>
                  <p className="text-lg font-bold text-amber-400">{FIXED_MAX_BET}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blackjack İstatistikleri */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-fuchsia-500" />
              Blackjack İstatistikleri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Detaylı İstatistikler */}
            {detailedStats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Oyun İstatistikleri */}
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Spade className="w-4 h-4 text-purple-400" />
                    Oyun İstatistikleri
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-purple-500/10 border border-purple-700/30 rounded-lg">
                      <Gamepad2 className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{detailedStats.totalGames?.toLocaleString('tr-TR') || 0}</p>
                      <p className="text-xs text-slate-500">Toplam</p>
                    </div>
                    <div className="text-center p-2 bg-emerald-500/10 border border-emerald-700/30 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{detailedStats.gamesToday?.toLocaleString('tr-TR') || 0}</p>
                      <p className="text-xs text-slate-500">Bugün</p>
                    </div>
                    <div className="text-center p-2 bg-blue-500/10 border border-blue-700/30 rounded-lg">
                      <Calendar className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{detailedStats.gamesWeek?.toLocaleString('tr-TR') || 0}</p>
                      <p className="text-xs text-slate-500">Hafta</p>
                    </div>
                    <div className="text-center p-2 bg-amber-500/10 border border-amber-700/30 rounded-lg">
                      <BarChart3 className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{detailedStats.gamesMonth?.toLocaleString('tr-TR') || 0}</p>
                      <p className="text-xs text-slate-500">Ay</p>
                    </div>
                  </div>
                </div>

                {/* Puan Akışı */}
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Puan Akışı
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 bg-rose-500/10 border border-rose-700/30 rounded-lg">
                        <div className="flex items-center gap-1 mb-1">
                          <ArrowDownRight className="w-3 h-3 text-rose-400" />
                          <span className="text-xs text-slate-400">Toplam Bahis</span>
                        </div>
                        <p className="text-lg font-bold text-rose-400">
                          {detailedStats.totalBets?.toLocaleString('tr-TR') || 0}
                        </p>
                      </div>
                      <div className="p-2 bg-emerald-500/10 border border-emerald-700/30 rounded-lg">
                        <div className="flex items-center gap-1 mb-1">
                          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs text-slate-400">Toplam Kazanç</span>
                        </div>
                        <p className="text-lg font-bold text-emerald-400">
                          {detailedStats.totalWins?.toLocaleString('tr-TR') || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-sm text-slate-400">Site Karı</span>
                      <span className={`text-lg font-bold ${(detailedStats.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(detailedStats.netProfit || 0) >= 0 ? '+' : ''}{detailedStats.netProfit?.toLocaleString('tr-TR') || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Özet İstatistikler */}
            {statistics && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-700/30 text-center">
                  <BarChart3 className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{statistics.totalGames.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Toplam Oyun</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-700/30 text-center">
                  <Trophy className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-400">{statistics.wins + statistics.blackjacks}</p>
                  <p className="text-xs text-slate-500">Kazanç</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-700/30 text-center">
                  <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-400">{statistics.losses}</p>
                  <p className="text-xs text-slate-500">Kayıp</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-700/30 text-center">
                  <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-yellow-400">%{statistics.winRate}</p>
                  <p className="text-xs text-slate-500">Kazanma Oranı</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-700/30 text-center">
                  <Coins className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-amber-400">{statistics.totalBet.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Toplam Bahis</p>
                </div>
                <div className={`p-3 rounded-lg text-center ${statistics.houseProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-700/30' : 'bg-red-500/10 border border-red-700/30'}`}>
                  <Scale className={`w-5 h-5 mx-auto mb-1 ${statistics.houseProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <p className={`text-lg font-bold ${statistics.houseProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {statistics.houseProfit >= 0 ? '+' : ''}{statistics.houseProfit.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">Kasa Karı</p>
                </div>
              </div>
            )}

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
                <span className="font-medium">Aktif Blackjack Oyunları</span>
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
                          <span className="text-xs text-gray-500">
                            {game.ipAddress?.split(',')[0] || 'IP yok'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bilgi Kutusu */}
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <h4 className="font-medium text-green-400 mb-2">Tamamen Şansa Dayalı</h4>
          <p className="text-sm text-gray-400">
            Tüm oyunlar tamamen rastgele sonuçlarla çalışır. Hiçbir manipülasyon yoktur.
            Gerçek casino oyunları gibi adil ve şansa dayalıdır.
          </p>
        </div>
      </div>
    </AdminPermissionGuard>
  )
}
