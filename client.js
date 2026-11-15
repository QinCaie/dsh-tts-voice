/**
 * dsh-tts-voice —— 设置页「她的声音」
 *
 * 只做界面：列 GSV 模型、试听、选模型、调语速。合成与切换都在桥接那边
 * （/api/tts-voice/* 由宿主侧代理到 qq-bridge 的 /api/tts/*）。
 *
 * 现在只剩 GPT-SoVITS 一个引擎；以后加了新 GSV 模型，会在这里自动出现。
 */
window.__ModuleLoader__.load({
  id: 'dsh-tts-voice',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const API = '/api/tts-voice'

    const CSS = `
[data-tv-page]{display:flex;flex-direction:column;gap:14px;padding:4px 2px 12px;max-width:760px;}
[data-tv-card]{border:1px solid rgba(127,127,127,.22);border-radius:12px;padding:14px 16px;background:rgba(127,127,127,.03);}
[data-tv-card] > h4{margin:0 0 4px;font-size:13px;font-weight:600;opacity:.9;}
[data-tv-sub]{font-size:12px;opacity:.55;line-height:1.7;margin:0 0 10px;}
[data-tv-row]{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;font-size:13px;border-top:1px dashed rgba(127,127,127,.15);}
[data-tv-row]:first-of-type{border-top:none;}
[data-tv-meta]{font-size:11px;opacity:.5;line-height:1.6;}
[data-tv-badge]{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;background:rgba(58,154,85,.14);color:#3a9a55;margin-left:6px;}
[data-tv-actions]{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
[data-tv-ok]{color:#3a9a55;font-size:12px;}
[data-tv-err]{color:#c0392b;font-size:12px;}
[data-tv-note]{font-size:12px;opacity:.6;line-height:1.8;}
[data-tv-model]{width:100%;text-align:left;border:1px solid rgba(127,127,127,.28);border-radius:10px;padding:10px 12px;margin-top:8px;cursor:pointer;font-size:13px;background:transparent;color:inherit;}
[data-tv-model][data-on]{border-color:#3a9a55;background:rgba(58,154,85,.10);}
[data-tv-model]:disabled{opacity:.6;cursor:default;}
[data-tv-speed]{display:flex;align-items:center;gap:10px;margin-top:10px;}
[data-tv-speed] input[type=range]{flex:1;}
[data-tv-num]{font-variant-numeric:tabular-nums;font-size:13px;min-width:44px;text-align:right;}
[data-tv-input]{width:100%;margin-top:8px;padding:8px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;font-size:13px;}
[data-tv-btn]{border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;background:transparent;color:inherit;}
[data-tv-btn][data-primary]{border-color:#3a9a55;color:#3a9a55;}
[data-tv-btn]:disabled{opacity:.5;cursor:default;}
`

    const asJson = async (res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() }

    function Panel() {
      const [st, setSt] = React.useState(null)
      const [msg, setMsg] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [picked, setPicked] = React.useState('')
      const [speed, setSpeed] = React.useState(0.92)
      const [text, setText] = React.useState('在的，我听着呢。你慢慢说。')
      const audioRef = React.useRef(null)

      const load = async () => {
        setMsg(null)
        try {
          const j = await asJson(await fetch(API + '/status', { credentials: 'same-origin', signal: AbortSignal.timeout(20000) }))
          setSt(j)
          setPicked(j.currentModel || (j.models && j.models[0] && j.models[0].id) || '')
          setSpeed(Number(j.speed) || 0.92)
        } catch (e) { setMsg({ err: String(e.message || e) }) }
      }
      React.useEffect(() => { load() }, [])

      const save = async (payload, label) => {
        setBusy(label); setMsg(null)
        try {
          const r = await fetch(API + '/select', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const j = await r.json().catch(() => ({}))
          if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status))
          setMsg({ ok: label + '：已保存（下一句就生效）' })
          await load()
        } catch (e) { setMsg({ err: label + '失败：' + String(e.message || e) }) }
        finally { setBusy('') }
      }

      const preview = async () => {
        setBusy('试听'); setMsg(null)
        try {
          const r = await fetch(API + '/preview', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, model: picked, speed }),
          })
          if (!r.ok) {
            const j = await r.json().catch(() => ({}))
            throw new Error(j.error || ('HTTP ' + r.status))
          }
          const blob = await r.blob()
          if (audioRef.current) {
            audioRef.current.src = URL.createObjectURL(blob)
            await audioRef.current.play().catch(() => {})
          }
          setMsg({ ok: '试听：' + (Math.round(blob.size / 1024)) + ' KB' })
        } catch (e) { setMsg({ err: '试听失败：' + String(e.message || e) }) }
        finally { setBusy('') }
      }

      if (!st) return h('div', { 'data-tv-page': '' }, h('div', { 'data-tv-note': '' }, msg?.err ? ('读取失败：' + msg.err) : '加载中…'))

      const models = st.models || []
      const running = st.running === true

      return h('div', { 'data-tv-page': '' },
        h('div', { 'data-tv-card': '' },
          h('h4', null, '状态'),
          h('div', { 'data-tv-row': '' },
            h('span', null,
              h('span', null, running ? '服务运行中' : '服务未启动'),
              running ? h('span', { 'data-tv-badge': '' }, 'GPT-SoVITS') : null,
              h('div', { 'data-tv-meta': '' },
                (st.device ? '设备 ' + st.device : '设备未知')
                + (st.loaded ? ' · 已加载 ' + st.loaded : '')
                + ' · 语速 ' + (Number(st.speed) || 0.92))),
            h('span', { 'data-tv-actions': '' },
              h('button', { 'data-tv-btn': '', disabled: busy === '刷新', onClick: load }, '刷新')))),

        h('div', { 'data-tv-card': '' },
          h('h4', null, '声线'),
          h('div', { 'data-tv-sub': '' }, '她说话用哪个模型。以后加新模型：把模型包放进 D:\\tts\\gsv-models\\<名字>\\（gpt.ckpt / sovits.pth / ref.list / ref/ / meta.json），这里会自动列出来。'),
          models.length
            ? models.map((m) => h('button', {
                key: m.id,
                'data-tv-model': '',
                'data-on': picked === m.id ? '' : undefined,
                disabled: Boolean(busy),
                onClick: () => setPicked(m.id),
              },
                h('div', null, m.label || m.id, picked === m.id ? h('span', { 'data-tv-badge': '' }, '已选') : null),
                h('div', { 'data-tv-meta': '' }, (m.note || '') + (m.id ? ' · ' + m.id : ''))))
            : h('div', { 'data-tv-note': '' }, 'D:\\tts\\gsv-models 里还没发现模型。'),
          h('div', { 'data-tv-row': '' }, h('span', { 'data-tv-meta': '' }, '选好点保存，下一句就换。'),
            h('span', { 'data-tv-actions': '' },
              h('button', { 'data-tv-btn': '', onClick: () => { setPicked(st.currentModel || '') }, disabled: Boolean(busy) }, '还原'),
              h('button', { 'data-tv-btn': '', 'data-primary': '', onClick: () => save({ model: picked }, '声线'), disabled: Boolean(busy) || !picked }, '保存')))),

        h('div', { 'data-tv-card': '' },
          h('h4', null, '语速'),
          h('div', { 'data-tv-sub': '' }, '小于 1 更慢，大于 1 更快。0.9 左右比较像她平时说话。'),
          h('div', { 'data-tv-speed': '' },
            h('input', {
              type: 'range', min: 0.8, max: 1.1, step: 0.01, value: speed,
              onChange: (e) => setSpeed(Number(e.target.value)),
            }),
            h('span', { 'data-tv-num': '' }, speed.toFixed(2))),
          h('div', { 'data-tv-row': '' }, h('span', { 'data-tv-meta': '' }, '当前保存值 ' + (Number(st.speed) || 0.92)),
            h('span', { 'data-tv-actions': '' },
              h('button', { 'data-tv-btn': '', onClick: () => setSpeed(Number(st.speed) || 0.92), disabled: Boolean(busy) }, '还原'),
              h('button', { 'data-tv-btn': '', 'data-primary': '', onClick: () => save({ model: picked, speed }, '语速'), disabled: Boolean(busy) }, '保存')))),

        h('div', { 'data-tv-card': '' },
          h('h4', null, '试听'),
          h('div', { 'data-tv-sub': '' }, '用当前选中模型 + 当前滑块语速试听，不改保存值。'),
          h('input', { 'data-tv-input': '', value: text, onChange: (e) => setText(e.target.value), maxLength: 120 }),
          h('div', { 'data-tv-row': '' }, h('span', { 'data-tv-meta': '' }, text.length + ' / 120 字'),
            h('span', { 'data-tv-actions': '' },
              h('button', { 'data-tv-btn': '', 'data-primary': '', onClick: preview, disabled: Boolean(busy) || !picked }, busy === '试听' ? '合成中…' : '试听')))),
        h('audio', { ref: audioRef, controls: true, style: { width: '100%', marginTop: 8 } }),

        msg?.ok ? h('div', { 'data-tv-ok': '' }, msg.ok) : null,
        msg?.err ? h('div', { 'data-tv-err': '' }, msg.err) : null
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-tts-voice')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-tts-voice: 设置页样式')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'tts-voice', order: 48, label: '她的声音' },
          () => h(Panel)))
      },
    }
  },
})
