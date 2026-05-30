// 多平台内容发布工具 - 后端服务
const express = require('express');
const path = require('path');
const ContentModel = require('./core/content-model');
const AdapterRegistry = require('./core/adapter-registry');
const Publisher = require('./core/publisher');
const WechatApiPublisher = require('./core/wechat-api');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const registry = new AdapterRegistry();
registry.autoDiscover(path.join(__dirname, 'adapters'));

// 初始化发布器
const mockPublisher = new Publisher(registry);
const wechatApi = new WechatApiPublisher();

// 尝试从文件加载微信配置
try {
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'wechat-config.json'), 'utf8'));
  if (cfg.appId && cfg.appSecret) {
    wechatApi.configure(cfg.appId, cfg.appSecret);
    console.log('已从 wechat-config.json 加载微信API配置');
  }
} catch (e) {
  // 文件不存在，跳过
}

// ============ API 路由 ============

// 获取所有平台列表
app.get('/api/platforms', (req, res) => {
  try {
    const platforms = registry.getPlatforms();
    res.json({ success: true, data: platforms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 预览：转换内容到指定平台并返回预览
app.post('/api/preview', (req, res) => {
  try {
    const { platformId, ...contentData } = req.body;
    const contentModel = new ContentModel(contentData);

    if (platformId === 'all') {
      const previews = registry.previewAll(contentModel);
      return res.json({ success: true, data: previews });
    }

    const preview = registry.preview(platformId, contentModel);
    res.json({ success: true, data: preview });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 转换：仅转换不预览
app.post('/api/transform', (req, res) => {
  try {
    const { platformId, ...contentData } = req.body;
    const contentModel = new ContentModel(contentData);

    if (platformId === 'all') {
      const results = registry.transformAll(contentModel);
      return res.json({ success: true, data: results });
    }

    const result = registry.transform(platformId, contentModel);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 获取各平台的发布信息（编辑器URL、操作指南等）
app.post('/api/publish-info', (req, res) => {
  try {
    const { platformIds, ...contentData } = req.body;
    const contentModel = new ContentModel(contentData);
    const platforms = Array.isArray(platformIds) ? platformIds : [platformIds];

    const results = platforms.map(pid => {
      const adapter = registry.getAdapter(pid);
      const adapted = adapter.transform(contentModel);
      const info = adapter.getPublishInfo(contentModel);
      return {
        ...info,
        adaptedContent: adapted,
        wechatConfigured: pid === 'wechat' ? wechatApi.isConfigured : false
      };
    });

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 模拟发布
app.post('/api/publish', async (req, res) => {
  try {
    const { platformIds, ...contentData } = req.body;
    const contentModel = new ContentModel(contentData);
    const platforms = Array.isArray(platformIds) ? platformIds : [platformIds];

    const results = await mockPublisher.publishMulti(platforms, contentModel);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 真实发布（微信公众号通过API创建草稿）
app.post('/api/publish-real', async (req, res) => {
  try {
    const { platformIds, ...contentData } = req.body;
    const contentModel = new ContentModel(contentData);
    const platforms = Array.isArray(platformIds) ? platformIds : [platformIds];
    const results = [];

    for (const pid of platforms) {
      if (pid === 'wechat' && wechatApi.isConfigured) {
        const adapter = registry.getAdapter('wechat');
        const adapted = adapter.transform(contentModel);

        console.log('\n[微信API] 准备创建草稿');
        console.log('  标题:', adapted.title);
        console.log('  内容长度:', adapted.content.length);
        console.log('  封面图:', adapted.coverImage || '无');

        try {
          const draft = await wechatApi.createDraft([{
            title: adapted.title,
            content: adapted.content,
            author: adapted.author || '',
            digest: adapted.summary || '',
            content_source_url: adapted.sourceUrl || '',
            coverImage: adapted.coverImage
          }]);

          console.log('[微信API] 草稿创建成功！');
          console.log('  media_id:', draft.media_id);

          results.push({
            platformId: 'wechat',
            platformName: '微信公众号',
            status: 'published',
            publishedAt: new Date().toISOString(),
            platformUrl: draft.url,
            isReal: true,
            message: '草稿已写入。请到 mp.weixin.qq.com → 管理 → 素材管理 → 草稿箱 查看'
          });
        } catch (err) {
          console.error('[微信API] 草稿创建失败:', err.message);
          results.push({
            platformId: 'wechat',
            platformName: '微信公众号',
            status: 'failed',
            error: err.message,
            isReal: true
          });
        }
      } else {
        // 非微信或无配置的平台，使用模拟发布
        const result = await mockPublisher.publishMulti([pid], contentModel);
        results.push(...result);
      }
    }

    mockPublisher.history.push(...results.filter(r => r.status === 'published'));
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 获取发布历史
app.get('/api/history', (req, res) => {
  try {
    const history = mockPublisher.getHistory();
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 清除发布历史
app.delete('/api/history', (req, res) => {
  try {
    mockPublisher.clearHistory();
    res.json({ success: true, message: '发布历史已清除' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 微信凭证配置
app.post('/api/wechat/config', (req, res) => {
  try {
    const { appId, appSecret } = req.body;
    if (!appId || !appSecret) {
      return res.status(400).json({ success: false, error: '请提供 appId 和 appSecret' });
    }
    wechatApi.configure(appId, appSecret);

    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, 'wechat-config.json'),
      JSON.stringify({ appId, appSecret }, null, 2),
      'utf8'
    );

    res.json({ success: true, message: '微信API已配置并保存', configured: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/wechat/status', (req, res) => {
  res.json({ success: true, configured: wechatApi.isConfigured });
});

// 获取所有已注册平台
const platformList = registry.getPlatforms();
console.log(`已加载 ${platformList.length} 个平台适配器:`);
platformList.forEach(p => console.log(`  - ${p.name} (${p.id})`));

app.listen(PORT, () => {
  console.log(`\n多平台内容发布工具已启动: http://localhost:${PORT}`);
});

