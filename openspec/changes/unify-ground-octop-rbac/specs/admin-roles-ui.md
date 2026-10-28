# admin-roles-ui

## Requirement: 真角色页

`/admin/roles` SHALL 从中台 API 加载角色列表，SHALL NOT 再使用写死的「平台管理员 / 普通用户」两行静态数据作为唯一数据源。

页面 SHALL 展示至少内置平台角色 `super_admin`、`platform_admin`（可用中文名「超级管理员」「平台管理员」）。

## Requirement: permChip 交互

角色编辑/详情 SHALL 使用 permission chip 多选交互，信息架构对齐 Octop `/agent/admin/users?tab=roles` 的 PermissionCheckboxPicker（按 category/page 分组的 chip，选中/未选中态清晰）。

SHALL NOT 引入 PeecAI 细粒度权限树（按资源实例、深层级勾选）。

Chip 标签优先中文 `labelZh`；保存时只提交 Catalog 内 key。

## Requirement: 权限门禁

| 能力 | 所需 key |
|---|---|
| 进入 `/admin/roles` 查看 | `portal.admin.roles.read`（或超管全量） |
| 修改角色权限包/名称 | `portal.admin.roles.write` |
| 进入总后台 | `portal.admin.access` |

无 `roles.write` 时 UI SHALL 只读：隐藏或禁用保存；直接调 PATCH SHALL 返回 403。

`super_admin` 角色的权限包 UI SHALL 展示为「全部权限」且一期不可改窄（防把自己锁死）；`platform_admin` SHALL 可编辑（仅持有 write 者）。

## Requirement: 用户绑定平台角色

`/admin/users` 创建/编辑用户时 SHALL 能选择平台角色：

- 无平台角色（普通用户）
- `platform_admin`
- `super_admin`（仅已有 `roles.write` 或已是超管的操作者可授予，推荐）

兼容：旧字段 `isPlatformAdmin=true` 的写入 SHALL 映射为赋予某一平台角色（新建默认 `platform_admin`；迁移存量见 design）。

列表 SHALL 展示平台角色中文名，而不只是「平台管理员」布尔。

## Requirement: 交互状态

| 状态 | SHALL |
|---|---|
| 加载中 | 表格/卡片可感知 loading |
| 空列表 | 空态文案「暂无角色」 |
| 加载失败 | 错误提示 + 可重试 |
| 保存中 | 提交按钮 loading，防重复点击 |
| 校验失败 | 展示服务端/前端错误，不静默成功 |
| 搜索 | 支持角色名 keyword；debounce 或显式搜索与现网 admin 一致 |

## Scenario: 静态页被替换

- Given 平台超管已登录
- When 打开 `/admin/roles`
- Then 列表来自 API 且可见 `super_admin` / `platform_admin`
- And 不再仅渲染写死的 `isPlatformAdmin = true/false` 说明两行作为唯一内容

## Scenario: 只读平台管理员

- Given 用户为 `platform_admin` 且无 `portal.admin.roles.write`
- When 打开 `/admin/roles`
- Then 可查看角色与 chip
- And 不能成功保存权限变更

## Scenario: 超管改平台管理员权限包

- Given 超管编辑 `platform_admin`
- When 取消某业务 chip 并保存成功
- And 重新进入编辑
- Then 该 chip 仍为未选中
