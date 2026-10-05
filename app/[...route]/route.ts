export const runtime = 'edge'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ route: string[] }> }
) {
  const { route } = await params

  try {
    const accessToken = process.env.ACCESS_TOKEN
    if (!accessToken) {
      return Response.json({ error: 'ACCESS_TOKEN is not configured.' }, { status: 500 })
    }

    if (route.length !== 2) {
      return Response.json({ error: 'Expected /<account>/<channel>.' }, { status: 400 })
    }
    const account = route[0]

    // Older servers send 'aesgcm', whose salt and key live in headers we don't forward.
    if (req.headers.get('content-encoding')?.toLowerCase() !== 'aes128gcm') {
      return Response.json({ error: 'Only aes128gcm is supported.' }, { status: 415 })
    }

    const channelUri = Buffer.from(route[1], 'base64url').toString()
    const destination = new URL(channelUri)
    if (
      destination.protocol !== 'https:' ||
      !destination.hostname.endsWith('.windows.com')
    ) {
      return Response.json({ error: 'Invalid WNS channel URI.' }, { status: 400 })
    }

    const message = Buffer.from(await req.arrayBuffer()).toString('base64url')
    const payload = JSON.stringify({ i: account, m: message })

    const upstream = await fetch(destination, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'X-WNS-Type': 'wns/raw',
      },
      body: payload,
    })

    // Mastodon only looks at the status; 404/410 makes it delete the stale subscription.
    return new Response(null, { status: upstream.status })
  } catch {
    return Response.json(
      { error: 'Unable to forward the raw notification to WNS.' },
      { status: 502 }
    )
  }
}