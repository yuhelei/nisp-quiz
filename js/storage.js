/**
 * storage.js - localStorage 封装
 *
 * 提供统一的存储接口，避免业务代码直接散落 localStorage 调用。
 * 涉及 key：
 *   progress_km1, progress_km4  - 顺序练习进度
 *   wrong_questions             - 错题本
 *   favorite_questions          - 收藏
 *   exam_history                - 模拟考试历史
 *   study_stats                 - 学习统计
 */
(function (global) {
  'use strict';

  var NS = 'nisp_'; // 命名空间，避免与其他站点冲突
  var KEYS = {
    PROGRESS_KM1: NS + 'progress_km1',
    PROGRESS_KM4: NS + 'progress_km4',
    WRONG: NS + 'wrong_questions',
    FAVORITE: NS + 'favorite_questions',
    EXAM: NS + 'exam_history',
    STATS: NS + 'study_stats',
  };

  /**
   * 安全读取 JSON。失败时返回默认值。
   */
  function readJSON(key, defaultValue) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[storage] read fail:', key, e);
      return defaultValue;
    }
  }

  /**
   * 安全写入 JSON。失败时静默降级到控制台。
   * 写入成功后触发 onChange 钩子（由 auth.js 设置，用于云端同步）；
   * pauseSync = true 期间（云端导入）不触发，避免回环。
   */
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      var api = global.Storage;
      if (api && api.onChange && !api.pauseSync) {
        try { api.onChange(key, value); } catch (e) {}
      }
    } catch (e) {
      console.warn('[storage] write fail:', key, e);
    }
  }

  /**
   * 通用工具：今天日期字符串 (YYYY-MM-DD)
   */
  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * 通用工具：生成短 ID
   */
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ============ 进度 ============

  function getProgress(subject) {
    var key = subject === 'km4' ? KEYS.PROGRESS_KM4 : KEYS.PROGRESS_KM1;
    return readJSON(key, { idx: 0, lastTs: 0 });
  }

  function setProgress(subject, data) {
    var key = subject === 'km4' ? KEYS.PROGRESS_KM4 : KEYS.PROGRESS_KM1;
    writeJSON(key, data);
  }

  // ============ 错题 ============

  /**
   * 返回错题 Map: { [qid]: { wrongCount, lastWrong, lastAnswer } }
   */
  function getWrong() {
    return readJSON(KEYS.WRONG, {});
  }

  function addWrong(qid, userAnswer) {
    var w = getWrong();
    if (w[qid]) {
      w[qid].wrongCount = (w[qid].wrongCount || 0) + 1;
      w[qid].lastWrong = Date.now();
      w[qid].lastAnswer = userAnswer || [];
    } else {
      w[qid] = {
        wrongCount: 1,
        lastWrong: Date.now(),
        lastAnswer: userAnswer || [],
      };
    }
    writeJSON(KEYS.WRONG, w);
    return w[qid];
  }

  function removeWrong(qid) {
    var w = getWrong();
    if (w[qid]) {
      delete w[qid];
      writeJSON(KEYS.WRONG, w);
    }
  }

  function clearWrong() {
    writeJSON(KEYS.WRONG, {});
  }

  // ============ 收藏 ============

  function getFavorite() {
    return readJSON(KEYS.FAVORITE, []);
  }

  function isFavorite(qid) {
    var arr = getFavorite();
    return arr.indexOf(qid) !== -1;
  }

  function toggleFavorite(qid) {
    var arr = getFavorite();
    var idx = arr.indexOf(qid);
    if (idx === -1) {
      arr.push(qid);
    } else {
      arr.splice(idx, 1);
    }
    writeJSON(KEYS.FAVORITE, arr);
    return idx === -1; // true 表示已收藏
  }

  function removeFavorite(qid) {
    var arr = getFavorite().filter(function (x) { return x !== qid; });
    writeJSON(KEYS.FAVORITE, arr);
  }

  function clearFavorite() {
    writeJSON(KEYS.FAVORITE, []);
  }

  // ============ 考试历史 ============

  function getExamHistory() {
    return readJSON(KEYS.EXAM, []);
  }

  function saveExam(exam) {
    var list = getExamHistory();
    list.unshift(exam); // 最新在前
    // 最多保留 20 条
    if (list.length > 20) list = list.slice(0, 20);
    writeJSON(KEYS.EXAM, list);
  }

  function getExamById(id) {
    return getExamHistory().find(function (x) { return x.id === id; });
  }

  // ============ 学习统计 ============

  function defaultStats() {
    return {
      totalAnswered: 0,
      totalCorrect: 0,
      examBest: { km1: 0, km4: 0 },
      streakDays: 0,
      lastStudyDate: '',
      todayDate: todayStr(),
      todayAnswered: 0,
      todayCorrect: 0,
    };
  }

  function getStats() {
    return readJSON(KEYS.STATS, defaultStats());
  }

  function setStats(s) {
    writeJSON(KEYS.STATS, s);
  }

  /**
   * 记录一次答题结果，更新累计与今日统计、连续学习天数
   * @param {boolean} correct
   */
  function recordAnswer(correct) {
    var s = getStats();
    var today = todayStr();
    if (s.todayDate !== today) {
      // 跨天结算昨日
      if (s.lastStudyDate && s.lastStudyDate !== today) {
        // 连续学习 = 如果上次学习日期是昨天，累加；否则清零
        var prev = new Date(s.lastStudyDate);
        var now = new Date(today);
        var diffDays = Math.round((now - prev) / 86400000);
        if (diffDays === 1) {
          s.streakDays = (s.streakDays || 0) + 1;
        } else if (diffDays > 1) {
          s.streakDays = 1;
        }
      } else if (!s.lastStudyDate) {
        s.streakDays = 1;
      }
      s.todayDate = today;
      s.todayAnswered = 0;
      s.todayCorrect = 0;
    } else if (!s.lastStudyDate) {
      s.streakDays = 1;
    }
    s.totalAnswered = (s.totalAnswered || 0) + 1;
    s.todayAnswered = (s.todayAnswered || 0) + 1;
    if (correct) {
      s.totalCorrect = (s.totalCorrect || 0) + 1;
      s.todayCorrect = (s.todayCorrect || 0) + 1;
    }
    s.lastStudyDate = today;
    setStats(s);
    return s;
  }

  function recordExam(subject, score) {
    var s = getStats();
    if (!s.examBest) s.examBest = { km1: 0, km4: 0 };
    if (score > (s.examBest[subject] || 0)) {
      s.examBest[subject] = score;
    }
    setStats(s);
  }

  /**
   * 清空所有数据
   */
  function clearAll() {
    Object.values(KEYS).forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }

  // ============ 批量写入（云端同步用，auth.js 调用） ============

  function setWrong(map) { writeJSON(KEYS.WRONG, map || {}); }
  function setFavorite(arr) { writeJSON(KEYS.FAVORITE, arr || []); }
  function setExamHistory(list) { writeJSON(KEYS.EXAM, list || []); }
  /** 是否处于云端导入状态（导入期间不触发 onChange） */
  var pauseSync = false;

  /**
   * 暴露接口
   */
  global.Storage = {
    KEYS: KEYS,
    todayStr: todayStr,
    genId: genId,
    // progress
    getProgress: getProgress,
    setProgress: setProgress,
    // wrong
    getWrong: getWrong,
    addWrong: addWrong,
    removeWrong: removeWrong,
    clearWrong: clearWrong,
    // favorite
    getFavorite: getFavorite,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    removeFavorite: removeFavorite,
    clearFavorite: clearFavorite,
    // exam
    getExamHistory: getExamHistory,
    saveExam: saveExam,
    getExamById: getExamById,
    setExamHistory: setExamHistory,
    // batch write（云端同步）
    setWrong: setWrong,
    setFavorite: setFavorite,
    pauseSync: false,
    // stats
    getStats: getStats,
    setStats: setStats,
    recordAnswer: recordAnswer,
    recordExam: recordExam,
    // clear
    clearAll: clearAll,
  };

})(window);
