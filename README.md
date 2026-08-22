# 163music Vercel 音频代理

基于 NeteaseDL 的网易云音乐 Vercel 音频代理，专为 Telegram Bot 设计。

## 功能特性

- ✅ **Telegram Bot 专用接口**：`/api/music/audio/:id` 直接通过歌曲 ID 获取音频流
- ✅ **Upstash Redis 自动同步 Cookie**：Bot 管理员更新 Cookie 后自动同步
- ✅ **多音质支持**：standard / high / lossless，高音质不可用时自动降级
- ✅ **健康检查**：`/api/health` 查看服务状态和 Upstash 连接状态

## 快速部署

### 1. 配置 Upstash Redis（推荐）

在 [Upstash 控制台](https://console.upstash.com/redis) 创建 Redis 数据库，获取以下信息：
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 2. 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/XiOuDi/163music-vercel-proxy)

或手动导入：
1. 打开 https://vercel.com/new
2. 选择 `XiOuDi/163music-vercel-proxy` 仓库
3. 配置环境变量（见下方）
4. 点击 Deploy

### 3. 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `UPSTASH_REDIS_REST_URL` | 推荐 | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | 推荐 | Upstash Redis REST Token |
| `NETEASE_COOKIE` | 可选 | 网易云 Cookie（优先使用 Upstash） |
| `REAL_IP` | 可选 | 真实 IP，提升可用性 |

## API 接口

### 获取音频流（Telegram Bot 专用）

```
GET /api/music/audio/:id?quality=standard
```

**参数：**
- `:id` - 网易云歌曲 ID
- `quality` - 音质：`standard`（标准）、`high`（极高）、`lossless`（无损）

**示例：**
```
https://your-domain.vercel.app/api/music/audio/1954907052?quality=standard
```

### 健康检查

```
GET /api/health
```

返回服务状态和 Upstash 连接状态。

## Cookie 同步原理

```
Bot 管理员更新 Cookie
    ↓
写入 Upstash Redis (key: cookie:music_u)
    ↓
Vercel 代理自动读取最新 Cookie
    ↓
使用最新 Cookie 获取歌曲下载 URL
```

**支持的 Cookie Key（自动检测）：**
1. `netease:cookie` - 完整 Cookie
2. `netease:music_u` - 仅 MUSIC_U
3. `cookie:music_u` - Bot 默认格式

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动开发服务器
npm run dev
```

## 技术栈

- **后端**：Express + TypeScript
- **网易云 API**：NeteaseCloudMusicApi
- **数据库**：Upstash Redis
- **部署**：Vercel Serverless Functions

## 合规声明

本项目仅用于学习与技术研究。请遵守所在地法律法规、平台服务条款与版权要求，不要将本项目用于任何侵权用途。
