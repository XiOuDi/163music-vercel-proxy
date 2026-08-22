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

  if (!id) {
    return res.status(400).send('Song ID is required');
  }

  try {
    // Step 1: 获取歌曲下载 URL
    const downloadData = await netease.getDownloadUrl(id, quality);
    
    if (!downloadData.playable || !downloadData.url) {
      return res.status(403).json({ 
        success: false, 
        error: downloadData.reason || 'Song not playable (VIP/Copyright)' 
      });
    }

    // Step 2: 代理音频流
    const response = await axios({
      url: downloadData.url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://music.163.com/'
      },
      timeout: 30000
    });

    const contentType = (response.headers['content-type'] as string) || 'audio/mpeg';
    const contentLength = response.headers['content-length'] as string | undefined;
    
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Proxy-Source', 'vercel');
    res.setHeader('X-Song-ID', id);
    res.setHeader('X-Quality', quality);
    
    response.data.pipe(res);
  } catch (error: any) {
    console.error('Audio proxy error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to proxy audio' 
    });
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
