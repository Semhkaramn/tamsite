'use client'
import { useEffect, useState, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { SITE_CONFIG } from '@/lib/site-config'
import { getActiveTheme } from '@/config/themes'

/**
 * Global Preloader - Sadece ilk site yüklemesinde gösterilir
 *
 * - Admin sayfalarında gösterilmez
 * - Session boyunca sadece 1 kez gösterilir
 * - Logo animasyonlu splash screen
 * - Sponsor renklerinin yüklenmesini bekler
 */
export default function GlobalPreloader() {
  const [isLoading, setIsLoading] = useState(true)
  const [shouldShow, setShouldShow] = useState(true)
  const [colorsReady, setColorsReady] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const pathname = usePathname()
  const theme = getActiveTheme()

  // Minimum süre ve maksimum bekleme süresi
  const MINIMUM_LOADING_TIME = 800 // 0.8 saniye minimum
  const MAX_WAIT_TIME = 5000 // 5 saniye maksimum bekleme

  useLayoutEffect(() => {
    // Admin sayfalarında preloader gösterme
    if (pathname?.startsWith('/admin')) {
      setIsLoading(false)
      setShouldShow(false)
      return
    }

    // Session'da daha önce yüklendi mi kontrol et
    try {
      const hasLoaded = sessionStorage.getItem('site_preloader_shown')
      if (hasLoaded) {
        setIsLoading(false)
        setShouldShow(false)
        return
      }
    } catch {
      setIsLoading(false)
      setShouldShow(false)
      return
    }

    const startTime = Date.now()

    // Sayfa yüklenme durumu
    const checkPageReady = () => {
      if (document.readyState === 'complete') {
        setPageReady(true)
      }
    }

    checkPageReady()
    window.addEventListener('load', () => setPageReady(true))

    // Renklerin hazır olduğunu dinle
    const handleColorsReady = () => {
      setColorsReady(true)
    }

    window.addEventListener('sponsorColorsReady', handleColorsReady)

    // Progress animasyonu
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const elapsed = Date.now() - startTime
        const baseProgress = Math.min((elapsed / MAX_WAIT_TIME) * 100, 95)
        return Math.max(prev, baseProgress)
      })
    }, 100)

    // Maksimum bekleme süresi timeout
    const maxWaitTimeout = setTimeout(() => {
      setColorsReady(true) // Zorla hazır say
      setPageReady(true)
    }, MAX_WAIT_TIME)

    return () => {
      window.removeEventListener('load', () => setPageReady(true))
      window.removeEventListener('sponsorColorsReady', handleColorsReady)
      clearInterval(progressInterval)
      clearTimeout(maxWaitTimeout)
    }
  }, [pathname])

  // Hem sayfa hem renkler hazır olduğunda loading'i kapat
  useEffect(() => {
    if (!shouldShow) return

    if (colorsReady && pageReady) {
      setProgress(100)

      // Minimum süre kontrolü
      const hideTimer = setTimeout(() => {
        setIsLoading(false)
        try {
          sessionStorage.setItem('site_preloader_shown', 'true')
        } catch {
          // Ignore
        }
      }, MINIMUM_LOADING_TIME)

      return () => clearTimeout(hideTimer)
    }
  }, [colorsReady, pageReady, shouldShow])

  // Admin sayfası veya daha önce gösterildi
  if (!shouldShow || !isLoading) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.backgroundSecondary} 50%, ${theme.colors.background} 100%)`,
        opacity: isLoading ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
        pointerEvents: isLoading ? 'auto' : 'none'
      }}
    >
      {/* Animated background glow effects */}
      <div
        className="absolute w-[500px] h-[500px] md:w-[600px] md:h-[600px] rounded-full blur-[100px] animate-pulse"
        style={{
          backgroundColor: `${theme.colors.primary}15`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />

      {/* Secondary glow */}
      <div
        className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full blur-[80px] opacity-50"
        style={{
          backgroundColor: `${theme.colors.accent || theme.colors.primary}20`,
          top: '45%',
          left: '55%',
          transform: 'translate(-50%, -50%)',
          animation: 'pulse 2s ease-in-out infinite alternate'
        }}
      />

      {/* Rotating neon ring */}
      <div
        className="absolute w-[280px] h-[280px] md:w-[360px] md:h-[360px] rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent, ${theme.colors.primary}, transparent, ${theme.colors.primary}, transparent)`,
          opacity: 0.2,
          animation: 'spin 4s linear infinite'
        }}
      />

      {/* Logo Container */}
      <div className="relative flex flex-col items-center gap-6 md:gap-8">
        {/* Logo with scale and glow animation */}
        <div
          className="relative w-28 h-28 md:w-40 md:h-40"
          style={{
            animation: 'logoFloat 2s ease-in-out infinite'
          }}
        >
          {/* Logo glow effect */}
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-60"
            style={{
              backgroundColor: theme.colors.primary,
              transform: 'scale(1.2)',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}
          />

          {/* Logo image */}
          <Image
            src={SITE_CONFIG.siteLogo}
            alt="Logo"
            fill
            className="object-contain drop-shadow-2xl relative z-10"
            priority
            sizes="(max-width: 768px) 112px, 160px"
          />
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-4">
          {/* Progress bar */}
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.accent || theme.colors.primary})`
              }}
            />
          </div>

          {/* Loading text */}
          <div className="flex items-center gap-2">
            <p
              className="text-sm md:text-base font-medium tracking-wide"
              style={{ color: theme.colors.textSecondary }}
            >
              {progress < 50 ? 'Renkler yükleniyor...' : progress < 90 ? 'Hazırlanıyor...' : 'Tamamlanıyor...'}
            </p>
            {/* Animated dots */}
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: theme.colors.primary,
                    animation: `dotBounce 1.2s ease-in-out ${i * 0.15}s infinite`
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes logoFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes dotBounce {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
