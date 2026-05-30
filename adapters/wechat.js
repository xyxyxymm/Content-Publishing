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
      requiresCoverImage: false
    };
  }

  transform(contentModel) {
    const cleaned = this.cleanMarkdown(contentModel.content || '');
    const rawHtml = marked.parse(cleaned);
    const fixedHtml = this.fixLists(rawHtml);
    const html = this.applyWechatStyles(fixedHtml);
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

  // 清理Markdown：删除空列表项、重编有序列表序号
  cleanMarkdown(md) {
    const lines = md.split('\n');
    const result = [];
    let orderedCounter = 0;
    let inOrderedList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
      const unorderedMatch = line.match(/^[\-\*]\s+(.*)/);

      if (orderedMatch) {
        const content = orderedMatch[2].trim();
        if (!content) continue; // 跳过空列表项
        inOrderedList = true;
        orderedCounter++;
        result.push(`${orderedCounter}. ${content}`);
      } else if (unorderedMatch) {
        const content = unorderedMatch[1].trim();
        if (!content) continue;
        inOrderedList = false;
        orderedCounter = 0;
        result.push(line);
      } else {
        // 非列表行
        if (line.trim() === '') {
          // 空行可能结束列表
          if (inOrderedList && i + 1 < lines.length && /^\d+\.\s+/.test(lines[i + 1])) {
            continue; // 列表间空行跳过，保持列表连续
          }
          inOrderedList = false;
          orderedCounter = 0;
        } else {
          inOrderedList = false;
          orderedCounter = 0;
        }
        result.push(line);
      }
    }
    return result.join('\n');
  }

  // 修复marked输出：合并被空行拆散的连续有序列表，删除空<li>
  fixLists(html) {
    // 合并相邻的 <ol> 列表
    html = html.replace(/<\/ol>\s*<ol(\s[^>]*)?>/g, '');
    // 删除空的 <li></li> 或只有空白符的
    html = html.replace(/<li(\s[^>]*)?>\s*<\/li>/g, '');
    return html;
  }
  applyWechatStyles(html) {
    return html
      // === 标题 ===
      .replace(/<h1>/g, '<h1 style="font-size:22px;font-weight:bold;margin:1.4em 0 0.6em;line-height:1.5;letter-spacing:0.5px;">')
      .replace(/<h2>/g, '<h2 style="font-size:19px;font-weight:bold;margin:1.3em 0 0.5em;line-height:1.5;">')
      .replace(/<h3>/g, '<h3 style="font-size:17px;font-weight:bold;margin:1.2em 0 0.4em;line-height:1.5;">')
      .replace(/<h4>/g, '<h4 style="font-size:16px;font-weight:bold;margin:1em 0 0.3em;line-height:1.5;">')
      // === 段落 ===
      .replace(/<p>/g, '<p style="font-size:16px;line-height:1.8;margin:0.6em 0;color:#3f3f3f;letter-spacing:0.5px;word-break:break-all;">')
      // === 代码块（先处理 <pre><code> 防止内部 <code> 被单独替换）===
      .replace(/<pre><code>/g, '<pre style="background:#282c34;color:#abb2bf;padding:14px 18px;border-radius:6px;margin:1em 0;overflow-x:auto;font-size:14px;line-height:1.7;white-space:pre-wrap;font-family:Menlo,Consolas,monospace;"><code>')
      // === 行内代码 ===
      .replace(/<code>/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:0.88em;color:#c7254e;font-family:Menlo,Consolas,monospace;word-break:break-all;">')
      // === 引用 ===
      .replace(/<blockquote>/g, '<blockquote style="border-left:4px solid #1aad19;padding:10px 18px;margin:1em 0;background:#f6fdf6;font-size:15px;line-height:1.7;color:#555;">')
      // === 列表（微信重置 ul/ol，必须加强内联样式）===
      .replace(/<ul>/g, '<ul style="padding-left:1.8em;margin:0.8em 0;list-style-type:disc;list-style-position:outside;">')
      .replace(/<ol>/g, '<ol style="padding-left:1.8em;margin:0.8em 0;list-style-type:decimal;list-style-position:outside;">')
      .replace(/<li>/g, '<li style="font-size:16px;line-height:1.8;margin:0.4em 0;color:#3f3f3f;">')
      // === 图片 ===
      .replace(/<img /g, '<img style="max-width:100%;height:auto;display:block;margin:1em auto;border-radius:4px;" ')
      // === 链接 ===
      .replace(/<a /g, '<a style="color:#576b95;text-decoration:none;border-bottom:1px solid #576b95;" ')
      // === 水平线 ===
      .replace(/<hr>/g, '<hr style="border:none;border-top:1px solid #e0e0e0;margin:1.5em 0;" />')
      // === 表格 ===
      .replace(/<table>/g, '<table style="width:100%;border-collapse:collapse;margin:1em 0;font-size:15px;border:1px solid #e0e0e0;">')
      .replace(/<th>/g, '<th style="padding:10px 14px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;text-align:left;">')
      .replace(/<td>/g, '<td style="padding:10px 14px;border:1px solid #ddd;">');
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
