// Roll Sistemi - Database Tabanlı (Sunucu Restart'a Dayanıklı)
// Mantık: Geçici kullanıcı yok, her zaman AKTİF bir adıma yazılır
// - "roll başlat" → Adım 1 oluştur ve aktif yap
// - Mesajlar → Aktif adıma kaydedilir
// - "roll adım" → Mevcut adımı kapat (artık aktif adım yok)
// - "roll devam" → Yeni adım aç ve aktif yap

import { prisma } from '@/lib/prisma'

// ========== CLEANUP THROTTLE ==========
// Her "liste" komutunda cleanup yapılmasını engeller (performans için)
const lastCleanupTime = new Map<string, number>()
const CLEANUP_THROTTLE_MS = 30 * 1000 // 30 saniye

type RollStatus = 'active' | 'paused' | 'stopped' | 'break' | 'locked'

interface RollState {
  status: RollStatus
  activeDuration: number
  currentStep: number
  previousStatus: 'active' | 'paused' | 'locked' | null
  groupId: string
}

// Step ve User için interface tanımları
interface RollStepUserData {
  name: string
  messageCount: number
  telegramUserId: string
}

interface RollStepData {
  id: string
  stepNumber: number
  isActive: boolean
  createdAt: Date
  users: RollStepUserData[]
}

// ========== TEMEL FONKSİYONLAR ==========

/**
 * Roll durumunu getir (database'den)
 */
export async function getRollState(groupId: string): Promise<RollState> {
  const session = await prisma.rollSession.findUnique({
    where: { groupId }
  })

  if (!session) {
    // Session yoksa default döndür (stopped durumda)
    return {
      status: 'stopped',
      activeDuration: 2,
      currentStep: 0,
      previousStatus: null,
      groupId
    }
  }

  return {
    status: session.status as RollStatus,
    activeDuration: session.activeDuration,
    currentStep: session.currentStep,
    previousStatus: session.previousStatus as 'active' | 'paused' | 'locked' | null,
    groupId
  }
}

/**
 * Roll başlat - Adım 1'i oluştur ve aktif yap
 * ✅ FIX: Transaction ile race condition önlendi
 */
export async function startRoll(groupId: string, duration: number): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Önce mevcut session'ı temizle (varsa)
      await tx.rollSession.deleteMany({ where: { groupId } })

      // Yeni session oluştur + Adım 1'i aynı anda oluştur
      await tx.rollSession.create({
        data: {
          groupId,
          status: 'active',
          activeDuration: Math.max(1, duration),
          currentStep: 1,
          previousStatus: null,
          steps: {
            create: {
              stepNumber: 1,
              isActive: true // Adım 1 otomatik aktif
            }
          }
        }
      })
    })

    console.log(`✅ Roll başlatıldı: Grup=${groupId}, Süre=${duration}dk, Adım 1 aktif`)
  } catch (error) {
    console.error(`❌ Roll başlatma hatası (Grup=${groupId}):`, error)
    throw error
  }
}

/**
 * Roll'u duraklat
 * ✅ FIX: locked ve break durumlarından da pause yapılabilir
 */
export async function pauseRoll(groupId: string): Promise<void> {
  const session = await prisma.rollSession.findUnique({ where: { groupId } })

  if (!session || session.status === 'stopped') {
    return
  }

  if (session.status === 'active') {
    // Active -> Paused
    await prisma.rollSession.update({
      where: { groupId },
      data: { status: 'paused' }
    })
  } else if (session.status === 'locked') {
    // Locked -> Paused (previousStatus temizlenir)
    await prisma.rollSession.update({
      where: { groupId },
      data: {
        status: 'paused',
        previousStatus: null
      }
    })
  } else if (session.status === 'break') {
    // ✅ FIX: Break -> Paused (previousStatus temizlenir)
    await prisma.rollSession.update({
      where: { groupId },
      data: {
        status: 'paused',
        previousStatus: null
      }
    })
  }
  // paused durumunda zaten paused - bir şey yapma
}

/**
 * Roll'u kilitle (yeni kullanıcı girişini kapat)
 * ✅ FIX: previousStatus sadece boşsa kaydedilir, üzerine yazılmaz
 */
export async function lockRoll(groupId: string): Promise<void> {
  const session = await prisma.rollSession.findUnique({ where: { groupId } })

  if (!session || session.status === 'stopped') {
    return
  }

  // Zaten locked ise bir şey yapma
  if (session.status === 'locked') {
    return
  }

  // Active, paused veya break durumundan kilitlenebilir
  if (session.status === 'active' || session.status === 'paused' || session.status === 'break') {
    // ✅ FIX: Eğer previousStatus zaten doluysa (örn: break durumunda active kaydedilmişse) üzerine yazma
    // Bu durumda orijinal durum korunur
    const newPreviousStatus = session.previousStatus || session.status

    await prisma.rollSession.update({
      where: { groupId },
      data: {
        previousStatus: newPreviousStatus,
        status: 'locked'
      }
    })
  }
}

/**
 * Roll kilidini aç
 * @returns Geri dönülen durum (active, paused, break) veya null
 */
export async function unlockRoll(groupId: string): Promise<RollStatus | null> {
  const session = await prisma.rollSession.findUnique({ where: { groupId } })

  if (!session || session.status !== 'locked') {
    return null
  }

  // Önceki duruma geri dön (active, paused veya break olabilir)
  const previousStatus = (session.previousStatus as RollStatus) || 'active'

  await prisma.rollSession.update({
    where: { groupId },
    data: {
      status: previousStatus,
      previousStatus: null // Temizle
    }
  })

  return previousStatus
}

/**
 * Mola başlat
 * ✅ FIX: locked durumundan break'e geçişte orijinal durum korunuyor
 * ✅ FIX: Zaten break durumundaysa bir şey yapma
 */
export async function startBreak(groupId: string): Promise<void> {
  const session = await prisma.rollSession.findUnique({ where: { groupId } })

  if (!session || session.status === 'stopped') {
    return
  }

  // ✅ FIX: Zaten break durumundaysa bir şey yapma
  if (session.status === 'break') {
    return
  }

  // Break'e geçiş için previousStatus belirleme
  let newPreviousStatus: string | null = null

  if (session.status === 'locked') {
    // Locked durumundayken break'e geçiliyorsa, orijinal durumu koru
    // Örn: active -> locked -> break olduğunda, previousStatus hala 'active' kalmalı
    newPreviousStatus = session.previousStatus || 'active'
  } else if (session.status === 'active' || session.status === 'paused') {
    // Normal durumlardan break'e geçiş
    newPreviousStatus = session.status
  }

  if (newPreviousStatus) {
    await prisma.rollSession.update({
      where: { groupId },
      data: {
        previousStatus: newPreviousStatus,
        status: 'break'
      }
    })

    // Tüm kullanıcıların lastActive zamanlarını şimdi yap (mola süresini saymasın)
    const now = new Date()
    await prisma.rollStepUser.updateMany({
      where: { step: { sessionId: session.id } },
      data: { lastActive: now }
    })
  }
}

/**
 * Molayı bitir / Devam et - Yeni adım oluştur ve aktif yap
 * ✅ FIX: Eski aktif adımlar kapatılıyor
 */
export async function resumeRoll(groupId: string): Promise<void> {
  const session = await prisma.rollSession.findUnique({ where: { groupId } })

  if (!session) return

  let newStatus: RollStatus = 'active'

  if (session.status === 'break') {
    // Mola bitişi - önceki duruma dön
    newStatus = (session.previousStatus as RollStatus) || 'active'

    // Break'ten çıkma - sadece status değişikliği
    await prisma.rollSession.update({
      where: { groupId },
      data: {
        status: newStatus,
        previousStatus: null
      }
    })

    // Tüm kullanıcıların lastActive zamanlarını şimdi yap (restart için)
    const now = new Date()
    await prisma.rollStepUser.updateMany({
      where: { step: { sessionId: session.id } },
      data: { lastActive: now }
    })
  } else if (session.status === 'paused') {
    // Duraklatılmıştan aktife geç - YENİ ADIM OLUŞTUR
    newStatus = 'active'

    // Yeni adım oluştur ve aktif yap
    const newStepNumber = session.currentStep + 1

    await prisma.$transaction(async (tx) => {
      // ✅ FIX: Önce tüm aktif adımları kapat
      await tx.rollStep.updateMany({
        where: {
          sessionId: session.id,
          isActive: true
        },
        data: { isActive: false }
      })

      // Yeni adım oluştur
      await tx.rollStep.create({
        data: {
          sessionId: session.id,
          stepNumber: newStepNumber,
          isActive: true
        }
      })

      await tx.rollSession.update({
        where: { id: session.id },
        data: {
          status: newStatus,
          currentStep: newStepNumber,
          previousStatus: null
        }
      })
    })

    // Tüm kullanıcıların lastActive zamanlarını şimdi yap (restart için)
    const now = new Date()
    await prisma.rollStepUser.updateMany({
      where: { step: { sessionId: session.id } },
      data: { lastActive: now }
    })

    console.log(`✅ Roll devam: Grup=${groupId}, Adım ${newStepNumber} aktif`)
  }
  // else: Zaten active, stopped veya locked - hiçbir şey yapma
}

/**
 * Roll'u durdur
 */
export async function stopRoll(groupId: string): Promise<void> {
  const session = await prisma.rollSession.findUnique({ where: { groupId } })

  if (!session) return

  await prisma.rollSession.update({
    where: { groupId },
    data: { status: 'stopped' }
  })
}

/**
 * Adım kaydet - Mevcut aktif adımı kapat (isActive=false)
 */
export async function saveStep(groupId: string): Promise<{ success: boolean; message: string; stepNumber: number }> {
  try {
    const session = await prisma.rollSession.findUnique({
      where: { groupId },
      include: {
        steps: {
          where: { isActive: true },
          include: { users: true }
        }
      }
    })

    if (!session || session.status === 'stopped') {
      return { success: false, message: '⚠️ Roll aktif değil.', stepNumber: 0 }
    }

    const activeStep = session.steps[0]
    if (!activeStep) {
      return { success: false, message: '⚠️ Aktif adım bulunamadı.', stepNumber: 0 }
    }

    // ACTIVE veya LOCKED durumunda temizlik yap (dk kuralına uymayanlar çıkarılır)
    if (session.status === 'active' || session.status === 'locked') {
      await cleanInactiveUsers(groupId)
    }

    // Temizlik sonrası kullanıcı sayısını tekrar kontrol et
    const userCount = await prisma.rollStepUser.count({
      where: { stepId: activeStep.id }
    })

    if (userCount === 0) {
      return { success: false, message: '📭 Kaydedilecek aktif kullanıcı yok.', stepNumber: 0 }
    }

    // Aktif adımı kapat (isActive=false) ve roll'u duraklat
    await prisma.$transaction(async (tx) => {
      await tx.rollStep.update({
        where: { id: activeStep.id },
        data: { isActive: false }
      })

      await tx.rollSession.update({
        where: { id: session.id },
        data: { status: 'paused' }
      })
    })

    return { success: true, message: '✅ Adım kaydedildi!', stepNumber: activeStep.stepNumber }
  } catch (error) {
    console.error(`❌ Adım kaydetme hatası (Grup=${groupId}):`, error)
    return { success: false, message: '❌ Adım kaydedilirken hata oluştu.', stepNumber: 0 }
  }
}

/**
 * Kullanıcı mesaj attığında izle - Aktif adıma kaydet
 */
export async function trackUserMessage(
  groupId: string,
  userId: string,
  username: string | null,
  firstName: string | null
): Promise<void> {
  const session = await prisma.rollSession.findUnique({
    where: { groupId },
    include: {
      steps: {
        where: { isActive: true }
      }
    }
  })

  if (!session) return

  // Sadece active veya locked durumunda izle
  if (session.status !== 'active' && session.status !== 'locked') return

  const activeStep = session.steps[0]
  if (!activeStep) {
    console.warn(`⚠️ Aktif adım bulunamadı (Grup=${groupId})`)
    return
  }

  const name = username ? `@${username}` : firstName || 'Kullanıcı'
  const now = new Date()

  // Locked durumunda: Sadece AKTİF ADIMDAKİ kullanıcılar mesaj atabilir
  if (session.status === 'locked') {
    // Kullanıcı AKTİF ADIMDA var mı? (herhangi bir adımda değil!)
    const existsInActiveStep = await prisma.rollStepUser.findUnique({
      where: {
        stepId_telegramUserId: {
          stepId: activeStep.id,
          telegramUserId: userId
        }
      }
    })

    if (!existsInActiveStep) {
      // Aktif adımda yok = yeni kullanıcı giremez
      return
    }

    // Aktif adımda var - sadece güncelle (mesaj sayısını artır)
    await prisma.rollStepUser.update({
      where: {
        stepId_telegramUserId: {
          stepId: activeStep.id,
          telegramUserId: userId
        }
      },
      data: {
        lastActive: now,
        messageCount: { increment: 1 },
        name
      }
    })
    return
  }

  // Active durumunda: Kullanıcı bu aktif adımda var mı kontrol et ve güncelle/ekle
  await prisma.rollStepUser.upsert({
    where: {
      stepId_telegramUserId: {
        stepId: activeStep.id,
        telegramUserId: userId
      }
    },
    update: {
      lastActive: now,
      messageCount: { increment: 1 },
      name
    },
    create: {
      stepId: activeStep.id,
      telegramUserId: userId,
      name,
      messageCount: 1,
      lastActive: now
    }
  })
}

/**
 * İnaktif kullanıcıları temizle
 * NOT: Tüm adımlardan inaktif kullanıcıları siler (kullanıcının istediği davranış)
 */
export async function cleanInactiveUsers(groupId: string): Promise<void> {
  const session = await prisma.rollSession.findUnique({
    where: { groupId }
  })

  if (!session) return

  const timeout = session.activeDuration * 60 * 1000 // Milisaniye
  const cutoffTime = new Date(Date.now() - timeout)

  // Adımlardan inaktif kullanıcıları sil
  await prisma.rollStepUser.deleteMany({
    where: {
      step: { sessionId: session.id },
      lastActive: { lt: cutoffTime }
    }
  })

  // Boş adımları sil (ama aktif adımı silme!)
  const emptySteps = await prisma.rollStep.findMany({
    where: {
      sessionId: session.id,
      isActive: false, // Sadece kapalı adımlardan
      users: { none: {} } // Hiç kullanıcısı olmayan
    },
    select: { id: true }
  })

  if (emptySteps.length > 0) {
    await prisma.rollStep.deleteMany({
      where: {
        id: { in: emptySteps.map(s => s.id) }
      }
    })
  }
}

/**
 * Tarihi formatla (Türkiye saati)
 */
function formatDate(date: Date): string {
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Kullanıcı adını formatlı döndür (username varsa @username, yoksa mention linki)
 */
function formatUserName(name: string, telegramUserId: string): string {
  // Eğer @ ile başlıyorsa username var, olduğu gibi göster
  if (name.startsWith('@')) {
    return name
  }
  // Username yoksa mention linki oluştur (HTML formatında)
  return `<a href="tg://user?id=${telegramUserId}">${name}</a>`
}

/**
 * Sıralı liste formatla (mesaj sayısına göre)
 */
function formatRankedList(users: RollStepUserData[], showStep?: number, stepDate?: Date): string {
  if (users.length === 0) {
    return '📭 Kullanıcı yok.'
  }

  const sorted = users.sort((a, b) => b.messageCount - a.messageCount)

  let header = ''
  if (showStep) {
    const dateStr = stepDate ? ` (${formatDate(stepDate)})` : ''
    header = `📍 Adım ${showStep}${dateStr}\n`
  }

  return header + sorted.map(u => `✅ ${formatUserName(u.name, u.telegramUserId)} • ${u.messageCount} ✉️`).join('\n')
}

/**
 * Roll durumunu göster (liste komutu için)
 * ✅ FIX: Proper typing, as any kaldırıldı
 */
export async function getStatusList(groupId: string): Promise<string> {
  let session = await prisma.rollSession.findUnique({
    where: { groupId },
    include: {
      steps: {
        include: {
          users: true
        },
        orderBy: {
          stepNumber: 'asc'
        }
      }
    }
  })

  if (!session) {
    return '📌 Roll şu anda aktif değil.'
  }

  // Roll bitmiş ama veriler duruyor - tarihi göster
  if (session.status === 'stopped') {
    if (session.steps.length === 0) {
      return '📌 Roll şu anda aktif değil.'
    }

    // Son roll verilerini göster
    const msgParts = [`🏁 Son Roll (${formatDate(session.createdAt)})\n`]

    for (const step of session.steps) {
      const stepUsers: RollStepUserData[] = step.users.map(u => ({
        name: u.name,
        messageCount: u.messageCount,
        telegramUserId: u.telegramUserId
      }))
      const stepList = formatRankedList(stepUsers, step.stepNumber, step.createdAt)
      msgParts.push(`\n${stepList}`)
    }

    return msgParts.join('')
  }

  // ACTIVE veya LOCKED durumunda temizlik yap (throttled - performans için)
  // Locked'da da dk kuralına uymayanlar çıkmalı
  if (session.status === 'active' || session.status === 'locked') {
    const now = Date.now()
    const lastCleanup = lastCleanupTime.get(groupId) || 0

    // Son cleanup'tan 30 saniye geçtiyse temizlik yap
    if (now - lastCleanup >= CLEANUP_THROTTLE_MS) {
      await cleanInactiveUsers(groupId)
      lastCleanupTime.set(groupId, now)

      // ✅ FIX: Tekrar çek (fresh query) - yeni değişkene ata
      const updatedSession = await prisma.rollSession.findUnique({
        where: { groupId },
        include: {
          steps: {
            include: {
              users: true
            },
            orderBy: {
              stepNumber: 'asc'
            }
          }
        }
      })

      if (!updatedSession || updatedSession.status === 'stopped') {
        return '📌 Roll şu anda aktif değil.'
      }

      // Güncel session'ı kullan
      session = updatedSession
    }
  }

  let statusText = ''
  switch (session.status) {
    case 'active':
      statusText = '▶️ Aktif'
      break
    case 'paused':
      statusText = '⏸ Duraklatıldı'
      break
    case 'break':
      statusText = '☕ Molada'
      break
    case 'locked':
      statusText = '🔒 Kilitli (Yeni Giriş Kapalı)'
      break
    default:
      statusText = '❓ Bilinmiyor'
  }

  const msgParts = [`📊 Roll Durumu: ${statusText} (⏳ ${session.activeDuration} dk kuralı)\n`]

  // Tüm adımları göster (aktif olanı işaretle)
  for (const step of session.steps) {
    const stepMarker = step.isActive ? '🔴 ' : ''
    const stepUsers: RollStepUserData[] = step.users.map(u => ({
      name: u.name,
      messageCount: u.messageCount,
      telegramUserId: u.telegramUserId
    }))
    const stepList = formatRankedList(stepUsers, step.stepNumber, step.createdAt)
    msgParts.push(`\n${stepMarker}${stepList}`)
  }

  if (session.steps.length === 0) {
    msgParts.push('\n📭 Henüz kullanıcı yok.')
  }

  return msgParts.join('')
}

/**
 * Sadece adımları göster
 */
export async function getStepList(groupId: string): Promise<string> {
  const session = await prisma.rollSession.findUnique({
    where: { groupId },
    include: {
      steps: {
        include: {
          users: true
        },
        orderBy: {
          stepNumber: 'asc'
        }
      }
    }
  })

  if (!session) {
    return '📭 Roll bulunamadı.'
  }

  const msgParts: string[] = []

  // Tüm adımları göster (aktif olanı işaretle)
  for (const step of session.steps) {
    const stepMarker = step.isActive ? '🔴 ' : ''
    const stepUsers: RollStepUserData[] = step.users.map(u => ({
      name: u.name,
      messageCount: u.messageCount,
      telegramUserId: u.telegramUserId
    }))
    const stepList = formatRankedList(stepUsers, step.stepNumber, step.createdAt)
    msgParts.push(`${stepMarker}${stepList}`)
  }

  return msgParts.join('\n\n')
}

/**
 * Roll verilerini temizle (bitir komutu sonrası)
 */
export async function clearRollData(groupId: string): Promise<void> {
  // Session'ı sil (cascade olarak tüm veriler silinir)
  await prisma.rollSession.deleteMany({
    where: { groupId }
  })
}
