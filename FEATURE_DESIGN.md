# API Testing Tool 特性设计文档

> 版本：v 0.1.0　|　文档类型：特性设计　|　语言：中文

## 1. 概述

**API Testing Tool** 是一个面向英文使用场景的轻量级接口测试小工具，核心用途是验证：

> **OAuth 2.0 鉴权通过后，目标业务 API 能否返回预期的字段。**

工具采用「前后端分离、本地运行」的架构：

- **前端**：单文件 HTML（`index_en.html`），CSS 与 JavaScript 全部内嵌，无外部依赖。
- **后端**：Node.js 本地服务（`server.js`），负责托管前端页面，并作为**反向代理**转发外部 API 请求，从而规避浏览器跨域（CORS）限制。

关键指标与运行方式：

| 项目 | 说明 |
| --- | --- |
| 前端版本 | v 0.1.0（页面右上角展示） |
| 后端技术 | Node.js 内置 `http` 模块（ESM），使用全局 `fetch`（Node 18+） |
| 运行时依赖 | 无第三方 npm 依赖 |
| 默认端口 | `8765`（仅绑定 `127.0.0.1`） |
| 启动方式 | 双击 `start.bat`（内部执行 `powershell -Command "npm start"`） |
| npm 脚本 | `start` → `node server.js 8765`；`test` → `node --test` |

---

## 2. 系统架构

### 2.1 总体架构

```
┌───────────────────────────┐
│  浏览器                    │
│  index_en.html (SPA)      │
│  内嵌 CSS / JS             │
└────────────┬──────────────┘
             │  fetch 同源请求
             ▼
┌───────────────────────────┐
│  本地后端 server.js        │
│  GET  /   → 托管页面       │
│  POST /proxy → OAuth 代理  │
│  POST /api   → 业务API代理 │
└────────────┬──────────────┘
             │ 服务端 fetch（规避 CORS）
             ▼
┌───────────────────────────┐
│  外部 API                  │
│  · OAuth Token 端点        │
│  · 业务 API 端点           │
└───────────────────────────┘
```

### 2.2 设计要点

1. **前后端同源**：页面由后端 `GET /` 提供，前端 `fetch` 只请求本机 `/proxy`、`/api`，因此不触发 CORS。
2. **服务端代理**：真实的外部请求由 Node 发起（服务端不涉及浏览器同源策略），前端不直接接触第三方域名。
3. **统一响应协议**：两个代理接口都返回相同结构，前端用同一套逻辑渲染结果。

---

## 3. 页面布局总览

页面为单列卡片式布局，自上而下：

1. **页头**：居中标题 “API Testing Tool”，标题下方右对齐灰色版本号 “v 0.1.0”。
2. **第一块：Oauth 2.0**（鉴权取 token）。
3. **第二块：API Field Info**（调用业务 API 并做字段核对）。

---

## 4. 功能模块一：OAuth 2.0 鉴权

### 4.1 界面组成

左右两栏结构：

**左栏（表单）**
- `Auth API URL`：文本输入框，填写 OAuth Token 端点地址。
- `RequestBody` 区域，含三个字段：
  - `grant_type`：下拉单选框，选项为 `client_credentials` / `authorization_code` / `password`。
  - `client_id`：文本输入框。
  - `client_secret`：文本输入框。

**右栏（结果）**
- `Test Auth` 按钮。
- 灰色底纹返回区域（`responseBox`），展示程序 API 的完整返回内容。

### 4.2 交互流程

1. 用户填写 Auth API URL 与三个 RequestBody 字段，点击 **Test Auth**。
2. 前端校验 URL 非空，否则在返回区提示 `Error: Auth API URL is required.`。
3. 前端将参数以 JSON 提交到本机 `POST /proxy`。
4. 后端以 `application/x-www-form-urlencoded` 格式调用外部 OAuth 端点。
5. 后端把上游的**状态码、状态文本、原始响应体、耗时**封装返回。
6. 前端在返回区展示：状态码与耗时，以及**自动美化（缩进）的 JSON**（非 JSON 则原样显示）。
7. 本次返回中若包含 `access_token` 键值对，前端会自动在第二块 **Header** 区域新增一个键值对（`access_token` = 令牌值；若该键已存在则更新其值）。

### 4.3 后端接口：`POST /proxy`

- **请求体（JSON）**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `url` | string | OAuth Token 端点地址 |
| `grant_type` | string | 授权类型 |
| `client_id` | string | 客户端 ID |
| `client_secret` | string | 客户端密钥 |

- **上游调用**：`POST url`，`Content-Type: application/x-www-form-urlencoded`，body 为上述三个参数。
- **成功响应**：`{ status, statusText, body, elapsed }`
- **上游异常**：HTTP 502，`{ error, elapsed }`

---

## 5. 功能模块二：API Field Info

### 5.1 界面组成

第二块自上而下分为三个「行」，行与行之间用浅色分隔线区隔：

**第 1 行：请求地址与方法**
- `API URL` 输入框（占满剩余宽度）。
- `Method` 下拉框：`GET` / `POST`（默认 `GET`）。

**第 2 行：Header 与 RequestBody（左右结构）**
- 左侧 `Header` 区域：键值对集合，可动态增删。
- 右侧 `RequestBody` 区域：键值对集合，可动态增删；区域下方是 `API Test & Data Check` 按钮。

**第 3 行：响应区与 DataCheck（左右结构）**
- 左侧：灰色底纹返回区（`apiResponseBox`）。
- 右侧：`DataCheck` 下拉框 + 字段映射表。

### 5.2 键值对（Header / RequestBody）管理

- 每个区域由若干「键值对行」组成，每行 = `key` 输入框 + `value` 输入框 + `Delete` 按钮。
- 点击灰色 **add Parameter** 按钮：新增一行空的键值对。
- 点击 **Delete**：删除本行两个输入框。
- `RequestBody` 默认初始化两行：`PageNo = 1`、`PageSize = 10`。
- 提交时，仅收集 key 非空的行，key 为空的行被忽略。

### 5.3 API 调用流程（API Test & Data Check）

1. 用户填写 API URL、Method、Header、RequestBody 后点击按钮。
2. 前端校验 API URL 非空。
3. 前端收集 Header 与 RequestBody 键值对。
   - `access_token` 由模块一在 Test Auth 成功后自动注入 Header 区域。
4. 若 Header 中存在 `access_token`，前端将其从 `headers` 中提取，作为独立字段 `access_token` 与 `headers` 并列提交到本机 `POST /api`。
5. 后端按 Method 调用外部 API：`headers` 原样透传为请求头，`access_token` 由后端附加到请求参数（body/query）。
6. 前端展示状态码、耗时与美化后的 JSON 响应。

### 5.4 DataCheck 字段映射表

- `DataCheck` 下拉框选项：`Delivery_Project` / `Issue_Ticket` / `Health_Check`。
- 切换选项时，下方表格动态渲染对应数据（`renderDataCheck`）。
- 表格结构：
  - 第 1 列：复选框列（表头 + 每行都有复选框）。
  - 第 2 列：`Description`（业务字段描述）。
  - 第 3 列：`O3 Mandatory Field`（API 响应中期望出现的字段名）。
- **表头复选框**：单击可全选 / 反选当前表格所有行。
- 数据来源：`csv/` 目录下三个 CSV 文件（详见附录），已预先转换为 JSON 数组内嵌于前端，**运行时不再加载本地 CSV**。

### 5.5 后端接口：`POST /api`

- **请求体（JSON）**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `url` | string | 业务 API 地址 |
| `method` | string | `GET` 或 `POST` |
| `headers` | object | 前端 Header 键值对（不含已提取的 `access_token`） |
| `body` | object | 前端 RequestBody 键值对 |
| `access_token` | string | 从 Header 中提取的令牌（可选） |

- **上游调用规则**
  - `GET`：将 `body` 与 `access_token` 拼接为 URL 查询串。
  - `POST`：将 `body` 与 `access_token` 作为 `application/x-www-form-urlencoded` 请求体；`headers` 原样透传，若未指定 `Content-Type` 则自动补上。
- **成功响应**：`{ status, statusText, body, elapsed }`
- **上游异常**：HTTP 502，`{ error, elapsed }`

---

## 6. 后端接口汇总

| 方法 | 路径 | 用途 | 入参 | 出参 |
| --- | --- | --- | --- | --- |
| GET | `/` | 托管前端页面 | — | `text/html` |
| POST | `/proxy` | OAuth Token 代理 | `url, grant_type, client_id, client_secret` | `status, statusText, body, elapsed` |
| POST | `/api` | 业务 API 代理 | `url, method, headers, body, access_token` | `status, statusText, body, elapsed` |
| 其他 | 其他 | 未匹配路由 | — | 404 Not Found |

统一约定：
- 请求体为非法 JSON → 400 + `{ error }`。
- 缺少 `url` → 400 + `{ error }`。
- 上游网络/异常 → 502 + `{ error, elapsed }`。
- 成功 → 200 + `{ status, statusText, body, elapsed }`。

---

## 7. 关键数据流时序

### 7.1 OAuth 鉴权

```
用户 → 前端 testAuth() → POST /proxy → 后端 fetch(OAuth URL) → 返回 token JSON → 前端展示并自动把 access_token 注入 Header 区域
```

### 7.2 业务 API 调用 + 字段核对

```
用户 → 前端 apiTest()
     → 收集 Header 与 RequestBody，提取 Header 中的 access_token
     → POST /api（携带 url/method/headers/body/access_token）
     → 后端 fetch(业务 URL，GET 拼 query / POST 拼 form body)
     → 返回响应 → 前端美化展示
```

### 7.3 DataCheck 表格渲染

```
用户切换 DataCheck 下拉 → renderDataCheck() → 读取内嵌 dataCheckData[选项] → 重建表头与表体
表头复选框 → toggleAll() → 勾选/取消当前表格所有行
```

---

## 8. 前端核心函数清单

| 函数 | 职责 |
| --- | --- |
| `testAuth()` | 提交 OAuth 参数至 `/proxy`，渲染结果并自动注入 access_token 到 Header |
| `apiTest()` | 收集 Header/RequestBody，提取 Header 中的 access_token，提交 `/api` 并渲染结果 |
| `createPairRow()` | 生成一组键值对输入行（key + value + Delete） |
| `addHeader()` / `addBody()` | 在 Header / RequestBody 区域新增空键值对 |
| `addHeaderParameter()` | 在 Header 区域按 key 更新或新增一个键值对 |
| `removePair()` | 删除指定键值对行 |
| `collectPairs()` | 收集某区域内所有非空键值对为对象 |
| `extractAccessToken()` | 从 OAuth 返回文本中提取 access_token（testAuth 调用） |
| `renderDataCheck()` | 依据下拉选项渲染字段映射表 |
| `toggleAll()` | 表头复选框全选 / 反选 |
| `escapeHtml()` | HTML 转义，防止错误信息注入 |

---

## 9. 已知限制与后续规划

1. **字段自动核对尚未闭环**：当前 `DataCheck` 表格提供了「字段映射 + 勾选」交互，但 `apiTest()` 尚未读取表格勾选项，也未自动把 API 响应的字段与 `O3 Mandatory Field` 逐项比对。即「数据校验」目前停留在人工对照阶段，自动比对属于待实现能力。
2. **鉴权仅支持 access_token 透传**：模块一仅支持三种 `grant_type` 的 token 获取，未实现 refresh_token、PKCE、授权码回调等高级 OAuth 流程。
3. **access_token 传递位置**：`access_token` 由前端自动注入 Header 区域，提交时被提取为独立字段 `access_token`，由后端附加到请求参数（body/query）；如需改为标准 `Authorization: Bearer` 头，需调整后端映射。
4. **无 token 也可发起调用**：模块二不再拦截「缺少 access_token」的情况，未鉴权时同样会发起请求；调用是否成功取决于外部 API 是否要求鉴权。
5. **数据静态内嵌**：DataCheck 数据由 CSV 预转换内嵌，CSV 更新后需重新生成内嵌 JSON。

---

## 10. 附录：DataCheck 数据源

数据源自 `csv/` 目录下三个 CSV，均已转换为 JSON 数组内嵌于前端：

| 下拉选项 | 源文件 | 行数（映射项） |
| --- | --- | --- |
| Delivery_Project | `csv/Delivery_Project .csv` | 29 |
| Issue_Ticket | `csv/Issue_Ticket.csv` | 12 |
| Health_Check | `csv/Health_Check.csv` | 11 |

每个 CSV 的第一行为表头 `Description, O3 Mandatory Field`，后续每行是一条「业务字段描述 → 期望字段名」的映射记录。
