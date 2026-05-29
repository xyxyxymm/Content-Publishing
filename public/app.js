// 多平台内容发布工具 - 前端交互逻辑
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  var titleInput, coverInput, summaryInput, categorySelect, tagsInput, authorInput;
  var contentInput, platformSelector, previewTabs, previewContent;
  var btnPublish, btnCopyAll, publishStatus, historyList, toast;
  var wechatConfig, wechatAppid, wechatSecret, wechatStatus;

  var state = {
    platforms: [],
    selectedPlatforms: new Set(),
    currentTab: null,
    previewData: {},
    isPublishing: false,
    publishMode: 'assisted'
  };

  // ============= Init =============
  function initDom() {
    titleInput = $('#title');
    coverInput = $('#coverImage');
    summaryInput = $('#summary');
    categorySelect = $('#category');
    tagsInput = $('#tags');
    authorInput = $('#author');
    contentInput = $('#content');
    platformSelector = $('#platform-selector');
    previewTabs = $('#preview-tabs');
    previewContent = $('#preview-content');
    btnPublish = $('#btn-publish');
    btnCopyAll = $('#btn-copy-all');
    publishStatus = $('#publish-status');
    historyList = $('#history-list');
    toast = $('#toast');
    wechatConfig = $('#wechat-config');
    wechatAppid = $('#wechat-appid');
    wechatSecret = $('#wechat-secret');
    wechatStatus = $('#wechat-status');
  }

  // ============= Toast =============
  var toastTimer;
  function showToast(msg, type) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = 'toast ' + (type || '') + ' show';
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3000);
  }

  // ============= API =============
  function apiGet(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (d) {
      if (!d.success) throw new Error(d.error || '请求失败');
      return d.data;
    });
  }

  function apiPost(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (d) {
      if (!d.success) throw new Error(d.error || '请求失败');
      return d.data;
    });
  }

  function apiDelete(url) {
    return fetch(url, { method: 'DELETE' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // ============= Content =============
  function getContentData() {
    var tags = (tagsInput.value || '').split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
    return {
      title: (titleInput.value || '').trim(),
      content: contentInput.value || '',
      summary: (summaryInput.value || '').trim(),
      tags: tags,
      category: categorySelect.value || '',
      coverImage: (coverInput.value || '').trim(),
      author: (authorInput.value || '').trim()
    };
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  // ============= Platform Chips =============
  function renderPlatformChips() {
    if (!platformSelector) return;
    var existing = platformSelector.querySelectorAll('.platform-chip');
    if (existing.length === 0) {
      platformSelector.innerHTML = state.platforms.map(function (p) {
        return '<div class="platform-chip ' + p.id + ' active" data-platform="' + p.id + '">' +
          '<span class="chip-dot"></span>' + p.name + '</div>';
      }).join('');
    }
    platformSelector.querySelectorAll('.platform-chip').forEach(function (chip) {
      var pid = chip.dataset.platform;
      if (chip.classList.contains('active')) state.selectedPlatforms.add(pid);
      chip.addEventListener('click', function () {
        if (state.selectedPlatforms.has(pid)) {
          state.selectedPlatforms.delete(pid);
          chip.classList.remove('active');
        } else {
          state.selectedPlatforms.add(pid);
          chip.classList.add('active');
        }
        updatePreviewTabs();
        updatePublishButton();
        if (state.selectedPlatforms.size > 0) refreshPreviews();
      });
    });
  }

  // ============= Preview =============
  function updatePreviewTabs() {
    var active = Array.from(state.selectedPlatforms);
    if (active.length === 0) {
      previewTabs.innerHTML = '';
      previewContent.innerHTML = '<div class="preview-placeholder"><div class="placeholder-icon">📝</div><p>选择上方平台查看格式适配效果</p></div>';
      state.currentTab = null;
      return;
    }
    previewTabs.innerHTML = state.platforms.filter(function (p) { return active.indexOf(p.id) !== -1; }).map(function (p, i) {
      var warns = state.previewData[p.id] && state.previewData[p.id].warnings;
      var badge = warns && warns.length ? '<span class="badge warn">' + warns.length + '</span>' : (state.previewData[p.id] ? '<span class="badge ok">✓</span>' : '');
      return '<button class="preview-tab' + (i === 0 ? ' active' : '') + '" data-platform="' + p.id + '">' + p.name + ' ' + badge + '</button>';
    }).join('');

    if (!state.currentTab || active.indexOf(state.currentTab) === -1) state.currentTab = active[0];

    previewTabs.querySelectorAll('.preview-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        previewTabs.querySelectorAll('.preview-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        state.currentTab = tab.dataset.platform;
        showPreviewPane(state.currentTab);
      });
    });
    showPreviewPane(state.currentTab);
  }

  function refreshPreviews() {
    if (state.selectedPlatforms.size === 0) return;
    var cd = getContentData();
    if (!cd.content && !cd.title) return;
    var ids = Array.from(state.selectedPlatforms);
    ids.forEach(function (pid, i) {
      apiPost('/api/preview', Object.assign({ platformId: pid }, cd)).then(function (data) {
        state.previewData[pid] = data;
        updatePreviewTabs();
      }).catch(function (err) {
        state.previewData[pid] = { error: err.message, platform: pid, platformId: pid };
        updatePreviewTabs();
      });
    });
  }

  function showPreviewPane(platformId) {
    var data = state.previewData[platformId];
    if (!data) { previewContent.innerHTML = '<div class="preview-placeholder"><div class="spinner"></div><p>加载中...</p></div>'; return; }
    if (data.error) { previewContent.innerHTML = '<div class="preview-placeholder"><p style="color:#d63031;">预览失败: ' + escapeHtml(data.error) + '</p></div>'; return; }

    var html = '';
    if (data.warnings && data.warnings.length) {
      html += '<div class="preview-warnings">' + data.warnings.map(function (w) { return '<div class="warn-item">⚠ ' + escapeHtml(w) + '</div>'; }).join('') + '</div>';
    }
    var p = data.preview;
    switch (platformId) {
      case 'wechat': html += renderWechat(p); break;
      case 'zhihu': html += renderZhihu(p); break;
      case 'bilibili': html += renderBilibili(p); break;
      case 'xiaohongshu': html += renderXiaohongshu(p); break;
    }
    if (data.tips && data.tips.length) {
      html += '<div class="preview-tips">' + data.tips.map(function (t) { return '<div class="tip-item">💡 ' + escapeHtml(t) + '</div>'; }).join('') + '</div>';
    }
    previewContent.innerHTML = html;
  }

  function renderWechat(p) {
    var cover = p.coverImage ? '<div class="preview-cover"><img src="' + escapeHtml(p.coverImage) + '" alt="封面" onerror="this.parentElement.innerHTML=\'封面图加载失败\'"></div>' : '<div class="preview-cover">📷 封面图（未设置）</div>';
    var summary = p.summary ? '<div class="preview-summary">📋 ' + escapeHtml(p.summary) + '</div>' : '';
    return '<div class="preview-wechat"><div class="preview-title">' + escapeHtml(p.title) + '</div>' + cover + summary + '<div class="preview-body">' + (p.content || '') + '</div><div style="text-align:center;color:#999;font-size:12px;margin-top:20px;padding:16px;border-top:1px solid #eee;">— END —<br><span style="font-size:10px;">模拟公众号文章</span></div></div>';
  }

  function renderZhihu(p) {
    var tags = p.tags && p.tags.length ? '<div class="zhihu-tags">' + p.tags.map(function (t) { return '<span class="zhihu-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '';
    return '<div class="preview-zhihu"><div class="preview-zhihu-header"><div class="zhihu-title">' + escapeHtml(p.title) + '</div>' + tags + '</div><div class="preview-zhihu-body">' + (p.content || '') + '</div></div>';
  }

  function renderBilibili(p) {
    var cover = p.coverImage ? '<div class="bili-cover"><img src="' + escapeHtml(p.coverImage) + '" alt="封面" onerror="this.parentElement.innerHTML=\'封面图加载失败\'"></div>' : '<div class="bili-cover">📷 专栏封面（B站必填）</div>';
    var tags = p.tags && p.tags.length ? p.tags.map(function (t) { return '<span class="zhihu-tag">' + escapeHtml(t) + '</span>'; }).join('') : '';
    return '<div class="preview-bilibili"><div class="preview-bili-header"><div class="bili-title">' + escapeHtml(p.title) + '</div><div class="bili-meta"><span>分类：' + (p.category ? escapeHtml(p.category.name) : '未设置') + '</span>' + (tags ? '<span>' + tags + '</span>' : '') + '</div></div>' + cover + '<div class="preview-bili-body">' + (p.content || '') + '</div></div>';
  }

  function renderXiaohongshu(p) {
    var img = p.images && p.images.length ? '<div class="xhs-image"><img src="' + escapeHtml(p.images[0]) + '" alt="图片" onerror="this.parentElement.innerHTML=\'图片加载失败\'"></div>' : '<div class="xhs-image">📷 需要上传封面图<br><span style="font-size:10px;">小红书必传</span></div>';
    return '<div class="preview-xiaohongshu">' + img + '<div class="xhs-body"><div class="xhs-title">' + escapeHtml(p.title) + '</div><div class="xhs-text">' + escapeHtml(p.body || '') + '</div><div class="xhs-hashtags">' + (p.hashtags ? escapeHtml(p.hashtags) : '') + '</div></div></div>';
  }

  // ============= Publish =============
  function updatePublishButton() {
    if (state.selectedPlatforms.size > 0) {
      btnPublish.disabled = state.isPublishing;
      if (state.publishMode === 'assisted') btnPublish.innerHTML = '🚀 辅助发布到 ' + state.selectedPlatforms.size + ' 个平台';
      else if (state.publishMode === 'real') btnPublish.innerHTML = '🚀 真实API发布到 ' + state.selectedPlatforms.size + ' 个平台';
      else btnPublish.innerHTML = '🚀 模拟发布到 ' + state.selectedPlatforms.size + ' 个平台';
    } else {
      btnPublish.disabled = true;
      btnPublish.innerHTML = '🚀 请先选择目标平台';
    }
  }

  // 辅助发布：打开平台编辑器 + 复制内容
  function assistedPublish() {
    if (state.selectedPlatforms.size === 0) { showToast('请先选择平台', 'error'); return; }
    var cd = getContentData();
    if (!cd.title || !cd.content) { showToast('请填写标题和正文', 'error'); return; }

    state.isPublishing = true;
    btnPublish.disabled = true;
    publishStatus.textContent = '';
    publishStatus.className = 'publish-status';

    apiPost('/api/publish-info', { platformIds: Array.from(state.selectedPlatforms), title: cd.title, content: cd.content, summary: cd.summary, tags: cd.tags, category: cd.category, coverImage: cd.coverImage, author: cd.author })
      .then(function (infos) {
        publishStatus.textContent = '⏳ 正在打开平台编辑器...';
        // 收集复制内容和打开的标签页
        var copyTexts = [];
        infos.forEach(function (info, i) {
          // 延迟打开，避免浏览器拦截弹窗
          setTimeout(function () {
            if (info.canOpenEditor && info.editorUrl) {
              window.open(info.editorUrl, '_blank');
            }
          }, i * 300);

          // 收集要复制的内容
          if (info.copyTarget === 'html' && info.adaptedContent.content) {
            copyTexts.push({ platform: info.platformName, content: info.adaptedContent.content, type: 'html' });
          } else if (info.copyTarget === 'markdown' && info.adaptedContent.content) {
            copyTexts.push({ platform: info.platformName, content: info.adaptedContent.content, type: 'text' });
          } else if (info.copyTarget === 'text' && info.adaptedContent.content) {
            copyTexts.push({ platform: info.platformName, content: info.adaptedContent.content + '\n\n' + info.adaptedContent.title, type: 'text' });
          }
        });

        if (copyTexts.length > 0) {
          // 平面文本复制（兼容所有浏览器）
          var allText = copyTexts.map(function (c) { return '--- ' + c.platform + ' ---\n' + c.content; }).join('\n\n\n');
          copyToClipboard(allText).then(function () {
            showToast('已复制 ' + copyTexts.length + ' 个平台的适配内容到剪贴板', 'success');
            publishStatus.textContent = '✅ 已打开 ' + infos.length + ' 个平台编辑器，内容已复制。请在各平台 Ctrl+V 粘贴发布';
            publishStatus.className = 'publish-status success';
            // 保存模拟记录
            infos.forEach(function (info) {
              apiPost('/api/publish', { platformIds: [info.platformId], title: cd.title, content: cd.content, summary: cd.summary, tags: cd.tags, category: cd.category, coverImage: cd.coverImage, author: cd.author }).catch(function () {});
            });
            loadHistory();
          }).catch(function () {
            showToast('已打开 ' + infos.length + ' 个编辑器，请手动复制内容后粘贴', 'success');
            publishStatus.textContent = '✅ 已打开编辑器，请手动 Ctrl+C 复制预览内容';
            publishStatus.className = 'publish-status success';
          });
        }
        state.isPublishing = false;
        btnPublish.disabled = false;
        updatePublishButton();
      })
      .catch(function (err) {
        showToast('获取发布信息失败: ' + err.message, 'error');
        state.isPublishing = false;
        btnPublish.disabled = false;
        updatePublishButton();
      });
  }

  // 真实API发布
  function realApiPublish() {
    if (state.selectedPlatforms.size === 0) { showToast('请先选择平台', 'error'); return; }
    var cd = getContentData();
    if (!cd.title || !cd.content) { showToast('请填写标题和正文', 'error'); return; }
    state.isPublishing = true;
    btnPublish.disabled = true;
    publishStatus.textContent = '⏳ 真实API发布中...';
    publishStatus.className = 'publish-status';

    apiPost('/api/publish-real', { platformIds: Array.from(state.selectedPlatforms), title: cd.title, content: cd.content, summary: cd.summary, tags: cd.tags, category: cd.category, coverImage: cd.coverImage, author: cd.author })
      .then(function (results) {
        var success = results.filter(function (r) { return r.status === 'published'; }).length;
        var failed = results.filter(function (r) { return r.status === 'failed'; });
        var real = results.filter(function (r) { return r.isReal; });

        if (failed.length > 0) {
          publishStatus.textContent = '⚠ 部分发布失败: ' + failed.map(function (f) { return f.platformName + ': ' + f.error; }).join('; ');
          publishStatus.className = 'publish-status error';
        } else if (real.length > 0) {
          publishStatus.textContent = '✅ 真实API发布成功！' + real.map(function (r) { return r.platformName + '草稿已创建'; }).join(', ');
          publishStatus.className = 'publish-status success';
        } else {
          publishStatus.textContent = '✅ 发布完成 | ' + success + '/' + results.length + ' 个平台';
          publishStatus.className = 'publish-status success';
        }
        showToast('发布完成：' + success + ' 成功，' + failed.length + ' 失败', failed.length ? 'error' : 'success');
        loadHistory();
        state.isPublishing = false;
        btnPublish.disabled = false;
        updatePublishButton();
      })
      .catch(function (err) {
        showToast('发布失败: ' + err.message, 'error');
        publishStatus.textContent = '❌ 发布失败: ' + err.message;
        publishStatus.className = 'publish-status error';
        state.isPublishing = false;
        btnPublish.disabled = false;
        updatePublishButton();
      });
  }

  // 模拟发布
  function simulatePublish() {
    if (state.selectedPlatforms.size === 0) { showToast('请先选择平台', 'error'); return; }
    var cd = getContentData();
    if (!cd.title || !cd.content) { showToast('请填写标题和正文', 'error'); return; }
    state.isPublishing = true;
    btnPublish.disabled = true;

    var platformIds = Array.from(state.selectedPlatforms);
    var total = platformIds.length;
    function publishOne(i) {
      if (i >= total) {
        showToast('模拟发布完成！共 ' + total + ' 个平台', 'success');
        publishStatus.textContent = '✅ 模拟发布完成 | ' + total + ' 个平台';
        publishStatus.className = 'publish-status success';
        btnPublish.innerHTML = '🚀 模拟发布到 ' + total + ' 个平台';
        state.isPublishing = false;
        btnPublish.disabled = false;
        loadHistory();
        return;
      }
      var pid = platformIds[i];
      var pname = '';
      for (var j = 0; j < state.platforms.length; j++) { if (state.platforms[j].id === pid) { pname = state.platforms[j].name; break; } }
      btnPublish.innerHTML = '<span class="spinner"></span> 模拟发布到 ' + pname + ' (' + (i + 1) + '/' + total + ')...';
      publishStatus.textContent = '⏳ ' + pname + ' 模拟发布中...';

      apiPost('/api/publish', Object.assign({ platformIds: [pid] }, cd))
        .then(function () { publishStatus.textContent = '✅ ' + pname + ' 模拟成功'; setTimeout(function () { publishOne(i + 1); }, 300); })
        .catch(function (err) { publishStatus.textContent = '❌ ' + pname + ' 失败: ' + err.message; publishStatus.className = 'publish-status error'; setTimeout(function () { publishOne(i + 1); }, 500); });
    }
    publishOne(0);
  }

  // 一键复制全部内容
  function copyAllContent() {
    var cd = getContentData();
    if (!cd.content) { showToast('请输入正文内容', 'error'); return; }
    var ids = Array.from(state.selectedPlatforms);
    if (ids.length === 0) { ids = state.platforms.map(function (p) { return p.id; }); }

    apiPost('/api/transform', Object.assign({ platformId: 'all' }, cd))
      .then(function (result) {
        var texts = [];
        for (var pid in result) {
          if (result.hasOwnProperty(pid)) {
            var pname = '';
            for (var k = 0; k < state.platforms.length; k++) { if (state.platforms[k].id === pid) { pname = state.platforms[k].name; break; } }
            texts.push('--- ' + pname + ' ---\n' + (result[pid].content || ''));
          }
        }
        copyToClipboard(texts.join('\n\n\n')).then(function () {
          showToast('已复制全部平台适配内容到剪贴板', 'success');
        });
      })
      .catch(function (err) { showToast('转换失败: ' + err.message, 'error'); });
  }

  // 剪贴板工具
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // 降级方案
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) {
        reject(e);
      }
      document.body.removeChild(ta);
    });
  }

  // ============= History =============
  function loadHistory() {
    apiGet('/api/history').then(function (history) {
      if (!history || history.length === 0) { historyList.innerHTML = '<p class="empty-hint">暂无发布记录</p>'; return; }
      historyList.innerHTML = history.map(function (item) {
        return '<div class="history-item"><div class="history-platform"><span class="history-dot ' + item.platformId + '"></span><span>' + item.platformName + '</span></div>' +
          '<span class="history-title">' + escapeHtml(item.title) + '</span>' +
          '<div class="history-meta"><span class="history-status published">' + (item.isReal ? '真实发布' : '已发布') + '</span>' +
          '<a class="history-url" href="' + item.platformUrl + '" target="_blank">🔗 打开</a>' +
          '<span>' + new Date(item.publishedAt).toLocaleString('zh-CN') + '</span></div></div>';
      }).join('');
    }).catch(function (err) { historyList.innerHTML = '<p class="empty-hint" style="color:#d63031;">加载失败</p>'; });
  }

  // ============= Mode Switch =============
  function bindModeTabs() {
    $$('.publish-mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.publish-mode-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.publishMode = btn.dataset.mode;
        updatePublishButton();
        // 真实API模式时显示微信配置
        if (state.publishMode === 'real') {
          wechatConfig.style.display = 'block';
        } else {
          wechatConfig.style.display = 'none';
        }
      });
    });
  }

  // ============= WeChat Config =============
  function checkWechatStatus() {
    apiGet('/api/wechat/status').then(function (data) {
      if (data.configured) {
        wechatStatus.textContent = '✅ 微信API已配置';
        wechatStatus.className = 'config-status ok';
      } else {
        wechatStatus.textContent = '⚠ 未配置微信API（不影响辅助发布）';
        wechatStatus.className = 'config-status err';
      }
    }).catch(function () {});
  }

  // ============= Events =============
  function bindEvents() {
    btnPublish.addEventListener('click', function () {
      if (state.isPublishing) return;
      if (state.publishMode === 'assisted') assistedPublish();
      else if (state.publishMode === 'real') realApiPublish();
      else simulatePublish();
    });

    btnCopyAll.addEventListener('click', copyAllContent);

    $('#btn-preview-all').addEventListener('click', function () {
      if (state.selectedPlatforms.size === 0) { showToast('请先选择目标平台', 'error'); return; }
      refreshPreviews();
      showToast('预览已刷新', 'success');
    });

    $('#btn-clear-history').addEventListener('click', function () {
      apiDelete('/api/history').then(function () {
        historyList.innerHTML = '<p class="empty-hint">历史已清除</p>';
        showToast('已清除', 'success');
      }).catch(function (err) { showToast('清除失败: ' + err.message, 'error'); });
    });

    $('#btn-save-wechat').addEventListener('click', function () {
      var appId = wechatAppid.value.trim();
      var secret = wechatSecret.value.trim();
      if (!appId || !secret) { showToast('请填写 AppID 和 AppSecret', 'error'); return; }
      apiPost('/api/wechat/config', { appId: appId, appSecret: secret }).then(function () {
        showToast('微信API配置成功', 'success');
        checkWechatStatus();
      }).catch(function (err) { showToast('配置失败: ' + err.message, 'error'); });
    });

    titleInput.addEventListener('input', function () { $('#title-count').textContent = titleInput.value.length; });
    summaryInput.addEventListener('input', function () { $('#summary-count').textContent = summaryInput.value.length; });
    contentInput.addEventListener('input', function () { $('#content-count').textContent = contentInput.value.length; });

    var toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) {
      toolbar.addEventListener('click', function (e) {
        var btn = e.target.closest('.tb-btn');
        if (!btn) return;
        var action = btn.dataset.action;
        var ta = contentInput;
        var start = ta.selectionStart, end = ta.selectionEnd;
        var text = ta.value, selected = text.substring(start, end);
        var replacement = '', cursorOffset = 0;
        switch (action) {
          case 'bold': replacement = '**' + (selected || '粗体') + '**'; cursorOffset = selected ? 0 : -2; break;
          case 'italic': replacement = '*' + (selected || '斜体') + '*'; cursorOffset = selected ? 0 : -1; break;
          case 'heading': replacement = '\n## ' + (selected || '标题') + '\n'; break;
          case 'link': replacement = '[' + (selected || '链接') + '](url)'; cursorOffset = selected ? 0 : -4; break;
          case 'image': replacement = '![' + (selected || '图片') + '](URL)'; break;
          case 'quote': replacement = '> ' + (selected || '引用'); break;
          case 'list': replacement = selected ? selected.split('\n').map(function (l) { return '- ' + l; }).join('\n') : '- 列表项'; break;
          case 'code': replacement = selected ? '```\n' + selected + '\n```' : '`代码`'; cursorOffset = selected ? 0 : -1; break;
          case 'hr': replacement = '\n---\n'; break;
        }
        ta.value = text.substring(0, start) + replacement + text.substring(end);
        ta.focus();
        ta.setSelectionRange(start + replacement.length + cursorOffset, start + replacement.length + cursorOffset);
        ta.dispatchEvent(new Event('input'));
      });
    }
  }

  // ============= Start =============
  function init() {
    initDom();
    bindModeTabs();
    checkWechatStatus();

    apiGet('/api/platforms').then(function (platforms) {
      state.platforms = platforms;
      console.log('[发布工具] 已加载 ' + platforms.length + ' 个平台');
      renderPlatformChips();
      bindEvents();
      updatePublishButton();
      loadHistory();
      console.log('[发布工具] 初始化完成。当前模式: ' + state.publishMode);
    }).catch(function (err) {
      console.error('[发布工具] 加载平台失败:', err);
      showToast('无法连接后端服务，请运行 npm start', 'error');
    });
  }

  init();
})();
