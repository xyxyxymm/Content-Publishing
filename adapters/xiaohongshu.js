// 小红书适配器 - 生成小红书风格文案（emoji + 短段落 + 话题标签）
const PlatformAdapter = require('../core/adapter-base');

// 主题emoji映射：根据标题/内容关键词自动选择
const TOPIC_EMOJIS = {
  '教育': '📚', '学习': '📖', '学校': '🏫', '孩子': '👶', '家长': '👨‍👩‍👧',
  '科技': '💻', 'AI': '🤖', '技术': '⚙️', '数码': '📱',
  '生活': '🌟', '日常': '📝', '分享': '✨',
  '美食': '🍽️', '旅游': '✈️', '健康': '💪', '运动': '🏃',
  '职场': '💼', '效率': '⏰', '工具': '🛠️',
  '情感': '💕', '心理': '🧠', '成长': '🌱',
  '金融': '💰', '理财': '📊', '法律': '⚖️',
};

const BULLET_EMOJIS = ['✨', '💡', '📌', '🔹', '▫️', '🌟', '✅', '👉'];
const SECTION_EMOJIS = ['🔥', '📌', '💡', '⚡', '🔍', '🎯', '📢', '💬'];

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
      requiresCoverImage: false
    };
  }

  transform(contentModel) {
    const md = contentModel.content || '';
    const topicEmoji = this.pickTopicEmoji(md);

    // 转换为小红书风格文本
    const lines = md.split('\n');
    const result = [];
    let bulletIdx = 0;
    let sectionIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // 跳过空行（保留单个空行作为段落分隔）
      if (line.trim() === '') {
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
        continue;
      }

      // 去除水平线
      if (/^---+$/.test(line.trim())) {
        result.push('—————— ✂ ——————');
        sectionIdx++;
        continue;
      }

      // 标题处理
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = this.stripInline(line.substring(level + 1));
        if (level <= 2) {
          // 一级/二级标题 → 加粗 + emoji + 分隔
          const secEmoji = SECTION_EMOJIS[sectionIdx % SECTION_EMOJIS.length];
          result.push('');
          result.push(`${secEmoji} 【${text}】`);
        } else {
          result.push(`▫️ ${text}`);
        }
        sectionIdx++;
        continue;
      }

      // 有序列表
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (orderedMatch) {
        const text = this.stripInline(orderedMatch[2]);
        const emoji = BULLET_EMOJIS[bulletIdx % BULLET_EMOJIS.length];
        bulletIdx++;
        result.push(`${emoji} ${text}`);
        continue;
      }

      // 无序列表
      const unorderedMatch = line.match(/^[\-\*]\s+(.+)/);
      if (unorderedMatch) {
        const text = this.stripInline(unorderedMatch[1]);
        const emoji = BULLET_EMOJIS[bulletIdx % BULLET_EMOJIS.length];
        bulletIdx++;
        result.push(`${emoji} ${text}`);
        continue;
      }

      // 引用
      if (line.startsWith('> ')) {
        const text = this.stripInline(line.substring(2));
        result.push(`💬 ${text}`);
        continue;
      }

      // 图片
      if (line.match(/^!\[.*\]\(.+\)/)) {
        continue; // 跳过图片
      }

      // 代码块区域（跳过）
      if (line.trim().startsWith('```')) {
        while (i + 1 < lines.length && !lines[i + 1].trim().startsWith('```')) i++;
        i++; // 跳过结束 ```
        continue;
      }

      // 普通行内代码
      line = line.replace(/`(.+?)`/g, '$1');

      // 普通段落：拆成长句为短段（小红书风格）
      const plain = this.stripInline(line);
      if (plain) {
        // 拆分过长段落
        const sentences = plain.split(/[。！？]/).filter(s => s.trim());
        for (const s of sentences) {
          const trimmed = s.trim();
          if (trimmed) result.push(trimmed + '。');
        }
      }
    }

    let text = result.join('\n')
      .replace(/\n{3,}/g, '\n\n')  // 最多两个连续换行
      .trim();

    // 1000字限制
    text = text.slice(0, 1000);

    // 话题标签
    const hashtags = (contentModel.tags || []).map(t => `#${t}#`).join(' ');
    const fullText = hashtags ? `${text}\n\n${hashtags}` : text;

    const title = (contentModel.title || this.generateTitle(text)).slice(0, 20);

    return {
      title,
      content: fullText,
      images: contentModel.coverImage ? [contentModel.coverImage] : [],
      tags: contentModel.tags || [],
      location: '',
      noteType: 'image-text'
    };
  }

  // 去除行内Markdown格式符号
  stripInline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')   // 粗体
      .replace(/\*(.+?)\*/g, '$1')         // 斜体
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')  // 链接
      .replace(/\n/g, '')
      .trim();
  }

  // 根据内容关键词选择主题emoji
  pickTopicEmoji(text) {
    for (const [key, emoji] of Object.entries(TOPIC_EMOJIS)) {
      if (text.includes(key)) return emoji;
    }
    return '📝';
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

  generateTitle(text) {
    const clean = text.replace(/[🔥📌💡⚡🔍🎯📢💬✨📝▫️·#\n]/g, '').trim();
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
    if (adapted.tags.length > 10) {
      warnings.push(`话题标签最多10个，当前${adapted.tags.length}个`);
    }
    return warnings;
  }
}

module.exports = XiaohongshuAdapter;
