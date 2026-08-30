#!/usr/bin/env bash
# 在服务器上部署/更新本项目：cd /srv/apps/poker/deploy && bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "缺少 deploy/.env，请先 cp .env.example .env 并填写"; exit 1; }
set -a; source .env; set +a
: "${DOMAIN:?请在 .env 里设置 DOMAIN}"

PROXY_DIR="${PROXY_DIR:-/srv/proxy}"

echo "==> 拉取最新代码"
git -C .. pull --ff-only

echo "==> 拉取镜像并启动容器"
docker compose --env-file .env pull
docker compose --env-file .env up -d --remove-orphans

echo "==> 更新共享反代的站点配置：$PROXY_DIR/sites/poker.caddy"
sed "s/\${DOMAIN}/${DOMAIN}/g" sites/poker.caddy.template > "$PROXY_DIR/sites/poker.caddy"
docker compose -f "$PROXY_DIR/docker-compose.yml" exec -T caddy caddy reload --config /etc/caddy/Caddyfile

echo "==> 清理旧镜像"
docker image prune -f >/dev/null

echo "==> 自检"
sleep 3
curl -fsS "https://${DOMAIN}/api/health" && echo "  API OK" || echo "  API 未就绪（首次证书签发可能需要一分钟）"
