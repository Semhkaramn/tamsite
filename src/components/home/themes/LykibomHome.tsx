'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useSponsors } from '@/lib/hooks/useSponsors'
import { optimizeCloudinaryImage, ensureAbsoluteUrl } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Heart, Crown, Sparkles, Search, Star, Zap } from 'lucide-react'
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

// Main Sponsor Kartı - Ultra Premium
function MainSponsorCard({ sponsor, onClick, index }: { sponsor: Sponsor; onClick: (e: React.MouseEvent) => void; index: number }) {
  const colorResult = getCachedColor(sponsor.logoUrl)
  const styles = createColorStyles(colorResult, '#ef4444')

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden border-2 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 group cursor-pointer backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, ${styles.primary}15 0%, ${styles.primary}08 50%, ${styles.primary}15 100%)`,
        borderColor: styles.primary,
        boxShadow: `
          0 0 20px ${styles.primary}40,
          0 0 40px ${styles.primary}20,
          0 4px 20px rgba(0,0,0,0.3),
          inset 0 1px 0 rgba(255,255,255,0.1)
        `,
      }}
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse at 0% 0%, ${styles.primary}30 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, ${styles.primary}20 0%, transparent 50%)
          `,
        }}
      />

      {/* Top glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${styles.primary}, transparent)`,
        }}
      />

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden">
        <div
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"
          style={{
            background: `linear-gradient(90deg, transparent, ${styles.primary}15, transparent)`,
          }}
        />
      </div>

      {/* Corner sparkles */}
      <Sparkles
        className="absolute top-2.5 left-2.5 w-4 h-4 opacity-70 animate-pulse"
        style={{ color: styles.primary }}
        fill="currentColor"
      />
      <Star
        className="absolute top-2.5 right-2.5 w-3.5 h-3.5 opacity-60 animate-pulse"
        style={{ color: styles.primary, animationDelay: '0.5s' }}
        fill="currentColor"
      />

      {/* Content - Horizontal layout */}
      <div className="relative flex items-center gap-4 p-4">
        {/* Logo container */}
        {sponsor.logoUrl && (
          <div
            className="w-[100px] h-[56px] sm:w-[120px] sm:h-[68px] rounded-xl flex-shrink-0 relative overflow-hidden border-2 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(145deg, ${styles.primary}25, ${styles.primary}10)`,
              borderColor: `${styles.primary}60`,
              boxShadow: `0 4px 15px ${styles.primary}30`,
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 160, 90)}
              alt={sponsor.name}
              width={120}
              height={68}
              className="object-contain p-2 max-w-full max-h-full"
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
            />
          </div>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles
              className="w-4 h-4 animate-pulse flex-shrink-0"
              style={{ color: styles.primary }}
              fill="currentColor"
            />
            <h3
              className="text-base sm:text-lg md:text-xl font-black truncate"
              style={{ color: styles.textColor }}
            >
              {sponsor.name}
            </h3>
            <Sparkles
              className="w-4 h-4 animate-pulse flex-shrink-0"
              style={{ color: styles.primary, animationDelay: '0.3s' }}
              fill="currentColor"
            />
          </div>
          {sponsor.description && (
            <p
              className="text-xs sm:text-sm font-medium line-clamp-2 opacity-85"
              style={{ color: styles.textColor }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>

      {/* Bottom accent */}
      <div
        className="absolute bottom-0 left-4 right-4 h-[1px] opacity-50"
        style={{
          background: `linear-gradient(90deg, transparent, ${styles.primary}60, transparent)`,
        }}
      />
    </Card>
  )
}

// VIP Sponsor Kartı - Premium
function VipSponsorCard({ sponsor, onClick }: { sponsor: Sponsor; onClick: (e: React.MouseEvent) => void }) {
  const colorResult = getCachedColor(sponsor.logoUrl)
  const styles = createColorStyles(colorResult, '#eab308')

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 group cursor-pointer backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, ${styles.primary}12 0%, ${styles.primary}05 100%)`,
        borderColor: `${styles.primary}70`,
        boxShadow: `
          0 0 15px ${styles.primary}25,
          0 4px 15px rgba(0,0,0,0.2),
          inset 0 1px 0 rgba(255,255,255,0.05)
        `,
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 0% 0%, ${styles.primary}20 0%, transparent 60%)`,
        }}
      />

      {/* Top glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${styles.primary}80, transparent)`,
        }}
      />

      {/* Crown icon */}
      <Crown
        className="absolute top-2 right-2 w-3.5 h-3.5 opacity-50 group-hover:opacity-80 transition-opacity"
        style={{ color: styles.primary }}
        fill="currentColor"
      />

      {/* Content - Horizontal layout */}
      <div className="relative flex items-center gap-3 p-3">
        {/* Logo container */}
        {sponsor.logoUrl && (
          <div
            className="w-[80px] h-[45px] sm:w-[90px] sm:h-[50px] rounded-lg flex-shrink-0 relative overflow-hidden border transition-all duration-300 group-hover:scale-105 flex items-center justify-center"
            style={{
              background: `linear-gradient(145deg, ${styles.primary}20, ${styles.primary}08)`,
              borderColor: `${styles.primary}40`,
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 120, 68)}
              alt={sponsor.name}
              width={90}
              height={50}
              className="object-contain p-1.5 max-w-full max-h-full"
              loading="lazy"
            />
          </div>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3
            className="text-sm sm:text-base font-bold truncate mb-0.5"
            style={{ color: styles.textColor }}
          >
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p
              className="text-xs line-clamp-2 opacity-80"
              style={{ color: styles.textColor }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// Normal Sponsor Kartı - Clean & Simple
function NormalSponsorCard({ sponsor, onClick }: { sponsor: Sponsor; onClick: (e: React.MouseEvent) => void }) {
  const colorResult = getCachedColor(sponsor.logoUrl)
  const styles = createColorStyles(colorResult, '#64748b')

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden border transition-all duration-300 hover:scale-[1.01] group cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: `${styles.primary}25`,
      }}
    >
      {/* Subtle hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${styles.primary}10 0%, transparent 70%)`,
        }}
      />

      {/* Content - Horizontal layout */}
      <div className="relative flex items-center gap-2.5 p-2.5">
        {/* Logo container */}
        {sponsor.logoUrl && (
          <div
            className="w-[70px] h-[40px] sm:w-[80px] sm:h-[45px] rounded-md flex-shrink-0 relative overflow-hidden border transition-all duration-300 flex items-center justify-center"
            style={{
              background: `${styles.primary}08`,
              borderColor: `${styles.primary}20`,
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 100, 56)}
              alt={sponsor.name}
              width={80}
              height={45}
              className="object-contain p-1 max-w-full max-h-full"
              loading="lazy"
            />
          </div>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="text-xs sm:text-sm font-semibold text-white truncate mb-0.5 group-hover:text-white/90 transition-colors">
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p className="text-xs text-gray-400 line-clamp-1 group-hover:text-gray-300 transition-colors">
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

  const logoUrls = useMemo(() => {
    return (sponsorsData || []).map((s: Sponsor) => s.logoUrl).filter(Boolean) as string[]
  }, [sponsorsData])

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
        <div className="flex-1 min-w-0 px-2 sm:px-4 py-4 max-w-5xl mx-auto">
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Sponsor ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm bg-white/5 border-white/10 focus:border-white/20"
            />
          </div>

          {filteredSponsors.length === 0 ? (
            <div className="text-center py-12" style={{ minHeight: '200px' }}>
              <Heart className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Henüz sponsor bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-8" style={{ contain: 'layout', minHeight: '300px' }}>
              {/* MAIN Sponsors */}
              {mainSponsors.length > 0 && (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-red-400 animate-pulse" fill="currentColor" />
                    <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-300 via-red-400 to-red-500">
                      Ana Sponsor
                    </h2>
                    <Sparkles className="w-5 h-5 text-red-400 animate-pulse" fill="currentColor" />
                  </div>

                  <div className={`grid gap-4 ${getGridClass(mainSponsors.length, 'main', !!hasBanners)}`}>
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
                <div>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-yellow-400" fill="currentColor" />
                    <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500">
                      VIP Sponsorlar
                    </h2>
                    <Crown className="w-4 h-4 text-yellow-400" fill="currentColor" />
                  </div>

                  <div className={`grid gap-3 ${getGridClass(vipSponsors.length, 'vip', !!hasBanners)}`}>
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

                  <div className={`grid gap-2.5 ${getGridClass(normalSponsors.length, 'normal', !!hasBanners)}`}>
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
