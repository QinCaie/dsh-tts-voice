/**
 * dsh-tts-voice —— 设置页「她的声音」
 *
 * 作用：不用改文件、不用重启，随时切换她说话的音色。
 *   · ChatTTS（本地大模型，最像真人，每句 8~11 秒）
 *   · 系统语音（Windows Yaoyao/Huihui/Kangkang，秒出）
 * 后续接克隆模型时，只要让桥接的 /api/tts/status 多返回几个 speaker，这里会自动列出来。
 *
 * 为什么由它做代理：浏览器里没有控制台令牌，而桥接的 /api/* 全部要求令牌。
 * 所以令牌只在宿主侧读（state\console-token），前端调本插件自己的路由。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadHostDeps } from './lib/hostdeps.mjs'

let hostDeps = { z: null, defineTool: null }
try { hostDeps = await loadHostDeps() } catch (e) {
  console.log(`[tts-voice] 取宿主依赖失败：${e?.message ?? e}`)
}

export const name = 'tts-voice'
export const inject = ['webServer']

const DEFAULTS = {
  bridgeUrl: 'http://127.0.0.1:3100',
  tokenFile: 'D:\\Ayu\\qq-bridge\\state\\console-token',
}

export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config && typeof config === 'object' ? config : {}) }
  const log = (m) => console.log(`[tts-voice] ${m}`)

  function token() {
    try { return readFileSync(cfg.tokenFile, 'utf8').trim() } catch { return '' }
  }

  async function bridge(pathname, init = {}) {
    const t = token()
    if (!t) throw new Error('读不到控制台令牌（state\\console-token）')
    const headers = { ...(init.headers || {}), 'x-console-token': t }
    return fetch(String(cfg.bridgeUrl).replace(/\/+$/, '') + pathname, { ...init, headers })
  }

  const sendJson = (res, code, body) => {
    try {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    } catch {}
  }

  async function readBody(req) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const raw = Buffer.concat(chunks).toString('utf8')
    try { return raw ? JSON.parse(raw) : {} } catch { return {} }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/api/tts-voice',
    handler: async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      try {
        if (req.method === 'GET' && url.pathname === '/api/tts-voice/status') {
          const r = await bridge('/api/tts/status')
          const text = await r.text()
          res.writeHead(r.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          return res.end(text)
        }

        if (req.method === 'POST' && url.pathname === '/api/tts-voice/select') {
          const body = await readBody(req)
          const r = await bridge('/api/tts/select', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          const text = await r.text()
          log(`切换音色 → ${JSON.stringify(body)}（HTTP ${r.status}）`)
          res.writeHead(r.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          return res.end(text)
        }

        if (req.method === 'POST' && url.pathname === '/api/tts-voice/preview') {
          const body = await readBody(req)
          const r = await bridge('/api/tts/preview', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!r.ok) {
            const text = await r.text()
            return sendJson(res, r.status, { ok: false, error: text.slice(0, 200) })
          }
          const buf = Buffer.from(await r.arrayBuffer())
          res.writeHead(200, {
            'content-type': 'audio/wav',
            'content-length': String(buf.length),
            'cache-control': 'no-store',
          })
          return res.end(buf)
        }

        if (req.method === 'GET' && url.pathname === '/api/tts-voice/health') {
          return sendJson(res, 200, { ok: true, tokenAvailable: Boolean(token()) })
        }

        return sendJson(res, 404, { ok: false, error: 'not found' })
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: String(e?.message ?? e) })
      }
    },
  }), 'tts-voice: /api/tts-voice 路由')

  log('已挂载：/api/tts-voice/{status,select,preview}')
}
