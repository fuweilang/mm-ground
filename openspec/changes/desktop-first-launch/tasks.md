# 任务

听用户指令再做下一项。不要并行开 2。

## 1. 规格

- [x] 写本目录。不另写产品文档。不叫林杰。
- [x] 按当天决策更新：客户端在本机可登录也可注册，账号只在中台；两端用户管理都能看到。规格不再写「客户端只有登录」。

## 2. 官网包

- [x] 核对官网安装包是否含 `60859f3`、`499b428`。Mac arm64 已含：壳里有 `.bundle-sha256` 和 `OCTOP_MAMMOTH_OIDC_ISSUER`，运行时里有 `/mammoth/console-link`。包时间 2026-10-25 21:09，晚于两笔提交。不重打，不换宝塔。
- [x] 不含则重打。本次跳过。
- [x] 浪哥不审。没有新 diff。

## 3. 本机登录与注册

- [x] 客户端薄表单，停在本机，两个页签：密码登录 / 注册，选中蓝底 `#2563eb`，对齐中台 `/login`。本机 Octop 代调中台，再在服务端走完现有 OIDC。未改 Nest。
- [x] 登录代调 `POST /console/api/auth/login`；注册代调现有 `POST /console/api/auth/register`，字段 `name` / `phone` / `password` / `enterpriseName`。未新增接口或字段。
- [x] 禁止 WebView 跳到官网 `/login` 或 OIDC 授权页。AuthGuard 首屏在本机时进 `/login`，不进 `/setup`，也不跳授权页。
- [x] 现有接口可以换成 Octop 会话，没有停手。
- [x] 注册后中台和 Octop 两侧用户管理都能看到；密码只在中台，Octop `users` 只是影子用户。

## 4. 企业控制台

- [x] 不新做。登录成功仍写入 `console_handoff` token，沿用一次性票。单测覆盖了写入。没有在 Chrome 里实点。

## 5. 旧运行时

- [x] 现官网 Mac 包已有 `.bundle-sha256`。本次没有新打包，没有改 `~/.octop` 目录名。新登录代码还不在官网包里。

## 6. 验收

- [x] 秋池这次不叫。没有新官网包，也没有客户那台干净电脑。
- [x] 本地已跑：`test_sso_service` 两条桌面登录、`test_exempt_paths`、`mammothSso.test.ts`、dashboard `tsc -b`。
- [ ] 注册链路补专测：`desktop-register` 目前只有 exempt-path 断言和前端 `mammothSso.test.ts`，后端 `register_with_platform` 没有专属单测。

## 7. 发包前

- [x] 浪哥审过。P0 已补：AuthGuard 不再把干净客户端送进本地向导。公网经 nginx 调 desktop-login 会 403。没有再审第二轮。不换宝塔包。

## 明确不做

- [ ] 分仓
- [ ] 拆 Octop 大文件
- [ ] 藏 Octop 用户页、模型配置归中台
- [ ] `pnpm dev` 收成两条
- [ ] PeecAI 接入
- [ ] 改产品数据目录
