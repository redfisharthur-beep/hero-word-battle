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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/line-status') {
      return json({
        ok: true,
        version: 'line-diagnostic-1',
        channelIdPresent: Boolean(env.LINE_CHANNEL_ID),
        channelSecretPresent: Boolean(env.LINE_CHANNEL_SECRET),
        configured: Boolean(env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET),
        callbackUrl: `${url.origin}/auth/line/callback`,
      })
    }

    return worker.fetch(request, env)
  },
}
