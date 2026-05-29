// 通用内容模型 - 所有平台适配器的统一输入格式
class ContentModel {
  constructor({
    title = '',
    content = '',       // Markdown 格式
    summary = '',
    tags = [],
    category = '',
    coverImage = '',
    author = '',
    originalUrl = ''
  } = {}) {
    this.title = title;
    this.content = content;
    this.summary = summary;
    this.tags = Array.isArray(tags) ? tags : [tags];
    this.category = category;
    this.coverImage = coverImage;
    this.author = author;
    this.originalUrl = originalUrl;
  }
}

module.exports = ContentModel;
