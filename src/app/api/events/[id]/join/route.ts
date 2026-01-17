import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { invalidateCache } from '@/lib/enhanced-cache'
import { logEventJoin, extractRequestInfo } from '@/lib/services/activity-log-service'

// POST - Etkinliğe katıl (Race condition korumalı)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)
    const userId = session.userId

    const { id } = await params

    // Transaction ile race condition koruması
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get user
      const user = await tx.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('USER_NOT_FOUND')
      }

      // Get event with current participant count
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          sponsor: {
            select: {
              id: true,
              name: true,
              identifierType: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
      })

      if (!event) {
        throw new Error('EVENT_NOT_FOUND')
      }

      if (event.status !== 'active') {
        throw new Error('EVENT_NOT_ACTIVE')
      }

      // Check sponsor info
      const userSponsorInfo = await tx.userSponsorInfo.findUnique({
        where: {
          userId_sponsorId: {
            userId: user.id,
            sponsorId: event.sponsor.id,
          },
        },
      })

      if (!userSponsorInfo) {
        throw new Error(`SPONSOR_INFO_REQUIRED:${event.sponsor.id}`)
      }

      // Check if already joined (within transaction to prevent race condition)
      const existingParticipation = await tx.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId: event.id,
            userId: user.id,
          },
        },
      })

      if (existingParticipation) {
        throw new Error('ALREADY_JOINED')
      }

      // Check participant limit (within transaction)
      if (event.participationType === 'limited' && event._count.participants >= event.participantLimit) {
        throw new Error('EVENT_FULL')
      }

      // Create participation
      const participation = await tx.eventParticipant.create({
        data: {
          eventId: event.id,
          userId: user.id,
          sponsorInfo: userSponsorInfo.identifier,
        },
      })

      // Update participant count atomically
      const updatedEvent = await tx.event.update({
        where: { id },
        data: {
          participantCount: {
            increment: 1,
          },
        },
        include: {
          _count: {
            select: {
              participants: true,
            },
          },
        },
      })

      // Handle raffle if limit reached
      let raffleCompleted = false
      if (
        event.participationType === 'raffle' &&
        updatedEvent._count.participants >= event.participantLimit
      ) {
        // Check if raffle already done
        const existingWinners = await tx.eventWinner.count({
          where: { eventId: event.id },
        })

        if (existingWinners === 0) {
          // Perform raffle
          const allParticipants = await tx.eventParticipant.findMany({
            where: { eventId: event.id },
            include: {
              user: {
                select: {
                  id: true,
                },
              },
            },
          })

          const shuffled = [...allParticipants].sort(() => 0.5 - Math.random())
          const selectedWinners = shuffled.slice(0, event.participantLimit)

          await Promise.all(
            selectedWinners.map((participant) =>
              tx.eventWinner.create({
                data: {
                  eventId: event.id,
                  userId: participant.userId,
                  status: 'prize_added',
                  statusMessage: 'Ödülünüz eklendi',
                },
              })
            )
          )

          // Update event status
          await tx.event.update({
            where: { id },
            data: { status: 'pending' },
          })

          raffleCompleted = true
        }
      }

      return {
        participation,
        raffleCompleted,
        eventTitle: event.title,
        sponsorName: event.sponsor.name,
        sponsorInfo: userSponsorInfo.identifier
      }
    })

    // ✅ Cache invalidation
    invalidateCache.events()

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logEventJoin(
      userId,
      id,
      result.eventTitle,
      result.sponsorName,
      result.sponsorInfo,
      requestInfo
    )

    if (result.raffleCompleted) {
      return NextResponse.json({
        message: 'Etkinliğe katıldınız ve çekiliş yapıldı!',
        participation: result.participation,
        raffleCompleted: true,
      })
    }

    return NextResponse.json({
      message: 'Etkinliğe başarıyla katıldınız',
      participation: result.participation,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
          { status: 401 }
        )
      }
      if (error.message === 'USER_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Kullanıcı bulunamadı' },
          { status: 404 }
        )
      }
      if (error.message === 'EVENT_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Etkinlik bulunamadı' },
          { status: 404 }
        )
      }
      if (error.message === 'EVENT_NOT_ACTIVE') {
        return NextResponse.json(
          { error: 'Bu etkinliğe artık katılım yapılamaz' },
          { status: 400 }
        )
      }
      if (error.message.startsWith('SPONSOR_INFO_REQUIRED:')) {
        const sponsorId = error.message.split(':')[1]
        return NextResponse.json(
          { error: 'Sponsor bilgisi bulunamadı', needsSponsorInfo: true, sponsorId },
          { status: 400 }
        )
      }
      if (error.message === 'ALREADY_JOINED') {
        return NextResponse.json(
          { error: 'Bu etkinliğe zaten katıldınız' },
          { status: 400 }
        )
      }
      if (error.message === 'EVENT_FULL') {
        return NextResponse.json(
          { error: 'Etkinlik katılımcı limiti doldu' },
          { status: 400 }
        )
      }
    }
    console.error('Error joining event:', error)
    return NextResponse.json(
      { error: 'Etkinliğe katılırken hata oluştu' },
      { status: 500 }
    )
  }
}
