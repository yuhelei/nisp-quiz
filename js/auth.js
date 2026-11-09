/**
 * auth.js - 登录认证 + 云端数据同步
 *
 * 依赖：storage.js（在其后加载）
 * 提供：
 *   Auth  — token 管理 / API 封装 / 后端探测 / 登录登出
 *   Sync  — 本地刷题数据 ↔ MySQL（user_state 表）双向同步
 */
(function (global) {
  'use strict';

  var AUTH_KEY = 'nisp_auth_token';
  var sessionToken = null;              // 未勾选「记住密码」时的会话级 token
  var state = { online: false };        // 后端可达性

  // ============ 本地登录态 ============
  function getStored() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function store(a) {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch (e) {}
  }
  function token() {
    if (sessionToken) return sessionToken;
    var a = getStored();
    return a ? a.token : null;
  }
  function username() {
    if (sessionToken && sessionUsername) return sessionUsername;
    var a = getStored();
    return a ? a.username : null;
  }
  var sessionUsername = null;

  /**
   * 保存登录态
   * @param remember true=localStorage 持久化（30 天免登录）；false=仅当前页面会话
   */
  function signIn(tk, uname, remember) {
    sessionUsername = uname;
    if (remember) store({ token: tk, username: uname, ts: Date.now() });
    else sessionToken = tk;
  }

  function signOut() {
    clearTokenOnly();
  }
  function clearTokenOnly() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    sessionToken = null;
    sessionUsername = null;
  }

  // ============ API 封装 ============
  /**
   * 调用后端接口。返回 Promise<{ok, ...}>，网络失败时返回 {ok:false, offline:true}
   * @param {string} path 如 '/login'
   * @param {{method?:string, body?:object, timeout?:number}} opts
   */
  function api(path, opts) {
    opts = opts || {};
    var headers = {};
    var t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    if (opts.body) headers['Content-Type'] = 'application/json';
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 5000) : null;
    return fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return { ok: false, msg: '响应解析失败' }; });
    }, function () {
      if (timer) clearTimeout(timer);
      return { ok: false, offline: true, msg: '无法连接服务器' };
    });
  }

  /** 探测后端可达性（3 秒超时）；file:// 协议下直接判定离线，避免无谓请求 */
  function probe() {
    if (location.protocol === 'file:') {
      state.online = false;
      return Promise.resolve(false);
    }
    return api('/ping', { timeout: 3000 }).then(function (r) {
      state.online = !!(r && r.ok);
      return state.online;
    });
  }

  // ============ 云端数据同步 ============
  var pushTimer = null;

  function exportLocal() {
    var S = global.Storage;
    return {
      progress_km1: S.getProgress('km1'),
      progress_km4: S.getProgress('km4'),
      wrong: S.getWrong(),
      favorite: S.getFavorite(),
      examHistory: S.getExamHistory(),
      stats: S.getStats(),
      exportedAt: Date.now(),
    };
  }

  function importLocal(data) {
    var S = global.Storage;
    if (!data || typeof data !== 'object') return;
    S.pauseSync = true; // 导入过程中不触发回推
    try {
      if (data.progress_km1 && typeof data.progress_km1 === 'object') S.setProgress('km1', data.progress_km1);
      if (data.progress_km4 && typeof data.progress_km4 === 'object') S.setProgress('km4', data.progress_km4);
      if (data.wrong && typeof data.wrong === 'object') S.setWrong(data.wrong);
      if (Array.isArray(data.favorite)) S.setFavorite(data.favorite);
      if (Array.isArray(data.examHistory)) S.setExamHistory(data.examHistory);
      if (data.stats && typeof data.stats === 'object') S.setStats(data.stats);
    } finally {
      S.pauseSync = false;
    }
  }

  /**
   * 登录后拉取云端状态：
   *   服务端有数据 → 覆盖本地（返回 'server'）
   *   服务端无数据 → 上传本地（返回 'local'）
   */
  function pull() {
    if (!state.online || !token()) return Promise.resolve(false);
    return api('/state', { timeout: 6000 }).then(function (r) {
      if (!r.ok) return false;
      if (r.data) { importLocal(r.data); return 'server'; }
      push();
      return 'local';
    });
  }

  /** 本地数据变化后防抖推送（1.2s 合并多次写入） */
  function push() {
    if (!state.online || !token()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      api('/state', { method: 'POST', body: { data: exportLocal() }, timeout: 8000 });
    }, 1200);
  }

  /** 立即推送（跳过防抖），返回 Promise<boolean>，供「我的 → 立即同步」使用 */
  function pushNow() {
    if (!state.online || !token()) return Promise.resolve(false);
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    return api('/state', { method: 'POST', body: { data: exportLocal() }, timeout: 8000 })
      .then(function (r) { return !!(r && r.ok); });
  }

  // 挂接 Storage 变更钩子（storage.js 加载后设置）
  if (global.Storage) {
    global.Storage.onChange = function () { push(); };
  }

  // ============ 暴露 ============
  global.Auth = {
    state: state,
    token: token,
    username: username,
    signIn: signIn,
    signOut: signOut,
    api: api,
    probe: probe,
  };
  global.Sync = {
    pull: pull,
    push: push,
    pushNow: pushNow,
  };

})(window);
