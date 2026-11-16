# dsh-tts-voice

设置页里的「她的声音」：不用改文件、不用重启，随时切她说话用的音色。

## 这是什么

一个 DSH 插件，在设置界面新增一栏「她的声音」，把当前能用的音色列出来，点一下就切过去，还能试听。

它本身不合成语音——真正的合成在桥接那头（`D:\Ayu\qq-bridge` 的 `src/tts.js`，走本地 GPT-SoVITS 服务）。这个插件只做两件事：**把音色清单摆到你面前**、**把选择写回去**。

## 为什么做成代理

浏览器里没有控制台令牌，而桥接的 `/api/*` 全部要求令牌。所以令牌只在宿主侧读（`state/console-token`），前端调本插件自己的路由，由插件转发。

```
浏览器 → /api/tts-voice/status  → 插件 → 桥接 /api/tts/status（带令牌）
浏览器 → /api/tts-voice/preview → 插件 → 桥接 /api/tts/preview
```

## 路由

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/tts-voice/status` | 当前音色、候选清单、是否可用 |
| POST | `/api/tts-voice/select` | 切换音色 |
| POST | `/api/tts-voice/preview` | 试听一句 |

## 接新的克隆音色

只要让桥接的 `/api/tts/status` 多返回几个 speaker，这一页会自动列出来——插件不写死候选表。

## 依赖

- 桥接在跑（`http://127.0.0.1:3100`）
- 桥接侧的 TTS 服务可用（GPT-SoVITS 或系统语音）
- `state/console-token` 存在

## 状态

自用插件，v0.1.0。写得比较薄，能切能试听就够。
