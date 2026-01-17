'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { SITE_CONFIG } from '@/lib/site-config'
import { getActiveTheme } from '@/config/themes'

export default function GlobalPreloader() {
  const [isLoading, setIsLoading] = useState(true)
  const theme = getActiveTheme()

  // Loading ekranı için minimum süre (milisaniye)
  const MINIMUM_LOADING_TIME = 2500 // 2.5 saniye

  useEffect(() => {
    const startTime = Date.now()

    const hidePreloader = () => {
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME - elapsedTime)

      // Minimum süre dolana kadar bekle, sonra kapat
      setTimeout(() => {
        setIsLoading(false)
      }, remainingTime)
    }

    // DOM hazır olduğunda süreyi kontrol et ve kapat
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      hidePreloader()
    } else {
      document.addEventListener('DOMContentLoaded', hidePreloader)
    }

    // Fallback: maksimum 5 saniye sonra zorla kapat (hata durumunda)
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false)
    }, 5000)

    return () => {
      document.removeEventListener('DOMContentLoaded', hidePreloader)
      clearTimeout(fallbackTimer)
    }
  }, [])

  if (!isLoading) return null

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        background: `linear-gradient(to bottom right, ${theme.colors.background}, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
        opacity: isLoading ? 1 : 0,
        transition: 'opacity 0.3s ease-out',
        pointerEvents: isLoading ? 'auto' : 'none'
      }}
    >
      {/* Subtle background glow - centered */}
      <div
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{
          backgroundColor: `${theme.colors.primary}20`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />

      {/* Logo with heartbeat animation - ALWAYS centered */}
      <div
        className="absolute"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="w-32 h-32 relative animate-pulse">
          <Image
            src={SITE_CONFIG.siteLogo}
            alt="Logo"
            fill
            className="object-contain drop-shadow-2xl"
            priority
            sizes="128px"
          />
        </div>
      </div>
    </div>
  )
}
