#!/usr/bin/env bash
# 一次性初始化一台全新的 Ubuntu 22.04/24.04 服务器，用于承载多个 Docker 项目。
# 用法（root 或 sudo）：bash server-init.sh <你的用户名>
set -euo pipefail
USER_NAME="${1:-deploy}"

echo "==> 基础软件与安全更新"
apt-get update -y
apt-get install -y ca-certificates curl git ufw unattended-upgrades fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> 创建部署用户 $USER_NAME（免密 sudo）"
if ! id "$USER_NAME" &>/dev/null; then
  adduser --disabled-password --gecos "" "$USER_NAME"
  echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/"$USER_NAME"
  mkdir -p /home/"$USER_NAME"/.ssh
  [ -f /root/.ssh/authorized_keys ] && cp /root/.ssh/authorized_keys /home/"$USER_NAME"/.ssh/
  chown -R "$USER_NAME:$USER_NAME" /home/"$USER_NAME"/.ssh
  chmod 700 /home/"$USER_NAME"/.ssh
fi

echo "==> 安装 Docker（官方源）"
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # Docker 官方源可能还没有最新 Ubuntu 版本的目录，此时回退到上一个 LTS（noble）
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  if ! curl -fsI "https://download.docker.com/linux/ubuntu/dists/${CODENAME}/Release" >/dev/null; then
    echo "Docker 源暂无 ${CODENAME}，使用 noble"
    CODENAME=noble
  fi
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker "$USER_NAME"

echo "==> 防火墙：只开 22/80/443"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 2G swap（小内存机器构建前端时需要）"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 目录结构：/srv/proxy（共享反代） /srv/apps/<项目>"
mkdir -p /srv/proxy/sites /srv/apps
chown -R "$USER_NAME:$USER_NAME" /srv

echo "==> 共享 docker 网络 web（所有项目加入它，让 Caddy 能按容器名转发）"
docker network inspect web &>/dev/null || docker network create web

echo
echo "完成。接下来："
echo "  1) 以 $USER_NAME 登录，把本仓库 deploy/proxy 下的文件放到 /srv/proxy，执行 docker compose up -d"
echo "  2) 每个项目 clone 到 /srv/apps/<名字>，按各自 deploy 说明启动，并把站点文件放进 /srv/proxy/sites/"
