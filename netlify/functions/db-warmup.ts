import type { Config, Context } from "@netlify/functions"
import { getPrisma, disconnectPrisma } from "./lib/prisma"

/**
 * 🚀 Neon Connection Warming
 * Her 5 dakikada bir basit query yaparak connection pool'u sıcak tutar
 * Cold start gecikmesini önler (~300-800ms kazanç)
 */
export default async (req: Request, context: Context) => {
  const startTime = Date.now()
  const prisma = getPrisma()

  try {
    // Basit bir query ile connection'ı sıcak tut
    await prisma.$queryRaw`SELECT 1 as warmup`

    const duration = Date.now() - startTime
    console.log(`✅ Database connection warmed in ${duration}ms`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Database connection warmed',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Database warmup failed after ${duration}ms:`, error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  } finally {
    await disconnectPrisma()
  }
}

// Her 5 dakikada bir çalıştır
export const config: Config = {
  schedule: "*/5 * * * *"
}
