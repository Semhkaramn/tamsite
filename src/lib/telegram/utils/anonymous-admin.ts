/**
 * 🔒 Anonymous Admin Utilities
 * Telegram'da anonim olarak mesaj gönderen adminleri tespit eder ve yönetir.
 *
 * Anonim admin durumu:
 * - message.from.id = 1087968824 (GroupAnonymousBot ID)
 * - message.sender_chat = grup/kanal bilgisi (gerçek gönderen)
 *
 * Kurallar:
 * - Anonim adminler veritabanına kaydedilmez
 * - Anonim adminler roll listesine eklenmez
 * - Anonim adminler puan kazanmaz
 * - Anonim adminler komut kullanabilir (admin yetkileriyle)
 */

// GroupAnonymousBot ID - Telegram tarafından kullanılır
export const GROUP_ANONYMOUS_BOT_ID = 1087968824

/**
 * Mesajın anonim bir admin tarafından gönderilip gönderilmediğini kontrol eder
 * @param message Telegram message objesi
 * @returns true = anonim admin, false = normal kullanıcı
 */
export function isAnonymousAdmin(message: any): boolean {
  // from.id GroupAnonymousBot ID'si mi?
  const fromId = message.from?.id
  if (fromId !== GROUP_ANONYMOUS_BOT_ID) {
    return false
  }

  // sender_chat varsa bu anonim admin mesajıdır
  return !!message.sender_chat
}

/**
 * Anonim admin mesajından grup/kanal ID'sini al
 * @param message Telegram message objesi
 * @returns sender_chat.id veya null
 */
export function getAnonymousAdminChatId(message: any): number | null {
  if (!isAnonymousAdmin(message)) {
    return null
  }
  return message.sender_chat?.id || null
}

/**
 * Anonim admin mesajından grup/kanal başlığını al
 * @param message Telegram message objesi
 * @returns sender_chat.title veya null
 */
export function getAnonymousAdminChatTitle(message: any): string | null {
  if (!isAnonymousAdmin(message)) {
    return null
  }
  return message.sender_chat?.title || null
}

/**
 * Anonim admin mesajından grup/kanal tipini al
 * @param message Telegram message objesi
 * @returns sender_chat.type veya null (group, supergroup, channel)
 */
export function getAnonymousAdminChatType(message: any): string | null {
  if (!isAnonymousAdmin(message)) {
    return null
  }
  return message.sender_chat?.type || null
}

/**
 * Mesaj anonim admin tarafından mı gönderildi ve admin komutlarını kullanabilir mi?
 * Anonim adminler grubun adminleri olduğu için otomatik olarak admin yetkisine sahiptir.
 *
 * @param message Telegram message objesi
 * @returns true = anonim admin, admin komutlarını kullanabilir
 */
export function canAnonymousAdminUseCommands(message: any): boolean {
  if (!isAnonymousAdmin(message)) {
    return false
  }

  // sender_chat.id ile chat.id eşleşmeli (aynı gruptan anonim admin)
  const senderChatId = message.sender_chat?.id
  const chatId = message.chat?.id

  if (!senderChatId || !chatId) {
    return false
  }

  // Mutlak değer karşılaştırması (- işareti farkını gidermek için)
  const normalizedSenderChatId = String(senderChatId).replace(/-/g, '')
  const normalizedChatId = String(chatId).replace(/-/g, '')

  return normalizedSenderChatId === normalizedChatId
}

/**
 * Mesaj göndereni belirle - anonim admin mi yoksa normal kullanıcı mı
 * @param message Telegram message objesi
 * @returns { isAnonymous: boolean, userId: string | null, displayName: string | null }
 */
export function getMessageSender(message: any): {
  isAnonymous: boolean
  userId: string | null
  displayName: string | null
  username: string | null
  firstName: string | null
  lastName: string | null
} {
  if (isAnonymousAdmin(message)) {
    // Anonim admin - gerçek kullanıcı bilgisi yok
    return {
      isAnonymous: true,
      userId: null, // Anonim adminlerin gerçek userId'si bilinmiyor
      displayName: message.sender_chat?.title || 'Anonim Admin',
      username: message.sender_chat?.username || null,
      firstName: null,
      lastName: null
    }
  }

  // Normal kullanıcı
  return {
    isAnonymous: false,
    userId: message.from?.id ? String(message.from.id) : null,
    displayName: message.from?.first_name || message.from?.username || 'Bilinmeyen',
    username: message.from?.username || null,
    firstName: message.from?.first_name || null,
    lastName: message.from?.last_name || null
  }
}
