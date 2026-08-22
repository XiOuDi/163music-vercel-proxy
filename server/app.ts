import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import musicRoutes from './routes/music.js'
import { testUpstashConnection, getRedis } from './services/upstash.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/music', musicRoutes)

app.use('/api/health', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const upstashConfigured = !!getRedis();
  let upstashStatus: { connected: boolean; error?: string } | null = null;
  
  if (upstashConfigured) {
    try {
      upstashStatus = await testUpstashConnection();
    } catch (e: any) {
      upstashStatus = { connected: false, error: e.message };
    }
  }

  res.status(200).json({
    success: true,
    message: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      upstash: {
        configured: upstashConfigured,
        connected: upstashStatus?.connected || false,
        error: upstashStatus?.error || null
      },
      netease_cookie: {
        env_configured: !!process.env.NETEASE_COOKIE,
        upstash_enabled: upstashConfigured
      }
    }
  })
})

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
