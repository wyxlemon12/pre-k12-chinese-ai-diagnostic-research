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

等价的 API 单独启动命令：

```powershell
uv run --project apps/api python -m uvicorn app.main:app --app-dir apps/api --reload --host 127.0.0.1 --port 8000
```

默认端口：

- React: `http://127.0.0.1:5173`
- FastAPI: `http://127.0.0.1:8000`
- FastAPI docs: `http://127.0.0.1:8000/docs`

## 浏览器连通说明

为了让浏览器中的教师工作台可以直接访问本地 API，这轮已经补上：

- `CORSMiddleware`
- 针对 `Access-Control-Request-Private-Network: true` 的预检放行

这意味着在 `http://127.0.0.1:5173` 打开的前端，可以正常请求 `http://127.0.0.1:8000` 的 lesson parse、pathways 和 diagnose 接口。

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
  - 输入课文标题、主题和文本
  - 输出本课三件套、观察点、工作纸映射
- `POST /api/v1/lessons/pathways`
  - 输出起步支持、标准课堂和延展表达三类路径卡
- `POST /api/v1/observations/diagnose`
  - 输入观察点、工作纸结果和教师备注
  - 输出证据链诊断与下一步教学建议

## 下一步建议

下一步编码工程可以直接从以下顺序展开：

1. 在 `apps/api` 中补齐 lesson parse 的结构化 schema。
2. 在 `apps/web` 中把 dashboard 改成教师工作流原型。
3. 在 `crates/text_engine` 中增加高频字、文本特征和结构标签抽取。
