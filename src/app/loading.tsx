'use client'

import { getActiveTheme } from '@/config/themes'

/**
 * Sayfa Geçiş Loading - Sayfa geçişlerinde gösterilir
 * İlk yükleme için GlobalPreloader kullanılır, bu sadece sayfa arası geçişler için
 */
export default function Loading() {
  const theme = getActiveTheme()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Simple spinner */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 md:w-12 md:h-12 border-3 rounded-full animate-spin"
          style={{
            borderColor: `${theme.colors.border}`,
            borderTopColor: theme.colors.primary,
            borderWidth: '3px'
          }}
        />
        <p
          className="text-sm font-medium"
          style={{ color: theme.colors.textSecondary }}
        >
          Yükleniyor...
        </p>
      </div>
    </div>
  )
}
