'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Scale,
  Bomb,
  Diamond,
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
  const [activeTab, setActiveTab] = useState('blackjack')

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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700">
            <TabsTrigger
              value="blackjack"
              className="flex items-center gap-2 data-[state=active]:bg-fuchsia-500/20 data-[state=active]:text-fuchsia-400"
            >
              <Spade className="w-4 h-4" />
              Blackjack
            </TabsTrigger>
            <TabsTrigger
              value="mines"
              className="flex items-center gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
            >
              <Bomb className="w-4 h-4" />
              Mines
            </TabsTrigger>
          </TabsList>

          {/* Blackjack Tab */}
          <TabsContent value="blackjack" className="space-y-6">
            {/* Detaylı İstatistikler */}
            {detailedStats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Oyun İstatistikleri */}
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
                      <Spade className="w-5 h-5 text-purple-400" />
                      Oyun İstatistikleri
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center p-3 bg-purple-500/10 border border-purple-700/30 rounded-lg">
                        <Gamepad2 className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{detailedStats.totalGames?.toLocaleString('tr-TR') || 0}</p>
                        <p className="text-xs text-slate-500">Toplam Oyun</p>
                      </div>
                      <div className="text-center p-3 bg-emerald-500/10 border border-emerald-700/30 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{detailedStats.gamesToday?.toLocaleString('tr-TR') || 0}</p>
                        <p className="text-xs text-slate-500">Bugün</p>
                      </div>
                      <div className="text-center p-3 bg-blue-500/10 border border-blue-700/30 rounded-lg">
                        <Calendar className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{detailedStats.gamesWeek?.toLocaleString('tr-TR') || 0}</p>
                        <p className="text-xs text-slate-500">Bu Hafta</p>
                      </div>
                      <div className="text-center p-3 bg-amber-500/10 border border-amber-700/30 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{detailedStats.gamesMonth?.toLocaleString('tr-TR') || 0}</p>
                        <p className="text-xs text-slate-500">Bu Ay</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Puan Akışı */}
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
                      <Coins className="w-5 h-5 text-amber-400" />
                      Puan Akışı
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Toplam Bahis ve Kazanç */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-rose-500/10 border border-rose-700/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowDownRight className="w-4 h-4 text-rose-400" />
                          <span className="text-xs text-slate-400">Toplam Bahis</span>
                        </div>
                        <p className="text-xl font-bold text-rose-400">
                          {detailedStats.totalBets?.toLocaleString('tr-TR') || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 border border-emerald-700/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs text-slate-400">Toplam Kazanç</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-400">
                          {detailedStats.totalWins?.toLocaleString('tr-TR') || 0}
                        </p>
                      </div>
                    </div>

                    {/* Bugünkü Bahis ve Kazanç */}
                    <div className="pt-3 border-t border-slate-800/50">
                      <p className="text-xs text-slate-500 mb-2">Bugün</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                          <span className="text-xs text-slate-400">Bahis</span>
                          <span className="text-sm font-semibold text-rose-400">
                            {detailedStats.betsToday?.toLocaleString('tr-TR') || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                          <span className="text-xs text-slate-400">Kazanç</span>
                          <span className="text-sm font-semibold text-emerald-400">
                            {detailedStats.winsToday?.toLocaleString('tr-TR') || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Site Kar/Zarar */}
                    <div className="pt-3 border-t border-slate-800/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Site Karı (Bahis - Kazanç)</span>
                        <span className={`text-lg font-bold ${(detailedStats.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(detailedStats.netProfit || 0) >= 0 ? '+' : ''}{detailedStats.netProfit?.toLocaleString('tr-TR') || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Özet İstatistikler */}
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

            {/* Blackjack Ayarları Card */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600">
                      <Spade className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-100">Blackjack Ayarları</CardTitle>
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
                  {/* Oyun Durumu - Sadece Toggle */}
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

                  {/* Min Bahis - Sabit Değer Gösterimi */}
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <Label className="text-gray-300 flex items-center gap-2 mb-3">
                      <Coins className="w-4 h-4" />
                      Min Bahis
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-amber-400">{FIXED_MIN_BET}</span>
                      <span className="text-gray-400">puan (sabit)</span>
                    </div>
                  </div>

                  {/* Max Bahis - Sabit Değer Gösterimi */}
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <Label className="text-gray-300 flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4" />
                      Max Bahis
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-amber-400">{FIXED_MAX_BET}</span>
                      <span className="text-gray-400">puan (sabit)</span>
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
          </TabsContent>

          {/* Mines Tab */}
          <TabsContent value="mines" className="space-y-6">
            {/* Mines Ayarları Card */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                      <Bomb className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-100">Mines Ayarları</CardTitle>
                      <CardDescription className="text-gray-400">
                        Mayın tarlası oyunu - 5x5 grid
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
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
                {/* Oyun Bilgisi */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Oyun Durumu - Toggle */}
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
                    <p className="text-xs text-gray-500">Blackjack ile paylaşımlı</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                      <Diamond className="w-5 h-5 text-cyan-400" />
                      <span className="text-gray-300 font-medium">Grid Boyutu</span>
                    </div>
                    <p className="text-2xl font-bold text-white">5x5</p>
                    <p className="text-xs text-gray-500">25 kare</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                      <Coins className="w-5 h-5 text-amber-400" />
                      <span className="text-gray-300 font-medium">Bahis Limitleri</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{FIXED_MIN_BET} - {FIXED_MAX_BET}</p>
                    <p className="text-xs text-gray-500">puan (sabit)</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                      <Bomb className="w-5 h-5 text-red-400" />
                      <span className="text-gray-300 font-medium">Mayın Aralığı</span>
                    </div>
                    <p className="text-2xl font-bold text-white">1-24</p>
                    <p className="text-xs text-gray-500">Seçilebilir mayın sayısı</p>
                  </div>
                </div>

                {/* Nasıl Çalışır */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-300">Nasıl Çalışır</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-800/50 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">1</div>
                      <div>
                        <p className="text-sm text-gray-300">Bahis Yap</p>
                        <p className="text-xs text-gray-500">Bahis miktarı ve mayın sayısını seç</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/50 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">2</div>
                      <div>
                        <p className="text-sm text-gray-300">Kare Aç</p>
                        <p className="text-xs text-gray-500">Elmas bul, mayına basma</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/50 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">3</div>
                      <div>
                        <p className="text-sm text-gray-300">Çarpan Artar</p>
                        <p className="text-xs text-gray-500">Her elmas ile çarpan yükselir</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/50 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">4</div>
                      <div>
                        <p className="text-sm text-gray-300">Çek</p>
                        <p className="text-xs text-gray-500">İstediğin zaman kazancını al</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPermissionGuard>
  )
}
