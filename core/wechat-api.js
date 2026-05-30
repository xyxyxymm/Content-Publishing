// 微信公众号真实 API 发布模块
// 使用微信公众平台 "草稿箱" API 创建草稿
const https = require('https');
const zlib = require('zlib');

class WechatApiPublisher {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.appId = '';
    this.appSecret = '';
    this._defaultThumbMediaId = null;
  }

  configure(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    this._defaultThumbMediaId = null;
  }

  get isConfigured() {
    return !!(this.appId && this.appSecret);
  }

  // ========== HTTP 工具 ==========

  async wechatGet(path) {
    const url = `https://api.weixin.qq.com${path}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.errcode) throw new Error(`微信API错误 [${data.errcode}]: ${data.errmsg}`);
    return data;
  }

  async wechatPost(path, body) {
    console.log('[微信POST]', path, JSON.stringify(body).slice(0, 200));
    const res = await fetch(`https://api.weixin.qq.com${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log('[微信响应]', JSON.stringify(data));
    if (data.errcode) throw new Error(`微信API错误 [${data.errcode}]: ${data.errmsg}`);
    return data;
  }

  // 上传文件到微信素材库（手动构建 multipart，无需 form-data 包）
  wechatUpload(token, type, buffer, filename, contentType) {
    return new Promise((resolve, reject) => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;

      const body = Buffer.concat([Buffer.from(header), buffer, Buffer.from(footer)]);

      const req = https.request({
        hostname: 'api.weixin.qq.com',
        path: `/cgi-bin/material/add_material?access_token=${token}&type=${type}`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.errcode) reject(new Error(`上传失败 [${json.errcode}]: ${json.errmsg}`));
            else resolve(json);
          } catch (e) {
            reject(new Error('解析响应失败: ' + data.slice(0, 200)));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // ========== Access Token ==========

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return this.accessToken;
    const data = await this.wechatGet(`/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`);
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return this.accessToken;
  }

  // ========== 创建草稿 ==========

  async createDraft(articles) {
    const token = await this.getAccessToken();
    const processed = [];

    for (const article of articles) {
      let thumbMediaId = article.thumb_media_id || '';

      // 用户提供了封面图 → 下载或解码后上传到微信
      if (!thumbMediaId && article.coverImage) {
        try {
          let imgBuf;
          if (article.coverImage.startsWith('data:')) {
            // base64 data URL
            const b64 = article.coverImage.split(',')[1];
            imgBuf = Buffer.from(b64, 'base64');
          } else if (article.coverImage.startsWith('http')) {
            imgBuf = await this.downloadFile(article.coverImage);
          }
          if (imgBuf) {
            const result = await this.wechatUpload(token, 'image', imgBuf, 'cover.jpg', 'image/jpeg');
            thumbMediaId = result.media_id;
          }
        } catch (err) {
          console.warn('封面图上传失败:', err.message);
        }
      }

      // 微信草稿 API 要求 thumb_media_id 必填
      if (!thumbMediaId) {
        try {
          thumbMediaId = await this.getDefaultThumb(token);
        } catch (err) {
          throw new Error('无法获取封面图，请提供封面图URL: ' + err.message);
        }
      }

      const item = {
        title: article.title || '',
        content: article.content || '',
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
        show_cover_pic: (article.coverImage && (article.coverImage.startsWith('http') || article.coverImage.startsWith('data:'))) ? 1 : 0
      };

      if (article.author) item.author = article.author;
      if (article.digest) item.digest = article.digest;
      if (article.content_source_url) item.content_source_url = article.content_source_url;

      processed.push(item);
    }

    const data = await this.wechatPost(`/cgi-bin/draft/add?access_token=${token}`, { articles: processed });
    console.log('[微信API] 草稿 media_id:', data.media_id);

    // 验证草稿数是否增加
    try {
      const countData = await this.wechatGet(`/cgi-bin/draft/count?access_token=${token}`);
      console.log('[微信API] 当前草稿总数:', countData.total_count);
    } catch (e) {
      console.warn('[微信API] 获取草稿数失败:', e.message);
    }

    return {
      media_id: data.media_id,
      url: 'https://mp.weixin.qq.com/'
    };
  }

  // 缓存的默认封面，避免重复上传
  async getDefaultThumb(token) {
    if (this._defaultThumbMediaId) return this._defaultThumbMediaId;
    const pngBuffer = createMinimalPng(26, 173, 25);
    const result = await this.wechatUpload(token, 'image', pngBuffer, 'cover.png', 'image/png');
    this._defaultThumbMediaId = result.media_id;
    return result.media_id;
  }

  async downloadFile(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
    return Buffer.from(await res.arrayBuffer());
  }
}

// ========== 最小 PNG 生成（300x300，满足微信封面最低要求）==========

function createMinimalPng(r, g, b) {
  const W = 300, H = 300;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);  // width
  ihdr.writeUInt32BE(H, 4);  // height
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // 纯色图片：一行一个 filter byte + RGB像素
  const row = Buffer.alloc(1 + W * 3);
  row[0] = 0; // filter none
  for (let x = 0; x < W; x++) {
    const off = 1 + x * 3;
    row[off] = r;
    row[off + 1] = g;
    row[off + 2] = b;
  }

  // 拼接所有行
  const rawRows = [];
  for (let y = 0; y < H; y++) rawRows.push(row);
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcIn = Buffer.concat([typeBuf, data]);
  const crcOut = Buffer.alloc(4);
  crcOut.writeUInt32BE(crc32(crcIn), 0);
  return Buffer.concat([len, typeBuf, data, crcOut]);
}

function crc32(buf) {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

module.exports = WechatApiPublisher;
