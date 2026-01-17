import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTurkeyToday, getTurkeyDateAgo } from '@/lib/utils'

export async function GET() {
  try {
    const today = getTurkeyToday()
    const weekAgo = getTurkeyDateAgo(7)
    const monthAgo = getTurkeyDateAgo(30)

    // DailyStats'tan aggregate yap - Cache yok, anlık veri
    const [totalStats, todayStats, weeklyStats, monthlyStats, allTimeUniqueStats] = await Promise.all([
      // Tüm zamanların toplamı
      prisma.dailyStats.aggregate({
        _sum: { totalVisits: true }
      }),
      // Bugünkü ziyaretler (uniqueVisitors dahil)
      prisma.dailyStats.findUnique({
        where: { date: today }
      }),
      // Haftalık ziyaretler
      prisma.dailyStats.aggregate({
        where: { date: { gte: weekAgo } },
        _sum: { totalVisits: true }
      }),
      // Aylık ziyaretler
      prisma.dailyStats.aggregate({
        where: { date: { gte: monthAgo } },
        _sum: { totalVisits: true }
      }),
      // Tüm zamanların toplam benzersiz ziyaretçi sayısı
      prisma.dailyStats.aggregate({
        _sum: { uniqueVisitors: true }
      })
    ])

    return NextResponse.json({
      totalVisits: totalStats._sum.totalVisits || 0,
      todayVisits: todayStats?.totalVisits || 0,
      weeklyVisits: weeklyStats._sum.totalVisits || 0,
      monthlyVisits: monthlyStats._sum.totalVisits || 0,
      uniqueVisitors: todayStats?.uniqueVisitors || 0,
      totalUniqueVisitors: allTimeUniqueStats._sum.uniqueVisitors || 0
    })
  } catch (error) {
    console.error('Error getting visit count:', error)
    return NextResponse.json(
      { error: 'Failed to get visit count' },
      { status: 500 }
    )
  }
}
