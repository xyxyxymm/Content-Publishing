// 适配器注册中心 - 插件化架构核心
// 新平台只需创建适配器文件并放入 adapters/ 目录即可自动发现
const fs = require('fs');
const path = require('path');

class AdapterRegistry {
  constructor() {
    this._adapters = new Map();
  }

  // 注册单个适配器
  register(AdapterClass) {
    const id = AdapterClass.platformId;
    const instance = new AdapterClass();
    this._adapters.set(id, {
      Class: AdapterClass,
      instance,
      meta: AdapterClass.meta
    });
  }

  // 自动扫描 adapters/ 目录，加载所有平台适配器
  autoDiscover(adaptersDir) {
    const files = fs.readdirSync(adaptersDir).filter(f => f.endsWith('.js') && f !== 'index.js');
    for (const file of files) {
      const AdapterClass = require(path.join(adaptersDir, file));
      if (AdapterClass.prototype && AdapterClass.platformId) {
        this.register(AdapterClass);
      }
    }
  }

  // 获取所有已注册平台
  getPlatforms() {
    const platforms = [];
    for (const [id, { meta }] of this._adapters) {
      platforms.push({ ...meta });
    }
    return platforms;
  }

  // 获取指定平台的适配器实例
  getAdapter(platformId) {
    const entry = this._adapters.get(platformId);
    if (!entry) {
      throw new Error(`未知平台: ${platformId}. 可用平台: ${[...this._adapters.keys()].join(', ')}`);
    }
    return entry.instance;
  }

  // 转换内容为指定平台格式
  transform(platformId, contentModel) {
    const adapter = this.getAdapter(platformId);
    return adapter.transform(contentModel);
  }

  // 生成预览
  preview(platformId, contentModel) {
    const adapter = this.getAdapter(platformId);
    return adapter.preview(contentModel);
  }

  // 所有平台转换
  transformAll(contentModel) {
    const results = {};
    for (const [id] of this._adapters) {
      results[id] = this.transform(id, contentModel);
    }
    return results;
  }

  // 所有平台预览
  previewAll(contentModel) {
    const results = {};
    for (const [id] of this._adapters) {
      results[id] = this.preview(id, contentModel);
    }
    return results;
  }
}

module.exports = AdapterRegistry;
