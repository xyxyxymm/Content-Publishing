# 多平台内容发布工具

一次编辑，多平台适配。支持将 Markdown 或纯文本自动转换为微信公众号、知乎、B站、小红书的平台格式，并支持辅助发布。

> 🎬 **[点击观看演示视频](https://www.bilibili.com/video/BV1rbVS6CEqL/)**

## 功能特性

- **智能格式适配**：Markdown 输入，自动转换为各平台兼容格式
- **纯文本兼容**：粘贴纯文本自动识别标题、列表结构
- **多平台预览**：选中平台实时预览适配效果
- **辅助发布**：一键打开平台编辑器 + 复制适配内容到剪贴板
- **真实API发布**：通过官方 API 直接创建草稿（目前仅微信公众号）
- **字数检测**：实时校验标题和正文是否超出平台限制
- **插件化架构**：新增平台适配器只需在 `adapters/` 下新建一个文件

## 支持的平台

| 平台 | 标题限制 | 正文限制 | 发布方式 |
|------|---------|---------|---------|
| 微信公众号 | 64字 | 20000字 | 真实API（草稿箱）|
| 知乎 | 100字 | 50000字 | 辅助发布（Markdown 原生支持） |
| B站 | 100字 | 30000字 | 辅助发布（Markdown） |
| 小红书 | 20字 | 1000字 | 辅助发布（纯文本 + Emoji） |

## 快速开始

### 一键启动（推荐）

**Windows：** 双击 `start.bat`  
**Linux / Mac：** `bash start.sh`

脚本会自动安装依赖、释放端口并启动服务，浏览器自动打开 http://localhost:3000。

### 手动启动

```bash
npm install
npm start
```

## 使用流程

1. 左侧「编辑」区域输入标题和正文（仅支持 Markdown 或纯文本）
2. 选择目标平台（微信公众号 / 知乎 / B站 / 小红书）
3. 右侧「预览」区域实时查看格式适配效果
4. 选择发布方式：
   - **辅助发布**：自动打开平台编辑器 + 复制适配内容，Ctrl+V 粘贴即可
   - **API**（仅微信公众号）：配置 AppID/AppSecret 后直接创建草稿到公众号后台

## 微信公众号API配置

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com) → 开发 → 基本配置
2. 获取 AppID 和 AppSecret
3. 将本机公网 IP 加入白名单
4. 在工具中点击「⚙ 微信公众号 API 配置」填入凭证
5. 选择微信公众号 → 点击「真实API发布」

草稿将出现在公众号后台 → 素材管理 → 草稿箱。

## 项目结构

```
tset/
├── server.js                 # Express 后端入口，API 路由
├── package.json
├── core/                     # 核心模块
│   ├── content-model.js      # 通用内容模型（统一输入格式）
│   ├── adapter-base.js       # 适配器基类
│   ├── adapter-registry.js   # 适配器注册中心（自动发现）
│   ├── text-to-markdown.js   # 纯文本 → Markdown 智能转换
│   ├── publisher.js          # 模拟发布引擎
│   └── wechat-api.js         # 微信公众号真实API
├── adapters/                 # 各平台适配器（插件式，自动注册）
│   ├── wechat.js             # 微信公众号
│   ├── zhihu.js              # 知乎
│   ├── bilibili.js           # B站
│   └── xiaohongshu.js        # 小红书
└── public/                   # 前端（纯原生，无框架）
    ├── index.html
    ├── style.css
    └── app.js
```

## 扩展新平台

1. 在 `adapters/` 下新建文件（如 `douyin.js`）
2. 继承 `PlatformAdapter`，设置 `platformName` / `platformId` / `meta`
3. 实现 `transform(contentModel)` 转换逻辑
4. 重启服务，自动注册

```javascript
// adapters/douyin.js
const PlatformAdapter = require('../core/adapter-base');

class DouyinAdapter extends PlatformAdapter {
  static get platformName() { return '抖音'; }
  static get platformId() { return 'douyin'; }

  static get meta() {
    return {
      id: 'douyin',
      name: '抖音',
      description: '抖音图文发布',
      maxTitleLength: 50,
      maxContentLength: 5000,
      supportsMarkdown: false,
      supportsImages: true,
      supportsTags: true,
      supportsCategory: false,
      requiresCoverImage: true
    };
  }

  transform(contentModel) {
    // 转换逻辑
    return {
      title: contentModel.title,
      content: contentModel.content
    };
  }

  getPublishInfo(contentModel) {
    return {
      platformId: 'douyin',
      platformName: '抖音',
      editorUrl: 'https://creator.douyin.com/',
      hasRealApi: false,
      copyTarget: 'text',
      instructions: ['1. 打开抖音创作者中心', '2. 粘贴内容'],
      canOpenEditor: true
    };
  }
}

module.exports = DouyinAdapter;
```

## 技术栈

| 依赖 | 版本 | 用途 |
|------|------|------|
| **express** | ^4.18.2 | HTTP 服务框架，提供 RESTful API 和静态文件托管 |
| **marked** | ^9.1.0 | Markdown → HTML 转换，微信公众号和B站适配的核心渲染引擎 |
| **form-data** | ^4.0.5 | 构建 multipart/form-data 请求，用于微信 API 上传封面图片 |
| **axios** | ^1.16.1 | HTTP 客户端（预留，用于后续平台 API 对接） |
| **cheerio** | ^1.2.0 | HTML 解析器（预留，用于爬取平台页面信息） |
| **csv-writer** | ^1.6.0 | CSV 文件写入（预留，用于批量发布记录导出） |

**前端**：零依赖，纯原生 HTML + CSS + JavaScript。

## License

MIT
