import { prisma } from '@/lib/prisma'
import { getTurkeyToday } from '@/lib/utils'

// Server-side sponsor fetcher - doğrudan DB'den
export async function fetchSponsorsServer() {
  try {
    const sponsors = await prisma.sponsor.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'desc' }, // VIP önce
        { order: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        websiteUrl: true,
        category: true,
        clicks: true,
        showInBanner: true,
        order: true,
        isActive: true,
      }
    })
    return sponsors
  } catch (error) {
    console.error('Error fetching sponsors:', error)
    return []
  }
}

// Server-side visit stats fetcher - Cache yok, anlık veri
export async function fetchVisitStatsServer() {
  try {
    const today = getTurkeyToday()

    const [totalStats, todayStats, allTimeUniqueStats] = await Promise.all([
      // Tüm zamanların toplamı
      prisma.dailyStats.aggregate({
        _sum: { totalVisits: true }
      }),
      // Bugünkü ziyaretler (uniqueVisitors dahil)
      prisma.dailyStats.findUnique({
        where: { date: today }
      }),
      // Tüm zamanların toplam benzersiz ziyaretçi sayısı
      prisma.dailyStats.aggregate({
        _sum: { uniqueVisitors: true }
      })
    ])

    return {
      totalVisits: totalStats._sum.totalVisits || 0,
      todayVisits: todayStats?.totalVisits || 0,
      uniqueVisitors: todayStats?.uniqueVisitors || 0,
      totalUniqueVisitors: allTimeUniqueStats._sum.uniqueVisitors || 0
    }
  } catch (error) {
    console.error('Error fetching visit stats:', error)
    return { totalVisits: 0, todayVisits: 0, uniqueVisitors: 0, totalUniqueVisitors: 0 }
  }
}

// Server-side social media fetcher
export async function fetchSocialMediaServer() {
  try {
    const socialMedia = await prisma.socialMedia.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        platform: true,
        username: true,
        order: true,
      }
    })
    return socialMedia
  } catch (error) {
    console.error('Error fetching social media:', error)
    return []
  }
}

// Server-side banners fetcher
export async function fetchBannersServer() {
  try {
    const [leftBannerSetting, rightBannerSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'left_banner_data' } }),
      prisma.settings.findUnique({ where: { key: 'right_banner_data' } })
    ])

    const result: {
      left: { imageUrl: string; sponsorId: string; sponsor: { id: string; name: string; websiteUrl: string | null } | null } | null;
      right: { imageUrl: string; sponsorId: string; sponsor: { id: string; name: string; websiteUrl: string | null } | null } | null;
    } = { left: null, right: null }

    if (leftBannerSetting?.value) {
      try {
        const leftData = JSON.parse(leftBannerSetting.value)
        if (leftData.enabled && leftData.imageUrl && leftData.sponsorId) {
          const sponsor = await prisma.sponsor.findUnique({
            where: { id: leftData.sponsorId },
            select: { id: true, name: true, websiteUrl: true }
          })
          result.left = {
            imageUrl: leftData.imageUrl,
            sponsorId: leftData.sponsorId,
            sponsor
          }
        }
      } catch {}
    }

    if (rightBannerSetting?.value) {
      try {
        const rightData = JSON.parse(rightBannerSetting.value)
        if (rightData.enabled && rightData.imageUrl && rightData.sponsorId) {
          const sponsor = await prisma.sponsor.findUnique({
            where: { id: rightData.sponsorId },
            select: { id: true, name: true, websiteUrl: true }
          })
          result.right = {
            imageUrl: rightData.imageUrl,
            sponsorId: rightData.sponsorId,
            sponsor
          }
        }
      } catch {}
    }

    return result
  } catch (error) {
    console.error('Error fetching banners:', error)
    return { left: null, right: null }
  }
}

// Server-side sponsor banner settings fetcher
export async function fetchSponsorBannerEnabledServer() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'sponsor_banner_enabled' }
    })
    return setting?.value === 'true'
  } catch (error) {
    console.error('Error fetching sponsor banner setting:', error)
    return false
  }
}
