'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useSponsors } from '@/lib/hooks/useSponsors'
import { optimizeCloudinaryImage, ensureAbsoluteUrl } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Heart, Crown, Sparkles, Search, Star, Gem } from 'lucide-react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import HomePopup from '@/components/HomePopup'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { usePreloadedSponsorColors, getCachedColor, createColorStyles } from '@/lib/hooks/useDominantColor'

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

interface SponsorCardProps {
  sponsor: Sponsor
  onClick: (e: React.MouseEvent, sponsorId: string, websiteUrl?: string) => void
  index?: number
}

// ============================================
// LYKIBOM SPONSOR KARTLARI - Logo Rengi Bazlı
// ============================================

// Normal Sponsor Card
function NormalSponsorCard({ sponsor, onClick }: SponsorCardProps) {
  const { theme } = useUserTheme()
  const cachedColor = getCachedColor(sponsor.logoUrl)
  const colorStyles = createColorStyles(cachedColor, theme.colors.primary)

  return (
    <Card
      onClick={(e) => onClick(e, sponsor.id, sponsor.websiteUrl)}
      className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group cursor-pointer h-full flex flex-col"
      style={{
        background: `linear-gradient(145deg, ${colorStyles.primary}12, ${colorStyles.primary}06)`,
        borderWidth: 1,
        borderColor: `${colorStyles.primary}40`,
      }}
    >
      {/* Üst accent çizgisi */}
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: `linear-gradient(to right, transparent, ${colorStyles.primary}, transparent)` }}
      />

      <div className="flex flex-col items-center p-3 sm:p-4 flex-1">
        {/* Logo */}
        {sponsor.logoUrl && (
          <div
            className="w-20 h-10 sm:w-24 sm:h-12 md:w-28 md:h-14 rounded-lg flex-shrink-0 relative overflow-hidden mb-2 sm:mb-3 transition-transform group-hover:scale-105"
            style={{
              background: theme.colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: `${colorStyles.primary}30`
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 160, 80)}
              alt={sponsor.name}
              width={112}
              height={56}
              className="object-contain p-1.5 w-full h-full"
              loading="lazy"
            />
          </div>
        )}

        {/* İçerik */}
        <div className="flex-1 flex flex-col justify-center items-center text-center w-full min-h-0">
          <h3
            className="text-sm sm:text-base font-bold mb-1 break-words w-full leading-tight line-clamp-2"
            style={{ color: colorStyles.primary }}
          >
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p
              className="leading-snug text-xs whitespace-pre-line break-words w-full line-clamp-3 flex-1"
              style={{ color: theme.colors.textSecondary }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// VIP Sponsor Card
function VIPSponsorCard({ sponsor, onClick }: SponsorCardProps) {
  const { theme } = useUserTheme()
  const cachedColor = getCachedColor(sponsor.logoUrl)
  const colorStyles = createColorStyles(cachedColor, theme.colors.warning)

  return (
    <Card
      onClick={(e) => onClick(e, sponsor.id, sponsor.websiteUrl)}
      className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group cursor-pointer h-full flex flex-col"
      style={{
        background: `linear-gradient(145deg, ${colorStyles.primary}18, ${colorStyles.primary}08)`,
        borderWidth: 2,
        borderColor: `${colorStyles.primary}50`
      }}
    >
      {/* Üst accent çizgisi */}
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: `linear-gradient(to right, transparent, ${colorStyles.primary}, transparent)` }}
      />

      {/* Crown ikonu */}
      <div className="absolute top-2 right-2">
        <Crown className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: colorStyles.primary }} fill="currentColor" />
      </div>

      <div className="flex flex-col items-center p-3 sm:p-4 flex-1">
        {/* Logo */}
        {sponsor.logoUrl && (
          <div
            className="w-24 h-12 sm:w-28 sm:h-14 md:w-32 md:h-16 rounded-xl flex-shrink-0 relative overflow-hidden mb-2 sm:mb-3 transition-transform group-hover:scale-105"
            style={{
              background: theme.colors.backgroundSecondary,
              borderWidth: 2,
              borderColor: `${colorStyles.primary}40`
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 192, 96)}
              alt={sponsor.name}
              width={128}
              height={64}
              className="object-contain p-1.5 w-full h-full"
              loading="lazy"
            />
          </div>
        )}

        {/* İçerik */}
        <div className="flex-1 flex flex-col justify-center items-center text-center w-full min-h-0">
          <h3
            className="text-sm sm:text-base md:text-lg font-bold mb-1 break-words w-full leading-tight line-clamp-2"
            style={{ color: colorStyles.primary }}
          >
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p
              className="leading-snug text-xs sm:text-sm whitespace-pre-line break-words w-full line-clamp-3 flex-1"
              style={{ color: theme.colors.textSecondary }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// Main Sponsor Card - En önemli sponsorlar
function MainSponsorCard({ sponsor, onClick, index = 0 }: SponsorCardProps) {
  const { theme } = useUserTheme()
  const cachedColor = getCachedColor(sponsor.logoUrl)
  const colorStyles = createColorStyles(cachedColor, theme.colors.error)

  return (
    <Card
      onClick={(e) => onClick(e, sponsor.id, sponsor.websiteUrl)}
      className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group cursor-pointer h-full flex flex-col"
      style={{
        background: `linear-gradient(145deg, ${colorStyles.primary}20, ${colorStyles.primary}10)`,
        borderWidth: 2,
        borderColor: `${colorStyles.primary}60`,
        boxShadow: `0 4px 16px ${colorStyles.primary}15`
      }}
    >
      {/* Üst parıltı efekti */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(to right, transparent, ${colorStyles.primary}, transparent)` }}
      />

      {/* Sparkles ikonu */}
      <div className="absolute top-2 right-2">
        <Gem className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colorStyles.primary }} fill="currentColor" />
      </div>

      <div className="flex flex-col items-center p-4 sm:p-5 flex-1">
        {/* Logo */}
        {sponsor.logoUrl && (
          <div
            className="w-28 h-14 sm:w-32 sm:h-16 md:w-36 md:h-18 rounded-xl relative overflow-hidden mb-3 sm:mb-4 transition-transform group-hover:scale-105"
            style={{
              background: theme.colors.backgroundSecondary,
              borderWidth: 2,
              borderColor: `${colorStyles.primary}50`,
              boxShadow: `0 4px 12px ${colorStyles.primary}20`
            }}
          >
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 216, 108)}
              alt={sponsor.name}
              width={144}
              height={72}
              className="object-contain p-2 w-full h-full"
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
            />
          </div>
        )}

        {/* İçerik */}
        <div className="flex-1 flex flex-col justify-center items-center text-center w-full min-h-0">
          <h3
            className="text-base sm:text-lg md:text-xl font-black mb-2 break-words w-full leading-tight line-clamp-2"
            style={{ color: colorStyles.primary }}
          >
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p
              className="leading-relaxed font-medium text-xs sm:text-sm whitespace-pre-line break-words w-full line-clamp-4 flex-1"
              style={{ color: theme.colors.textSecondary }}
            >
              {sponsor.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// ============================================
// BANNER VE API FONKSİYONLARI
// ============================================

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

// ============================================
// ANA SAYFA BİLEŞENİ
// ============================================

export default function LykibomHome() {
  const { user } = useAuth()
  const { theme } = useUserTheme()
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

  // Tüm sponsor logo URL'lerini topla
  const sponsorLogoUrls = useMemo(() => {
    if (!sponsorsData) return []
    return sponsorsData.map((s: Sponsor) => s.logoUrl).filter((url): url is string => !!url)
  }, [sponsorsData])

  // Tüm sponsor renklerini önceden yükle
  const { isReady: colorsReady } = usePreloadedSponsorColors(sponsorLogoUrls)

  // Sponsorlar ve renkler hazır olduğunda contentReady event'i gönder
  useEffect(() => {
    if (!loadingSponsors && sponsorsData && colorsReady) {
      window.dispatchEvent(new CustomEvent('contentReady'))
    }
  }, [loadingSponsors, sponsorsData, colorsReady])

  const sponsors = sponsorsData || []

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

  // Sponsorlar veya renkler yüklenmediyse boş div döndür (preloader gösterilecek)
  if (loadingSponsors || !sponsorsData || !colorsReady) {
    return <div className="min-h-screen" style={{ contain: 'layout' }} />
  }

  const filteredSponsors = sponsors.filter((s: Sponsor) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sıralama: Main > VIP > Normal
  const mainSponsors = filteredSponsors.filter((s: Sponsor) => s.category === 'main')
  const vipSponsors = filteredSponsors.filter((s: Sponsor) => s.category === 'vip')
  const normalSponsors = filteredSponsors.filter((s: Sponsor) => s.category !== 'vip' && s.category !== 'main')

  const { leftBanner, leftSponsor, rightBanner, rightSponsor } = bannerConfig || {}

  // Banner varsa içerik alanı daraltılacak mı kontrol et
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
            <div
              className="sticky top-4 h-[calc(100vh-32px)] rounded-lg overflow-hidden shadow-2xl"
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                background: `linear-gradient(to bottom right, ${theme.colors.backgroundSecondary}50, ${theme.colors.backgroundSecondary}80)`
              }}
            >
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
        <div className="flex-1 min-w-0 px-2 sm:px-4 py-4">
          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.colors.textSecondary }} />
            <Input
              type="text"
              placeholder="Sponsor ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 sm:pl-10 h-9 sm:h-10 text-sm transition-all"
              style={{
                backgroundColor: `${theme.colors.backgroundSecondary}40`,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            />
          </div>

          {filteredSponsors.length === 0 ? (
            <div className="text-center py-12" style={{ minHeight: '200px' }}>
              <Heart className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" style={{ color: theme.colors.textMuted }} />
              <p style={{ color: theme.colors.textMuted }}>Henüz sponsor bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-6" style={{ contain: 'layout', minHeight: '400px' }}>
              {/* MAIN Sponsors */}
              {mainSponsors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Gem className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" style={{ color: theme.colors.primary }} fill="currentColor" />
                    <h2
                      className="text-lg sm:text-xl md:text-2xl font-black text-transparent bg-clip-text"
                      style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.primary}99, ${theme.colors.primary}, ${theme.colors.primary}CC)` }}
                    >
                      Ana Sponsorlar
                    </h2>
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" style={{ color: theme.colors.primary }} />
                  </div>

                  <div className={`grid gap-3 auto-rows-fr ${hasBanners ? 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                    {mainSponsors.map((sponsor, index) => (
                      <MainSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        onClick={visitSponsor}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* VIP Sponsors */}
              {vipSponsors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" style={{ color: theme.colors.primary }} fill="currentColor" />
                    <h2
                      className="text-base sm:text-lg md:text-xl font-bold text-transparent bg-clip-text"
                      style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.primary}99, ${theme.colors.primary})` }}
                    >
                      VIP Sponsorlar
                    </h2>
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" style={{ color: theme.colors.primary }} />
                  </div>

                  <div className={`grid gap-3 auto-rows-fr ${hasBanners ? 'grid-cols-2 2xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
                    {vipSponsors.map((sponsor, index) => (
                      <VIPSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        onClick={visitSponsor}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Normal Sponsors */}
              {normalSponsors.length > 0 && (
                <div>
                  {(mainSponsors.length > 0 || vipSponsors.length > 0) && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Heart className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.colors.primary }} />
                      <h2 className="text-base sm:text-lg font-bold" style={{ color: theme.colors.primary }}>
                        Sponsorlar
                      </h2>
                    </div>
                  )}

                  <div className={`grid gap-3 auto-rows-fr ${hasBanners ? 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
                    {normalSponsors.map((sponsor, index) => (
                      <NormalSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        onClick={visitSponsor}
                        index={index}
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
            <div
              className="sticky top-4 h-[calc(100vh-32px)] rounded-lg overflow-hidden shadow-2xl"
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                background: `linear-gradient(to bottom right, ${theme.colors.backgroundSecondary}50, ${theme.colors.backgroundSecondary}80)`
              }}
            >
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
