import { schedule } from '@netlify/functions'

// Her gün Türkiye saati 00:00'da çalışır (UTC 21:00 = TR 00:00)
const handler = schedule('0 21 * * *', async () => {
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (!siteUrl) {
      console.error('Site URL not found')
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Site URL not configured' }),
      }
    }

    console.log('🎡 Running wheel reset notification...')

    const response = await fetch(`${siteUrl}/api/admin/wheel/reset-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    console.log('✅ Wheel reset notification completed:', data)

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    }
  } catch (error) {
    console.error('❌ Error in wheel reset notification:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send wheel reset notifications' }),
    }
  }
})

export { handler }
