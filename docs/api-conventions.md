# 映墨 V2 API 通用规范

> API 根路径：`/api/v1`。本规范优先于各业务接口的临时习惯。

## 1. HTTP 与通用规则

- 内容类型为 `application/json; charset=utf-8`；图片上传使用 `multipart/form-data`。
- JSON 字段使用 `snake_case`；布尔为 JSON boolean；时间为 UTC ISO 8601，例如 `2026-07-10T14:30:00Z`。
- 路径资源 ID 使用正整数；slug 只用于明确声明为 slug 的路径参数。空字符串视为未提供。
- 成功使用语义化的 200、201 或 204；204 无响应体。创建资源响应带 `Location`。
- 受保护接口使用 `Authorization: Bearer <access_token>`；没有、无效或过期 token 返回 401。权限不足返回 403，绝不以隐藏前端按钮代替后端鉴权。
- 列表默认按业务定义稳定排序，必须支持 `page` 与 `page_size`。不支持的筛选/排序参数返回 422。

## 2. 成功响应

除 204 外，所有成功响应使用：

```json
{
  "data": {},
  "meta": {
    "request_id": "01J..."
  }
}
```

`data` 可以是对象或数组。仅在适用时添加 `meta` 字段，不能为方便而改变顶层结构。示例：

```json
{
  "data": {
    "id": 42,
    "title": "傍晚的路口"
  },
  "meta": { "request_id": "req_abc" }
}
```

## 3. 分页

请求参数：`page` 从 1 开始，默认 1；`page_size` 默认 20，最大 100。分页列表使用：

```json
{
  "data": [{ "id": 42 }],
  "meta": {
    "request_id": "req_abc",
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 73,
      "total_pages": 4,
      "has_next": true,
      "has_previous": false
    }
  }
}
```

`total` 是按当前可见性/筛选条件计算后的总数。评论回复等嵌套集合不得隐式无限返回；需要时提供独立分页端点。

## 4. 错误响应与状态码

所有错误响应固定如下，`message` 可安全展示给用户，`details` 只包含可公开的字段错误，不包含堆栈、SQL、token 或存储路径：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法。",
    "details": [
      { "field": "email", "code": "invalid_format", "message": "请输入有效邮箱地址。" }
    ],
    "request_id": "req_abc"
  }
}
```

| HTTP | 错误码 | 使用场景 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | 语法正确但无法按协议处理的请求 |
| 401 | `AUTHENTICATION_REQUIRED` / `TOKEN_INVALID` | 缺失、无效或失效认证 |
| 403 | `PERMISSION_DENIED` / `ACCOUNT_RESTRICTED` | 已认证但无权、账户限制 |
| 404 | `RESOURCE_NOT_FOUND` | 资源不存在，或私有资源按防枚举策略隐藏 |
| 409 | `RESOURCE_CONFLICT` / `DUPLICATE_RESOURCE` | 唯一约束、重复点赞/章节等冲突 |
| 413 | `FILE_TOO_LARGE` | 上传超过限制 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 文件真实类型不受支持 |
| 422 | `VALIDATION_ERROR` | 字段、分页或业务前置校验失败 |
| 429 | `RATE_LIMITED` | 触发限流，可附 `Retry-After` |
| 500 | `INTERNAL_ERROR` | 未预期错误；只给通用文案与 request_id |

已存在的点赞/收藏“再次点击取消”应设计为明确的删除/切换契约，不能把数据库唯一冲突泄露为 500。对同一字段冲突，服务层将数据库 `IntegrityError` 映射为 409。

## 5. 请求校验、并发与安全

- 每个端点在进入 service 前做 schema 校验；服务层再做业务、状态、归属和可见性校验。
- 可写请求只接收白名单字段；HTML/富文本尚未纳入 V2 MVP，文本按纯文本处理和安全转义。
- `POST` 创建、上传、登录、举报与互动应配置按用户/IP 的限流；具体阈值由部署任务定案。
- 所有响应附 `X-Request-ID`；若客户端传入合规 `X-Request-ID` 可沿用，否则服务端生成。日志以该 ID 关联。
- 修改/删除必须检查作者或管理员权限。对章节合并、下架和举报裁决使用事务并记录管理员操作日志。

## 6. 认证会话契约

- `POST /auth/login` 和 `POST /auth/register` 的 `data` 返回 access token 与当前用户概要；refresh token 仅通过 HttpOnly cookie 写入，响应 JSON 不回传。
- `POST /auth/refresh` 依赖 refresh cookie，轮换 refresh token 并返回新的 access token；失败为 401。
- `POST /auth/logout` 撤销当前 refresh session、清除 cookie；重复调用保持幂等并返回 204。
- 前端 access token 只存内存；刷新页面以 `/auth/refresh` 重获，不能持久化到 localStorage。

## 7. 媒体与可见性

- `POST /uploads/images` 接收字段名 `files`（可多文件），返回待绑定 Media 资源；服务端读取真实图片内容、限制格式为 JPEG/PNG/WebP、单图最大 15 MB，并生成缩略图。
- 媒体仅可由上传者在未绑定状态删除；绑定后的删除必须经所属日常或教材编辑接口处理。
- 返回给客户端的是经过授权的访问 URL 或应用媒体 URL，绝不返回服务器绝对文件路径或对象存储凭据。
- 对 `private` 内容，读取接口必须在加载媒体前通过可见性校验；`login_only`（字段值）要求已认证用户。
