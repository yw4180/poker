把每个项目的站点配置放这里，例如 `poker.caddy`：

```
poker.example.com {
    encode zstd gzip
    handle /api/* { reverse_proxy poker-server:4000 }
    handle /socket.io/* { reverse_proxy poker-server:4000 }
    handle { reverse_proxy poker-web:3000 }
}
```
要求：项目容器加入外部网络 `web`，并设置固定 `container_name`。
修改后：`docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`
