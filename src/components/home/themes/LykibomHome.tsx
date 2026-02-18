'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useSponsors } from '@/lib/hooks/useSponsors'
import { optimizeCloudinaryImage, ensureAbsoluteUrl } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Heart, Crown, Sparkles, Search, Star } from 'lucide-react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import HomePopup from '@/components/HomePopup'
import { useDominantColors, getCachedColor, createColorStyles } from '@/lib/hooks/useDominantColor'

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

    const config: BannerConfig = {
      leftBanner: bannersData.left ? {
        enabled: true,
        imageUrl: bannersData.left.imageUrl,
        sponsorId: bannersData.left.sponsorId
      } : null,
      leftSponsor: bannersData.left?.sponsor || null,
      rightBanner: bannersData.right ? {
        enabled: true,
        imageUrl: bannersData.right.imageUrl,
        sponsorId: bannersData.right.sponsorId
      } : null,
      rightSponsor: bannersData.right?.sponsor || null
    }

    return config
  } catch (error) {
    console.error('Error loading banners:', error)
    return {
      leftBanner: null,
      leftSponsor: null,
      rightBanner: null,
      rightSponsor: null
    }
  }
}

function optimizeBannerImage(url: string): string {
  if (!url) return url
  if (url.toLowerCase().endsWith('.gif')) return url
  if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto/')
  }
  return url
}

// Dinamik grid class hesaplama
function getGridClass(count: number, type: 'main' | 'vip' | 'normal', hasBanners: boolean): string {
  // Main sponsorlar için: max 2 sütun
  if (type === 'main') {
    if (count === 1) {
      return 'grid-cols-1'
    }
    // 2+ için: mobilde 1, tablet+ 2
    return 'grid-cols-1 md:grid-cols-2'
  }

  // VIP sponsorlar için: max 3 sütun
  if (type === 'vip') {
    if (count === 1) {
      return 'grid-cols-1'
    }
    if (count === 2) {
      return 'grid-cols-1 sm:grid-cols-2'
    }
    // 3+ için: mobilde 1, tablet 2, desktop 3
    if (hasBanners) {
      return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
    }
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  }

  // Normal sponsorlar için: max 4 sütun
  if (count === 1) {
    return 'grid-cols-1'
  }
  if (count === 2) {
    return 'grid-cols-1 sm:grid-cols-2'
  }
  if (count === 3) {
    if (hasBanners) {
      return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
    }
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  }
  // 4+ için
  if (hasBanners) {
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  }
  return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
}

// Main Sponsor Kartı - En gösterişli
function MainSponsorCard({ sponsor, onClick, index }: { sponsor: Sponsor; onClick: (e: React.MouseEvent) => void; index: number }) {
  const colorResult = getCachedColor(sponsor.logoUrl)
  const styles = createColorStyles(colorResult, '#ef4444')

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden border-2 transition-all duration-500 hover:scale-[1.02] group cursor-pointer"
      style={{
        background: styles.gradient,
        borderColor: styles.primaryBorder,
        boxShadow: `0 0 30px ${styles.primaryLight}, 0 0 60px ${styles.primaryLight}, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      {/* Animated glow effect */}
      <div
        className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${styles.primary}40 0%, transparent 70%)`,
        }}
      />

      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
          style={{
            background: `linear-gradient(90deg, transparent, ${styles.primary}20, transparent)`,
          }}
        />
      </div>

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-16 h-16 opacity-60">
        <Sparkles
          className="w-5 h-5 absolute top-2 left-2 animate-pulse"
          style={{ color: styles.primary }}
          fill="currentColor"
        />
      </div>
      <div className="absolute top-0 right-0 w-16 h-16 opacity-60">
        <Star
          className="w-4 h-4 absolute top-2 right-2 animate-pulse"
          style={{ color: styles.primary, animationDelay: '0.5s' }}
          fill="currentColor"
        />
      </div>

      <div className="relative flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-4 sm:p-5">
        {sponsor.logoUrl && (
          <div
            className="w-24 h-14 sm:w-32 sm:h-18 md:w-40 md:h-22 rounded-xl flex-shrink-0 relative overflow-hidden border-2 transition-all duration-300 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${styles.primaryLight}, ${styles.primaryMedium})`,
              borderColor: styles.primaryBorder,
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 200, 120)}
              alt={sponsor.name}
              width={160}
              height={88}
              className="object-contain p-2 w-full h-full"
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center items-center w-full">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <Sparkles
              className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse"
              style={{ color: styles.primary }}
              fill="currentColor"
            />
            <h3
              className="text-lg sm:text-xl md:text-2xl font-black text-center break-words leading-tight"
              style={{ color: styles.textColor }}
            >
              {sponsor.name}
            </h3>
            <Sparkles
              className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse"
              style={{ color: styles.primary, animationDelay: '0.3s' }}
              fill="currentColor"
            />
          </div>
          {sponsor.description && (
            <p
              className="leading-snug font-semibold text-center text-xs sm:text-sm md:text-base break-words w-full opacity-90"
              style={{ color: styles.textColor, whiteSpace: 'pre-line' }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// VIP Sponsor Kartı - Orta seviye gösteriş
function VipSponsorCard({ sponsor, onClick }: { sponsor: Sponsor; onClick: (e: React.MouseEvent) => void }) {
  const colorResult = getCachedColor(sponsor.logoUrl)
  const styles = createColorStyles(colorResult, '#eab308')

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden border transition-all duration-300 hover:scale-[1.02] group cursor-pointer"
      style={{
        background: styles.gradient,
        borderColor: styles.primaryBorder,
        boxShadow: `0 0 15px ${styles.primaryLight}`,
      }}
    >
      {/* Subtle glow */}
      <div
        className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${styles.primary}30 0%, transparent 60%)`,
        }}
      />

      {/* Crown icon */}
      <div className="absolute top-1 right-1 opacity-50 group-hover:opacity-80 transition-opacity">
        <Crown
          className="w-3.5 h-3.5"
          style={{ color: styles.primary }}
          fill="currentColor"
        />
      </div>

      <div className="relative flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 p-3 sm:p-4">
        {sponsor.logoUrl && (
          <div
            className="w-20 h-11 sm:w-24 sm:h-14 md:w-28 md:h-16 rounded-lg flex-shrink-0 relative overflow-hidden border transition-all duration-300 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${styles.primaryLight}, ${styles.primaryMedium})`,
              borderColor: styles.primaryBorder,
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 140, 80)}
              alt={sponsor.name}
              width={112}
              height={64}
              className="object-contain p-1.5 w-full h-full"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center items-center w-full">
          <h3
            className="text-sm sm:text-base md:text-lg font-bold text-center break-words leading-tight mb-0.5"
            style={{ color: styles.textColor }}
          >
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p
              className="leading-snug text-center text-xs sm:text-sm break-words w-full opacity-85"
              style={{ color: styles.textColor, whiteSpace: 'pre-line' }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// Normal Sponsor Kartı - Sade tasarım
function NormalSponsorCard({ sponsor, onClick }: { sponsor: Sponsor; onClick: (e: React.MouseEvent) => void }) {
  const colorResult = getCachedColor(sponsor.logoUrl)
  const styles = createColorStyles(colorResult, '#64748b')

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden border transition-all duration-300 hover:scale-[1.01] group cursor-pointer bg-white/5 hover:bg-white/10"
      style={{
        borderColor: `${styles.primary}30`,
      }}
    >
      <div className="relative flex flex-col sm:flex-row items-center gap-2 p-2.5 sm:p-3">
        {sponsor.logoUrl && (
          <div
            className="w-16 h-9 sm:w-20 sm:h-11 md:w-24 md:h-13 rounded-md flex-shrink-0 relative overflow-hidden border transition-all duration-300"
            style={{
              background: `${styles.primary}15`,
              borderColor: `${styles.primary}25`,
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 100, 60)}
              alt={sponsor.name}
              width={96}
              height={52}
              className="object-contain p-1 w-full h-full"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center items-center text-center w-full">
          <h3
            className="text-xs sm:text-sm md:text-base font-semibold text-white mb-0.5 group-hover:opacity-90 transition-colors break-words w-full leading-tight"
          >
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p
              className="text-gray-400 leading-snug text-xs break-words w-full"
              style={{ whiteSpace: 'pre-line' }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function LykibomHome() {
  const { user } = useAuth()
  const { data: sponsorsData, isLoading: loadingSponsors } = useSponsors()

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

  // Logo URL'lerini topla ve renkleri önceden yükle
  const logoUrls = useMemo(() => {
    return (sponsorsData || []).map((s: Sponsor) => s.logoUrl).filter(Boolean) as string[]
  }, [sponsorsData])

  // Renkleri önceden yükle
  useDominantColors(logoUrls)

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
      fetch('/api/sponsors/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true
      }).catch(() => {})
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
        fetch('/api/sponsors/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true
        }).catch(() => {})
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

      <div className="flex justify-center gap-2 px-2 max-w-full overflow-x-hidden">
        {/* Sol Banner */}
        {leftBanner && leftSponsor && (
          <div
            className="hidden xl:block flex-shrink-0 w-[160px] 2xl:w-[200px] cursor-pointer pt-4"
            onClick={() => handleBannerClick(leftSponsor)}
          >
            <div className="sticky top-4 h-[calc(100vh-32px)] rounded-lg overflow-hidden shadow-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10">
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
        <div className="flex-1 min-w-0 px-2 sm:px-4 py-4 max-w-6xl mx-auto">
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Sponsor ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {filteredSponsors.length === 0 ? (
            <div className="text-center py-12" style={{ minHeight: '200px' }}>
              <Heart className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Henüz sponsor bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-6" style={{ contain: 'layout', minHeight: '300px' }}>
              {/* MAIN Sponsors */}
              {mainSponsors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-red-400 animate-pulse" fill="currentColor" />
                    <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-300 via-red-400 to-red-500">
                      Ana Sponsor
                    </h2>
                    <Sparkles className="w-5 h-5 text-red-400 animate-pulse" fill="currentColor" />
                  </div>

                  <div className={`grid gap-3 ${getGridClass(mainSponsors.length, 'main', !!hasBanners)}`}>
                    {mainSponsors.map((sponsor, index) => (
                      <MainSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        index={index}
                        onClick={(e) => visitSponsor(e, sponsor.id, sponsor.websiteUrl)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* VIP Sponsors */}
              {vipSponsors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-yellow-400" fill="currentColor" />
                    <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500">
                      VIP Sponsorlar
                    </h2>
                    <Crown className="w-4 h-4 text-yellow-400" fill="currentColor" />
                  </div>

                  <div className={`grid gap-2.5 ${getGridClass(vipSponsors.length, 'vip', !!hasBanners)}`}>
                    {vipSponsors.map((sponsor) => (
                      <VipSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
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
                    <h2 className="text-base font-semibold text-white mb-3 flex items-center justify-center gap-2">
                      <Heart className="w-4 h-4 text-slate-400" />
                      Sponsorlar
                    </h2>
                  )}

                  <div className={`grid gap-2 ${getGridClass(normalSponsors.length, 'normal', !!hasBanners)}`}>
                    {normalSponsors.map(sponsor => (
                      <NormalSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
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
            <div className="sticky top-4 h-[calc(100vh-32px)] rounded-lg overflow-hidden shadow-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10">
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
