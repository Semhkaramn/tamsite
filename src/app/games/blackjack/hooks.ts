'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Sound System Hook
export function useSoundEffects(enabled: boolean) {
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const audioContextRef = useRef<AudioContext | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    if (typeof window !== 'undefined') {
      audioRefs.current = {
        cardDeal: new Audio('/sounds/card-deal.mp3'),
        cardFlip: new Audio('/sounds/card-flip.mp3'),
        chip: new Audio('/sounds/chip.mp3'),
        win: new Audio('/sounds/win.mp3'),
        lose: new Audio('/sounds/lose.mp3')
      }

      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.preload = 'auto'
          audio.volume = 0.5
        }
      })
    }

    return () => {
      isMountedRef.current = false
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause()
          audio.src = ''
        }
      })
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const playClickSound = useCallback(() => {
    if (!isMountedRef.current) return
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioContextRef.current

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05)

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.05)
    } catch (e) {
      console.warn('Click sound not supported:', e)
    }
  }, [])

  const playSound = useCallback((type: 'card' | 'cardFlip' | 'chip' | 'win' | 'lose' | 'blackjack' | 'click') => {
    if (!enabled || !isMountedRef.current) return

    try {
      if (type === 'click') {
        playClickSound()
        return
      }

      let audio: HTMLAudioElement | null = null

      switch (type) {
        case 'card':
          audio = audioRefs.current.cardDeal
          break
        case 'cardFlip':
          audio = audioRefs.current.cardFlip
          break
        case 'chip':
          audio = audioRefs.current.chip
          break
        case 'win':
        case 'blackjack':
          audio = audioRefs.current.win
          break
        case 'lose':
          audio = audioRefs.current.lose
          break
      }

      if (audio) {
        const clone = audio.cloneNode() as HTMLAudioElement
        clone.volume = 0.5
        clone.play().catch(() => {})
        clone.onended = () => {
          clone.src = ''
        }
      }
    } catch (e) {
      console.warn('Audio not supported:', e)
    }
  }, [enabled, playClickSound])

  return { playSound }
}

// Oyun kilidi hook'u - Aynı oyun için çoklu istek engelleme
export function useGameLock() {
  // Tamamlanmış oyunların ID'lerini takip et
  const completedGamesRef = useRef<Set<string>>(new Set())
  // Şu an işlenen oyun ID'leri
  const processingGamesRef = useRef<Set<string>>(new Set())
  // Request ID'leri (aynı isteğin tekrarını engelle)
  const pendingRequestsRef = useRef<Map<string, Promise<Response>>>(new Map())

  // Oyun tamamlandı mı kontrol et
  const isGameCompleted = useCallback((gameId: string): boolean => {
    return completedGamesRef.current.has(gameId)
  }, [])

  // Oyun işleniyor mu kontrol et
  const isGameProcessing = useCallback((gameId: string): boolean => {
    return processingGamesRef.current.has(gameId)
  }, [])

  // Oyunu tamamlandı olarak işaretle
  const markGameCompleted = useCallback((gameId: string) => {
    completedGamesRef.current.add(gameId)
    processingGamesRef.current.delete(gameId)
  }, [])

  // Oyunu işleniyor olarak işaretle
  const markGameProcessing = useCallback((gameId: string): boolean => {
    // Zaten tamamlanmışsa false dön
    if (completedGamesRef.current.has(gameId)) {
      console.log(`[GameLock] Oyun zaten tamamlanmış: ${gameId}`)
      return false
    }
    // Zaten işleniyorsa false dön
    if (processingGamesRef.current.has(gameId)) {
      console.log(`[GameLock] Oyun zaten işleniyor: ${gameId}`)
      return false
    }
    processingGamesRef.current.add(gameId)
    return true
  }, [])

  // İşleme başarısız oldu, kilidi kaldır
  const clearGameProcessing = useCallback((gameId: string) => {
    processingGamesRef.current.delete(gameId)
  }, [])

  // Tüm kilitleri temizle (yeni oyun başlarken)
  const resetLocks = useCallback(() => {
    completedGamesRef.current.clear()
    processingGamesRef.current.clear()
    pendingRequestsRef.current.clear()
  }, [])

  // Dedupe edilmiş fetch - Aynı istek için tek bir promise döner
  const dedupedFetch = useCallback(async (
    requestKey: string,
    url: string,
    options: RequestInit
  ): Promise<Response> => {
    // Aynı istek zaten pending mi?
    const pendingRequest = pendingRequestsRef.current.get(requestKey)
    if (pendingRequest) {
      console.log(`[GameLock] Aynı istek zaten pending: ${requestKey}`)
      return pendingRequest
    }

    // Yeni istek oluştur
    const fetchPromise = fetch(url, options).finally(() => {
      pendingRequestsRef.current.delete(requestKey)
    })

    pendingRequestsRef.current.set(requestKey, fetchPromise)
    return fetchPromise
  }, [])

  return {
    isGameCompleted,
    isGameProcessing,
    markGameCompleted,
    markGameProcessing,
    clearGameProcessing,
    resetLocks,
    dedupedFetch
  }
}

// Timer management hook
export function useTimerManager() {
  const isMountedRef = useRef(true)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      timersRef.current.forEach(timer => clearTimeout(timer))
      timersRef.current = []
    }
  }, [])

  const addTimer = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        callback()
      }
      // Timer tamamlandıktan sonra array'den çıkar
      timersRef.current = timersRef.current.filter(t => t !== timer)
    }, delay)
    timersRef.current.push(timer)
    return timer
  }, [])

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer))
    timersRef.current = []
  }, [])

  return { addTimer, clearAllTimers, isMounted: () => isMountedRef.current }
}
