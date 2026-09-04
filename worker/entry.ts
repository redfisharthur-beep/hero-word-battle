import worker, { GameRoom, type Env } from './index'

export { GameRoom }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

const callbackUrl = (url: URL) => `${url.origin}/auth/line/callback`

const cookieValue = (request: Request, name: string) => {
  const raw = request.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

const resultRedirect = (
  url: URL,
  key: 'line_login' | 'line_error',
  value: string,
  clearState = false,
) =>
  new Response(null, {
    status: 302,
    headers: {
      location: `${url.origin}/#${key}=${encodeURIComponent(value)}`,
      'cache-control': 'no-store',
      ...(clearState
        ? {
            'set-cookie':
              'line_oauth_state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
          }
        : {}),
    },
  })

async function handleLineLogin(request: Request, env: Env) {
  const url = new URL(request.url)

  if (!env.LINE_CHANNEL_ID || !env.LINE_CHANNEL_SECRET) {
    return resultRedirect(url, 'line_error', 'LINE_LOGIN_NOT_CONFIGURED')
  }

  const state = crypto.randomUUID().replace(/-/g, '')
  const authorize = new URL('https://access.line.me/oauth2/v2.1/authorize')
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('client_id', env.LINE_CHANNEL_ID)
  authorize.searchParams.set('redirect_uri', callbackUrl(url))
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('scope', 'profile openid')
  authorize.searchParams.set('ui_locales', 'zh-TW')

  // Avoid LINE mobile auto-login/app switching, which can look like a crash or
  // immediately bounce users out of the game on some mobile/in-app browsers.
  // LINE officially recommends disable_auto_login when auto login is unstable.
  authorize.searchParams.set('disable_auto_login', 'true')

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      'cache-control': 'no-store',
      'set-cookie': `line_oauth_state=${encodeURIComponent(
        state,
      )}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
    },
  })
}

async function handleLineCallback(request: Request, env: Env) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  const expected = cookieValue(request, 'line_oauth_state')

  if (url.searchParams.get('error')) {
    return resultRedirect(
      url,
      'line_error',
      url.searchParams.get('error_description') || 'LINE_LOGIN_CANCELLED',
      true,
    )
  }

  if (!code || !state || !expected || state !== expected) {
    return resultRedirect(url, 'line_error', 'LINE_STATE_MISMATCH', true)
  }

  if (!env.LINE_CHANNEL_ID || !env.LINE_CHANNEL_SECRET) {
    return resultRedirect(url, 'line_error', 'LINE_LOGIN_NOT_CONFIGURED', true)
  }

  try {
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl(url),
        client_id: env.LINE_CHANNEL_ID,
        client_secret: env.LINE_CHANNEL_SECRET,
      }),
    })

    if (!tokenResponse.ok) {
      return resultRedirect(url, 'line_error', 'LINE_TOKEN_FAILED', true)
    }

    const token = (await tokenResponse.json()) as { access_token?: string }
    if (!token.access_token) {
      return resultRedirect(url, 'line_error', 'LINE_TOKEN_FAILED', true)
    }

    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: { authorization: `Bearer ${token.access_token}` },
    })

    if (!profileResponse.ok) {
      return resultRedirect(url, 'line_error', 'LINE_PROFILE_FAILED', true)
    }

    const profile = (await profileResponse.json()) as { displayName?: string }
    const displayName = (profile.displayName ?? '').trim().slice(0, 12)
    if (!displayName) {
      return resultRedirect(url, 'line_error', 'LINE_NAME_MISSING', true)
    }

    return resultRedirect(url, 'line_login', displayName, true)
  } catch {
    return resultRedirect(url, 'line_error', 'LINE_LOGIN_FAILED', true)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/line-status') {
      return json({
        ok: true,
        version: 'line-login-2',
        channelIdPresent: Boolean(env.LINE_CHANNEL_ID),
        channelSecretPresent: Boolean(env.LINE_CHANNEL_SECRET),
        configured: Boolean(env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET),
        callbackUrl: callbackUrl(url),
      })
    }

    if (url.pathname === '/auth/line' && request.method === 'GET') {
      return handleLineLogin(request, env)
    }

    if (url.pathname === '/auth/line/callback' && request.method === 'GET') {
      return handleLineCallback(request, env)
    }

    return worker.fetch(request, env)
  },
}
