/**
 * 🔧 Netlify Functions için Prisma Client
 *
 * Ana uygulama @/lib/prisma'yı kullanırken,
 * Netlify Functions ayrı bir ortamda çalıştığı için
 * kendi Prisma client'ına ihtiyaç duyar.
 *
 * ✅ Neon Serverless adapter kullanır
 * ✅ Her invocation sonunda disconnect eder
 */

import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

let prismaInstance: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance
  }

  // Neon.tech serverless için WebSocket configurasyonu
  neonConfig.webSocketConstructor = ws

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables')
  }

  // Serverless için optimize edilmiş pool ayarları
  const pool = new Pool({
    connectionString,
    max: 5, // Serverless için düşük tutuyoruz
    idleTimeoutMillis: 10000, // 10 saniye
    connectionTimeoutMillis: 5000, // 5 saniye
  })

  const adapter = new PrismaNeon(pool)

  prismaInstance = new PrismaClient({
    adapter,
    log: ['error'],
  })

  return prismaInstance
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = null
  }
}
