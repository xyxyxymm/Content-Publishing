// 多平台内容发布工具 - 前端交互逻辑
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  var titleInput, coverInput, summaryInput, categorySelect, tagsInput, authorInput;
  var contentInput, platformSelector, previewTabs, previewContent;
  var btnPublish, publishStatus, historyList, toast;
  var wechatConfig, wechatAppid, wechatSecret, wechatStatus;
  var coverDropzone, coverPreview, coverDataInput, btnCoverClear;

  var state = {
    platforms: [],
    selectedPlatforms: new Set(),
    currentTab: null,
    previewData: {},
    isPublishing: false
  };

  // ============= Init =============
  function initDom() {
    titleInput = $('#title');
    coverInput = $('#coverImage');
    coverDropzone = $('#cover-dropzone');
    coverPreview = $('#cover-preview');
    coverDataInput = $('#cover-data');
    btnCoverClear = $('#btn-cover-clear');
    summaryInput = $('#summary');
    categorySelect = $('#category');
    tagsInput = $('#tags');
    authorInput = $('#author');
    contentInput = $('#content');
    platformSelector = $('#platform-selector');
    previewTabs = $('#preview-tabs');
    previewContent = $('#preview-content');
    btnPublish = $('#btn-publish');
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
    var tags = tagsInput ? (tagsInput.value || '').split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean) : [];
    var rawCover = (coverDataInput.value || coverInput.value || '').trim();
    // 预览时 base64 太长会拖慢请求，只传标记；发布时才传完整数据
    var isDataUrl = rawCover.startsWith('data:');
    return {
      title: (titleInput.value || '').trim(),
      content: contentInput.value || '',
      summary: (summaryInput.value || '').trim(),
      tags: tags,
      category: categorySelect.value || '',
      coverImage: rawCover,
      _coverIsDataUrl: isDataUrl,
      author: (authorInput.value || '').trim()
    };
  }

  function getPublishData() {
    var cd = getContentData();
    // 发布时确保传完整封面数据
    return cd;
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
      chip.addEventListener('click', function () {
        if (state.selectedPlatforms.has(pid)) {
          state.selectedPlatforms.delete(pid);
          chip.classList.remove('active');
        } else {
          // 单选：先清除所有，再选中当前
          state.selectedPlatforms.clear();
          platformSelector.querySelectorAll('.platform-chip').forEach(function (c) { c.classList.remove('active'); });
          state.selectedPlatforms.add(pid);
          chip.classList.add('active');
        }
        updatePreviewTabs();
        updatePublishButton();
        updateSummaryVisibility();
        if (state.selectedPlatforms.size > 0) refreshPreviews();
      });
    });
  }

  // ============= Preview =============
  function updatePreviewTabs() {
    var active = Array.from(state.selectedPlatforms);
    if (active.length === 0) {
      previewTabs.innerHTML = '';
      previewContent.innerHTML = '<div class="preview-placeholder"><div class="placeholder-icon">📝</div><p>选择一个平台查看格式适配效果</p></div>';
      state.currentTab = null;
      return;
    }

    state.currentTab = active[0];
    // 单选：不显示页签，直接展示预览
    previewTabs.innerHTML = '';
    showPreviewPane(state.currentTab);
  }

  function refreshPreviews() {
    if (state.selectedPlatforms.size === 0) return;
    var cd = getContentData();
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
    var body = p.htmlContent || p.content || '';
    return '<div class="preview-zhihu"><div class="preview-zhihu-header"><div class="zhihu-title">' + escapeHtml(p.title) + '</div>' + tags + '</div><div class="preview-zhihu-body">' + body + '</div></div>';
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
      var pid = Array.from(state.selectedPlatforms)[0];
      var pname = '';
      for (var i = 0; i < state.platforms.length; i++) {
        if (state.platforms[i].id === pid) { pname = state.platforms[i].name; break; }
      }
      if (pid === 'wechat') btnPublish.innerHTML = '🚀 真实API发布到 ' + pname;
      else btnPublish.innerHTML = '🚀 辅助发布到 ' + pname;
    } else {
      btnPublish.disabled = true;
      btnPublish.innerHTML = '🚀 请先选择目标平台';
    }
  }

  function updateSummaryVisibility() {
    var summaryGroup = $('#summary-group');
    if (summaryGroup) summaryGroup.style.display = state.selectedPlatforms.has('wechat') ? 'block' : 'none';

    var tagsGroup = $('#tags-group');
    if (tagsGroup) tagsGroup.style.display = (state.selectedPlatforms.has('zhihu') || state.selectedPlatforms.has('xiaohongshu')) ? 'block' : 'none';

    var categoryGroup = $('#category-group');
    if (categoryGroup) categoryGroup.style.display = 'none';

    var coverGroup = $('#cover-group');
    if (coverGroup) coverGroup.style.display = (state.selectedPlatforms.has('zhihu') || state.selectedPlatforms.has('bilibili')) ? 'none' : 'block';

    if (wechatConfig) {
      wechatConfig.style.display = state.selectedPlatforms.has('wechat') ? 'block' : 'none';
    }
  }

  // 辅助发布：打开平台编辑器 + 复制内容
  function assistedPublish() {
    if (state.selectedPlatforms.size === 0) { showToast('请先选择平台', 'error'); return; }
    var cd = getContentData();
    if (!cd.title || !cd.content) { showToast('请填写标题和正文', 'error'); return; }

    state.isPublishing = true;
    btnPublish.disabled = true;

    apiPost('/api/publish-info', { platformIds: Array.from(state.selectedPlatforms), title: cd.title, content: cd.content, summary: cd.summary, tags: cd.tags, category: cd.category, coverImage: cd.coverImage, author: cd.author })
      .then(function (infos) {
        var copyTexts = [];
        infos.forEach(function (info, i) {
          setTimeout(function () {
            if (info.canOpenEditor && info.editorUrl) {
              window.open(info.editorUrl, '_blank');
            }
          }, i * 300);

          if (info.copyTarget === 'html' && info.adaptedContent.content) {
            copyTexts.push({ platform: info.platformName, content: info.adaptedContent.content, type: 'html' });
          } else if (info.copyTarget === 'markdown' && info.adaptedContent.content) {
            copyTexts.push({ platform: info.platformName, content: info.adaptedContent.content, type: 'text' });
          } else if (info.copyTarget === 'text' && info.adaptedContent.content) {
            copyTexts.push({ platform: info.platformName, content: info.adaptedContent.content + '\n\n' + info.adaptedContent.title, type: 'text' });
          }
        });

        var msg = '';
        if (copyTexts.length > 0) {
          var allText = copyTexts.map(function (c) { return '--- ' + c.platform + ' ---\n' + c.content; }).join('\n\n\n');
          copyToClipboard(allText).then(function () {
            showToast('已打开 ' + infos.length + ' 个平台，内容已复制', 'success');
            infos.forEach(function (info) {
              apiPost('/api/publish', { platformIds: [info.platformId], title: cd.title, content: cd.content, summary: cd.summary, tags: cd.tags, category: cd.category, coverImage: cd.coverImage, author: cd.author }).catch(function () {});
            });
            loadHistory();
            $('#history-body').style.display = 'block';
          }).catch(function () {
            showToast('已打开 ' + infos.length + ' 个编辑器，请手动复制内容后粘贴', 'success');
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

    apiPost('/api/publish-real', { platformIds: Array.from(state.selectedPlatforms), title: cd.title, content: cd.content, summary: cd.summary, tags: cd.tags, category: cd.category, coverImage: cd.coverImage, author: cd.author })
      .then(function (results) {
        var failed = results.filter(function (r) { return r.status === 'failed'; });

        if (failed.length > 0) {
          showToast('发布失败: ' + failed.map(function (f) { return f.platformName + ': ' + f.error; }).join('; '), 'error');
        } else {
          showToast('发布完成', 'success');
        }
        loadHistory();
        $('#history-body').style.display = 'block';
        state.isPublishing = false;
        btnPublish.disabled = false;
        updatePublishButton();
      })
      .catch(function (err) {
        showToast('发布失败: ' + err.message, 'error');
        state.isPublishing = false;
        btnPublish.disabled = false;
        updatePublishButton();
      });
  }

  // 一键复制全部内容
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
          '<div class="history-meta"><span class="history-status published">' + (item.isReal ? '真实发布' : (item.status === 'assisted' ? '辅助发布' : '已发布')) + '</span>' +
          '<span>' + new Date(item.publishedAt).toLocaleString('zh-CN') + '</span></div></div>';
      }).join('');
    }).catch(function (err) { historyList.innerHTML = '<p class="empty-hint" style="color:#d63031;">加载失败</p>'; });
  }

  // ============= Mode Switch =============
  // ============= WeChat Config Toggle =============
  function bindWechatToggle() {
    var wechatToggleBtn = $('#btn-toggle-wechat');
    var configBody = $('#config-body');
    if (wechatToggleBtn) {
      wechatToggleBtn.addEventListener('click', function () {
        if (configBody.style.display === 'none') {
          configBody.style.display = 'block';
        } else {
          configBody.style.display = 'none';
        }
      });
    }
  }

  // ============= WeChat Config =============
  function checkWechatStatus() {
    apiGet('/api/wechat/status').then(function (data) {
      if (data.configured) {
        wechatStatus.textContent = '✅ 微信API已配置';
        wechatStatus.className = 'config-status ok';
        var btn = $('#btn-toggle-wechat');
        if (btn) btn.textContent = '⚙ 微信公众号 API 配置 (已配置)';
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
      var pid = state.selectedPlatforms.size > 0 ? Array.from(state.selectedPlatforms)[0] : '';
      if (pid === 'wechat') realApiPublish();
      else assistedPublish();
    });

    $('#btn-preview-all').addEventListener('click', function () {
      if (state.selectedPlatforms.size === 0) { showToast('请先选择目标平台', 'error'); return; }
      refreshPreviews();
      showToast('预览已刷新', 'success');
    });

    $('#btn-toggle-history').addEventListener('click', function () {
      var body = $('#history-body');
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
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
        var btn = $('#btn-toggle-wechat');
        if (wechatStatus.textContent.indexOf('✅') !== -1) {
          btn.textContent = '⚙ 微信公众号 API 配置 (已配置)';
          $('#config-body').style.display = 'none';
        }
      }).catch(function (err) { showToast('配置失败: ' + err.message, 'error'); });
    });

    titleInput.addEventListener('input', function () { $('#title-count').textContent = titleInput.value.length; });
    summaryInput.addEventListener('input', function () { $('#summary-count').textContent = summaryInput.value.length; });
    var previewTimer;
    contentInput.addEventListener('input', function () {
      $('#content-count').textContent = contentInput.value.length;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(function () {
        if (state.selectedPlatforms.size > 0) refreshPreviews();
      }, 300);
    });

    contentInput.addEventListener('paste', function (e) {
      e.preventDefault();
      var clipboardData = e.clipboardData || window.clipboardData;
      var text = clipboardData.getData('text/plain');
      if (!text) return;
      var ta = this;
      var start = ta.selectionStart;
      var end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 封面：粘贴 / 点击 / 拖拽
    coverDropzone.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          handleCoverFile(items[i].getAsFile());
          return;
        }
      }
    });

    coverDropzone.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = function () { if (input.files[0]) handleCoverFile(input.files[0]); };
      input.click();
    });

    coverDropzone.addEventListener('dragover', function (e) { e.preventDefault(); coverDropzone.classList.add('drag-over'); });
    coverDropzone.addEventListener('dragleave', function () { coverDropzone.classList.remove('drag-over'); });
    coverDropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      coverDropzone.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (file && file.type.indexOf('image') !== -1) handleCoverFile(file);
    });

    btnCoverClear.addEventListener('click', function (e) {
      e.stopPropagation();
      coverDataInput.value = '';
      coverInput.value = '';
      coverInput.style.display = 'none';
      $('#btn-cover-url').style.display = '';
      coverPreview.style.display = 'none';
      coverPreview.src = '';
      coverDropzone.classList.remove('has-image');
      btnCoverClear.style.display = 'none';
    });

    // 图片URL按钮：点击切换输入框显示/隐藏
    var btnCoverUrl = $('#btn-cover-url');
    btnCoverUrl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (coverInput.style.display === 'none') {
        coverInput.style.display = '';
        coverInput.focus();
      } else {
        coverInput.style.display = 'none';
      }
    });

    // URL 输入变化时更新预览
    coverInput.addEventListener('input', function () {
      var url = coverInput.value.trim();
      if (url && url.startsWith('http')) {
        coverPreview.src = url;
        coverPreview.style.display = 'block';
        coverDropzone.classList.add('has-image');
        btnCoverClear.style.display = 'block';
        coverDataInput.value = '';
      }
    });

    // URL 输入变化时更新预览
    coverInput.addEventListener('input', function () {
      var url = coverInput.value.trim();
      if (url && url.startsWith('http')) {
        coverPreview.src = url;
        coverPreview.style.display = 'block';
        coverDropzone.classList.add('has-image');
        btnCoverClear.style.display = 'inline-flex';
        coverDataInput.value = '';
      }
    });

    function handleCoverFile(file) {
      var reader = new FileReader();
      reader.onload = function () {
        coverDataInput.value = reader.result;
        coverInput.value = '';
        coverPreview.src = reader.result;
        coverPreview.style.display = 'block';
        coverDropzone.classList.add('has-image');
        btnCoverClear.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    }

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
    bindWechatToggle();
    checkWechatStatus();

    apiGet('/api/platforms').then(function (platforms) {
      state.platforms = platforms;
      console.log('[发布工具] 已加载 ' + platforms.length + ' 个平台');
      renderPlatformChips();
      bindEvents();
      updatePublishButton();
      updateSummaryVisibility();
      loadHistory();
      console.log('[发布工具] 初始化完成');
    }).catch(function (err) {
      console.error('[发布工具] 加载平台失败:', err);
      showToast('无法连接后端服务，请运行 npm start', 'error');
    });
  }

  init();
})();
