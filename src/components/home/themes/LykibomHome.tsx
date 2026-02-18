'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useSponsors } from '@/lib/hooks/useSponsors'
import { optimizeCloudinaryImage, ensureAbsoluteUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Heart, Crown, Sparkles, Search, Star } from 'lucide-react'
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

// ==================== MAIN SPONSOR CARD (HORIZONTAL - BEST EFFECTS) ====================
function MainSponsorCard({ sponsor, onClick, index, color }: {
  sponsor: Sponsor
  onClick: (e: React.MouseEvent) => void
  index: number
  color: string
}) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Outer glow */}
      <div
        className="absolute -inset-2 rounded-3xl opacity-60 blur-2xl transition-all duration-500 group-hover:opacity-100 group-hover:blur-3xl"
        style={{ background: `radial-gradient(ellipse at center, ${color}60, transparent 70%)` }}
      />

      {/* Rotating neon border container */}
      <div className="relative p-[3px] rounded-2xl overflow-hidden">
        {/* Animated rotating gradient border */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `conic-gradient(from var(--rotation), ${color}, transparent 30%, transparent 50%, ${color}, transparent 80%, transparent 100%)`,
            animation: 'rotateGradient 3s linear infinite',
          }}
        />
        {/* Secondary rotating glow (opposite direction) */}
        <div
          className="absolute inset-0 rounded-2xl opacity-50"
          style={{
            background: `conic-gradient(from calc(var(--rotation) + 180deg), transparent, ${color}80, transparent 40%, transparent 60%, ${color}80, transparent)`,
            animation: 'rotateGradient 3s linear infinite reverse',
          }}
        />

        {/* Inner card */}
        <div
          className="relative rounded-xl overflow-hidden transition-all duration-300 group-hover:scale-[1.01]"
          style={{
            background: `linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(10,10,20,0.9) 50%, rgba(0,0,0,0.95) 100%)`,
          }}
        >
          {/* Inner glow effects */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(ellipse at 30% 20%, ${color}40, transparent 50%), radial-gradient(ellipse at 70% 80%, ${color}30, transparent 50%)`
            }}
          />

          {/* Top highlight line */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}80, ${color}, ${color}80, transparent)`,
              boxShadow: `0 0 20px ${color}60, 0 0 40px ${color}30`
            }}
          />

          {/* Content - Horizontal Layout */}
          <div className="relative flex items-center gap-5 p-5 sm:p-6">
            {/* Logo container with glow */}
            {sponsor.logoUrl && (
              <div className="relative flex-shrink-0">
                {/* Logo glow */}
                <div
                  className="absolute inset-0 rounded-xl blur-lg opacity-50"
                  style={{ background: color }}
                />
                <div
                  className="relative w-[100px] h-[60px] sm:w-[130px] sm:h-[75px] rounded-xl flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `linear-gradient(145deg, ${color}25, ${color}10)`,
                    border: `2px solid ${color}50`,
                    boxShadow: `0 0 25px ${color}40, inset 0 0 15px ${color}15`
                  }}
                >
                  <Image
                    src={optimizeCloudinaryImage(sponsor.logoUrl, 160, 95)}
                    alt={sponsor.name}
                    width={130}
                    height={75}
                    className="object-contain p-2 max-w-full max-h-full"
                    priority={index === 0}
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
              </div>
            )}

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color, filter: `drop-shadow(0 0 8px ${color})` }}
                  fill="currentColor"
                />
                <h3
                  className="text-lg sm:text-xl md:text-2xl font-black truncate"
                  style={{
                    color: color,
                    textShadow: `0 0 20px ${color}90, 0 0 40px ${color}50, 0 0 60px ${color}30`
                  }}
                >
                  {sponsor.name}
                </h3>
                <Star
                  className="w-4 h-4 flex-shrink-0 animate-pulse"
                  style={{ color, filter: `drop-shadow(0 0 6px ${color})` }}
                  fill="currentColor"
                />
              </div>
              {sponsor.description && (
                <p className="text-sm sm:text-base text-gray-300 line-clamp-2 font-medium leading-relaxed">
                  {sponsor.description}
                </p>
              )}
            </div>

            {/* Side accent */}
            <div
              className="absolute right-0 top-1/4 bottom-1/4 w-[2px] rounded-full"
              style={{
                background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
                boxShadow: `0 0 10px ${color}80`
              }}
            />
          </div>

          {/* Bottom glow line */}
          <div
            className="absolute bottom-0 left-1/4 right-1/4 h-[1px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
              boxShadow: `0 0 15px ${color}40`
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ==================== VIP SPONSOR CARD (VERTICAL - MEDIUM EFFECTS) ====================
function VipSponsorCard({ sponsor, onClick, color }: {
  sponsor: Sponsor
  onClick: (e: React.MouseEvent) => void
  color: string
}) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer h-full"
    >
      {/* Outer glow */}
      <div
        className="absolute -inset-1 rounded-xl opacity-40 blur-xl transition-all duration-300 group-hover:opacity-70"
        style={{ background: color }}
      />

      {/* Rotating neon border container */}
      <div className="relative p-[2px] rounded-xl overflow-hidden h-full">
        {/* Animated rotating gradient border */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: `conic-gradient(from var(--rotation), ${color}90, transparent 25%, transparent 50%, ${color}90, transparent 75%, transparent 100%)`,
            animation: 'rotateGradient 4s linear infinite',
          }}
        />

        {/* Inner card - Vertical Layout */}
        <div
          className="relative rounded-lg overflow-hidden h-full transition-all duration-300 group-hover:scale-[1.02]"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(5,5,15,0.95) 100%)`,
          }}
        >
          {/* Crown badge */}
          <div
            className="absolute top-2 right-2 p-1.5 rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${color}30, ${color}10)`,
              border: `1px solid ${color}40`
            }}
          >
            <Crown className="w-3.5 h-3.5" style={{ color }} fill="currentColor" />
          </div>

          {/* Inner glow */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${color}50, transparent 60%)`
            }}
          />

          {/* Content - Vertical Layout */}
          <div className="relative flex flex-col items-center gap-3 p-4 sm:p-5">
            {/* Logo */}
            {sponsor.logoUrl && (
              <div
                className="w-[90px] h-[52px] sm:w-[100px] sm:h-[58px] rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: `linear-gradient(145deg, ${color}20, ${color}08)`,
                  border: `1px solid ${color}35`,
                  boxShadow: `0 0 15px ${color}25, inset 0 0 10px ${color}08`
                }}
              >
                <Image
                  src={optimizeCloudinaryImage(sponsor.logoUrl, 120, 70)}
                  alt={sponsor.name}
                  width={100}
                  height={58}
                  className="object-contain p-2 max-w-full max-h-full"
                  loading="lazy"
                />
              </div>
            )}

            {/* Text - Centered */}
            <div className="text-center w-full">
              <h3
                className="text-sm sm:text-base font-bold truncate mb-1"
                style={{
                  color,
                  textShadow: `0 0 15px ${color}70, 0 0 30px ${color}40`
                }}
              >
                {sponsor.name}
              </h3>
              {sponsor.description && (
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                  {sponsor.description}
                </p>
              )}
            </div>
          </div>

          {/* Bottom accent line */}
          <div
            className="absolute bottom-0 left-1/4 right-1/4 h-[1px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ==================== NORMAL SPONSOR CARD (VERTICAL - SUBTLE EFFECTS) ====================
function NormalSponsorCard({ sponsor, onClick, color }: {
  sponsor: Sponsor
  onClick: (e: React.MouseEvent) => void
  color: string
}) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer h-full"
    >
      {/* Subtle hover glow */}
      <div
        className="absolute -inset-0.5 rounded-lg opacity-0 blur-md transition-all duration-300 group-hover:opacity-40"
        style={{ background: color }}
      />

      {/* Border container with subtle rotating effect on hover */}
      <div className="relative p-[1px] rounded-lg overflow-hidden h-full">
        {/* Rotating border - visible on hover */}
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `conic-gradient(from var(--rotation), ${color}60, transparent 20%, transparent 50%, ${color}60, transparent 80%, transparent 100%)`,
            animation: 'rotateGradient 5s linear infinite',
          }}
        />
        {/* Static border */}
        <div
          className="absolute inset-0 rounded-lg group-hover:opacity-0 transition-opacity duration-300"
          style={{
            background: `${color}15`,
          }}
        />

        {/* Inner card - Vertical Layout */}
        <div
          className="relative rounded-md overflow-hidden h-full transition-all duration-300 group-hover:scale-[1.01]"
          style={{
            background: 'rgba(0,0,0,0.85)',
          }}
        >
          {/* Content - Vertical Layout */}
          <div className="relative flex flex-col items-center gap-2.5 p-3 sm:p-4">
            {/* Logo */}
            {sponsor.logoUrl && (
              <div
                className="w-[75px] h-[44px] sm:w-[85px] sm:h-[50px] rounded flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: `${color}08`,
                  border: `1px solid ${color}15`,
                }}
              >
                <Image
                  src={optimizeCloudinaryImage(sponsor.logoUrl, 100, 60)}
                  alt={sponsor.name}
                  width={85}
                  height={50}
                  className="object-contain p-1.5 max-w-full max-h-full"
                  loading="lazy"
                />
              </div>
            )}

            {/* Text - Centered */}
            <div className="text-center w-full">
              <h3
                className="text-xs sm:text-sm font-semibold truncate mb-0.5 transition-colors duration-300"
                style={{ color: 'white' }}
              >
                <span className="group-hover:hidden">{sponsor.name}</span>
                <span
                  className="hidden group-hover:inline"
                  style={{
                    color,
                    textShadow: `0 0 10px ${color}50`
                  }}
                >
                  {sponsor.name}
                </span>
              </h3>
              {sponsor.description && (
                <p className="text-xs text-gray-500 line-clamp-1 group-hover:text-gray-400 transition-colors">
                  {sponsor.description}
                </p>
              )}
            </div>
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

  // Renkler hazır olduğunda state'i güncelle ve event dispatch et
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

        // Tüm renkler yüklendi mi kontrol et
        if (newColors.size >= logoUrls.length) {
          setColorsReady(true)
          // GlobalPreloader'a bildir
          window.dispatchEvent(new CustomEvent('sponsorColorsReady'))
        }
      }
    } else if (logoUrls.length === 0 && sponsorsData && !loadingSponsors) {
      // Hiç sponsor yoksa da ready say
      setColorsReady(true)
      window.dispatchEvent(new CustomEvent('sponsorColorsReady'))
    }
  }, [colorMap, logoUrls, sponsorsData, loadingSponsors])

  // Sponsor için renk al - fallback ile
  const getColorForSponsor = useCallback((sponsor: Sponsor, fallback: string): string => {
    const cachedColor = sponsorColors.get(sponsor.id)
    if (cachedColor) return cachedColor

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

  return (
    <div className="min-h-screen pb-8 overflow-x-hidden max-w-full">
      <HomePopup />

      {/* Global styles for rotating neon border animation */}
      <style jsx global>{`
        @property --rotation {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        @keyframes rotateGradient {
          0% {
            --rotation: 0deg;
          }
          100% {
            --rotation: 360deg;
          }
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
            <div className="space-y-12">
              {/* MAIN Sponsors - Horizontal Layout */}
              {mainSponsors.length > 0 && (
                <div>
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <Sparkles className="w-5 h-5 text-rose-400" fill="currentColor" style={{ filter: 'drop-shadow(0 0 8px #f43f5e)' }} />
                    <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-rose-400 to-rose-500">
                      Ana Sponsor
                    </h2>
                    <Sparkles className="w-5 h-5 text-rose-400" fill="currentColor" style={{ filter: 'drop-shadow(0 0 8px #f43f5e)' }} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              {/* VIP Sponsors - Vertical Grid (3 columns desktop, 2 mobile) */}
              {vipSponsors.length > 0 && (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <Crown className="w-5 h-5 text-amber-400" fill="currentColor" style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }} />
                    <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500">
                      VIP Sponsorlar
                    </h2>
                    <Crown className="w-5 h-5 text-amber-400" fill="currentColor" style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              {/* Normal Sponsors - Vertical Grid (4 columns desktop, 3 mobile) */}
              {normalSponsors.length > 0 && (
                <div>
                  {(mainSponsors.length > 0 || vipSponsors.length > 0) && (
                    <h2 className="text-base sm:text-lg font-semibold text-gray-300 mb-5 flex items-center justify-center gap-2">
                      <Heart className="w-4 h-4 text-gray-500" />
                      Sponsorlar
                    </h2>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
