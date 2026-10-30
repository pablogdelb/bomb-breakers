# Publicar BOMB BREAKERS

Es **un único servicio Node.js** (HTTP + WebSocket, ver `Dockerfile`). Requisitos de la plataforma: soportar WebSockets, HTTPS y **una sola instancia siempre encendida** (las salas están en memoria).

## Opción A — Render (la más sencilla, plan gratuito)
1. Sube el repositorio a GitHub.
2. En https://render.com → **New + → Blueprint** → elige el repositorio (usa `render.yaml`). O **New Web Service → Docker**.
3. Cuando termine, tu enlace es `https://bomb-breakers-xxxx.onrender.com`. Compártelo con tus amigos.
> En el plan gratuito el servicio se duerme tras ~15 min sin tráfico (el primer acceso tarda ~30 s). Abre el enlace unos minutos antes de jugar. Para que no se duerma, usa un plan de pago.

## Opción B — Fly.io
```bash
fly auth login
fly launch --no-deploy --copy-config   # cambia "app" en fly.toml por un nombre único
fly deploy
fly status && fly open
```
Enlace: `https://<app>.fly.dev`.

## Opción C — Railway / cualquier VPS con Docker
```bash
docker build -t bomb-breakers .
docker run -d --restart=always -p 80:8080 bomb-breakers
```
Detrás de HTTPS (Caddy, Cloudflare Tunnel…) reenvía también `/ws` (WebSocket).

## Comprobación tras publicar
- `https://<tu-enlace>/health` debe responder `{"ok":true,...}`.
- Abre el enlace en dos móviles, crea una sala y únete con el código.
- Si los jugadores se quedan en «reconectando», la plataforma no está pasando WebSockets.

## Obtener el enlace para tus amigos
Crea una sala: en la sala de espera, **COPIAR ENLACE** / **COMPARTIR** genera `https://<tu-enlace>/ABC123`; al abrirlo el código viene rellenado.

## Probar en local desde móviles (sin publicar)
`npm start` y abre `http://<IP-de-tu-PC>:3000` desde móviles en la misma wifi. (El micrófono/cámara no se usan, así que no hace falta HTTPS.)
