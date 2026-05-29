// 微信公众号适配器
const { marked } = require('marked');
const PlatformAdapter = require('../core/adapter-base');

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
    const html = marked.parse(contentModel.content || '');
    const summary = (contentModel.summary || this.extractSummary(contentModel.content)).slice(0, 120);

    return {
      title: contentModel.title.slice(0, 64),
      content: html,
      summary,
      coverImage: contentModel.coverImage,
      author: contentModel.author,
      originalFlag: true,
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
