import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ✅ Prisma sadece server-side'da initialize edilir
function createPrismaClient() {
  // Browser'da çalışmayı engelle
  if (typeof window !== 'undefined') {
    throw new Error('Prisma Client cannot be used in the browser')
  }

  // Neon.tech serverless için WebSocket configurasyonu
  neonConfig.webSocketConstructor = ws

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables')
  }

  // ✅ OPTIMIZED: Neon pooled connection for 200-300 concurrent users
  // ⚠️ CRITICAL: Connection pool limiti
  //   - Neon FREE tier: MAX 20 connections (YETERSİZ! - 200-300 kullanıcı için upgrade gerekli)
  //   - Neon PRO tier: MAX 50+ connections (ÖNERİLİR)
  //
  // 📊 Kapasite Analizi:
  //   - Peak load: ~50 msg/s (akşam saatleri)
  //   - Her mesaj: 3-5 query (~100ms connection kullanımı)
  //   - Gerekli connection: 50 msg/s × 0.1s = 5 connection
  //   - Buffer (×8): 40-50 connection önerilir
  //
  // 🚀 OPTIMIZATION: Reduced timeouts for faster connection recycling under high load
  const pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.DATABASE_POOL_SIZE || '20'), // ⚠️ ENV'de 50 yapın (Neon Pro gerekli)
    idleTimeoutMillis: 20000, // 20 seconds (reduced from 30s for faster recycling)
    connectionTimeoutMillis: Number.parseInt(process.env.DATABASE_TIMEOUT || '8000'), // 8 seconds
  })
  const adapter = new PrismaNeon(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  })
}

// ✅ Lazy initialization - sadece server-side'da çalışır
export const prisma = typeof window === 'undefined'
  ? (globalForPrisma.prisma ?? createPrismaClient())
  : ({} as PrismaClient) // Browser'da boş obje döner (kullanılmamalı)

if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// ✅ Graceful shutdown
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    console.log('🔌 Disconnecting Prisma...')
    await prisma.$disconnect()
  })
}

export default prisma
