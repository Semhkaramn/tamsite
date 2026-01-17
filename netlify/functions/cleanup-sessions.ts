import { schedule } from '@netlify/functions'
import { getPrisma, disconnectPrisma } from './lib/prisma'

/**
 * Cron Job: Her gün Türkiye saati 03:00'da çalışır (UTC 00:00 = TR 03:00)
 * Süresi dolmuş admin session'ları temizler
 *
 * 🚀 FIX: Session yerine AdminSession kullanılıyor
 */
const handler = schedule('0 0 * * *', async () => {
  const prisma = getPrisma()

  try {
    const now = new Date()

    // Süresi dolmuş admin session'ları sil
    const deleted = await prisma.adminSession.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Admin sessions cleaned up',
        deletedCount: deleted.count,
        timestamp: now.toISOString()
      }),
    }
  } catch (error) {
    console.error('❌ Error in session cleanup:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to cleanup sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    }
  } finally {
    await disconnectPrisma()
  }
})

export { handler }
