// 微信公众号真实 API 发布模块
// 使用微信公众平台 "草稿箱" API 创建草稿
// 文档: https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add_draft.html

class WechatApiPublisher {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.appId = '';
    this.appSecret = '';
  }

  // 配置凭证
  configure(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  get isConfigured() {
    return !!(this.appId && this.appSecret);
  }

  // 获取 access_token（自动缓存和刷新）
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.errcode) {
      throw new Error(`微信API错误 [${data.errcode}]: ${data.errmsg}`);
    }

    this.accessToken = data.access_token;
    // 提前5分钟过期
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return this.accessToken;
  }

  // 创建草稿
  // articles: [{ title, content, author, digest, content_source_url, thumb_media_id, ... }]
  async createDraft(articles) {
    const token = await this.getAccessToken();

    const body = {
      articles: articles.map(article => ({
        title: article.title || '',
        content: article.content || '',
        author: article.author || '',
        digest: article.digest || '',
        content_source_url: article.content_source_url || '',
        thumb_media_id: article.thumb_media_id || '',
        need_open_comment: 0,
        only_fans_can_comment: 0,
        show_cover_pic: article.coverImage ? 1 : 0
      }))
    };

    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const data = await res.json();

    if (data.errcode) {
      throw new Error(`微信草稿创建失败 [${data.errcode}]: ${data.errmsg}`);
    }

    return {
      media_id: data.media_id,
      url: `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=${data.media_id}&isMul=1`
    };
  }

  // 发布草稿（群发）
  async publishDraft(mediaId) {
    const token = await this.getAccessToken();

    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: mediaId })
      }
    );

    const data = await res.json();

    if (data.errcode) {
      throw new Error(`微信发布失败 [${data.errcode}]: ${data.errmsg}`);
    }

    return {
      publish_id: data.publish_id,
      message: '发布任务已提交，请到公众号后台确认'
    };
  }
}

module.exports = WechatApiPublisher;
