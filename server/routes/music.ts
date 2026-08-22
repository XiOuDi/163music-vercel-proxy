import express from 'express';
import axios from 'axios';
import { NeteaseProvider } from '../services/netease.js';

const router = express.Router();
const netease = new NeteaseProvider();

// POST /api/music/parse
router.post('/parse', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const data = await netease.parse(url);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Parse error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to parse music info' });
  }
});

// POST /api/music/download
router.post('/download', async (req, res) => {
  const { id, quality } = req.body;
  
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID is required' });
  }

  try {
    const data = await netease.getDownloadUrl(id, quality);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Download info error:', error);
    const msg = error.message || 'Failed to get download URL';
    if (msg.includes('Copyright') || msg.includes('VIP')) {
        return res.status(403).json({ success: false, error: msg });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /api/music/audio/:id - 直接通过 song_id 获取音频流（专为 Telegram Bot 设计）
router.get('/audio/:id', async (req, res) => {
  const { id } = req.params;
  const quality = (req.query.quality as string) || 'standard';
  const name = (req.query.name as string) || `song_${id}`;

  if (!id) {
    return res.status(400).send('Song ID is required');
  }

  try {
    console.log(`[Audio Proxy] 请求音频: id=${id}, quality=${quality}, name=${name}`);
    
    // Step 1: 获取歌曲下载 URL
    const downloadData = await netease.getDownloadUrl(id, quality);
    console.log(`[Audio Proxy] 获取下载URL成功: playable=${downloadData.playable}, url长度=${downloadData.url?.length || 0}`);
    
    if (!downloadData.playable || !downloadData.url) {
      return res.status(403).json({ 
        success: false, 
        error: downloadData.reason || 'Song not playable (VIP/Copyright)' 
      });
    }

    // Step 2: 先设置响应头（在流式响应开始前）
    const safeName = name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Proxy-Source', 'vercel');
    res.setHeader('X-Song-ID', id);
    res.setHeader('X-Quality', quality);
    res.setHeader('X-Song-Name', encodeURIComponent(name));

    // Step 3: 代理音频流
    const response = await axios({
      url: downloadData.url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://music.163.com/'
      },
      timeout: 30000,
      validateStatus: (status) => status < 400
    });

    console.log(`[Audio Proxy] 网易云响应: status=${response.status}, content-type=${response.headers['content-type']}, content-length=${response.headers['content-length']}`);
    
    // 设置实际的 content-type 和 content-length
    const contentType = (response.headers['content-type'] as string) || 'audio/mpeg';
    const contentLength = response.headers['content-length'] as string | undefined;
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    
    response.data.pipe(res);
    
    response.data.on('error', (err: any) => {
      console.error('[Audio Proxy] 流错误:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Stream error: ' + err.message });
      }
    });
  } catch (error: any) {
    console.error('[Audio Proxy] 错误:', error.message, error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to proxy audio' 
      });
    }
  }
});

// GET /api/music/proxy
router.get('/proxy', async (req, res) => {
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://music.163.com/'
      },
      timeout: 30000
    });

    const contentType = response.headers['content-type'] as string | undefined;
    const contentLength = response.headers['content-length'] as string | undefined;
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    
    response.data.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Failed to proxy file');
  }
});

export default router;
