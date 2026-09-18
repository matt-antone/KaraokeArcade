---
title: KaraokeArcade Server with NGINX (reverse proxy + custom path)
category: Networking
weight: 4
---

If you want to host the app at `/karaoke` for example, run KaraokeArcade Server with `--urlPath /karaoke --port <your_server_port>` (the port is random by default), then use an NGINX config similar to the following, replacing `<your_server_ip>` and `<your_server_port>`:

```
  location /karaoke {
    proxy_pass http://<your_server_ip>:<your_server_port>/karaoke;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
}
```

Also set `--serverUrl https://your.host/karaoke` so join QR codes point through the proxy instead of the server's own LAN address.
