// 平台适配器基类 - 所有平台适配器继承此类
// 新平台只需继承此基类并实现 transform() 方法即可完成注册
class PlatformAdapter {
  constructor() {
    if (new.target === PlatformAdapter) {
      throw new Error('PlatformAdapter is abstract, cannot be instantiated directly');
    }
  }

  // 返回平台名称，子类必须覆盖
  static get platformName() {
    throw new Error('Must override static platformName');
  }

  static get platformId() {
    throw new Error('Must override static platformId');
  }

  // 平台显示信息
  static get meta() {
    return {
      id: this.platformId,
      name: this.platformName,
      icon: '',
      description: '',
      maxTitleLength: 100,
      maxContentLength: 20000,
      supportsMarkdown: true,
      supportsImages: true,
      supportsTags: true,
      supportsCategory: false,
      requiresCoverImage: false
    };
  }

  // 核心转换方法 - 将通用 ContentModel 转换为平台特定格式
  // 子类必须实现
  transform(contentModel) {
    throw new Error('Must implement transform(contentModel)');
  }

  // 生成平台预览 HTML，方便用户预览发布效果
  preview(contentModel) {
    const adapted = this.transform(contentModel);
    return this.renderPreview(adapted, contentModel);
  }

  // 默认预览渲染，各平台可覆盖
  renderPreview(adapted, original) {
    return {
      platform: this.constructor.platformName,
      platformId: this.constructor.platformId,
      preview: adapted,
      warnings: this.validate ? this.validate(adapted) : []
    };
  }

  // 返回平台的发布信息：编辑器URL、操作指南、是否有真实API
  getPublishInfo(contentModel) {
    return {
      platformId: this.constructor.platformId,
      platformName: this.constructor.platformName,
      editorUrl: '',           // 平台内容编辑器地址
      publisherUrl: '',        // 平台创作者后台地址
      hasRealApi: false,       // 是否支持真实API发布
      copyTarget: 'html',      // 'html' | 'text' | 'markdown' - 复制格式
      instructions: [],        // 发布操作步骤
      canOpenEditor: true      // 能否打开编辑器页面
    };
  }

  // 发布前校验，返回警告列表
  validate(adaptedContent) {
    const warnings = [];
    const meta = this.constructor.meta;

    if (adaptedContent.title && adaptedContent.title.length > meta.maxTitleLength) {
      warnings.push(`标题超过平台限制 ${meta.maxTitleLength} 字，当前 ${adaptedContent.title.length} 字`);
    }
    if (adaptedContent.content && adaptedContent.content.length > meta.maxContentLength) {
      warnings.push(`内容超过平台限制 ${meta.maxContentLength} 字，当前 ${adaptedContent.content.length} 字`);
    }
    if (meta.requiresCoverImage && !adaptedContent.coverImage) {
      warnings.push('该平台要求必须上传封面图');
    }

    return warnings;
  }
}

module.exports = PlatformAdapter;
