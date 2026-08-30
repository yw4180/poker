# 部署（云服务器 + Cloudflare）

服务器采用"一个共享反代 + 多个独立项目"的结构，方便以后再放别的项目：

```
/srv/proxy            共享 Caddy（80/443），自动 HTTPS；sites/ 下每个项目一份站点配置
/srv/apps/poker       本项目（docker compose：postgres + server + web）
/srv/apps/<其他项目>   以后的项目，同样加入 docker 网络 web 即可被反代
```

## 一、Cloudflare

1. 域名托管到 Cloudflare（或直接在 Cloudflare 注册）。
2. DNS 添加 A 记录：`poker`（或你想要的子域）→ 服务器公网 IP，**开启橙色云代理**。
3. SSL/TLS 模式设为 **Full (strict)**（Caddy 会在源站签发真实证书）。
4. 以后每加一个项目，就再加一条 A 记录指向同一台服务器。

## 二、服务器初始化（只做一次）

以 root 登录新装的 Ubuntu 22.04/24.04：

```bash
curl -fsSL https://raw.githubusercontent.com/<你的GitHub>/poker/main/deploy/server-init.sh -o init.sh
bash init.sh deploy          # 创建 deploy 用户、装 Docker、开防火墙、建 /srv 目录与 web 网络
```

然后以 `deploy` 用户登录，启动共享反代：

```bash
git clone https://github.com/<你的GitHub>/poker.git /srv/apps/poker
cp -r /srv/apps/poker/deploy/proxy/* /srv/proxy/   # 需要证书到期提醒的话，在 Caddyfile 里填你的邮箱
cd /srv/proxy && docker compose up -d
```

## 三、部署本项目

```bash
cd /srv/apps/poker/deploy
cp .env.example .env && nano .env      # 填 DOMAIN / POSTGRES_PASSWORD / BETTER_AUTH_SECRET / Google
bash deploy.sh                          # 拉取 GHCR 镜像、启动、注册站点到反代、自检
```

以后更新：`cd /srv/apps/poker/deploy && bash deploy.sh`（GitHub Actions `deploy.yml` 在 push main 时会自动执行同样的命令）。

## 四、Google 登录

Google Cloud Console → APIs & Services → Credentials → OAuth client (Web)：

- 授权来源：`https://<DOMAIN>`
- 回调：`https://<DOMAIN>/api/auth/callback/google`
  把 client id/secret 填进 `.env`，重新 `bash deploy.sh`。

镜像由 `.github/workflows/images.yml` 在每次 push main 时构建并推到 `ghcr.io/yw4180/poker/{server,web}`；服务器不做构建，1 GB 内存也够用。

## 五、以后新增项目

1. Cloudflare 加 A 记录 `xxx.你的域名` → 同一 IP。
2. 项目的 compose 里：容器设置 `container_name`，加入外部网络 `web`（`networks: web: external: true`）。
3. 写 `/srv/proxy/sites/xxx.caddy`：`xxx.你的域名 { reverse_proxy <容器名>:<端口> }`，然后
   `cd /srv/proxy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`。

## 排查

- `docker compose -f /srv/proxy/docker-compose.yml logs -f caddy` 看证书签发。
- `docker compose logs -f server` 看后端；`curl https://<DOMAIN>/api/health` 应返回 `{"ok":true}`。
- 数据库备份：`docker exec poker-postgres pg_dump -U poker poker > backup.sql`。
