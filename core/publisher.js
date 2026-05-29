// 模拟发布引擎
// 支持模拟发布（延迟模拟 + 返回发布状态）和发布历史记录
class Publisher {
  constructor(adapterRegistry) {
    this.registry = adapterRegistry;
    this.history = [];
  }

  // 模拟发布到指定平台
  async publish(platformId, adaptedContent, contentModel) {
    const meta = this.registry.getAdapter(platformId).constructor.meta;

    // 模拟网络延迟
    const delay = 800 + Math.random() * 1500;
    await this.sleep(delay);

    const record = {
      id: this.generateId(),
      platformId,
      platformName: meta.name,
      title: adaptedContent.title || contentModel.title,
      status: 'published',
      publishedAt: new Date().toISOString(),
      platformUrl: this.generateMockUrl(platformId),
      adapted: adaptedContent
    };

    this.history.unshift(record);
    return record;
  }

  // 批量发布到多个平台
  async publishMulti(platformIds, contentModel) {
    const results = [];

    for (const platformId of platformIds) {
      const adapted = this.registry.transform(platformId, contentModel);
      const result = await this.publish(platformId, adapted, contentModel);
      results.push(result);
    }

    return results;
  }

  // 获取发布历史
  getHistory() {
    return this.history;
  }

  // 清除历史
  clearHistory() {
    this.history = [];
  }

  generateId() {
    return 'pub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  generateMockUrl(platformId) {
    const domains = {
      wechat: 'mp.weixin.qq.com',
      zhihu: 'zhuanlan.zhihu.com',
      bilibili: 'www.bilibili.com/read',
      xiaohongshu: 'www.xiaohongshu.com/explore'
    };
    const domain = domains[platformId] || `${platformId}.example.com`;
    const id = Math.random().toString(36).slice(2, 10);
    return `https://${domain}/p/${id}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Publisher;
