// 知乎适配器
const { marked } = require('marked');
const PlatformAdapter = require('../core/adapter-base');

class ZhihuAdapter extends PlatformAdapter {
  static get platformName() { return '知乎'; }
  static get platformId() { return 'zhihu'; }

  static get meta() {
    return {
      id: 'zhihu',
      name: '知乎',
      icon: 'zhihu',
      description: '知乎文章/回答发布',
      maxTitleLength: 100,
      maxContentLength: 50000,
      supportsMarkdown: true,
      supportsImages: true,
      supportsTags: true,
      supportsCategory: false,
      requiresCoverImage: false
    };
  }

  transform(contentModel) {
    // 知乎支持 Markdown + LaTeX 公式
    let content = contentModel.content || '';

    // 知乎特有的 @提及 和 #话题# 格式保留
    const html = marked.parse(content, { breaks: false });

    return {
      title: contentModel.title.slice(0, 100),
      content: content,          // 保留原始 Markdown
      htmlContent: html,         // 渲染后 HTML
      tags: contentModel.tags || [],
      coverImage: contentModel.coverImage || '',
      // 知乎允许声明转载/原创
      copyright: 'original',
      // 知乎专栏特有：标题图
      titleImage: contentModel.coverImage || ''
    };
  }

  getPublishInfo(contentModel) {
    return {
      platformId: 'zhihu',
      platformName: '知乎',
      editorUrl: 'https://zhuanlan.zhihu.com/write',
      publisherUrl: 'https://zhuanlan.zhihu.com/',
      hasRealApi: false,
      copyTarget: 'markdown',
      instructions: [
        '1. 链接会打开知乎专栏编辑器',
        '2. 知乎支持 Markdown，已自动复制到剪贴板',
        '3. 在编辑器中 Ctrl+V 粘贴，知乎会自动渲染',
        '4. 添加封面图和标签后点击"发布"',
        '提示：知乎无公开API，只能手动粘贴发布'
      ],
      canOpenEditor: true
    };
  }

  renderPreview(adapted, original) {
    const warnings = this.validate(adapted);

    return {
      platform: '知乎',
      platformId: 'zhihu',
      preview: {
        title: adapted.title,
        tags: adapted.tags,
        content: adapted.htmlContent
      },
      warnings,
      tips: [
        '知乎支持 LaTeX 数学公式 ($...$ 行内 / $$...$$ 块级)',
        '标签最多添加 5 个，有助于推荐分发',
        '图文并茂的文章阅读完成率更高'
      ]
    };
  }

  validate(adapted) {
    const warnings = super.validate(adapted);
    if (adapted.tags && adapted.tags.length > 5) {
      warnings.push(`知乎标签最多5个，当前${adapted.tags.length}个，超出部分将被忽略`);
    }
    return warnings;
  }
}

module.exports = ZhihuAdapter;
