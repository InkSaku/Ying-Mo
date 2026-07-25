# 生活章节所有权与投稿策略

本文记录 V2 生活章节的写入契约。产品定义仍以 `docs/product.md` 为准；这里补充接口、权限与事务实现，便于联调和回归测试。

## 字段与可见性

`LifeChapter.contribution_policy` 仅表示谁可以投稿：

- `public`：所有账号可用、具有发布权限的登录用户均可投稿。
- `private`：只有 `creator_id` 对应的章节创建者可投稿，管理员角色不会自动绕过。

该字段不控制浏览。`active + approved` 的公有和私有章节都会出现在公共列表、搜索和详情中，章节内日常仍按 `LifePost.visibility` 分别判断可见性。

## 权限矩阵

| 操作 | 创建者 | 内容管理员 | 系统管理员 | 其他合规用户 | 匿名用户 |
| --- | --- | --- | --- | --- | --- |
| 浏览 active/approved | 是 | 是 | 是 | 是 | 是 |
| 创建章节 | 是 | 是 | 是 | 是 | 否 |
| 编辑/安全删除自己的章节 | 是 | 是 | 是 | 否 | 否 |
| 编辑/安全删除任意章节 | 否 | 是 | 是 | 否 | 否 |
| 向公有章节投稿 | 是 | 是 | 是 | 是 | 否 |
| 向私有章节投稿 | 仅创建者 | 仅创建者 | 仅创建者 | 仅创建者 | 否 |
| 强制永久删除 | 否 | 否 | 是 | 否 | 否 |

所有写操作还要求账号处于可用状态；创建和投稿额外要求 `can_publish=true`。`merged` 章节不能普通编辑或再次安全删除。

## API

公共和所有者接口：

- `GET /api/v1/life/chapters`
- `GET /api/v1/life/chapters/{slug}`
- `POST /api/v1/life/chapters`
- `GET /api/v1/life/chapters/{id}/manage`
- `PATCH /api/v1/life/chapters/{id}`
- `GET /api/v1/life/chapters/{id}/deletion-preview`
- `POST /api/v1/life/chapters/{id}/delete`
- `POST /api/v1/life/posts`
- `PATCH /api/v1/life/posts/{id}`
- `GET /api/v1/users/me/chapters`
- `GET /api/v1/users/me/chapters/{id}`

管理员接口：

- `GET /api/v1/admin/chapters`
- `GET /api/v1/admin/chapters/{id}`
- `PATCH /api/v1/admin/chapters/{id}`
- `GET /api/v1/admin/chapters/{id}/deletion-preview`
- `POST /api/v1/admin/chapters/{id}/delete`
- `POST /api/v1/admin/chapters/{id}/force-delete`

旧的 `users/me/chapter-submissions`、管理员封面和合并接口保留兼容，但共用新的章节写入服务。

## 编辑与封面

普通所有者可编辑名称、类型、父章节、地区、简介、投稿策略和封面；管理员还可编辑别名及审核备注。重命名会重算规范名称与同层去重键，但不会改变 slug。

`cover_media_id` 的 PATCH 语义：

- 字段省略：保留当前封面；
- 正整数：绑定操作者本人新上传、用途为内容、尚未绑定且文件完整的图片；
- `null`：移除当前封面。

替换时先在数据库事务中解绑并删除旧记录、绑定新记录；只有事务提交成功后才删除旧物理文件。事务失败会保留旧封面；物理清理失败只记录日志，不回滚已经成功的数据库事务。

## 删除、迁移与强制删除

- 无日常、无子章节：永久删除章节及封面。
- 无日常、有子章节：校验同名冲突后，把直接子章节提升为一级章节，再永久删除源章节。
- 有日常：必须选择合法目标；日常迁移后源章节保留为 `merged` tombstone，旧 slug 返回目标 `canonical_slug`。
- 子章节迁移遇到目标下同名子章节时，子章节日常并入现有子章节，旧子章节标记为 `merged`。
- 私有目标只接受相同章节创建者的源章节迁移。
- 管理员删除他人章节必须填写原因并写审计日志。

系统管理员强制删除使用独立危险接口，要求 UUID `Idempotency-Key`、详细原因、严格确认词 `DELETE CHAPTER {id}`，以及两个级联确认布尔值。它会清理日常、媒体、点赞、收藏、评论、举报、精选、关联通知和子章节，并在事务提交后统一删除物理文件；重复 key 返回原执行统计，不重复删除。

删除、合并、父子层级变化以及向章节投稿时会锁定相关记录。源和目标章节按 ID 顺序加锁，事务内重新校验目标、层级与同名冲突；唯一约束并发冲突返回 409。

## 前端入口

- 创建：`/life/chapters/create`
- 所有者编辑：`/life/chapters/{id}/edit`
- 我的章节：`/me/chapters`
- 管理员编辑：`/admin/chapters/{id}/edit`

创建待审核章节后进入“我的章节”，审核通过后才进入公共详情。日常创建表单只列出可投稿章节；编辑已有日常时，会保留原来已经不再接受新投稿的当前章节，但不能把日常移入无权投稿的私有章节。
