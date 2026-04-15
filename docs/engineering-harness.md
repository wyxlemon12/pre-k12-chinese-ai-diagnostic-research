# Engineering Harness

这份文档对应“PRD 完成后，立即进入工程实现”的本地开发环境。

## 当前骨架

- `apps/web`
  - React + TypeScript + Vite
  - 用于教师工作台、诊断结果页和 API 连通验证
- `apps/api`
  - Python + FastAPI + uv
  - 用于 lesson parsing、知识图谱编排和证据链诊断接口
- `crates/text_engine`
  - Rust library crate
  - 用于后续高性能文本处理与本地化能力

## 一次性安装

```powershell
pnpm bootstrap
```

这会完成：

- 前端 npm 依赖安装
- Python 虚拟环境与依赖同步

Rust 工具链已经在当前机器安装完成；如果换到新机器，需要先安装 `rustup`。

## 本地开发

```powershell
pnpm dev
```

默认端口：

- React: `http://127.0.0.1:5173`
- FastAPI: `http://127.0.0.1:8000`
- FastAPI docs: `http://127.0.0.1:8000/docs`

## 验证命令

```powershell
pnpm build
pnpm lint:web
pnpm check:api
pnpm check:rust
```

## 当前最小接口

- `GET /healthz`
  - 健康检查
- `POST /api/v1/lessons/parse`
  - 输入课文标题和文本
  - 输出目标词、目标句、理解点和证据点的最小结构

## 下一步建议

下一步编码工程可以直接从以下顺序展开：

1. 在 `apps/api` 中补齐 lesson parse 的结构化 schema。
2. 在 `apps/web` 中把 dashboard 改成教师工作流原型。
3. 在 `crates/text_engine` 中增加高频字、文本特征和结构标签抽取。
