# Pre-K12 AI辅助教学研究

这个仓库围绕一个求职导向的产品研究题展开：

`面向香港国际学校 6 岁混合起点班级的中文阅读与识字诊断助手`

项目目标不是做一个“生成阅读材料”的工具，而是研究并设计一个更贴近一线中文教师工作流的 AI 助手：

1. 帮老师从现有课文、绘本片段或主题短文中选出合适的课堂入口。
2. 在一次课堂活动后快速判断学生卡点。
3. 给出下一步教学干预和下一篇材料建议。

## 当前产出

- 设计稿：
  [2026-04-16-age-6-chinese-reading-diagnostic-design.md](./docs/superpowers/specs/2026-04-16-age-6-chinese-reading-diagnostic-design.md)
- 首轮实施计划：
  [2026-04-16-first-implementation-plan.md](./docs/superpowers/plans/2026-04-16-first-implementation-plan.md)
- 课堂案例笔记：
  [lesson-case-notes.md](./docs/lesson-case-notes.md)
- 教师体验记录：
  [teacher-experience-notes.md](./docs/teacher-experience-notes.md)
- 工程 harness 说明：
  [engineering-harness.md](./docs/engineering-harness.md)
- 本地参考材料：
  `reference/`

## 技术方向

当前设计稿已经补入首版技术选型，核心组合为：

- 前端：`React + TypeScript`
- 后端主服务：`Python + FastAPI`
- 高性能或本地化模块：`Rust`

这个组合的意图不是堆技术，而是把三件事分清楚：

- React 负责教师工作台和 demo 交互
- Python 负责教案拆解、知识图谱、诊断逻辑和 LLM 编排
- Rust 负责后续值得性能化或本地化的模块

## 已部署的工程环境

当前仓库已经部署了可直接继续编程的 harness：

- `apps/web`：React + TypeScript + Vite
- `apps/api`：FastAPI + uv
- `crates/text_engine`：Rust crate

当前前后端 demo 已能跑通一个最小教师闭环：

1. 输入一段课文或主题短文
2. 生成本课三件套
3. 自动补出三类能力路径卡
4. 勾选课堂观察与工作纸结果
5. 输出证据链诊断和下一步教学建议

启动命令：

```powershell
pnpm bootstrap
pnpm dev
```

如需单独启动 API：

```powershell
uv run --project apps/api python -m uvicorn app.main:app --app-dir apps/api --reload --host 127.0.0.1 --port 8000
```

默认访问地址：

- 前端：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:8000`
- API 文档：`http://127.0.0.1:8000/docs`

## 当前 Demo 重点

这轮 demo 不是“给老师生成更多内容”，而是把一线教师更常见的三个动作串成一个界面：

1. 备课前先把文本拆成可教结构
2. 课堂中快速记录高信息量观察点
3. 课后形成低风险、可落地的下一步教学动作

后端当前开放 3 个核心接口：

- `POST /api/v1/lessons/parse`
- `POST /api/v1/lessons/pathways`
- `POST /api/v1/observations/diagnose`

## 教师视角反馈

从一位“不会关心技术栈、只关心能不能拿去上课”的教师视角看，这版 UI 已经有一个很强的正向信号：

- “生成本课三件套”这种动作命名足够直观，能让人立刻理解要点什么。
- 整体不像玩具，而像一个认真备课用的工作台。
- 一旦能稳定产出可直接拿去用的课堂结构，老师会愿意反复回来使用。

但也暴露出一个非常真实的问题：

- 只要界面出现 `API 状态`、`Failed to fetch`、`HTTP 404` 这类技术报错，非技术教师会立刻失去信任，默认这不是给自己准备的工具。
- `能力路径卡`、`诊断`、`证据链` 这类说法，需要继续配上更贴近课堂动作的解释，否则仍显抽象。
- 用户第一次进入页面时，仍需要更明确地知道“先填什么，再点哪里”。

这意味着后续优化重点应放在：

1. 把错误提示改成教师能理解的语言
2. 把步骤引导写得更像备课流程
3. 让每个输出区都更像“下一步能直接拿去做什么”

## 核心结论

- 对 6 岁孩子，AI 的首要价值不是“多生成内容”，而是“选对内容、看清卡点、给出下一步”。
- 产品首版要服务老师，不是直接服务学生。
- 首版诊断维度只做：
  - 听懂程度
  - 认字与词汇
  - 朗读与口语输出
  - 阅读理解
- 笔顺与书写放到第二阶段。

## 真实课堂蓝本

研究过程参考了两类公开材料：

1. 香港教育局《童心童趣》单元一《上学》教学设计
2. 香港教育局小一《中国语文（非华语学生适用）》第七课《我的家》

这两类材料帮助我们把 PRD 从“内容生成器”收窄成“课堂诊断与选材助手”。

## 说明

- 仓库中的 PDF 参考材料保留在本地研究环境，不作为公开仓库分发内容。
- 公开仓库以内文档、结构化笔记和来源链接为主，避免直接再分发可能涉及版权限制的材料。
