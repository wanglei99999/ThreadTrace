# ThreadTrace（语脉）

论坛上下文情报「研究座舱」：把论坛长帖转化为可追溯的上下文情报。面向单操作者，证据可追溯，多来源就绪（NGA 是第一个来源，不是架构本身）。

## 架构

DDD 分层（`src/`）：
- `domain/` — 领域模型、analysis、retrieval、sources、review-actions、scheduling、events、contracts
- `application/` — use-cases、ports、jobs、source-ingest
- `infrastructure/` — postgres、llm、crawlers、forum-adapters（nga）、notifications、storage、retrieval、review-actions
- `presentation/` — `http/`（server.js）、`cli/`、`worker/`、`web/`（前端）
- `runtime/`、`connectors/`

后端 Node.js（commonjs，Node ≥ 20）。

## 启动与验证

- 启动 Web：`npm run serve`（`node src/presentation/http/server.js`，端口 **3017**，浏览器开 http://localhost:3017）。端口默认值在 `src/runtime/threadTraceConfig.js`，可用 `PORT` / `THREADTRACE_HTTP_PORT` 覆盖。
- 单元测试：`npm run test:unit`
- Web CDP 验证示例：`npm run verify:web:automation-cockpit`（`scripts/verifyAutomationCockpitCdp.js`）

### 在线抓取（真实数据获取）

`infrastructure/crawlers/httpForumCrawler.js` 负责在线抓取，已支持：**自动 GBK/gb18030 解码**（NGA 是 GBK，按 content-type/meta 探测）、真实浏览器 UA、referer、cookie 注入。会话密钥**只经环境变量**注入，绝不落源码：
- `THREADTRACE_NGA_COOKIE`（或通用 `THREADTRACE_CRAWLER_COOKIE`）— 登录会话 cookie，NGA 绝大多数内容需要（`ngaPassportUid`/`ngaPassportCid`）。放 `.env`（已在 `.gitignore`）。
- `THREADTRACE_CRAWLER_USER_AGENT` / `THREADTRACE_CRAWLER_REFERER`（可选覆盖，默认给了 Chrome UA）。
- config 层 `config.crawler.cookieConfigured` 仅报告"是否已配"，不存值（镜像 `llm.apiKeyConfigured`）。

抓到的原始 HTML 与「保存页」格式兼容——同一套 `readHtmlText`(gb18030) + `ngaSavedHtmlAdapter` 解析链零改动直接吃（已端到端验证）。**离线保存页目录仍是 ToS 最安全的主路径**；在线抓取用你自己的登录会话，注意账号风控与抓取频率。

## 前端（`src/presentation/web/`）

纯 vanilla 三件套，**无构建步骤**：
- `index.html` — 应用外壳 + 8 个视图面板（`.view-panel`），底部按顺序加载 `js/app.part1..8.js`
- `js/app.part1..8.js`（共 ~1 万行）— 原单文件 `app.js` 按行段**物理拆分**为 8 个普通 `<script>`，**共享同一全局作用域**（无 import/export，无构建步骤），行为与单文件完全一致。全局 `state`、`views` 配置、视图切换、112 个 API 调用、234 个渲染函数散布其中。改动须知:① 仍是全局作用域,函数跨片自由互调;② 顶层 `state`/常量/`views`/`DOMContentLoaded` 注册都在 `part1`,必须最先加载;③ `index.html` 的脚本顺序 = 原文件顺序,不可乱序;④ 用 `grep` 按函数名跨片定位
- `styles.css` — 设计系统（单文件，色值全部走 `:root` token）

### 关键约束（改动前必读，不可破坏）

应用脚本（`js/app.part*.js`）全部用 `innerHTML` 字符串拼接渲染，并通过**写死的元素 id** 绑定事件与结果容器。修改 `index.html` 时：
- **保留所有 `<form>` 的 `id` 与字段 `name`**（提交走 FormData / `form.get(name)`）
- **保留所有按钮 / 结果容器 `id`**（`getElementById` 硬依赖，缺一即报错）
- **保留结构性 class 名**（渲染函数 `innerHTML` 依赖）：`*-hero` / `*-card` / `*-row` / `*-signal` / `panel` / `panel-head` / `panel-body` / `status-ok|warn|fail|muted` / `status-badge` / `cockpit-*` / `tag` / `tag-list` / `inline-button` / `secondary-inline-button` / `feedback-state` / `empty-signal` / `muted` / `error` / `hidden` / `is-active` / `is-refreshing` / `result-focus-pulse`
- 渲染工厂函数签名不动：`escapeHtml` / `panel` / `statusBadge` / `statusClassName` / `statusVariant` / `cockpitClassName` / `tagList` / `emptySignal` / `metric` / `evidenceList` / `renderFeedbackState`
- API 经 `requestJson`(POST) / `fetchJson`(GET) 封装；不直接散写 fetch

视图机制：`.nav-item[data-view]` → `bindNavigation` → `setView(name)`；`setView` 切换 `.view-panel` 的 `.hidden`、显示 `{name}View`、写 `viewTitle/viewSubtitle/viewMode/viewFocus`，并按视图触发加载（`overview→loadOverview`、`operations→loadSystemStatus/loadAutomationReadiness`、`history→renderHistoryCockpitStandby`）。新增视图需同步：`index.html` 的 `.view-panel` + 侧边栏 `data-view` 按钮、`part1` 的 `views` 对象与 `setView` 分支。

### 信息架构（8 视图，2 分组）

- **工作区**：`overview`（概览首页）· `history`（历史分析）· `context`（新发言解读）· `search`（历史检索）
- **运营**：`sources`（来源采集/接入）· `operations`（运行/worker/runbook/自动化）· `alerts`（通知事件 + 人工复核）· `publish`（连接器发布管线）

## 设计系统：Notion 骨 · Apple 质

事实来源：根 `DESIGN.md`；外部参考：`docs/design-references/notion.DESIGN.md` + `apple.DESIGN.md`。

- **Notion（主基调）**：紫主色 `--accent #5645d4`（仅主操作/当前选中/焦点）、链接蓝 `--link #0075de`（与主紫分工不混用）、暖灰中性（canvas `#ffffff` / surface `#f6f5f4` / hairline `#e5e3df` / 暖炭灰正文 `#37352f`）、8px 矩形按钮 / 12px 卡片、扁平 + 1px hairline、pastel 属性色（`--tint-*`）做状态与分类编码。
- **Apple（高级感）**：大标题负字距、weight 阶梯 **400/500/600/700（禁用 800+）**、关键标题区留白、`scale(0.97)` 按压微动效、阴影只给浮层（下拉/modal）。
- token 全部定义在 `styles.css` 的 `:root`；改样式**优先复用 token**，不要硬编码颜色。

### 设计红线（impeccable absolute bans）

禁止：`01/02/03` 数字脚手架编号、每区 eyebrow kicker（mono + 彩底小标签）、装饰性多色渐变条、`border-left/right` 大于 1px 的色条、渐变文字、超粗字重（800+）、玻璃拟态滥用、千篇一律的等大卡片网格。

### 前端设计一律走 impeccable 技能

前端的设计 / 改造 / 评审**统一用 impeccable 技能**（`/impeccable craft|polish|audit|critique|...`）：
- 新 surface 或大改 → `craft`（shape→build）
- 收尾 → `audit`（对比度·a11y·响应式）+ `critique`（UX 评分）+ `polish`
- 遵循 product register：earned familiarity、组件状态完整（default/hover/focus/active/disabled/loading/error）、密度感、骨架屏而非 spinner、空状态教学。
