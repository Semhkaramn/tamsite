import { schedule } from '@netlify/functions'

const handler = schedule('*/15 * * * *', async () => {
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

    console.log('🔄 Running event auto-check...')

    const response = await fetch(`${siteUrl}/api/admin/events/auto-check`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    })

    const data = await response.json()

    console.log('✅ Event auto-check completed:', data)

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    }
  } catch (error) {
    console.error('❌ Error in event auto-check:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to run auto-check' }),
    }
  }
})

export { handler }
