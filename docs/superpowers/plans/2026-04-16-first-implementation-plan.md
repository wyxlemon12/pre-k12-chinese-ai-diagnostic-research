# 首轮实施计划：从 Harness 到教师诊断 Demo

## 1. 目标

本轮不追求做完整产品，而是把当前可运行 harness 推进成一个可演示、可验证、能讲清楚产品价值的首版 demo。

本轮完成后，项目应能演示以下闭环：

1. 教师输入一段课文或短文本。
2. 系统输出本课三件套：
   - 目标词
   - 目标句
   - 目标理解点
3. 系统输出 2-3 条能力路径及支架策略。
4. 教师能勾选课堂观察点与工作纸结果。
5. 系统生成证据链三段式诊断摘要和下一步建议。

## 2. 当前现状

### 已有基础

- `apps/web`
  - 已有 React + TypeScript + Vite 前端壳
  - 已接通 API 健康检查
- `apps/api`
  - 已有 FastAPI 服务
  - 已提供 `POST /api/v1/lessons/parse` 的最小原型
- `crates/text_engine`
  - 已有 Rust crate
  - 已提供最小文本信号提取函数

### 当前缺口

- lesson parse 结果仍偏占位，缺少教师可直接使用的结构。
- 没有 pathways、question ladders、worksheet mapping、diagnosis 等核心接口。
- 前端仍是 harness 首页，不是教师工作流。
- Rust 模块还没有承担产品可见价值。

## 3. 本轮范围

### 必做

1. 把 lesson parse 从占位接口升级成稳定结构化输出。
2. 增加教师端最小工作流页面。
3. 增加课堂观察输入和诊断结果展示。
4. 增加至少一个可展示的 Rust 文本能力。
5. 让 demo 能围绕《我的家》或任意短文本完成一次完整演示。

### 暂不做

- 用户系统
- 持久化数据库
- 音频分析
- 笔顺与书写
- 真正复杂的知识图谱
- 复杂权限与多教师协作

## 4. 建议顺序

### 阶段一：稳定后端结构

目标：先让 API 输出稳定、可供前端消费的结构。

任务：

1. 定义统一的 lesson domain schema。
   - 输入：标题、文本、主题
   - 输出：目标词、目标句、目标理解点、观察点、证据点
2. 重构 `POST /api/v1/lessons/parse`
   - 让返回值字段命名与设计稿一致
   - 保留 deterministic fallback，避免 demo 全靠模型发挥
3. 新增 `POST /api/v1/lessons/pathways`
   - 输出起步支持、标准课堂、延展表达三条路径
4. 新增 `POST /api/v1/observations/diagnose`
   - 输入观察点与工作纸结果
   - 输出证据、推断、下一步动作
5. 为上述接口补齐 FastAPI response models 和样例 payload。

验收：

- FastAPI docs 中能清楚看到 3 个核心接口。
- 给一段《我的家》文本，可以稳定返回结构化 JSON。

### 阶段二：把前端改成教师工作流

目标：让演示从“技术壳”变成“教师使用流程”。

任务：

1. 把当前首页改成单页教师工作台。
2. 页面至少包含 4 个区域：
   - 文本输入区
   - 本课三件套区
   - 能力路径区
   - 课堂观察与诊断区
3. 提供一个默认样本文本，保证首次打开就能演示。
4. 把 API 调用串成最小闭环：
   - 先 parse
   - 再 pathways
   - 最后 diagnose
5. 明确 loading、error、empty 三种状态。

验收：

- 前端能完整跑通一次输入到诊断输出。
- 页面文案突出“教师诊断与选材助手”，而不是“AI 生成器”。

### 阶段三：补一个可展示的 Rust 能力

目标：让 Rust 不只是占位目录，而是能参与 demo 叙事。

建议最小能力：

- 中文文本字符信号提取
- 高频字去重
- 文本长度与结构标签初筛

任务：

1. 在 `crates/text_engine` 中扩展文本分析结果结构。
2. 至少输出：
   - 去重字列表
   - 字数
   - 句子数
   - 是否包含明显重复高频字
3. 给 crate 补测试。
4. 在文档中说明这个模块未来可承接更高性能的文本预处理。

验收：

- `cargo test -p text_engine` 在本机 Rust 环境修复后可通过。
- 该模块的输出能被后端后续接入或在文档中清晰说明用途。

## 5. 推荐任务拆分

适合按以下顺序执行：

1. 后端 schema 重构
2. lesson parse 改造
3. pathways 接口
4. diagnosis 接口
5. API 样例和手动验证
6. 前端页面重构
7. 前端串联 parse/pathways/diagnose
8. Rust 文本信号增强
9. 文档和演示 runbook 更新

## 6. 每个任务的完成标准

每个任务完成时都应满足：

1. 有清晰输入和输出。
2. 有最小验证步骤。
3. 不把下一步必须依赖的结构留成“以后再说”。
4. 尽量让 demo 可以随时中途演示。

## 7. 推荐的第一批具体实现

如果现在立刻开工，我建议先做这 4 件事：

1. 在 `apps/api/app/main.py` 中抽离 lesson 相关 schema 和 mock rules。
2. 新增 pathways 与 diagnose 两个端点。
3. 在 `apps/web/src/App.tsx` 中改成教师工作台单页。
4. 用默认样本文本把 API 到 UI 闭环跑通。

这是最小且最有展示价值的一轮。

## 8. 重启 Codex 后怎么配合 Superpowers 使用

重启 Codex 后进入项目目录，可以直接这样开始：

1. `先用 brainstorming 复核 docs/superpowers/specs 和 docs/superpowers/plans，下结论哪些必须做、哪些先不做。`
2. `然后用 writing-plans 把 docs/superpowers/plans 里的阶段一和阶段二拆成可执行小任务。`
3. `确认后，用 subagent-driven-development 或 executing-plans 开始实现。`
4. `每完成一批任务，用 requesting-code-review 复核。`

如果你想更直接，也可以说：

`按 docs/superpowers/plans/2026-04-16-first-implementation-plan.md 执行第一阶段和第二阶段。`

## 9. 当前阻塞项

当前唯一明显的机器级阻塞是 Rust toolchain 状态异常：

- `pnpm build` 中前端和 Python 部分可通过
- `cargo check -p text_engine` 当前失败

因此本轮开发可以先以前后端为主，Rust 作为第二优先级处理。
