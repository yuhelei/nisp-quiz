/**
 * router.js - 极简 hash 路由
 *
 * 路由格式: #/home, #/practice?subject=km1&mode=sequence&chapter=xxx
 *
 * 提供：
 *   Router.register(pattern, handler)
 *   Router.navigate(path)
 *   Router.start(defaultRoute)
 *   Router.parseQuery()
 */
(function (global) {
  'use strict';

  var routes = [];
  var currentHandler = null;
  var currentPath = '';

  /**
   * 注册路由
   * @param {string|RegExp} pattern  例如 '/practice' 或 /^\/practice$/
   * @param {function} handler      接收 (params, query) -> { teardown?: fn }
   */
  function register(pattern, handler) {
    routes.push({ pattern: pattern, handler: handler });
  }

  function match(path) {
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      var pat = r.pattern;
      if (pat instanceof RegExp) {
        var m = pat.exec(path);
        if (m) {
          var params = {};
          if (m.groups) Object.keys(m.groups).forEach(function (k) { params[k] = m.groups[k]; });
          return { handler: r.handler, params: params, query: parseQuery() };
        }
      } else if (typeof pat === 'string') {
        if (path === pat) {
          return { handler: r.handler, params: {}, query: parseQuery() };
        }
      }
    }
    return null;
  }

  /**
   * 解析 hash 中的 query
   * 例如: #/practice?subject=km1&mode=sequence
   */
  function parseQuery() {
    var hash = location.hash || '';
    var qIdx = hash.indexOf('?');
    if (qIdx === -1) return {};
    var qs = hash.slice(qIdx + 1);
    var result = {};
    qs.split('&').forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      var k, v;
      if (eq === -1) {
        k = pair; v = '';
      } else {
        k = decodeURIComponent(pair.slice(0, eq));
        v = decodeURIComponent(pair.slice(eq + 1));
      }
      // 支持同名多值
      if (result[k] === undefined) {
        result[k] = v;
      } else if (Array.isArray(result[k])) {
        result[k].push(v);
      } else {
        result[k] = [result[k], v];
      }
    });
    return result;
  }

  /**
   * 解析当前路径（去掉 query）
   * 注意：必须先在去掉 # 的字符串上找 ?，否则索引会偏移 1 位，
   * 导致 '#/practice?mode=xxx' 被解析成 '/practice?' 而匹配失败
   */
  function currentPathOnly() {
    var hash = location.hash || '';
    var p = hash.replace(/^#/, '');
    var qIdx = p.indexOf('?');
    if (qIdx !== -1) p = p.slice(0, qIdx);
    if (!p) p = '/home';
    return p;
  }

  /**
   * 触发路由匹配
   */
  function resolve() {
    var path = currentPathOnly();
    var m = match(path);
    if (m) {
      // 卸载上一个
      if (currentHandler && currentHandler.teardown) {
        try { currentHandler.teardown(); } catch (e) { console.warn(e); }
      }
      currentHandler = m.handler;
      currentPath = path;
      try {
        m.handler(m.params, m.query);
      } catch (e) {
        console.error('[router] handler error:', e);
      }
    } else {
      console.warn('[router] no match for', path);
    }
  }

  /**
   * 导航到路径
   */
  function navigate(path) {
    if (location.hash === '#' + path) {
      resolve();
    } else {
      location.hash = path;
    }
  }

  /**
   * 启动路由
   */
  function start(defaultRoute) {
    if (!location.hash && defaultRoute) {
      location.hash = defaultRoute;
    }
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  global.Router = {
    register: register,
    navigate: navigate,
    start: start,
    parseQuery: parseQuery,
    currentPath: function () { return currentPath; },
  };

})(window);
