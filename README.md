# NISP 刷题小程序

一个纯前端的 NISP（国家信息安全水平考试）刷题网站。  
参考驾考宝典的交互与布局风格，**与驾考无关**，仅复用"题库 + 顺序/随机/章节/模拟考试/错题/收藏"这一类通用刷题模式。

---

## 一、功能一览

| 模块 | 说明 |
|---|---|
| 🏠 首页 | 今日答题数 / 正确率 / 连续天数 / 最高分，入口卡片 |
| 📚 章节练习 | 6 个章节分别作答，支持单章选择 |
| 🔀 随机练习 | 题库内全随机抽题 |
| 📝 顺序练习 | 按题号顺序逐题作答，记录进度 |
| 🧪 模拟考试 | 50 题 / 30 分钟，90 分及格，自动计时交卷 |
| ❌ 错题本 | 自动收集所有答错的题目，支持移除 / 清空 / 重练 |
| ⭐ 收藏 | 重点题目收藏，支持移除 / 清空 / 重练 |
| 📊 学习统计 | 累计 / 今日 / 连续天数 / 最高分 / 考试历史 |
| 📋 答题卡 | 大题量答题卡，已答 / 未答 / 当前 / 答错状态可视

---

## 二、题库说明

- **来源**：PDF `D:\QQ\保存资料\题库1-522题.pdf`（已解析为 520 道题）
- **章节分布**：
  - 第一章 信息安全基础（100 题）
  - 第二章 密码学与认证（99 题）
  - 第三章 网络与系统安全（100 题）
  - 第四章 信息安全管理体系（99 题）
  - 第五章 风险评估与应急响应（100 题）
  - 第六章 安全运营与应用（22 题）
- **题型**：单选 512 道，多选 8 道
- **字段**：`id / originalId / subject / chapter / type / stem / options / answer / analysis`

---

## 三、如何运行

### 方式 A：直接双击 index.html

1. 进入 `D:\ai储存\龙虾\nisp刷题小程序\`
2. 双击 `index.html`
3. 浏览器（推荐 Chrome / Edge / Safari 最新版）打开即可

> 部分浏览器（如 Chrome）对 `file://` 协议下的 `localStorage` 有限制，但**所有数据存储都是用 localStorage 实现的纯前端方案**，不依赖任何后端。如果遇到打开后页面空白或脚本加载失败，请改用方式 B 启动本地服务器。

### 方式 B：用本地 HTTP 服务器（推荐）

任选一种：

```bash
# 方案 1：Python 内置（推荐，Windows 自带或可装）
cd "D:\ai储存\龙虾\nisp刷题小程序"
python -m http.server 8080

# 方案 2：Node.js
npx http-server -p 8080

# 方案 3：PHP
php -S 127.0.0.1:8080
```

然后在浏览器访问：<http://127.0.0.1:8080>

---

## 四、文件清单

```
nisp刷题小程序/
├── index.html              入口 HTML，依次加载 CSS/JS
├── README.md               本文档
├── css/
│   └── style.css           全局样式（主题色、卡片、响应式、安全区适配）
├── data/
│   └── questions.js        题库数据（520 题，window.QUESTIONS_RAW 全局变量）
└── js/
    ├── storage.js          localStorage 封装
    ├── router.js           hash 路由
    └── app.js              业务视图（首页 / 练习 / 考试 / 错题 / 收藏 / 答题卡 / 统计）
```

---

## 五、扩展题库

### 直接修改 `data/questions.js`

1. 打开 `data/questions.js`，顶部是注释，往下是 `window.QUESTIONS_RAW = [ ... ]`
2. 在数组末尾追加新的题目对象，格式如下：

```json
{
  "id": "q523",
  "originalId": 523,
  "subject": "nisp",
  "chapter": "第六章 安全运营与应用",
  "type": "single",
  "stem": "题目题干内容……",
  "options": [
    { "label": "A", "text": "选项 A 文字" },
    { "label": "B", "text": "选项 B 文字" },
    { "label": "C", "text": "选项 C 文字" },
    { "label": "D", "text": "选项 D 文字" }
  ],
  "answer": ["B"],
  "analysis": "答案解析：……"
}
```

- **单选题**：`answer: ["A"]`
- **多选题**：`answer: ["A", "C"]`，必须是合法选项 label
- **判断题**：用 `type: "judge"`，答案为 `["A"]`（对）或 `["B"]`（错）

3. 保存后刷新浏览器即可看到新题目。

### 从 PDF 重新生成

`data/questions.js` 是由 `.workbuddy/memory/parse_questions.py` 从 PDF 自动解析生成的。
如果你有新的 PDF，可参考脚本中的正则重新抽取：

```bash
python .workbuddy/memory/parse_questions.py
```

---

## 六、清空数据

### 方式 A：页面内清空

1. 打开「📊 学习统计」
2. 滑到最下方，点击「🗑 清除全部学习数据」
3. 在弹窗中确认

### 方式 B：浏览器开发者工具

```js
// F12 打开 Console，执行：
localStorage.clear(); location.reload();
```

清空后所有进度、错题、收藏、考试历史都会被重置。

---

## 七、技术约束

- 纯静态：`HTML5 + CSS3 + 原生 JavaScript ES6+`
- 无构建：直接 `index.html` 打开可运行
- 无后端：无服务器、无数据库、无 fetch 远程加载
- 无依赖：不使用 `import/export`、`fetch`、`localStorage` 之外的任何浏览器 API
- 兼容：Chrome / Edge / Safari 最新版，PC + 移动端自适应

---

## 八、主题色与样式

| 变量 | 用途 | 颜色 |
|---|---|---|
| `--primary` | 主色（按钮 / 高亮） | `#2F7BFF` |
| `--success` | 正确绿 | `#22C55E` |
| `--danger`  | 错误红 | `#EF4444` |
| `--bg`      | 背景 | `#F5F7FB` |
| 圆角 | 12–16 px | 卡片 / 按钮 |

- **PC 端**：最大宽度 960 px 居中
- **手机端**：单列，适配 iPhone 安全区（顶部 notch + 底部 home bar）

---

## 九、Hash 路由

| 路径 | 视图 |
|---|---|
| `#/home` | 首页 |
| `#/chapter` | 章节选择 |
| `#/practice?subject=km1&mode=sequence` | 顺序练习（保留以兼容原方案，subject 已不再区分科目，统一为 NISP） |
| `#/practice?chapter=第一章 信息安全基础` | 章节练习 |
| `#/practice?mode=random` | 随机练习 |
| `#/practice?mode=wrong` | 错题重练 |
| `#/practice?mode=favorite` | 收藏重练 |
| `#/card` | 答题卡 |
| `#/exam` | 模拟考试（50 题 / 30 分钟） |
| `#/wrong` | 错题本 |
| `#/favorite` | 收藏 |
| `#/stats` | 学习统计 |
| `#/history` | 考试历史 |
| `#/result?examId=xxx` | 考试结果 |

---

## 十、已知限制

1. **图片题**：题库中如有插图，本版本不展示图片（仅展示题干 / 选项 / 解析）
2. **多选提示**：题目 PDF 中多选题极少（仅 8 道），答题时多选按钮之间不会强制 "至少选 2 项" 校验，按用户提交内容判定
3. **跨设备同步**：当前版本数据仅存本地 `localStorage`，无法跨设备同步
4. **首次加载**：`data/questions.js` 约 530 KB，建议使用本地服务器方式运行以获得最佳体验

---

## 十一、验收清单

- [x] 双击 `index.html` 后可直接在浏览器运行
- [x] 顺序 / 随机 / 章节 / 错题 / 收藏 5 种练习模式可用
- [x] 模拟考试 50 题 / 30 分钟，90 分及格判定
- [x] 答题进度、错题、收藏、考试历史均持久化到 `localStorage`
- [x] 手机端 / PC 端响应式自适应
- [x] 无外部依赖，无控制台报错

---

## 十二、目录速查

| 路径 | 作用 |
|---|---|
| `index.html` | 入口 |
| `data/questions.js` | 题库（520 题） |
| `js/storage.js` | 存储封装 |
| `js/router.js` | 路由 |
| `js/app.js` | 业务视图 |
| `css/style.css` | 样式 |