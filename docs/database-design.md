# 映墨 V2 数据库设计

> 基线：MySQL 8.0+ / `utf8mb4` / InnoDB；SQLite 仅限本地与测试。所有表含 `created_at`、`updated_at`（UTC）；仅需要软删除的内容表另有 `deleted_at`。图片二进制不入库。

## 1. 通用原则

- 主键使用 `BIGINT UNSIGNED`；外键有索引；业务状态使用受约束的短字符串或受控枚举，不以自由文本存状态。
- 用户可见内容（`life_posts`、`game_guides`、`comments`）采用软删除，默认查询排除 `deleted_at IS NOT NULL`。媒体用状态/删除时间管理，不能物理删除仍被引用的文件。
- 聚合计数（like/comment/favorite/content 等）可作为缓存字段，但真相来自关联表；任何更新必须在事务内维护，且可重建。
- 多态关联只允许在白名单内使用，并以 `target_type` + `target_id` 联合索引。数据库不能为多态外键提供完整 FK，因此 service 层负责目标存在性与权限校验。

## 2. 用户、权限与媒体

| 表 | 核心字段与约束 | 用途 |
| --- | --- | --- |
| `users` | `username` UNIQUE、`email` UNIQUE、`password_hash`、`display_name`、`bio`、`location`、`avatar_media_id`、`role`、`status` | 账号；`role`: user/content_admin/system_admin；`status`: active/publish_restricted/comment_restricted/banned/deactivated |
| `refresh_sessions` | `user_id` FK、`token_hash` UNIQUE、`expires_at`、`revoked_at`、设备/IP 摘要 | refresh token 可撤销与轮换；只保存哈希 |
| `media` | `owner_id` FK、`storage_key` UNIQUE、`mime_type`、`byte_size`、`width`、`height`、`original_name`、`status`、`bound_at`、`deleted_at` | 原图/缩略图元数据；`storage_key` 不直接暴露 |
| `media_variants` | `media_id` FK、`kind`、`storage_key` UNIQUE、`width`、`height` | thumbnail 等派生文件；UNIQUE(`media_id`,`kind`) |

## 3. 日常生活域

| 表 | 核心字段与约束 | 用途 |
| --- | --- | --- |
| `life_chapters` | `name`、`normalized_name`、`slug` UNIQUE、`type`、`parent_id` 自关联、国家/省/市、`description`、`cover_media_id`、`creator_id`、`review_status`、`merged_into_id` | 城市、景点、旅行、校园、活动、自定义主题；UNIQUE(`parent_id`,`normalized_name`) 防同层重复 |
| `life_chapter_aliases` | `chapter_id` FK、`alias`、`normalized_alias` UNIQUE | 章节别名及重复检查 |
| `life_posts` | `author_id` FK、`chapter_id` FK、`title`、`body`、`location`、`mood`、`shot_at`、`visibility`、`status`、`cover_media_id`、`published_at`、`deleted_at` | 日常内容；`visibility`: public/login_only/private；`status`: draft/pending/published/hidden |
| `life_post_media` | `post_id` FK、`media_id` FK、`position` | 多图及排序；UNIQUE(`post_id`,`media_id`)、UNIQUE(`post_id`,`position`) |
| `tags` | `name`、`normalized_name` UNIQUE | 日常/教材复用标签字典 |
| `life_post_tags` | `post_id` FK、`tag_id` FK | UNIQUE(`post_id`,`tag_id`) |

章节合并不删除源章节：在事务内迁移 `life_posts.chapter_id`、保留别名、写入 `merged_into_id` 和管理员日志；读取旧 slug 返回目标章节信息或由应用层 301/业务重定向。

## 4. 游戏与教材域

| 表 | 核心字段与约束 | 用途 |
| --- | --- | --- |
| `games` | `name_zh`、`name_en`、`normalized_name` UNIQUE、`slug` UNIQUE、`aliases_json`、`icon_media_id`、`cover_media_id`、`current_version`、`status` | 管理员维护的游戏目录 |
| `heroes` | `game_id` FK、中文/英文名、`normalized_name`、`slug`、`aliases_json`、`avatar_media_id`、`role`、`review_status`、`merged_into_id` | UNIQUE(`game_id`,`normalized_name`)；slug 建议 UNIQUE(`game_id`,`slug`) |
| `game_maps` | `game_id` FK、中文/英文名、`normalized_name`、`slug`、`aliases_json`、`map_type`、`cover_media_id`、`status`、`review_status`、`merged_into_id` | UNIQUE(`game_id`,`normalized_name`) |
| `guide_categories` | `code` UNIQUE、`name`、`sort_order`、`active` | 受控教材分类；不让用户自由创建 |
| `game_guides` | `author_id`、`game_id`、可空 `hero_id`/`map_id`、`category_id`、`title`、`body`、`side`、`map_area`、`skill_name`、`aim_reference`、`timing`、`difficulty`、`game_version`、`validity_status`、`last_confirmed_at`、`video_url`、`status`、`cover_media_id`、`published_at`、`deleted_at` | 教材；英雄专属/地图相关约束由服务层校验关联游戏一致性 |
| `guide_steps` | `guide_id` FK、`position`、`title`、`instruction`、`media_id` FK | 多步骤图文；UNIQUE(`guide_id`,`position`) |
| `guide_tags` | `guide_id` FK、`tag_id` FK | UNIQUE(`guide_id`,`tag_id`) |
| `guide_validity_feedback` | `guide_id`、`user_id`、`status`、`game_version`、`note` | UNIQUE(`guide_id`,`user_id`,`status`,`game_version`) 防同版本重复同类反馈 |

## 5. 互动、通知与治理

| 表 | 核心字段与约束 | 用途 |
| --- | --- | --- |
| `likes` | `user_id` FK、`target_type`、`target_id` | UNIQUE(`user_id`,`target_type`,`target_id`)；目标仅 `life_post` / `game_guide` |
| `favorites` | `user_id` FK、`target_type`、`target_id` | UNIQUE(`user_id`,`target_type`,`target_id`)；目标仅 `life_post` / `game_guide` |
| `comments` | `author_id`、`target_type`、`target_id`、可空 `parent_id` 自关联、`body`、`status`、`deleted_at` | 目标仅日常/教材；`parent_id` 只允许指向一级评论，服务层阻止三级回复 |
| `notifications` | `recipient_id`、可空 `actor_id`、`type`、`target_type`、`target_id`、`payload_json`、`read_at` | 点赞、评论、回复、审核、下架、举报和系统通知 |
| `reports` | `reporter_id`、`target_type`、`target_id`、`reason`、`description`、`status`、`handler_id`、`resolution`、`resolved_at` | UNIQUE(`reporter_id`,`target_type`,`target_id`,`reason`) 防重复举报 |
| `admin_logs` | `admin_id`、`action`、`target_type`、`target_id`、`before_json`、`after_json`、`request_id` | 所有管理员可变更操作的审计记录 |

## 6. 关键关系与索引

```text
users ──< media / life_posts / game_guides / comments / interactions
life_chapters ──< life_chapters (parent) / life_posts ──< life_post_media >── media
games ──< heroes, game_maps, game_guides ──< guide_steps >── media
game_guides ──< guide_validity_feedback
life_posts + game_guides ──< likes, favorites, comments, reports
users ──< notifications, reports, admin_logs
```

除外键索引外，必须建立：`life_posts(chapter_id, status, published_at)`、`life_posts(author_id, status, published_at)`、`game_guides(game_id, hero_id, map_id, category_id, status, published_at)`、`comments(target_type, target_id, parent_id, created_at)`、`notifications(recipient_id, read_at, created_at)`、`reports(status, created_at)`。全文检索在阶段 8 以 MySQL FULLTEXT 或专用搜索方案作为独立决策实施，不能在 M0 预设为已完成。

## 7. 必须由迁移/测试保证的约束

1. 用户名、邮箱、游戏标准名全局唯一；同一游戏内英雄和地图标准名唯一；同层章节标准名唯一。
2. 同一用户对同一日常/教材只能有一个点赞和收藏。
3. 日常至少关联一张媒体、最多九张，且排序无重复；教材至少一张步骤图由 service/API 校验。
4. 日常、教材、步骤的媒体必须归属作者且状态可绑定；跨用户媒体和跨游戏英雄/地图组合拒绝。
5. 私有内容、草稿、隐藏/已删内容不得被未授权列表、详情、搜索、互动或媒体访问泄露。
6. 合并和治理操作必须事务化并产生 `admin_logs`。
