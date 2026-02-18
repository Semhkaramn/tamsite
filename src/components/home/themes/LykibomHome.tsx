'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useSponsors } from '@/lib/hooks/useSponsors'
import { optimizeCloudinaryImage, ensureAbsoluteUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Heart, Crown, Sparkles, Search } from 'lucide-react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import HomePopup from '@/components/HomePopup'
import { useDominantColors, getCachedColor } from '@/lib/hooks/useDominantColor'

interface Sponsor {
  id: string
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  category: string
  clicks: number
}

interface BannerData {
  imageUrl: string
  sponsorId: string
  enabled: boolean
}

interface BannerSponsor {
  id: string
  name: string
  websiteUrl?: string
}

interface BannerConfig {
  leftBanner: BannerData | null
  leftSponsor: BannerSponsor | null
  rightBanner: BannerData | null
  rightSponsor: BannerSponsor | null
}

async function fetchBanners(): Promise<BannerConfig> {
  try {
    const bannersRes = await fetch('/api/settings/banners')
    const bannersData = await bannersRes.json()
    return {
      leftBanner: bannersData.left ? { enabled: true, imageUrl: bannersData.left.imageUrl, sponsorId: bannersData.left.sponsorId } : null,
      leftSponsor: bannersData.left?.sponsor || null,
      rightBanner: bannersData.right ? { enabled: true, imageUrl: bannersData.right.imageUrl, sponsorId: bannersData.right.sponsorId } : null,
      rightSponsor: bannersData.right?.sponsor || null
    }
  } catch {
    return { leftBanner: null, leftSponsor: null, rightBanner: null, rightSponsor: null }
  }
}

function optimizeBannerImage(url: string): string {
  if (!url) return url
  if (url.toLowerCase().endsWith('.gif')) return url
  if (url.includes('cloudinary.com')) return url.replace('/upload/', '/upload/f_auto,q_auto/')
  return url
}

function getGridClass(count: number, type: 'main' | 'vip' | 'normal', hasBanners: boolean): string {
  if (type === 'main') {
    if (count === 1) return 'grid-cols-1'
    return 'grid-cols-1 md:grid-cols-2'
  }
  if (type === 'vip') {
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
    if (hasBanners) return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  }
  if (count === 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (count === 3) {
    if (hasBanners) return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  }
  if (hasBanners) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
}

// Neon glow CSS generator
function getNeonStyles(hex: string, intensity: 'high' | 'medium' | 'low' = 'medium') {
  const glowSizes = {
    high: { blur1: 20, blur2: 40, blur3: 60, borderWidth: 2 },
    medium: { blur1: 12, blur2: 25, blur3: 40, borderWidth: 1 },
    low: { blur1: 8, blur2: 15, blur3: 25, borderWidth: 1 }
  }
  const g = glowSizes[intensity]

  return {
    boxShadow: `
      0 0 ${g.blur1}px ${hex}50,
      0 0 ${g.blur2}px ${hex}30,
      0 0 ${g.blur3}px ${hex}15,
      inset 0 0 ${g.blur1}px ${hex}10
    `,
    border: `${g.borderWidth}px solid ${hex}`,
  }
}

// ==================== MAIN SPONSOR CARD ====================
function MainSponsorCard({ sponsor, onClick, index, color }: {
  sponsor: Sponsor
  onClick: (e: React.MouseEvent) => void
  index: number
  color: string
}) {
  const neonStyles = getNeonStyles(color, 'high')

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Animated background glow */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-75 blur-xl transition-all duration-500 group-hover:opacity-100 group-hover:blur-2xl animate-pulse"
        style={{ background: `linear-gradient(45deg, ${color}40, ${color}20, ${color}40)` }}
      />

      {/* Card */}
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1"
        style={{
          background: `linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%)`,
          ...neonStyles
        }}
      >
        {/* Animated neon border effect */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <div
            className="absolute inset-0 animate-spin-slow"
            style={{
              background: `conic-gradient(from 0deg, transparent, ${color}, transparent, ${color}, transparent)`,
              opacity: 0.3,
            }}
          />
          <div className="absolute inset-[2px] rounded-xl bg-black/90" />
        </div>

        {/* Top neon line */}
        <div
          className="absolute top-0 left-1/4 right-1/4 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            boxShadow: `0 0 10px ${color}, 0 0 20px ${color}50`
          }}
        />

        {/* Content */}
        <div className="relative flex items-center gap-4 p-4 sm:p-5">
          {/* Logo */}
          {sponsor.logoUrl && (
            <div
              className="w-[90px] h-[52px] sm:w-[110px] sm:h-[62px] rounded-lg flex-shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{
                background: `linear-gradient(145deg, ${color}20, ${color}05)`,
                border: `1px solid ${color}40`,
                boxShadow: `0 0 15px ${color}30, inset 0 0 10px ${color}10`
              }}
            >
              <Image
                src={optimizeCloudinaryImage(sponsor.logoUrl, 140, 80)}
                alt={sponsor.name}
                width={110}
                height={62}
                className="object-contain p-2 max-w-full max-h-full"
                priority={index === 0}
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          )}

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 flex-shrink-0 animate-pulse" style={{ color }} fill="currentColor" />
              <h3
                className="text-base sm:text-lg md:text-xl font-black truncate"
                style={{
                  color: color,
                  textShadow: `0 0 10px ${color}80, 0 0 20px ${color}40`
                }}
              >
                {sponsor.name}
              </h3>
            </div>
            {sponsor.description && (
              <p className="text-xs sm:text-sm text-gray-300 line-clamp-2 font-medium">
                {sponsor.description}
              </p>
            )}
          </div>
        </div>

        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-1/4 right-1/4 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
            boxShadow: `0 0 8px ${color}50`
          }}
        />
      </div>
    </div>
  )
}

// ==================== VIP SPONSOR CARD ====================
function VipSponsorCard({ sponsor, onClick, color }: {
  sponsor: Sponsor
  onClick: (e: React.MouseEvent) => void
  color: string
}) {
  const neonStyles = getNeonStyles(color, 'medium')

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Glow background */}
      <div
        className="absolute -inset-0.5 rounded-xl opacity-50 blur-lg transition-all duration-300 group-hover:opacity-80"
        style={{ background: color }}
      />

      {/* Card */}
      <div
        className="relative rounded-lg overflow-hidden transition-all duration-300 group-hover:scale-[1.02]"
        style={{
          background: 'rgba(0,0,0,0.85)',
          ...neonStyles
        }}
      >
        {/* Corner accent */}
        <div
          className="absolute top-0 right-0 w-8 h-8"
          style={{
            background: `linear-gradient(135deg, ${color}30, transparent)`,
          }}
        />
        <Crown
          className="absolute top-1.5 right-1.5 w-3 h-3 opacity-70"
          style={{ color }}
          fill="currentColor"
        />

        {/* Content */}
        <div className="relative flex items-center gap-3 p-3 sm:p-4">
          {/* Logo */}
          {sponsor.logoUrl && (
            <div
              className="w-[75px] h-[42px] sm:w-[85px] sm:h-[48px] rounded-md flex-shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
              style={{
                background: `${color}15`,
                border: `1px solid ${color}30`,
              }}
            >
              <Image
                src={optimizeCloudinaryImage(sponsor.logoUrl, 110, 62)}
                alt={sponsor.name}
                width={85}
                height={48}
                className="object-contain p-1.5 max-w-full max-h-full"
                loading="lazy"
              />
            </div>
          )}

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm sm:text-base font-bold truncate mb-0.5"
              style={{
                color,
                textShadow: `0 0 8px ${color}50`
              }}
            >
              {sponsor.name}
            </h3>
            {sponsor.description && (
              <p className="text-xs text-gray-400 line-clamp-2">
                {sponsor.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== NORMAL SPONSOR CARD ====================
function NormalSponsorCard({ sponsor, onClick, color }: {
  sponsor: Sponsor
  onClick: (e: React.MouseEvent) => void
  color: string
}) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Subtle glow on hover */}
      <div
        className="absolute -inset-0.5 rounded-lg opacity-0 blur-md transition-all duration-300 group-hover:opacity-50"
        style={{ background: color }}
      />

      {/* Card */}
      <div
        className="relative rounded-md overflow-hidden transition-all duration-300 group-hover:scale-[1.01]"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${color}20`,
        }}
      >
        {/* Hover border glow */}
        <div
          className="absolute inset-0 rounded-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            boxShadow: `inset 0 0 0 1px ${color}40, 0 0 10px ${color}20`
          }}
        />

        {/* Content */}
        <div className="relative flex items-center gap-2.5 p-2.5">
          {/* Logo */}
          {sponsor.logoUrl && (
            <div
              className="w-[65px] h-[38px] sm:w-[75px] sm:h-[42px] rounded flex-shrink-0 flex items-center justify-center"
              style={{
                background: `${color}08`,
                border: `1px solid ${color}15`,
              }}
            >
              <Image
                src={optimizeCloudinaryImage(sponsor.logoUrl, 95, 54)}
                alt={sponsor.name}
                width={75}
                height={42}
                className="object-contain p-1 max-w-full max-h-full"
                loading="lazy"
              />
            </div>
          )}

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-white truncate mb-0.5 group-hover:text-opacity-90">
              {sponsor.name}
            </h3>
            {sponsor.description && (
              <p className="text-xs text-gray-500 line-clamp-1 group-hover:text-gray-400">
                {sponsor.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================
export default function LykibomHome() {
  const { user } = useAuth()
  const { data: sponsorsData, isLoading: loadingSponsors } = useSponsors()
  const [colorsReady, setColorsReady] = useState(false)
  const [sponsorColors, setSponsorColors] = useState<Map<string, string>>(new Map())

  const { data: bannerConfig } = useQuery({
    queryKey: ['sideBanners'],
    queryFn: fetchBanners,
    staleTime: 60000,
    gcTime: 300000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const [searchTerm, setSearchTerm] = useState('')

  // Logo URL'leri
  const logoUrls = useMemo(() => {
    return (sponsorsData || []).map((s: Sponsor) => s.logoUrl).filter(Boolean) as string[]
  }, [sponsorsData])

  // Renkleri yükle ve cache'le
  const colorMap = useDominantColors(logoUrls)

  // Renkler hazır olduğunda state'i güncelle
  useEffect(() => {
    if (colorMap.size > 0 && logoUrls.length > 0) {
      const newColors = new Map<string, string>()

      sponsorsData?.forEach((sponsor: Sponsor) => {
        if (sponsor.logoUrl) {
          const colorResult = colorMap.get(sponsor.logoUrl)
          if (colorResult) {
            newColors.set(sponsor.id, colorResult.hex)
          }
        }
      })

      if (newColors.size > 0) {
        setSponsorColors(newColors)
        setColorsReady(true)
      }
    }
  }, [colorMap, logoUrls, sponsorsData])

  // Sponsor için renk al - fallback ile
  const getColorForSponsor = useCallback((sponsor: Sponsor, fallback: string): string => {
    // Önce state'den kontrol et
    const cachedColor = sponsorColors.get(sponsor.id)
    if (cachedColor) return cachedColor

    // Sonra doğrudan cache'den kontrol et
    if (sponsor.logoUrl) {
      const colorResult = getCachedColor(sponsor.logoUrl)
      if (colorResult) return colorResult.hex
    }

    return fallback
  }, [sponsorColors])

  useEffect(() => {
    if (!loadingSponsors && sponsorsData) {
      window.dispatchEvent(new CustomEvent('contentReady'))
    }
  }, [loadingSponsors, sponsorsData])

  const sponsors = sponsorsData || []
  const sortedSponsors = [...sponsors].sort((a: Sponsor, b: Sponsor) => {
    if (a.category === 'main' && b.category !== 'main') return -1
    if (a.category !== 'main' && b.category === 'main') return 1
    if (a.category === 'vip' && b.category !== 'vip') return -1
    if (a.category !== 'vip' && b.category === 'vip') return 1
    return 0
  })

  function visitSponsor(e: React.MouseEvent, sponsorId: string, websiteUrl?: string) {
    if (!websiteUrl) return
    const data = JSON.stringify({ sponsorId })
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' })
      navigator.sendBeacon('/api/sponsors/click', blob)
    } else {
      fetch('/api/sponsors/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true }).catch(() => {})
    }
    window.open(ensureAbsoluteUrl(websiteUrl), '_blank', 'noopener,noreferrer')
  }

  function handleBannerClick(sponsor: BannerSponsor | null) {
    if (!sponsor?.websiteUrl) return
    if (sponsor.id) {
      const data = JSON.stringify({ sponsorId: sponsor.id })
      if (navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' })
        navigator.sendBeacon('/api/sponsors/click', blob)
      } else {
        fetch('/api/sponsors/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true }).catch(() => {})
      }
    }
    window.open(ensureAbsoluteUrl(sponsor.websiteUrl), '_blank', 'noopener,noreferrer')
  }

  if (loadingSponsors && !sponsorsData) {
    return <div className="min-h-screen" style={{ contain: 'layout' }} />
  }

  const filteredSponsors = sortedSponsors.filter((s: Sponsor) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const mainSponsors = filteredSponsors.filter((s: Sponsor) => s.category === 'main')
  const vipSponsors = filteredSponsors.filter((s: Sponsor) => s.category === 'vip')
  const normalSponsors = filteredSponsors.filter((s: Sponsor) => s.category !== 'vip' && s.category !== 'main')

  const { leftBanner, leftSponsor, rightBanner, rightSponsor } = bannerConfig || {}
  const hasBanners = (leftBanner && leftSponsor) || (rightBanner && rightSponsor)

  return (
    <div className="min-h-screen pb-8 overflow-x-hidden max-w-full">
      <HomePopup />

      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>

      <div className="flex justify-center gap-2 px-2 max-w-full overflow-x-hidden">
        {/* Sol Banner */}
        {leftBanner && leftSponsor && (
          <div
            className="hidden xl:block flex-shrink-0 w-[160px] 2xl:w-[200px] cursor-pointer pt-4"
            onClick={() => handleBannerClick(leftSponsor)}
          >
            <div className="sticky top-4 h-[calc(100vh-32px)] rounded-lg overflow-hidden shadow-2xl border border-white/10">
              <Image
                src={optimizeBannerImage(leftBanner.imageUrl)}
                alt={leftSponsor.name}
                width={200}
                height={800}
                className="object-fill w-full h-full"
                priority
                loading="eager"
                quality={85}
                unoptimized={leftBanner.imageUrl.toLowerCase().endsWith('.gif')}
              />
            </div>
          </div>
        )}

        {/* Sponsors List */}
        <div className="flex-1 min-w-0 px-2 sm:px-4 py-4 max-w-5xl mx-auto">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Sponsor ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-sm bg-black/50 border-white/10 focus:border-white/30 rounded-lg"
            />
          </div>

          {filteredSponsors.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Henüz sponsor bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* MAIN Sponsors */}
              {mainSponsors.length > 0 && (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <Sparkles className="w-5 h-5 text-rose-400 animate-pulse" fill="currentColor" />
                    <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-rose-400 to-rose-500">
                      Ana Sponsor
                    </h2>
                    <Sparkles className="w-5 h-5 text-rose-400 animate-pulse" fill="currentColor" />
                  </div>

                  <div className={`grid gap-5 ${getGridClass(mainSponsors.length, 'main', !!hasBanners)}`}>
                    {mainSponsors.map((sponsor, index) => (
                      <MainSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        index={index}
                        color={getColorForSponsor(sponsor, '#f43f5e')}
                        onClick={(e) => visitSponsor(e, sponsor.id, sponsor.websiteUrl)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* VIP Sponsors */}
              {vipSponsors.length > 0 && (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Crown className="w-4 h-4 text-amber-400" fill="currentColor" />
                    <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500">
                      VIP Sponsorlar
                    </h2>
                    <Crown className="w-4 h-4 text-amber-400" fill="currentColor" />
                  </div>

                  <div className={`grid gap-4 ${getGridClass(vipSponsors.length, 'vip', !!hasBanners)}`}>
                    {vipSponsors.map((sponsor) => (
                      <VipSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        color={getColorForSponsor(sponsor, '#f59e0b')}
                        onClick={(e) => visitSponsor(e, sponsor.id, sponsor.websiteUrl)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Normal Sponsors */}
              {normalSponsors.length > 0 && (
                <div>
                  {(mainSponsors.length > 0 || vipSponsors.length > 0) && (
                    <h2 className="text-base font-semibold text-gray-300 mb-4 flex items-center justify-center gap-2">
                      <Heart className="w-4 h-4 text-gray-500" />
                      Sponsorlar
                    </h2>
                  )}

                  <div className={`grid gap-3 ${getGridClass(normalSponsors.length, 'normal', !!hasBanners)}`}>
                    {normalSponsors.map(sponsor => (
                      <NormalSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        color={getColorForSponsor(sponsor, '#64748b')}
                        onClick={(e) => visitSponsor(e, sponsor.id, sponsor.websiteUrl)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sağ Banner */}
        {rightBanner && rightSponsor && (
          <div
            className="hidden xl:block flex-shrink-0 w-[160px] 2xl:w-[200px] cursor-pointer pt-4"
            onClick={() => handleBannerClick(rightSponsor)}
          >
            <div className="sticky top-4 h-[calc(100vh-32px)] rounded-lg overflow-hidden shadow-2xl border border-white/10">
              <Image
                src={optimizeBannerImage(rightBanner.imageUrl)}
                alt={rightSponsor.name}
                width={200}
                height={800}
                className="object-fill w-full h-full"
                priority
                loading="eager"
                quality={85}
                unoptimized={rightBanner.imageUrl.toLowerCase().endsWith('.gif')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
