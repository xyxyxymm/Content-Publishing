// 纯文本 → Markdown 智能转换器
// 分析纯文本的排版结构，自动识别标题、列表、段落并生成标准 Markdown

class TextToMarkdown {
  convert(text) {
    if (!text || typeof text !== 'string') return '';

    // 检测是否已是 Markdown：需要多个标记才算
    const mdLines = text.split('\n').filter(line =>
      /^#{1,6}\s/.test(line) ||
      /^\s*[\-\*]\s/.test(line) ||
      /^\s*>\s/.test(line) ||
      /`/.test(line) ||
      /[*_]{1,2}[^*_\s]/.test(line) ||
      /!\[/.test(line) ||
      /\[.+\]\(.+\)/.test(line)
    );
    // 如果 Markdown 标记行超过总行数 20%，或存在标题标记(#)，认为是 Markdown
    const totalLines = text.split('\n').filter(l => l.trim()).length;
    const hasTitleLine = text.split('\n').some(l => /^#{1,6}\s/.test(l));
    if (mdLines.length > 0 && (hasTitleLine || mdLines.length >= totalLines * 0.2)) {
      return text;
    }

    // 纯文本：逐行分析结构并转为 Markdown
    const lines = text.split(/\r?\n/);
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 空行
      if (!trimmed) {
        result.push('');
        i++;
        continue;
      }

      // 识别标题：仅中文数字开头（一、二、三...）
      const cnHeadingMatch = trimmed.match(/^([一二三四五六七八九十]+)[、，．.\s]+(.+)/);
      if (cnHeadingMatch) {
        result.push('');
        result.push('## ' + trimmed);
        i++;
        continue;
      }

      // 识别有序列表：连续数字开头的行
      if (/^\d+[、．.\s]/.test(trimmed)) {
        const clean = trimmed.replace(/^\d+[、．.\s]+/, '');
        const num = trimmed.match(/^(\d+)/)[1];
        result.push(num + '. ' + clean);
        i++;
        continue;
      }

      // 识别无序列表：以 - • · ◆ ◇ ○ ● 等符号开头
      const bulletMatch = trimmed.match(/^[-\•·◆◇○●✓✔☑\->]\s*(.+)/);
      if (bulletMatch) {
        result.push('- ' + bulletMatch[1]);
        i++;
        continue;
      }

      // 识别引文：以" 或「 开头的行，或缩进的行
      if (/^[""「『].+/.test(trimmed) && trimmed.length > 20) {
        result.push('> ' + trimmed);
        i++;
        continue;
      }

      // 识别加粗格式：括号/书名号内的短文本
      const boldMatch = trimmed.match(/[【《「『](.+?)[】》」』]/);
      if (boldMatch && boldMatch[1].length <= 10) {
        result.push(trimmed.replace(/[【《「『](.+?)[】》」』]/g, '**$1**'));
        i++;
        continue;
      }

      // 水平线
      if (/^[-*=]{3,}$/.test(trimmed) || /^[─━═]{3,}$/.test(trimmed)) {
        result.push('---');
        i++;
        continue;
      }

      // 普通段落：合并连续非空行
      let paragraph = trimmed;
      i++;
      while (i < lines.length && lines[i].trim() && !this.isSpecialLine(lines[i].trim())) {
        paragraph += lines[i].trim();
        i++;
      }
      result.push(paragraph);
      result.push('');
    }

    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // 判断一行是否为特殊格式（列表、标题等）
  isSpecialLine(line) {
    return /^[一二三四五六七八九十]+[、，．.\s]/.test(line) ||
           /^\d+[、．.\s]/.test(line) ||
           /^[-\•·◆◇○●✓✔☑\->]/.test(line) ||
           /^[""「『]/.test(line) ||
           /^[-*=]{3,}$/.test(line);
  }
}

module.exports = TextToMarkdown;
