// B站专栏适配器
const { marked } = require('marked');
const PlatformAdapter = require('../core/adapter-base');

class BilibiliAdapter extends PlatformAdapter {
  static get platformName() { return 'B站'; }
  static get platformId() { return 'bilibili'; }

  static get meta() {
    return {
      id: 'bilibili',
      name: 'B站',
      icon: 'bilibili',
      description: 'B站专栏/动态发布',
      maxTitleLength: 100,
      maxContentLength: 30000,
      supportsMarkdown: false,
      supportsImages: true,
      supportsTags: true,
      supportsCategory: true,
      requiresCoverImage: true
    };
  }

  transform(contentModel) {
    const html = marked.parse(contentModel.content || '', { breaks: true });

    return {
      title: contentModel.title.slice(0, 100),
      content: this.applyBilibiliStyles(html),
      rawText: contentModel.content,
      coverImage: contentModel.coverImage || '',
      category: this.mapCategory(contentModel.category),
      tags: (contentModel.tags || []).slice(0, 10),
      // B站专栏支持插入视频 (BV号)
      // embeddedVideos: [],
      // 允许设置转载/原创
      original: 1,
      // 专栏摘要
      summary: contentModel.summary || contentModel.content.replace(/[#*`>\-\n]/g, ' ').slice(0, 200)
    };
  }

  getPublishInfo(contentModel) {
    return {
      platformId: 'bilibili',
      platformName: 'B站',
      editorUrl: 'https://member.bilibili.com/platform/upload/text',
      publisherUrl: 'https://member.bilibili.com/platform/home',
      hasRealApi: false,
      copyTarget: 'html',
      instructions: [
        '1. 链接会打开B站创作中心专栏编辑器',
        '2. 在编辑器中 Ctrl+V 粘贴已复制的富文本',
        '3. 上传封面图（建议1920x1080）',
        '4. 选择分类和标签后点击"提交"',
        '提示：B站需要登录且有专栏权限（通常Lv3以上）'
      ],
      canOpenEditor: true
    };
  }

  applyBilibiliStyles(html) {
    // B站专栏使用类微信公众号的富文本编辑器，但风格偏ACG/A站
    return html
      .replace(/<h1/g, '<h1 style="font-size:24px;font-weight:bold;line-height:1.5;margin:20px 0 12px;"')
      .replace(/<h2/g, '<h2 style="font-size:20px;font-weight:bold;line-height:1.5;margin:16px 0 10px;"')
      .replace(/<p>/g, '<p style="font-size:15px;line-height:1.8;color:#222;margin:8px 0;">')
      .replace(/<blockquote/g, '<blockquote style="border-left:3px solid #fb7299;padding:8px 16px;background:#fff5f7;margin:12px 0;"')
      .replace(/<img /g, '<img style="max-width:100%;display:block;margin:12px auto;" ');
  }

  mapCategory(category) {
    // B站专栏分类映射
    const categoryMap = {
      '科技': 1, '数码': 1,
      '生活': 2, '日常': 2,
      '游戏': 3,
      '动画': 4, '动漫': 4,
      '影视': 6, '电影': 6,
      '知识': 16, '科普': 16,
      '时尚': 19,
      '美食': 14
    };
    return {
      id: categoryMap[category] || 16,
      name: category || '知识'
    };
  }

  renderPreview(adapted, original) {
    const warnings = this.validate(adapted);

    if (!adapted.coverImage) {
      warnings.push('B站专栏必须上传封面图（建议16:9比例）');
    }

    return {
      platform: 'B站',
      platformId: 'bilibili',
      preview: {
        title: adapted.title,
        coverImage: adapted.coverImage,
        category: adapted.category,
        tags: adapted.tags,
        content: adapted.content
      },
      warnings,
      tips: [
        '封面图尺寸建议 1920x1080 (16:9)',
        'B站用户偏好轻松幽默的文风，可适当加入梗和表情',
        '专栏支持嵌入B站视频，可添加 BV 号引用'
      ]
    };
  }
}

module.exports = BilibiliAdapter;
