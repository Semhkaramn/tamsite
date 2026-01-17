import { NextResponse } from 'next/server'
import { handleStartCommand } from '../commands/start-command'
import { handleMeCommand } from '../commands/me-command'
import { handleRollCommand } from './roll-handler'

/**
 * Komut handler (/ ile başlayan mesajlar)
 *
 * 🚀 ULTRA OPTIMIZATION:
 * - Activity group kontrolü WEBHOOK'ta yapılıyor (burada YOK)
 * - Filter sistemi KALDIRILDI
 *
 * @param message Telegram message objesi
 */
export async function handleCommand(message: any) {
  const text = message.text.trim()
  const command = text.split(' ')[0].toLowerCase()

  switch (command) {
    case '/start':
      return await handleStartCommand(message)

    // .me, !me, /me - kullanıcı istatistikleri
    case '.ben':
    case '!ben':
    case '/ben':
      return await handleMeCommand(message)

    // Roll komutları için roll handler'ı kullan
    case 'roll':
    case 'liste':
      return await handleRollCommand(message)

    default:
      // Bilinmeyen komut - sessiz kal
      return NextResponse.json({ ok: true })
  }
}
