// 微信公众号适配器
const { marked } = require('marked');
const PlatformAdapter = require('../core/adapter-base');
const ContentModel = require('../core/content-model');

class WechatAdapter extends PlatformAdapter {
  static get platformName() { return '微信公众号'; }
  static get platformId() { return 'wechat'; }

  static get meta() {
    return {
      id: 'wechat',
      name: '微信公众号',
      icon: 'wechat',
      description: '微信公众平台文章发布',
      maxTitleLength: 64,
      maxContentLength: 20000,
      maxSummaryLength: 120,
      supportsMarkdown: false,
      supportsImages: true,
      supportsTags: false,
      supportsCategory: false,
      requiresCoverImage: true
    };
  }

  transform(contentModel) {
    const html = marked.parse(contentModel.content || '', { breaks: true });

    // 公众号富文本样式处理
    const styledHtml = this.applyWechatStyles(html);
    const summary = (contentModel.summary || this.extractSummary(contentModel.content)).slice(0, 120);

    return {
      title: contentModel.title.slice(0, 64),
      content: styledHtml,
      summary,
      coverImage: contentModel.coverImage,
      author: contentModel.author,
      originalFlag: true,
      // 公众号特有：原文链接
      sourceUrl: contentModel.originalUrl || '',
      rawText: contentModel.content
    };
  }

  getPublishInfo(contentModel) {
    return {
      platformId: 'wechat',
      platformName: '微信公众号',
      editorUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77',
      publisherUrl: 'https://mp.weixin.qq.com/',
      hasRealApi: true,
      copyTarget: 'html',
      instructions: [
        '1. 点击上方链接打开微信公众号后台',
        '2. 在编辑器中 Ctrl+V 粘贴已复制的富文本内容',
        '3. 上传封面图（900x500px）',
        '4. 填写摘要后点击"保存为草稿"或"群发"',
        '提示：可使用真实 API 模式，配置 AppID/AppSecret 后直接创建草稿'
      ],
      canOpenEditor: true
    };
  }

  applyWechatStyles(html) {
    // 为公众号适配样式：添加微信支持的CSS和内联样式
    return html
      .replace(/<h1/g, '<h1 style="font-size:22px;color:#333;text-align:center;margin:20px 0;"')
      .replace(/<h2/g, '<h2 style="font-size:18px;color:#555;margin:16px 0;"')
      .replace(/<h3/g, '<h3 style="font-size:16px;color:#666;margin:12px 0;"')
      .replace(/<p>/g, '<p style="font-size:15px;color:#3f3f3f;line-height:1.8;letter-spacing:0.5px;margin:10px 0;">')
      .replace(/<blockquote/g, '<blockquote style="border-left:4px solid #1aad19;padding:10px 16px;background:#f8f8f8;margin:16px 0;"')
      .replace(/<img /g, '<img style="max-width:100%;display:block;margin:16px auto;border-radius:4px;" ');
  }

  extractSummary(text) {
    return text.replace(/[#*`>\-\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  renderPreview(adapted, original) {
    const warnings = this.validate(adapted);

    if (!adapted.coverImage) {
      warnings.push('建议添加封面图以提升阅读量（公众号强制要求）');
    }

    return {
      platform: '微信公众号',
      platformId: 'wechat',
      preview: {
        title: adapted.title,
        coverImage: adapted.coverImage,
        summary: adapted.summary,
        content: adapted.content
      },
      warnings,
      tips: [
        '公众号文章不支持外部链接，可在文末放"阅读原文"',
        '建议封面图尺寸：900 x 500 像素',
        '摘要不超过120字，将显示在推送列表中'
      ]
    };
  }

  validate(adapted) {
    const warnings = super.validate(adapted);
    if (adapted.title.length > 64) {
      warnings.push(`公众号标题限制64字，当前${adapted.title.length}字，已自动截断`);
    }
    if (adapted.summary && adapted.summary.length > 120) {
      warnings.push(`摘要限制120字，已自动截断`);
    }
    return warnings;
  }
}

module.exports = WechatAdapter;
