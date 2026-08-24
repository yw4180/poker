# 部署到云服务器

1. 服务器装好 Docker（含 compose 插件），域名 A 记录指向服务器 IP，开放 80/443。
2. `git clone` 本仓库到服务器，`cp deploy/.env.example deploy/.env` 并填写：
   - `DOMAIN`、`POSTGRES_PASSWORD`、`BETTER_AUTH_SECRET`（`openssl rand -base64 32`）
   - Google 登录：在 Google Cloud Console 创建 OAuth 客户端，回调地址填 `https://<DOMAIN>/api/auth/callback/google`
3. `cd deploy && docker compose --env-file .env up -d --build`
4. Caddy 会自动申请 HTTPS 证书。访问 `https://<DOMAIN>`。

GitHub Actions `deploy.yml` 会在 push 到 main 时通过 SSH 执行上述步骤（需在仓库 Secrets 配置 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_KEY`、`DEPLOY_PATH`）。
