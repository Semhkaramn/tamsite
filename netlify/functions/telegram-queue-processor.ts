import type { Config, Context } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  console.log('🕐 Scheduled queue processor running...')

  try {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) {
      console.error('No site URL configured')
      return new Response(JSON.stringify({ error: 'No site URL configured' }), {
        status: 200, // Return 200 to prevent Netlify from marking as failed
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const secret = process.env.QUEUE_PROCESS_SECRET || 'queue-process-internal'

    const response = await fetch(`${siteUrl}/api/telegram/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-queue-secret': secret,
      },
    })

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      const text = await response.text()
      console.error('Queue processor API error:', response.status, text)
      return new Response(JSON.stringify({
        error: 'API error',
        status: response.status,
        message: text.substring(0, 200)
      }), {
        status: 200, // Return 200 to prevent Netlify from marking as failed
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let data
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('Failed to parse response:', parseError)
      return new Response(JSON.stringify({ error: 'Invalid JSON response' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('📊 Queue processor result:', data)

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Queue processor error:', error?.message || error)
    return new Response(JSON.stringify({
      error: 'Processing error',
      message: error?.message || 'Unknown error'
    }), {
      status: 200, // Return 200 to prevent Netlify from retrying
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config: Config = {
  schedule: '* * * * *', // Every minute
}
