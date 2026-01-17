'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Users,
  Edit,
  Search,
  Ban,
  ShieldCheck,
  MessageSquare,
  Coins,
  Award,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface User {
  id: string
  userId: string | null
  telegramId?: string | null
  siteUsername?: string | null
  username?: string | null
  telegramUsername?: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  avatar?: string | null
  points: number
  xp: number
  totalMessages: number
  dailySpinsLeft: number
  isBanned: boolean
  banReason?: string | null | undefined
  bannedAt?: string | null | undefined
  bannedBy?: string | null | undefined
  createdAt: string
  isRegistered: boolean
  hadStart?: boolean
  hasTelegram?: boolean
  rank?: {
    name: string
    icon: string
    color: string
  } | null
  _count: {
    purchases: number
    wheelSpins: number
    messages: number
  }
}

interface Pagination {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('points')
  const [sortOrder, setSortOrder] = useState('desc')
  const [userType, setUserType] = useState('all')
  const [bannedFilter, setBannedFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [pagination, setPagination] = useState<Pagination | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadUsers()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const delayDebounceFn = setTimeout(() => {
      loadUsers()
    }, 400)

    return () => {
      clearTimeout(delayDebounceFn)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [searchTerm, sortBy, sortOrder, userType, bannedFilter, currentPage, limit])

  async function loadUsers() {
    try {
      abortControllerRef.current = new AbortController()

      const params = new URLSearchParams({
        search: searchTerm,
        sortBy,
        sortOrder,
        page: currentPage.toString(),
        limit: limit.toString()
      })

      if (bannedFilter !== 'all') {
        params.append('banned', bannedFilter)
      }

      const response = await fetch(
        `/api/admin/statistics?${params.toString()}`,
        { signal: abortControllerRef.current.signal }
      )
      const data = await response.json()

      let filteredUsers = data.users || []

      // Client-side filter for user type
      if (userType === 'site') {
        filteredUsers = filteredUsers.filter((u: User) => u.isRegistered)
      } else if (userType === 'telegram') {
        filteredUsers = filteredUsers.filter((u: User) => !u.isRegistered)
      } else if (userType === 'linked') {
        filteredUsers = filteredUsers.filter((u: User) => u.isRegistered && u.hasTelegram)
      }

      setUsers(filteredUsers)
      setPagination(data.pagination)
    } catch (error: any) {
      if (error.name === 'AbortError') return
      console.error('Error loading users:', error)
      toast.error('Kullanıcılar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function handleBanToggle(userId: string, isBanned: boolean) {
    const action = isBanned ? 'unban' : 'ban'
    const reason = !isBanned ? prompt('Ban nedeni:') : undefined

    if (!isBanned && !reason) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason,
          adminUsername: 'Admin'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        loadUsers()
      } else {
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Ban toggle error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen admin-layout-bg">
        <div className="admin-spinner"></div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Kullanıcılar
          </h1>
          <p className="text-sm admin-text-muted">
            Toplam {pagination?.totalCount || 0} kullanıcı
          </p>
        </div>

        {/* Filters */}
        <Card className="admin-card p-4">
          <div className="space-y-3">
            {/* Search */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 admin-text-muted z-10" />
              <input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="admin-input w-full pl-10 h-10"
                placeholder="İsim, kullanıcı adı, email veya Telegram ID ile ara..."
              />
            </div>

            {/* Filter Options */}
            <div className="flex flex-wrap gap-2">
              <Select value={userType} onValueChange={(val) => { setUserType(val); setCurrentPage(1); }}>
                <SelectTrigger className="admin-input h-9 text-sm w-auto min-w-[130px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Kullanıcı Tipi" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="site">Site Kayıtlı</SelectItem>
                  <SelectItem value="telegram">Sadece Telegram</SelectItem>
                  <SelectItem value="linked">Bağlı Hesaplar</SelectItem>
                </SelectContent>
              </Select>

              <Select value={bannedFilter} onValueChange={(val) => { setBannedFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="admin-input h-9 text-sm w-auto min-w-[120px]">
                  <SelectValue placeholder="Ban Durumu" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="true">Banlı</SelectItem>
                  <SelectItem value="false">Aktif</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="admin-input h-9 text-sm w-auto min-w-[140px]">
                  <SelectValue placeholder="Sırala" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="points">Puan</SelectItem>
                  <SelectItem value="xp">XP</SelectItem>
                  <SelectItem value="messages">Mesaj Sayısı</SelectItem>
                  <SelectItem value="createdAt">Kayıt Tarihi</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="admin-input h-9 text-sm w-auto min-w-[150px]">
                  <SelectValue placeholder="Sıralama" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="desc">Yüksekten Düşüğe</SelectItem>
                  <SelectItem value="asc">Düşükten Yükseğe</SelectItem>
                </SelectContent>
              </Select>

              <Select value={limit.toString()} onValueChange={(val) => { setLimit(parseInt(val)); setCurrentPage(1); }}>
                <SelectTrigger className="admin-input h-9 text-sm w-auto min-w-[80px]">
                  <SelectValue placeholder="Göster" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Users List */}
        <Card className="admin-card overflow-hidden">
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 admin-text-muted mx-auto mb-4" />
              <p className="admin-text-muted">Kullanıcı bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left p-3 admin-text-muted text-xs font-semibold">KULLANICI</th>
                    <th className="text-left p-3 admin-text-muted text-xs font-semibold hidden md:table-cell">İSTATİSTİKLER</th>
                    <th className="text-left p-3 admin-text-muted text-xs font-semibold hidden lg:table-cell">TİP</th>
                    <th className="text-right p-3 admin-text-muted text-xs font-semibold">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        user.isBanned ? 'bg-red-500/5' : ''
                      }`}
                    >
                      {/* User Info */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            {user.avatar ? (
                              <AvatarImage src={user.avatar} alt="Avatar" />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-bold">
                                {(user.siteUsername || user.firstName || user.username || user.telegramUsername || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="admin-text-primary font-semibold truncate">
                                {user.siteUsername || user.firstName || user.username || user.telegramUsername || 'Kullanıcı'}
                              </p>
                              {user.rank && (
                                <span className="text-sm" style={{ color: user.rank.color }}>
                                  {user.rank.icon}
                                </span>
                              )}
                              {user.isBanned && (
                                <span className="admin-badge-danger text-[10px] px-1.5 py-0.5">BANLI</span>
                              )}
                            </div>
                            <p className="text-xs admin-text-muted truncate">
                              {(user.username || user.telegramUsername) ? `@${user.username || user.telegramUsername}` : user.email || user.telegramId || 'Bilgi yok'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-yellow-400 flex items-center gap-1" title="Puan">
                            <Coins className="w-3.5 h-3.5" /> {user.points}
                          </span>
                          <span className="text-purple-400 flex items-center gap-1" title="XP">
                            <Award className="w-3.5 h-3.5" /> {user.xp}
                          </span>
                          <span className="text-cyan-400 flex items-center gap-1" title="Mesaj">
                            <MessageSquare className="w-3.5 h-3.5" /> {user._count.messages || user.totalMessages}
                          </span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="p-3 hidden lg:table-cell">
                        <div className="flex gap-1">
                          {user.isRegistered ? (
                            <span className="admin-badge-success text-[10px] px-1.5 py-0.5">Site</span>
                          ) : (
                            <span className="admin-badge-warning text-[10px] px-1.5 py-0.5">TG</span>
                          )}
                          {user.hasTelegram && user.isRegistered && (
                            <span className="admin-badge-info text-[10px] px-1.5 py-0.5">Bağlı</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/users/${user.userId || user.id}`}
                            className="admin-btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                            title="Detayları Görüntüle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Detay</span>
                          </Link>
                          <button
                            onClick={() => handleBanToggle(user.id, user.isBanned)}
                            className={`text-xs px-3 py-1.5 flex items-center gap-1.5 ${
                              user.isBanned ? "admin-btn-success" : "admin-btn-danger"
                            }`}
                            title={user.isBanned ? "Ban Kaldır" : "Banla"}
                          >
                            {user.isBanned ? (
                              <><ShieldCheck className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Kaldır</span></>
                            ) : (
                              <><Ban className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Banla</span></>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="admin-text-muted text-sm">
              {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, pagination.totalCount)} / {pagination.totalCount}
            </div>
            <div className="flex gap-1">
              <Button
                onClick={() => setCurrentPage(1)}
                disabled={!pagination.hasPreviousPage}
                className="admin-btn-secondary disabled:opacity-50 p-2"
                title="İlk Sayfa"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
                className="admin-btn-secondary disabled:opacity-50 p-2"
                title="Önceki"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center px-4 admin-text-muted text-sm">
                {currentPage} / {pagination.totalPages}
              </div>

              <Button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="admin-btn-primary disabled:opacity-50 p-2"
                title="Sonraki"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setCurrentPage(pagination.totalPages)}
                disabled={!pagination.hasNextPage}
                className="admin-btn-secondary disabled:opacity-50 p-2"
                title="Son Sayfa"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
