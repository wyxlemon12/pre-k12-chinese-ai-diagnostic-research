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
- 课堂案例笔记：
  [lesson-case-notes.md](./docs/lesson-case-notes.md)
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

启动命令：

```powershell
pnpm bootstrap
pnpm dev
```

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
