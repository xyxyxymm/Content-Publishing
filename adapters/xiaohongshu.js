// 小红书适配器
const PlatformAdapter = require('../core/adapter-base');

class XiaohongshuAdapter extends PlatformAdapter {
  static get platformName() { return '小红书'; }
  static get platformId() { return 'xiaohongshu'; }

  static get meta() {
    return {
      id: 'xiaohongshu',
      name: '小红书',
      icon: 'xiaohongshu',
      description: '小红书笔记发布',
      maxTitleLength: 20,
      maxContentLength: 1000,
      supportsMarkdown: false,
      supportsImages: true,
      supportsTags: true,
      supportsCategory: false,
      requiresCoverImage: true
    };
  }

  transform(contentModel) {
    // 小红书是纯文本 + emoji + 话题标签
    // 将 Markdown 转为纯文本
    let text = this.markdownToPlainText(contentModel.content || '');
    
    // 小红书正文限制1000字
    text = text.slice(0, 1000);

    // 在小红书，话题标签以 #话题# 形式嵌入正文末尾
    const hashtags = (contentModel.tags || []).map(t => `#${t}#`).join(' ');

    // 如果有 hashtags，追加到正文末尾
    const fullText = hashtags ? `${text}\n\n${hashtags}` : text;
    
    // 标题限制20字
    const title = (contentModel.title || this.generateTitle(text)).slice(0, 20);

    return {
      title,
      content: fullText,
      // 小红书是多图模式，封面即首图
      images: contentModel.coverImage ? [contentModel.coverImage] : [],
      tags: contentModel.tags || [],
      // 小红书支持添加地点
      location: '',
      // 笔记类型：图文笔记
      noteType: 'image-text'
    };
  }

  getPublishInfo(contentModel) {
    return {
      platformId: 'xiaohongshu',
      platformName: '小红书',
      editorUrl: 'https://creator.xiaohongshu.com/publish/publish',
      publisherUrl: 'https://creator.xiaohongshu.com/',
      hasRealApi: false,
      copyTarget: 'text',
      instructions: [
        '1. 链接会打开小红书创作者中心',
        '2. 在"发布图文笔记"中上传图片',
        '3. 标题已复制，正文包含话题标签已复制到剪贴板',
        '4. Ctrl+V 分别粘贴标题和正文',
        '5. 添加地点等信息后点击"发布"',
        '提示：小红书正文最多1000字，标签放在文末'
      ],
      canOpenEditor: true
    };
  }

  markdownToPlainText(markdown) {
    return markdown
      // 去除标题符号
      .replace(/^#{1,6}\s+/gm, '')
      // 粗体 -> 保留文本
      .replace(/\*\*(.+?)\*\*/g, '$1')
      // 斜体 -> emoji 风格表达
      .replace(/\*(.+?)\*/g, '$1')
      // 链接 -> 只保留文字
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      // 图片 -> 标记
      .replace(/!\[.*?\]\(.+?\)/g, '📷')
      // 代码块处理
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.+?)`/g, '$1')
      // 引用 -> 添加标记
      .replace(/^>\s?/gm, '💬 ')
      // 列表符号美化
      .replace(/^[\-\*]\s/gm, '· ')
      .replace(/^\d+\.\s/gm, '')
      // 水平线
      .replace(/^---$/gm, '——————')
      // 清理多余空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  generateTitle(text) {
    // 从小红书正文前20字生成标题
    const clean = text.replace(/[#💬📷·]/g, '').trim();
    return clean.slice(0, 20) || '无标题笔记';
  }

  renderPreview(adapted, original) {
    const warnings = this.validate(adapted);

    // 分割正文和hashtags展示
    const parts = adapted.content.split('\n\n');
    const body = parts[0] || '';
    const tagsText = parts.slice(1).join('\n\n');

    return {
      platform: '小红书',
      platformId: 'xiaohongshu',
      preview: {
        title: adapted.title,
        images: adapted.images,
        body,
        hashtags: tagsText
      },
      warnings,
      tips: [
        '小红书正文最多1000字，建议控制在500字以内效果最佳',
        '使用 emoji 和换行符提升可读性',
        '话题标签 #xxx# 放在文末，最多10个',
        '图片建议3-9张，首图（封面）最重要',
        '小红书用户偏好真实、生活化的内容风格'
      ]
    };
  }

  validate(adapted) {
    const warnings = super.validate(adapted);
    if (adapted.title.length > 20) {
      warnings.push(`小红书标题限制20字，当前${adapted.title.length}字，已自动截断`);
    }
    if (adapted.content.length > 1000) {
      warnings.push(`小红书正文限制1000字，当前${adapted.content.length}字，已自动截断`);
    }
    if (!adapted.images || adapted.images.length === 0) {
      warnings.push('小红书发布必须至少上传1张图片');
    }
    if (adapted.tags.length > 10) {
      warnings.push(`话题标签最多10个，当前${adapted.tags.length}个`);
    }
    return warnings;
  }
}

module.exports = XiaohongshuAdapter;
