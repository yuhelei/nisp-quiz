/**
 * app.js - NISP 刷题网站主业务
 *
 * 视图:
 *   renderHome       首页：科目/章节信息 + 入口 + 统计
 *   renderPractice   练习：顺序/随机/章节/错题/收藏
 *   renderExam       模拟考试：计时 + 自动交卷
 *   renderWrong      错题本
 *   renderFavorite   收藏
 *   renderCard       答题卡
 *   renderStats      学习统计
 *   renderResult     考试结果
 */
(function (global) {
  'use strict';

  // ============== 题库加载 ==============
  var RAW = global.QUESTIONS_RAW || [];
  var QUESTIONS = RAW.slice(); // 顺序练习用原序
  // 按章节分布
  var CHAPTER_LIST = []; // [{name, count, ids}]
  (function () {
    var seen = {};
    RAW.forEach(function (q) {
      if (!seen[q.chapter]) {
        seen[q.chapter] = { name: q.chapter, count: 0, ids: [] };
        CHAPTER_LIST.push(seen[q.chapter]);
      }
      seen[q.chapter].count++;
      seen[q.chapter].ids.push(q.id);
    });
  })();

  function getQuestions() { return QUESTIONS; }

  function byIds(ids) {
    var map = {};
    QUESTIONS.forEach(function (q) { map[q.id] = q; });
    return ids.map(function (id) { return map[id]; }).filter(Boolean);
  }

  function byId(id) {
    return QUESTIONS.find(function (q) { return q.id === id; });
  }

  function byChapter(name) {
    return QUESTIONS.filter(function (q) { return q.chapter === name; });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ============== 评分 ==============
  function isCorrect(question, userAnswer) {
    if (!userAnswer || !userAnswer.length) return false;
    var correct = question.answer.slice().sort();
    var user = userAnswer.slice().sort();
    if (correct.length !== user.length) return false;
    for (var i = 0; i < correct.length; i++) {
      if (correct[i] !== user[i]) return false;
    }
    return true;
  }

  // ============== DOM 工具 ==============
  function $(id) { return document.getElementById(id); }
  function main() { return $('main'); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function setTitle(t) {
    var el = $('page-title');
    if (el) el.textContent = t || 'NISP 刷题';
  }
  function activeNav(name) {
    document.querySelectorAll('.nav-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.nav === name);
    });
  }
  function fmtTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // ============== 练习状态 ==============
  // 单一全局练习状态，避免污染
  var Practice = null;
  function newPractice(list, mode, opts) {
    return {
      list: list.slice(),   // 题目列表（数组）
      mode: mode,            // 'sequence'|'random'|'chapter'|'wrong'|'favorite'|'exam'
      opts: opts || {},       // { chapter, examConfig, ... }
      idx: 0,
      userAnswers: {},       // { [qid]: [A,B] }
      finished: false,
      startTs: Date.now(),
      durationMs: 0,
    };
  }

  // ============== 首页 ==============
  function renderHome() {
    setTitle('NISP 刷题');
    activeNav('home');
    var s = Storage.getStats();
    var bankTotal = QUESTIONS.length;
    // 精简为 4 个核心统计
    var total = s.totalAnswered || 0;
    var correct = s.totalCorrect || 0;
    var stats = [
      { label: '累计答题', value: total + ' 题' },
      { label: '累计正确率', value: total ? Math.round((correct / total) * 100) + '%' : '0%' },
      { label: '今日答题', value: (s.todayAnswered || 0) + ' 题' },
      { label: '考试最高', value: Math.max(s.examBest.km1 || 0, s.examBest.km4 || 0) + ' 分' },
    ];
    var statsHtml = stats.map(function (x) {
      return '<div class="stat-card">' +
        '<div class="stat-value">' + escapeHtml(x.value) + '</div>' +
        '<div class="stat-label">' + escapeHtml(x.label) + '</div>' +
      '</div>';
    }).join('');

    var wrong = Object.keys(Storage.getWrong()).length;
    var fav = Storage.getFavorite().length;

    var html = '' +
      '<div class="home-header">' +
        '<div class="home-title">NISP 备考刷题</div>' +
        '<div class="home-subtitle">共 ' + bankTotal + ' 道题 · 涵盖 6 个章节</div>' +
      '</div>' +

      '<div class="stats-grid">' + statsHtml + '</div>' +

      '<div class="section-title">刷题入口</div>' +
      '<div class="entry-grid">' +
        entryCard('顺序练习', '按题目顺序逐题作答', '📘', '#/practice?mode=sequence') +
        entryCard('随机练习', '随机抽题练习', '🎲', '#/practice?mode=random') +
        entryCard('章节练习', '按章节专项练习', '📑', '#/chapter') +
        entryCard('模拟考试', '限时模拟考', '📝', '#/exam') +
        entryCard('错题本', '回顾做错题 · ' + wrong + ' 题', '❌', '#/wrong') +
        entryCard('我的收藏', '收藏重点题 · ' + fav + ' 题', '⭐', '#/favorite') +
      '</div>' +

      '<div class="home-foot">NISP 备考刷题 · 数据保存在本地浏览器</div>';

    main().innerHTML = html;
  }

  function entryCard(title, desc, icon, href) {
    return '<a class="entry-card" href="' + href + '">' +
      '<div class="entry-icon">' + icon + '</div>' +
      '<div class="entry-info">' +
        '<div class="entry-title">' + escapeHtml(title) + '</div>' +
        '<div class="entry-desc">' + escapeHtml(desc) + '</div>' +
      '</div>' +
      '<div class="entry-arrow">›</div>' +
    '</a>';
  }

  // ============== 章节选择 ==============
  function renderChapter() {
    setTitle('章节练习');
    activeNav('home');
    var html = '<div class="section-title">选择章节</div>' +
      '<div class="chapter-grid">' +
      CHAPTER_LIST.map(function (c) {
        return '<a class="chapter-card" href="#/practice?mode=chapter&chapter=' + encodeURIComponent(c.name) + '">' +
          '<div class="chapter-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="chapter-count">' + c.count + ' 题</div>' +
          '<div class="chapter-arrow">开始 ›</div>' +
        '</a>';
      }).join('') +
      '</div>';
    main().innerHTML = html;
  }

  // ============== 练习页 ==============
  function renderPractice(params, query) {
    var mode = query.mode || 'sequence';
    var list = [];
    var title = '';

    // keep=1 表示「保留当前练习进度」（用于答题卡/错题本/收藏页跳回练习时定位）
    var keep = query.keep === '1';
    function canReuse() {
      if (!keep || !Practice) return false;
      if (Practice.mode !== mode) return false;
      if (mode === 'chapter' && Practice.opts.chapter !== query.chapter) return false;
      Practice.finished = false; // 允许从完成页回到练习继续查看
      return true;
    }

    if (mode === 'sequence') {
      title = '顺序练习';
      if (canReuse()) {
        setTitle(title); activeNav('practice'); renderQuestion(); return;
      }
      list = QUESTIONS.slice();
      // 续做进度
      var prog = Storage.getProgress('km1');
      var resumeIdx = prog.idx || 0;
      Practice = newPractice(list, mode, { resumeIdx: resumeIdx });
      Practice.idx = Math.min(resumeIdx, list.length - 1);
    } else if (mode === 'random') {
      title = '随机练习';
      if (canReuse()) {
        setTitle(title); activeNav('practice'); renderQuestion(); return;
      }
      list = shuffle(QUESTIONS);
      Practice = newPractice(list, mode);
    } else if (mode === 'chapter') {
      var ch = query.chapter;
      if (!ch) {
        // 没传章节 -> 回章节列表
        location.hash = '#/chapter';
        return;
      }
      title = ch;
      if (canReuse()) {
        setTitle(title); activeNav('practice'); renderQuestion(); return;
      }
      list = byChapter(ch);
      Practice = newPractice(list, mode, { chapter: ch });
    } else if (mode === 'wrong') {
      var ids = Object.keys(Storage.getWrong());
      if (!ids.length) {
        main().innerHTML = '<div class="empty-state">错题本是空的，去练习吧 ✨</div>';
        setTitle('错题练习');
        return;
      }
      title = '错题重练 (' + ids.length + ')';
      if (canReuse()) {
        setTitle(title); activeNav('practice'); renderQuestion(); return;
      }
      list = byIds(ids);
      Practice = newPractice(list, mode);
    } else if (mode === 'favorite') {
      var ids2 = Storage.getFavorite();
      if (!ids2.length) {
        main().innerHTML = '<div class="empty-state">还没有收藏题目，去练习时点 ★ 收藏吧</div>';
        setTitle('收藏练习');
        return;
      }
      title = '收藏练习 (' + ids2.length + ')';
      if (canReuse()) {
        setTitle(title); activeNav('practice'); renderQuestion(); return;
      }
      list = byIds(ids2);
      Practice = newPractice(list, mode);
    } else {
      location.hash = '#/home';
      return;
    }

    setTitle(title);
    activeNav('practice');
    renderQuestion();
  }

  function renderQuestion() {
    if (!Practice || Practice.finished) return;
    var q = Practice.list[Practice.idx];
    if (!q) { finishPractice(); return; }
    var total = Practice.list.length;
    var idx = Practice.idx + 1;
    var progressPct = Math.round((idx / total) * 100);
    var ua = Practice.userAnswers[q.id] || [];
    // locked：已作答（答对自动跳走后，用户滑回/跳回会渲染此状态，需区分对错展示）
    var locked = ua.length > 0;
    var correctNow = locked ? isCorrect(q, ua) : false;

    var typeText = q.type === 'multiple' ? '【多选】' : (q.type === 'judge' ? '【判断】' : '【单选】');
    var fav = Storage.isFavorite(q.id);
    var html = '' +
      '<div class="practice-top">' +
        '<div class="practice-progress">' +
          '<div class="practice-progress-text">第 ' + idx + ' / ' + total + ' 题</div>' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' + progressPct + '%"></div></div>' +
        '</div>' +
        '<div class="practice-meta">' +
          '<span class="badge badge-type">' + typeText + '</span>' +
          '<span class="badge badge-chapter">' + escapeHtml(q.chapter) + '</span>' +
          '<button class="btn-fav" data-fav="' + q.id + '">' + (fav ? '★' : '☆') + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="question-card">' +
        '<div class="stem">' + escapeHtml(q.stem) + '</div>' +
        '<div class="options">' +
        q.options.map(function (opt) {
          var classes = ['option'];
          if (locked) {
            classes.push('locked');
            var isUserPick = ua.indexOf(opt.label) !== -1;
            var isCorrect = q.answer.indexOf(opt.label) !== -1;
            if (isCorrect) classes.push('correct');
            if (isUserPick && !isCorrect) classes.push('wrong');
            if (isUserPick) classes.push('picked');
          }
          return '<div class="' + classes.join(' ') + '" data-label="' + opt.label + '" data-qid="' + q.id + '">' +
            '<span class="option-label">' + escapeHtml(opt.label) + '</span>' +
            '<span class="option-text">' + escapeHtml(opt.text) + '</span>' +
          '</div>';
        }).join('') +
        '</div>' +
      '</div>' +

      (locked ? (
        '<div class="analysis ' + (correctNow ? 'ok' : 'err') + '">' +
          '<div class="analysis-status">' + (correctNow ? '✓ 回答正确' : '✗ 回答错误') + ' · 正确答案：' + escapeHtml(q.answer.join('、')) + '</div>' +
          (q.analysis ? '<div class="analysis-text"><strong>解析：</strong>' + escapeHtml(q.analysis) + '</div>' : '') +
        '</div>'
      ) : '');

    // 底部操作栏：上一题 / 题目列表 / 下一题（多选未确认时为确认答案）
    var isFirst = Practice.idx === 0;
    var isLastQ = Practice.idx >= total - 1;
    var midBtn = (!locked && q.type === 'multiple')
      ? '<button class="btn btn-primary" data-action="confirm">确认答案</button>'
      : '<button class="btn btn-primary" data-action="next">' + (isLastQ ? '完成练习 ›' : '下一题 ›') + '</button>';
    html += '<div class="bottom-bar"><div class="btn-row">' +
      '<button class="btn btn-ghost" data-action="prev"' + (isFirst ? ' disabled' : '') + '>‹ 上一题</button>' +
      '<button class="btn btn-ghost" data-action="qlist">题目列表</button>' +
      midBtn +
    '</div></div>';

    // 题目列表面板（默认隐藏，点按钮弹出）
    html += qlistPanelHtml();

    main().innerHTML = html;

    // 绑定选项事件
    document.querySelectorAll('.option').forEach(function (el) {
      el.addEventListener('click', function () {
        if (el.classList.contains('locked')) return;
        var label = el.getAttribute('data-label');
        var qid = el.getAttribute('data-qid');
        if (q.type === 'multiple') {
          // 多选：累加选项，不立即判分
          var cur = Practice.userAnswers[qid] || [];
          var i = cur.indexOf(label);
          if (i === -1) cur.push(label); else cur.splice(i, 1);
          Practice.userAnswers[qid] = cur;
          // 临时更新 picked 样式
          document.querySelectorAll('.option').forEach(function (e2) {
            e2.classList.toggle('picked', Practice.userAnswers[qid].indexOf(e2.getAttribute('data-label')) !== -1);
          });
        } else {
          // 单选/判断：答对立即跳下一题，答错停留展示解析
          Practice.userAnswers[qid] = [label];
          var correct = isCorrect(q, [label]);
          Storage.recordAnswer(correct);
          if (correct) {
            // 答对了：toast + 跳下一题
            showToast('✓ 答对了', 'success', 600);
            setTimeout(function () {
              if (Practice.idx < Practice.list.length - 1) {
                Practice.idx++;
                if (Practice.mode === 'sequence') {
                  Storage.setProgress('km1', { idx: Practice.idx, lastTs: Date.now() });
                }
                renderQuestion();
              } else {
                // 最后一题答对了
                finishPractice();
              }
            }, 550);
          } else {
            // 答错了：加入错题本 + 渲染当前题展示解析
            Storage.addWrong(qid, [label]);
            if (Practice.mode === 'sequence') {
              Storage.setProgress('km1', { idx: Practice.idx, lastTs: Date.now() });
            }
            renderQuestion();
          }
        }
      });
    });

    var confirmBtn = document.querySelector('[data-action="confirm"]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        var ua = Practice.userAnswers[q.id] || [];
        if (ua.length === 0) {
          showToast('请至少选择一个选项', 'error', 1200);
          return;
        }
        var correct = isCorrect(q, ua);
        Storage.recordAnswer(correct);
        if (correct) {
          showToast('✓ 答对了', 'success', 600);
          setTimeout(function () {
            if (Practice.idx < Practice.list.length - 1) {
              Practice.idx++;
              if (Practice.mode === 'sequence') {
                Storage.setProgress('km1', { idx: Practice.idx, lastTs: Date.now() });
              }
              renderQuestion();
            } else {
              finishPractice();
            }
          }, 550);
        } else {
          Storage.addWrong(q.id, ua);
          if (Practice.mode === 'sequence') {
            Storage.setProgress('km1', { idx: Practice.idx, lastTs: Date.now() });
          }
          renderQuestion();
        }
      });
    }

    var next = document.querySelector('[data-action="next"]');
    if (next) {
      next.addEventListener('click', function () {
        if (Practice.idx < Practice.list.length - 1) {
          Practice.idx++;
          renderQuestion();
        } else {
          finishPractice();
        }
      });
    }
    var prevBtn = document.querySelector('[data-action="prev"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', goPrev);
    }
    var qlistBtn = document.querySelector('[data-action="qlist"]');
    if (qlistBtn) {
      qlistBtn.addEventListener('click', openQlist);
    }
    var qlistClose = document.querySelector('[data-action="qlist-close"]');
    if (qlistClose) {
      qlistClose.addEventListener('click', closeQlist);
    }
    var qlistMask = $('qlist-mask');
    if (qlistMask) {
      qlistMask.addEventListener('click', closeQlist);
    }
    document.querySelectorAll('[data-jump]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        Practice.idx = parseInt(cell.getAttribute('data-jump'), 10);
        savePracticeProgress();
        closeQlist();
        renderQuestion();
      });
    });
    var favBtn = document.querySelector('[data-fav]');
    if (favBtn) {
      favBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var qid = favBtn.getAttribute('data-fav');
        var added = Storage.toggleFavorite(qid);
        favBtn.textContent = added ? '★' : '☆';
      });
    }
  }

  // ============== 练习导航（上一题/下一题/滑动/题目列表） ==============
  function savePracticeProgress() {
    if (Practice && Practice.mode === 'sequence') {
      Storage.setProgress('km1', { idx: Practice.idx, lastTs: Date.now() });
    }
  }

  function goPrev() {
    if (!Practice || Practice.finished || Practice.idx <= 0) return;
    Practice.idx--;
    savePracticeProgress();
    renderQuestion();
  }

  function goNext() {
    if (!Practice || Practice.finished) return;
    // 滑动在最后一题不触发交卷，避免误操作；交卷走「完成练习」按钮
    if (Practice.idx >= Practice.list.length - 1) return;
    Practice.idx++;
    savePracticeProgress();
    renderQuestion();
  }

  /** 题目列表面板 HTML（复用答题卡的 card-cell 样式） */
  function qlistPanelHtml() {
    if (!Practice) return '';
    var cells = Practice.list.map(function (q, i) {
      var ua = Practice.userAnswers[q.id];
      var cls = ['card-cell'];
      if (i === Practice.idx) cls.push('current');
      if (ua && ua.length) cls.push(isCorrect(q, ua) ? 'ok' : 'err');
      return '<div class="' + cls.join(' ') + '" data-jump="' + i + '">' + (i + 1) + '</div>';
    }).join('');
    var legend = '<div class="legend">' +
      '<span><i class="dot current"></i> 当前</span>' +
      '<span><i class="dot ok"></i> 答对</span>' +
      '<span><i class="dot err"></i> 答错</span>' +
      '<span><i class="dot empty"></i> 未答</span>' +
    '</div>';
    return '' +
      '<div class="qlist-mask" id="qlist-mask"></div>' +
      '<div class="qlist-panel" id="qlist-panel">' +
        '<div class="qlist-head">' +
          '<div class="qlist-title">题目列表（共 ' + Practice.list.length + ' 题）</div>' +
          '<button class="qlist-close" data-action="qlist-close" aria-label="关闭">×</button>' +
        '</div>' +
        legend +
        '<div class="card-grid qlist-grid">' + cells + '</div>' +
      '</div>';
  }

  function openQlist() {
    var p = $('qlist-panel'), m = $('qlist-mask');
    if (p) p.classList.add('open');
    if (m) m.classList.add('open');
    var cur = document.querySelector('.qlist-grid .card-cell.current');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
  }

  function closeQlist() {
    var p = $('qlist-panel'), m = $('qlist-mask');
    if (p) p.classList.remove('open');
    if (m) m.classList.remove('open');
  }

  /** 触摸滑动切换题目：右滑上一题，左滑下一题（仅练习页生效） */
  function bindSwipeNav() {
    var el = main();
    if (!el) return;
    var startX = 0, startY = 0, tracking = false;
    el.addEventListener('touchstart', function (e) {
      if (location.hash.indexOf('#/practice') !== 0) return;
      if (!Practice || Practice.finished) return;
      var panel = $('qlist-panel');
      if (panel && panel.classList.contains('open')) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      if (location.hash.indexOf('#/practice') !== 0) return;
      if (!Practice || Practice.finished) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      // 水平位移 ≥60px 且明显大于纵向位移才算滑动，避免误伤上下滚动和点击
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) goPrev(); else goNext();
    }, { passive: true });
  }

  /** PC 端方向键：← 上一题，→ 下一题 */
  function bindKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (location.hash.indexOf('#/practice') !== 0) return;
      if (!Practice || Practice.finished) return;
      var panel = $('qlist-panel');
      if (panel && panel.classList.contains('open')) return;
      if (e.key === 'ArrowLeft') { goPrev(); }
      else if (e.key === 'ArrowRight') { goNext(); }
    });
  }

  /**
   * 顶部中央 toast 提示
   * @param {string} text 提示文字
   * @param {'success'|'error'|''} type 样式类型
   * @param {number} duration 持续时间（毫秒）
   */
  function showToast(text, type, duration) {
    duration = duration || 800;
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast-hide');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 200);
    }, duration);
  }

  function bottomButtons() {
    var isLast = Practice.idx >= Practice.list.length - 1;
    var isFirst = Practice.idx === 0;
    return '<div class="bottom-bar">' +
      '<div class="btn-row">' +
        '<button class="btn btn-ghost" data-action="prev"' + (isFirst ? ' disabled' : '') + '>‹ 上一题</button>' +
        '<button class="btn btn-ghost" data-action="card">答题卡</button>' +
        '<button class="btn btn-primary" data-action="next">' + (isLast ? '完成 ›' : '下一题 ›') + '</button>' +
      '</div>' +
    '</div>';
  }

  function finishPractice() {
    if (!Practice) return;
    var correctCount = 0;
    var total = Practice.list.length;
    var answered = 0;
    Practice.list.forEach(function (q) {
      var ua = Practice.userAnswers[q.id];
      if (ua && ua.length) {
        answered++;
        if (isCorrect(q, ua)) correctCount++;
      }
    });
    var pct = total ? Math.round((correctCount / total) * 100) : 0;
    Practice.finished = true;
    main().innerHTML = '' +
      '<div class="result-card">' +
        '<div class="result-title">本次练习完成</div>' +
        '<div class="result-stats">' +
          '<div class="result-stat"><div class="result-num">' + total + '</div><div class="result-lbl">总题数</div></div>' +
          '<div class="result-stat"><div class="result-num">' + answered + '</div><div class="result-lbl">已作答</div></div>' +
          '<div class="result-stat result-good"><div class="result-num">' + correctCount + '</div><div class="result-lbl">答对</div></div>' +
          '<div class="result-stat"><div class="result-num">' + pct + '%</div><div class="result-lbl">正确率</div></div>' +
        '</div>' +
        '<div class="btn-row">' +
          '<a class="btn btn-ghost" href="#/home">返回首页</a>' +
          '<a class="btn btn-ghost" href="#/wrong">查看错题</a>' +
          '<a class="btn btn-primary" href="#/practice?mode=' + Practice.mode + (Practice.opts.chapter ? '&chapter=' + encodeURIComponent(Practice.opts.chapter) : '') + '">再来一遍</a>' +
        '</div>' +
      '</div>';
  }

  // ============== 答题卡 ==============
  function renderCard() {
    setTitle('答题卡');
    if (!Practice) { location.hash = '#/home'; return; }
    var list = Practice.list;
    var grid = list.map(function (q, i) {
      var ua = Practice.userAnswers[q.id];
      var cls = ['card-cell'];
      if (i === Practice.idx) cls.push('current');
      if (ua && ua.length) {
        var ok = isCorrect(q, ua);
        cls.push(ok ? 'ok' : 'err');
      }
      return '<div class="' + cls.join(' ') + '" data-idx="' + i + '">' + (i + 1) + '</div>';
    }).join('');

    var legend = '' +
      '<div class="legend">' +
        '<span><i class="dot current"></i> 当前</span>' +
        '<span><i class="dot ok"></i> 答对</span>' +
        '<span><i class="dot err"></i> 答错</span>' +
        '<span><i class="dot empty"></i> 未答</span>' +
      '</div>';

    var html = legend + '<div class="card-grid">' + grid + '</div>' +
      '<div class="bottom-bar"><div class="btn-row">' +
        '<a class="btn btn-ghost" href="#/home">返回首页</a>' +
        '<button class="btn btn-primary" data-action="continue">继续练习</button>' +
      '</div></div>';

    main().innerHTML = html;

    document.querySelectorAll('.card-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        Practice.idx = parseInt(cell.getAttribute('data-idx'), 10);
        location.hash = '#/practice?mode=' + Practice.mode +
          (Practice.opts.chapter ? '&chapter=' + encodeURIComponent(Practice.opts.chapter) : '') + '&keep=1';
      });
    });
    var cont = document.querySelector('[data-action="continue"]');
    if (cont) cont.addEventListener('click', function () {
      location.hash = '#/practice?mode=' + Practice.mode +
        (Practice.opts.chapter ? '&chapter=' + encodeURIComponent(Practice.opts.chapter) : '') + '&keep=1';
    });
  }

  // ============== 模拟考试 ==============
  var ExamTimer = null;

  function renderExam(params, query) {
    setTitle('模拟考试');
    activeNav('exam');
    var totalCount = QUESTIONS.length;
    // 配置：题数 + 时长
    var config = {
      total: Math.min(100, totalCount), // 默认 100 题
      duration: 45 * 60, // 默认 45 分钟
      passingScore: 90,
    };
    // 如果题库不足 100 题，缩为全部
    if (totalCount < 100) {
      config.total = totalCount;
      config.duration = Math.max(20 * 60, Math.round(totalCount / 100 * 45 * 60));
    }

    var list = shuffle(QUESTIONS).slice(0, config.total);
    Practice = newPractice(list, 'exam', { config: config });
    Practice.startTs = Date.now();
    Practice.deadline = Practice.startTs + config.duration * 1000;

    renderExamPage();

    // 启动计时器
    if (ExamTimer) clearInterval(ExamTimer);
    ExamTimer = setInterval(function () {
      var left = Math.max(0, Math.round((Practice.deadline - Date.now()) / 1000));
      var el = $('exam-timer');
      if (el) el.textContent = fmtTime(left);
      if (left <= 0) {
        clearInterval(ExamTimer);
        ExamTimer = null;
        finishExam();
      }
    }, 500);

    var examId = Storage.genId();
    Practice.examId = examId;
  }

  function renderExamPage() {
    var q = Practice.list[Practice.idx];
    var total = Practice.list.length;
    var idx = Practice.idx + 1;
    var ua = Practice.userAnswers[q.id] || [];
    var locked = false; // 考试模式下不立即锁，等交卷才判

    var html = '' +
      '<div class="exam-top">' +
        '<div class="exam-info">' +
          '<span id="exam-progress">第 ' + idx + ' / ' + total + ' 题</span>' +
          '<span class="badge badge-chapter">' + escapeHtml(q.chapter) + '</span>' +
        '</div>' +
        '<div class="exam-timer" id="exam-timer">' + fmtTime(Practice.opts.config.duration) + '</div>' +
      '</div>' +

      '<div class="question-card">' +
        '<div class="stem">' + escapeHtml(q.stem) + '</div>' +
        '<div class="options">' +
        q.options.map(function (opt) {
          var picked = ua.indexOf(opt.label) !== -1;
          return '<div class="option' + (picked ? ' picked' : '') + '" data-label="' + opt.label + '" data-qid="' + q.id + '">' +
            '<span class="option-label">' + escapeHtml(opt.label) + '</span>' +
            '<span class="option-text">' + escapeHtml(opt.text) + '</span>' +
          '</div>';
        }).join('') +
        '</div>' +
      '</div>' +

      '<div class="bottom-bar"><div class="btn-row">' +
        '<button class="btn btn-ghost" data-action="prev"' + (Practice.idx === 0 ? ' disabled' : '') + '>‹ 上一题</button>' +
        '<button class="btn btn-ghost" data-action="card">答题卡</button>' +
        '<button class="btn btn-ghost" data-action="next">' + (Practice.idx >= total - 1 ? '交卷' : '下一题 ›') + '</button>' +
      '</div></div>';

    main().innerHTML = html;

    document.querySelectorAll('.option').forEach(function (el) {
      el.addEventListener('click', function () {
        var label = el.getAttribute('data-label');
        var qid = el.getAttribute('data-qid');
        if (q.type === 'multiple') {
          var cur = Practice.userAnswers[qid] || [];
          var i = cur.indexOf(label);
          if (i === -1) cur.push(label); else cur.splice(i, 1);
          Practice.userAnswers[qid] = cur;
        } else {
          Practice.userAnswers[qid] = [label];
        }
        renderExamPage();
      });
    });

    var prev = document.querySelector('[data-action="prev"]');
    if (prev) prev.addEventListener('click', function () {
      if (Practice.idx > 0) { Practice.idx--; renderExamPage(); }
    });
    var next = document.querySelector('[data-action="next"]');
    if (next) next.addEventListener('click', function () {
      if (Practice.idx >= Practice.list.length - 1) {
        finishExam();
      } else {
        Practice.idx++; renderExamPage();
      }
    });
    var card = document.querySelector('[data-action="card"]');
    if (card) card.addEventListener('click', function () {
      // 考试中跳到答题卡
      location.hash = '#/exam-card';
    });
  }

  function finishExam() {
    if (!Practice || Practice._finished) return;
    Practice._finished = true;
    if (ExamTimer) { clearInterval(ExamTimer); ExamTimer = null; }

    var correctCount = 0;
    var answered = 0;
    var wrongIds = [];
    var wrongDetails = [];
    Practice.list.forEach(function (q) {
      var ua = Practice.userAnswers[q.id];
      if (ua && ua.length) {
        answered++;
        var ok = isCorrect(q, ua);
        if (ok) {
          correctCount++;
        } else {
          wrongIds.push(q.id);
          wrongDetails.push({
            qid: q.id,
            stem: q.stem,
            userAnswer: ua,
            correct: q.answer,
            analysis: q.analysis,
            options: q.options,
          });
          Storage.addWrong(q.id, ua);
        }
        Storage.recordAnswer(ok);
      } else {
        // 未作答也算错
        wrongIds.push(q.id);
        wrongDetails.push({
          qid: q.id,
          stem: q.stem,
          userAnswer: [],
          correct: q.answer,
          analysis: q.analysis,
          options: q.options,
        });
      }
    });
    var total = Practice.list.length;
    var cfg = Practice.opts.config;
    var score = Math.round((correctCount / total) * 100);
    var pass = score >= cfg.passingScore;

    var examRecord = {
      id: Practice.examId || Storage.genId(),
      score: score,
      duration: cfg.duration - Math.round((Practice.deadline - Date.now()) / 1000),
      wrongIds: wrongIds,
      correctCount: correctCount,
      total: total,
      date: new Date().toISOString(),
    };
    Storage.saveExam(examRecord);
    Storage.recordExam('km1', score);

    // 渲染结果
    setTitle('考试结果');
    activeNav('exam');
    var html = '' +
      '<div class="result-card ' + (pass ? 'pass' : 'fail') + '">' +
        '<div class="result-title">' + (pass ? '🎉 考试通过' : '😢 未通过') + '</div>' +
        '<div class="result-score">' + score + '<span class="result-score-max">/100</span></div>' +
        '<div class="result-sub">答对 ' + correctCount + ' / ' + total + ' 题，及格线 ' + cfg.passingScore + ' 分</div>' +
        '<div class="btn-row">' +
          '<a class="btn btn-ghost" href="#/home">返回首页</a>' +
          '<a class="btn btn-ghost" href="#/wrong">查看错题</a>' +
          '<a class="btn btn-primary" href="#/exam">再考一次</a>' +
        '</div>' +
      '</div>' +
      (wrongDetails.length ? '<div class="section-title">错题回顾</div>' + renderWrongDetails(wrongDetails) : '');
    main().innerHTML = html;
  }

  function renderWrongDetails(details) {
    return details.map(function (d) {
      var optsHtml = d.options.map(function (opt) {
        var isCorrect = d.correct.indexOf(opt.label) !== -1;
        var isUser = d.userAnswer.indexOf(opt.label) !== -1;
        var cls = 'option locked';
        if (isCorrect) cls += ' correct';
        if (isUser && !isCorrect) cls += ' wrong';
        if (isUser) cls += ' picked';
        return '<div class="' + cls + '">' +
          '<span class="option-label">' + escapeHtml(opt.label) + '</span>' +
          '<span class="option-text">' + escapeHtml(opt.text) + '</span>' +
        '</div>';
      }).join('');
      return '<div class="question-card wrong-detail">' +
        '<div class="stem">' + escapeHtml(d.stem) + '</div>' +
        '<div class="options">' + optsHtml + '</div>' +
        '<div class="analysis err">' +
          '<div class="analysis-text"><strong>你的答案：</strong>' + (d.userAnswer.length ? escapeHtml(d.userAnswer.join('、')) : '未作答') + '</div>' +
          '<div class="analysis-text"><strong>正确答案：</strong>' + escapeHtml(d.correct.join('、')) + '</div>' +
          (d.analysis ? '<div class="analysis-text"><strong>解析：</strong>' + escapeHtml(d.analysis) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  // 考试中的答题卡
  function renderExamCard() {
    setTitle('答题卡');
    if (!Practice || Practice.mode !== 'exam') {
      location.hash = '#/exam';
      return;
    }
    var list = Practice.list;
    var grid = list.map(function (q, i) {
      var ua = Practice.userAnswers[q.id];
      var cls = ['card-cell'];
      if (i === Practice.idx) cls.push('current');
      if (ua && ua.length) cls.push('ok');
      return '<div class="' + cls.join(' ') + '" data-idx="' + i + '">' + (i + 1) + '</div>';
    }).join('');
    var legend = '<div class="legend">' +
      '<span><i class="dot current"></i> 当前</span>' +
      '<span><i class="dot ok"></i> 已答</span>' +
      '<span><i class="dot empty"></i> 未答</span>' +
    '</div>';
    main().innerHTML = legend + '<div class="card-grid">' + grid + '</div>' +
      '<div class="bottom-bar"><div class="btn-row">' +
        '<button class="btn btn-ghost" data-action="back-exam">返回考试</button>' +
        '<button class="btn btn-danger" data-action="submit-exam">交卷</button>' +
      '</div></div>';

    document.querySelectorAll('.card-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        Practice.idx = parseInt(cell.getAttribute('data-idx'), 10);
        renderExamPage();
        // 不切换 hash，避免计时器被清
      });
    });
    var back = document.querySelector('[data-action="back-exam"]');
    if (back) back.addEventListener('click', function () { renderExamPage(); });
    var submit = document.querySelector('[data-action="submit-exam"]');
    if (submit) submit.addEventListener('click', function () {
      if (confirm('确定交卷吗？')) finishExam();
    });
  }

  // ============== 错题本 ==============
  function renderWrong() {
    setTitle('错题本');
    activeNav('wrong');
    var wrong = Storage.getWrong();
    var ids = Object.keys(wrong);
    if (!ids.length) {
      main().innerHTML = '<div class="empty-state">错题本是空的<br><br><a class="btn btn-primary" href="#/practice?mode=sequence">开始练习</a></div>';
      return;
    }

    var chapterFilterHtml = '' +
      '<div class="filter-bar">' +
        '<select id="wrong-chapter-filter" class="filter-select">' +
        '<option value="">全部章节</option>' +
        CHAPTER_LIST.map(function (c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; }).join('') +
        '</select>' +
      '</div>';

    var listHtml = ids.map(function (qid) {
      var q = byId(qid);
      if (!q) return '';
      var w = wrong[qid];
      return '<div class="wrong-item" data-qid="' + qid + '" data-chapter="' + escapeHtml(q.chapter) + '">' +
        '<div class="wrong-stem">' + escapeHtml(q.stem.slice(0, 80)) + (q.stem.length > 80 ? '...' : '') + '</div>' +
        '<div class="wrong-meta">' +
          '<span class="badge badge-chapter">' + escapeHtml(q.chapter) + '</span>' +
          '<span class="badge badge-wrong">错 ' + w.wrongCount + ' 次</span>' +
        '</div>' +
        '<div class="wrong-actions">' +
          '<button class="btn btn-ghost btn-sm" data-action="remove" data-qid="' + qid + '">移除</button>' +
        '</div>' +
      '</div>';
    }).join('');

    main().innerHTML = '' +
      chapterFilterHtml +
      '<div class="list-wrap">' + listHtml + '</div>' +
      '<div class="bottom-bar"><div class="btn-row">' +
        '<a class="btn btn-primary" href="#/practice?mode=wrong">错题重练</a>' +
        '<button class="btn btn-danger" data-action="clear">清空错题</button>' +
      '</div></div>';

    var sel = $('wrong-chapter-filter');
    if (sel) {
      sel.addEventListener('change', function () {
        var val = sel.value;
        document.querySelectorAll('.wrong-item').forEach(function (el) {
          var ch = el.getAttribute('data-chapter');
          el.style.display = !val || ch === val ? '' : 'none';
        });
      });
    }

    document.querySelectorAll('[data-action="remove"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var qid = btn.getAttribute('data-qid');
        Storage.removeWrong(qid);
        renderWrong();
      });
    });

    var clr = document.querySelector('[data-action="clear"]');
    if (clr) clr.addEventListener('click', function () {
      if (confirm('确定清空错题本吗？此操作不可恢复')) {
        Storage.clearWrong();
        renderWrong();
      }
    });

    document.querySelectorAll('.wrong-item').forEach(function (el) {
      el.addEventListener('click', function () {
        // 跳转到对应题目练习（keep=1 保留定位）
        var qid = el.getAttribute('data-qid');
        var q = byId(qid);
        if (!q) return;
        var ids = Object.keys(Storage.getWrong());
        var idx = ids.indexOf(qid);
        Practice = newPractice(byIds(ids), 'wrong');
        Practice.idx = Math.max(0, idx);
        location.hash = '#/practice?mode=wrong&keep=1';
      });
    });
  }

  // ============== 收藏 ==============
  function renderFavorite() {
    setTitle('我的收藏');
    activeNav('favorite');
    var fav = Storage.getFavorite();
    if (!fav.length) {
      main().innerHTML = '<div class="empty-state">还没有收藏题目<br><br><a class="btn btn-primary" href="#/practice?mode=sequence">开始练习</a></div>';
      return;
    }
    var listHtml = fav.map(function (qid) {
      var q = byId(qid);
      if (!q) return '';
      return '<div class="fav-item" data-qid="' + qid + '">' +
        '<div class="fav-stem">' + escapeHtml(q.stem.slice(0, 80)) + (q.stem.length > 80 ? '...' : '') + '</div>' +
        '<div class="fav-meta">' +
          '<span class="badge badge-chapter">' + escapeHtml(q.chapter) + '</span>' +
        '</div>' +
        '<div class="fav-actions">' +
          '<button class="btn btn-ghost btn-sm" data-action="remove-fav" data-qid="' + qid + '">移除</button>' +
        '</div>' +
      '</div>';
    }).join('');

    main().innerHTML = '' +
      '<div class="list-wrap">' + listHtml + '</div>' +
      '<div class="bottom-bar"><div class="btn-row">' +
        '<a class="btn btn-primary" href="#/practice?mode=favorite">收藏练习</a>' +
        '<button class="btn btn-danger" data-action="clear-fav">清空收藏</button>' +
      '</div></div>';

    document.querySelectorAll('[data-action="remove-fav"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var qid = btn.getAttribute('data-qid');
        Storage.removeFavorite(qid);
        renderFavorite();
      });
    });

    var clr = document.querySelector('[data-action="clear-fav"]');
    if (clr) clr.addEventListener('click', function () {
      if (confirm('确定清空收藏吗？')) {
        Storage.clearFavorite();
        renderFavorite();
      }
    });

    document.querySelectorAll('.fav-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var qid = el.getAttribute('data-qid');
        var ids = Storage.getFavorite();
        var idx = ids.indexOf(qid);
        Practice = newPractice(byIds(ids), 'favorite');
        Practice.idx = Math.max(0, idx);
        location.hash = '#/practice?mode=favorite&keep=1';
      });
    });
  }

  // ============== 学习统计 ==============
  function renderStats() {
    setTitle('学习统计');
    activeNav('stats');
    var s = Storage.getStats();
    var examHistory = Storage.getExamHistory();
    var wrong = Storage.getWrong();
    var fav = Storage.getFavorite();

    var total = s.totalAnswered || 0;
    var accuracy = total ? Math.round(((s.totalCorrect || 0) / total) * 100) : 0;
    var todayAcc = (s.todayAnswered || 0) ? Math.round(((s.todayCorrect || 0) / s.todayAnswered) * 100) : 0;
    var best = Math.max(s.examBest.km1 || 0, s.examBest.km4 || 0);

    var html = '' +
      '<div class="section-title">学习概览</div>' +
      '<div class="stats-grid">' +
        statCard('累计答题', total + ' 题') +
        statCard('累计正确率', accuracy + '%') +
        statCard('今日答题', (s.todayAnswered || 0) + ' 题') +
        statCard('今日正确率', todayAcc + '%') +
        statCard('连续学习', (s.streakDays || 0) + ' 天') +
        statCard('考试最高', best + ' 分') +
      '</div>' +

      '<div class="section-title">考试记录 (' + examHistory.length + ')</div>' +
      (examHistory.length === 0
        ? '<div class="empty-state-sm">暂无考试记录<br><a class="btn btn-primary btn-sm" href="#/exam">立即考试</a></div>'
        : '<div class="list-wrap">' +
          examHistory.map(function (e) {
            var pass = e.score >= 90;
            return '<div class="exam-history-item">' +
              '<div class="exam-score ' + (pass ? 'pass' : 'fail') + '">' + e.score + '</div>' +
              '<div class="exam-info-row">' +
                '<div>' + fmtDate(new Date(e.date).getTime()) + '</div>' +
                '<div class="exam-info-meta">答对 ' + (e.correctCount || 0) + ' / ' + (e.total || '?') + ' · 错 ' + (e.wrongIds ? e.wrongIds.length : 0) + ' 题</div>' +
              '</div>' +
            '</div>';
          }).join('') +
          '</div>'
      ) +

      '<div class="section-title">其他</div>' +
      '<div class="list-wrap">' +
        '<div class="meta-item">错题本：' + Object.keys(wrong).length + ' 题</div>' +
        '<div class="meta-item">收藏：' + fav.length + ' 题</div>' +
      '</div>' +

      '<div class="section-title">账号</div>' +
      '<div class="list-wrap">' +
        (Auth.token()
          ? '<div class="meta-item account-item">' +
              '<div>当前用户：<strong>' + escapeHtml(Auth.username() || '未知') + '</strong></div>' +
              '<div class="exam-info-meta">数据已同步到本机 MySQL</div>' +
            '</div>' +
            '<div style="padding:12px 16px"><button class="btn btn-ghost btn-block" data-action="logout">退出登录</button></div>'
          : '<div class="meta-item">未登录（离线模式）· <a href="#/login">去登录 ›</a></div>') +
      '</div>' +

      '<div class="section-title">危险操作</div>' +
      '<div class="list-wrap">' +
        '<button class="btn btn-danger btn-block" data-action="clear-all">⚠️ 清空全部数据</button>' +
      '</div>' +

      '<div class="section-title">关于</div>' +
      '<div class="about">' +
        'NISP 刷题小程序 v1.0<br>' +
        '题库源自《题库1-522题.pdf》<br>' +
        '纯前端实现，数据存于 localStorage<br>' +
        '本地浏览器运行，无需联网' +
      '</div>';

    main().innerHTML = html;

    var clr = document.querySelector('[data-action="clear-all"]');
    if (clr) clr.addEventListener('click', function () {
      if (confirm('确定清空全部数据吗？此操作不可恢复！')) {
        Storage.clearAll();
        location.reload();
      }
    });

    var logout = document.querySelector('[data-action="logout"]');
    if (logout) logout.addEventListener('click', function () {
      Auth.api('/logout', { method: 'POST', timeout: 3000 }).then(function () {
        Auth.signOut();
        showToast('已退出登录', 'info');
        location.hash = '#/login';
      });
    });
  }

  function statCard(label, value) {
    return '<div class="stat-card">' +
      '<div class="stat-value">' + escapeHtml(value) + '</div>' +
      '<div class="stat-label">' + escapeHtml(label) + '</div>' +
    '</div>';
  }

  // ============== 考试历史 ==============
  function renderHistory() {
    setTitle('考试记录');
    activeNav('exam');
    var examHistory = Storage.getExamHistory();
    if (!examHistory.length) {
      main().innerHTML = '<div class="empty-state">暂无考试记录<br><br><a class="btn btn-primary" href="#/exam">立即考试</a></div>';
      return;
    }
    var html = examHistory.map(function (e) {
      var pass = e.score >= 90;
      return '<a class="exam-history-card" href="#/result?id=' + encodeURIComponent(e.id) + '">' +
        '<div class="exam-score ' + (pass ? 'pass' : 'fail') + '">' + e.score + '</div>' +
        '<div class="exam-info-row">' +
          '<div>' + fmtDate(new Date(e.date).getTime()) + '</div>' +
          '<div class="exam-info-meta">答对 ' + (e.correctCount || 0) + ' / ' + (e.total || '?') + '</div>' +
        '</div>' +
      '</a>';
    }).join('');
    main().innerHTML = '<div class="list-wrap">' + html + '</div>';
  }

  // ============== 考试结果详情 ==============
  function renderResult(params, query) {
    setTitle('考试详情');
    var examId = query.id;
    var exam = Storage.getExamById(examId);
    if (!exam) {
      main().innerHTML = '<div class="empty-state">考试记录不存在</div>';
      return;
    }
    var wrongIds = exam.wrongIds || [];
    var wrongDetails = wrongIds.map(function (qid) {
      var q = byId(qid);
      if (!q) return null;
      return {
        qid: qid,
        stem: q.stem,
        userAnswer: [], // 历史无记录
        correct: q.answer,
        analysis: q.analysis,
        options: q.options,
      };
    }).filter(Boolean);

    var pass = exam.score >= 90;
    main().innerHTML = '' +
      '<div class="result-card ' + (pass ? 'pass' : 'fail') + '">' +
        '<div class="result-title">' + (pass ? '🎉 考试通过' : '😢 未通过') + '</div>' +
        '<div class="result-score">' + exam.score + '<span class="result-score-max">/100</span></div>' +
        '<div class="result-sub">' + fmtDate(new Date(exam.date).getTime()) + '</div>' +
        '<div class="btn-row">' +
          '<a class="btn btn-ghost" href="#/history">返回列表</a>' +
          '<a class="btn btn-primary" href="#/home">返回首页</a>' +
        '</div>' +
      '</div>' +
      (wrongDetails.length ? '<div class="section-title">错题回顾</div>' + renderWrongDetails(wrongDetails) : '');
  }

  // ============== 路由注册 ==============
  /**
   * 底部导航栏显隐控制
   * 练习/考试等页面有独立操作栏，需隐藏导航栏避免重叠
   */
  function setNavVisible(show) {
    var nav = document.getElementById('bottombar');
    if (nav) nav.style.display = show ? '' : 'none';
  }

  /**
   * 顶部返回按钮显隐控制
   * 当底部导航被隐藏时，在标题栏左侧给出返回首页入口
   */
  function setBackButton(show) {
    var box = document.getElementById('topbar-back');
    if (!box) return;
    if (!show) { box.innerHTML = ''; return; }
    box.innerHTML = '<button class="topbar-btn" data-action="topbar-back" aria-label="返回首页">‹</button>';
    var btn = box.querySelector('[data-action="topbar-back"]');
    if (btn) {
      btn.addEventListener('click', function () {
        location.hash = '#/home';
      });
    }
  }

  /**
   * 包装路由处理函数，进入时同步导航栏/返回按钮
   */
  function withNav(show, fn) {
    return function (p, q) {
      setNavVisible(show);
      setBackButton(!show); // 隐藏底部导航时，顶部给返回按钮
      fn(p, q);
    };
  }

  function registerRoutes() {
    Router.register('/home',     withNav(true,  renderHome));
    Router.register('/chapter',  withNav(true,  renderChapter));
    Router.register('/wrong',    withNav(true,  renderWrong));
    Router.register('/favorite', withNav(true,  renderFavorite));
    Router.register('/stats',    withNav(true,  renderStats));
    Router.register('/history',  withNav(true,  renderHistory));
    Router.register('/result',   withNav(true,  renderResult));
    // 以下页面自带底部操作栏
    Router.register('/practice',  withNav(false, renderPractice));
    Router.register('/card',      withNav(false, renderCard));
    Router.register('/exam',      withNav(false, renderExam));
    Router.register('/exam-card', withNav(false, renderExamCard));
    // 登录页：自带全屏卡片布局，隐藏顶栏与底栏
    Router.register('/login', renderLogin);
  }

  // ============== 登录页 ==============

  /**
   * 登录 / 注册页（后端开启且未登录时显示）
   * 记住密码：token 存 localStorage，30 天内打开直接进首页
   */
  function renderLogin() {
    setNavVisible(false);
    setBackButton(false);
    setTitle('登录');
    document.getElementById('topbar').style.display = 'none';
    var offline = !Auth.state.online;
    var html = '' +
      '<div class="login-page">' +
        '<div class="login-card">' +
          '<div class="login-logo">📝</div>' +
          '<div class="login-title">NISP 刷题</div>' +
          '<div class="login-sub">登录后多端同步进度 · 错题 · 收藏</div>' +
          '<div class="login-field">' +
            '<input id="login-user" type="text" placeholder="用户名（2-20 位）" maxlength="20" autocomplete="username">' +
          '</div>' +
          '<div class="login-field">' +
            '<input id="login-pass" type="password" placeholder="密码（至少 6 位）" autocomplete="current-password">' +
          '</div>' +
          '<label class="login-remember">' +
            '<input type="checkbox" id="login-remember" checked>' +
            '<span>记住密码，30 天内免登录</span>' +
          '</label>' +
          '<div class="login-msg" id="login-msg"></div>' +
          '<button class="btn btn-primary btn-block btn-bounce" id="login-btn">登 录</button>' +
          '<button class="btn btn-ghost btn-block" id="register-btn" style="margin-top:10px">注册新账号</button>' +
          (offline
            ? '<div class="login-foot login-foot-off">⚠️ 服务器未开启，当前为离线模式</div>' +
              '<button class="btn btn-ghost btn-block" id="offline-btn" style="margin-top:10px">先离线刷题 ›</button>'
            : '<div class="login-foot">密码加密存储 · 数据保存在本机 MySQL</div>') +
        '</div>' +
      '</div>';
    main().innerHTML = html;

    function doLogin(isRegister) {
      var u = $('login-user').value.trim();
      var p = $('login-pass').value;
      var remember = $('login-remember').checked;
      var msg = $('login-msg');
      msg.textContent = '';
      if (!u || !p) { msg.textContent = '请输入用户名和密码'; return; }
      var btn = $(isRegister ? 'register-btn' : 'login-btn');
      btn.disabled = true;
      btn.textContent = isRegister ? '注册中…' : '登录中…';
      Auth.api(isRegister ? '/register' : '/login', {
        method: 'POST',
        body: { username: u, password: p },
        timeout: 6000,
      }).then(function (r) {
        btn.disabled = false;
        btn.textContent = isRegister ? '注册新账号' : '登 录';
        if (r.ok) {
          Auth.signIn(r.token, r.username, remember);
          document.getElementById('topbar').style.display = '';
          showToast((isRegister ? '注册成功，欢迎 ' : '欢迎回来，') + r.username, 'success');
          Sync.pull().then(function () {
            location.hash = '#/home';
            renderHome();
          });
        } else {
          msg.textContent = (r.offline ? '无法连接服务器，请确认已启动' : (r.msg || '操作失败'));
        }
      });
    }

    $('login-btn').addEventListener('click', function () { doLogin(false); });
    $('register-btn').addEventListener('click', function () { doLogin(true); });
    var ob = $('offline-btn');
    if (ob) ob.addEventListener('click', function () {
      document.getElementById('topbar').style.display = '';
      location.hash = '#/home';
    });
    // 回车提交登录
    ['login-user', 'login-pass'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doLogin(false);
      });
    });
    setTimeout(function () { var el = $('login-user'); if (el) el.focus(); }, 50);
  }

  /**
   * 启动流程：
   *   1. 先渲染当前路由（保证离线可用）
   *   2. 探测后端：在线 + 无 token → 跳登录页；在线 + 有 token → 静默校验并同步数据
   */
  function boot() {
    Router.start('#/home');
    Auth.probe().then(function (online) {
      if (!online) {
        showToast('服务器未开启，本地离线模式', 'info');
        return;
      }
      if (Auth.token()) {
        // 已登录：静默拉取云端数据，首页数据若被覆盖则刷新
        Sync.pull().then(function (src) {
          if (src === 'server' && (location.hash === '#/home' || location.hash === '' || location.hash === '#')) {
            renderHome();
          }
        });
      } else {
        location.hash = '#/login';
      }
    });
  }

  // ============== 启动 ==============
  global.App = {
    QUESTIONS: QUESTIONS,
    CHAPTER_LIST: CHAPTER_LIST,
    init: function () {
      registerRoutes();
      bindSwipeNav();
      bindKeyboardNav();
      boot();
    },
  };

})(window);
