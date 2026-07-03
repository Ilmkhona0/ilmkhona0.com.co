# Deploy ilmkhona0 to Hetzner Cloud

Total cost: ~€4–5/month (CX22 server). No surprise bills — Hetzner charges a fixed price.

## 1. Create the server

1. Log in at https://console.hetzner.com
2. New Project → Add Server
3. Choose:
   - **Location:** Nuremberg or Falkenstein (closest to you is fine)
   - **Image:** Ubuntu 24.04
   - **Type:** Shared vCPU → **CX22** (2 vCPU, 4 GB RAM) — enough for this app
   - **SSH key:** add your public key (on Windows: run `ssh-keygen` in PowerShell, then paste the contents of `C:\Users\ENVY\.ssh\id_ed25519.pub`)
4. Create & note the server's **IP address**.

## 2. Point your domain at the server

In your domain registrar's DNS settings, add:

| Type | Name | Value        |
|------|------|--------------|
| A    | @    | your-server-IP |
| A    | www  | your-server-IP |

Wait 5–30 minutes for DNS to propagate (check with `nslookup yourdomain.com`).

## 3. Prepare the server (one time)

SSH in from PowerShell:

```
ssh root@YOUR_SERVER_IP
```

Install Docker:

```
curl -fsSL https://get.docker.com | sh
```

Basic firewall:

```
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 4. Get the code onto the server

Easiest: push this project to GitHub (private repo is fine), then on the server:

```
apt install -y git
git clone https://github.com/YOURUSER/ilmkhona0.git /opt/ilmkhona0
cd /opt/ilmkhona0
```

(Alternative without GitHub: from PowerShell on your PC run
`scp -r "D:\Next.js Frameworks\ilmkhona0" root@YOUR_SERVER_IP:/opt/ilmkhona0`
— but delete `node_modules`, `.next` and `desktop` first or it will take forever.)

## 5. Configure

```
cd /opt/ilmkhona0
cp .env.production.example .env.production
nano .env.production        # fill in real values (copy from Vercel dashboard / .env.local)
nano Caddyfile              # replace example.com with your real domain
```

Important env notes:
- `AUTH_TRUST_HOST=true` is **required** off Vercel, or login will fail.
- `AUTH_URL=https://yourdomain.com` — must match your domain exactly.
- MongoDB Atlas: in Atlas → Network Access, **add your server's IP** (or 0.0.0.0/0) or the DB connection will be refused.
- Google/GitHub OAuth: in each provider's console, add the new callback URLs:
  - `https://yourdomain.com/api/auth/callback/google`
  - `https://yourdomain.com/api/auth/callback/github`

## 6. Launch

```
docker compose up -d --build
```

First build takes a few minutes. Then open https://yourdomain.com — Caddy issues the HTTPS certificate automatically on first request.

## 7. Updating later

```
cd /opt/ilmkhona0
git pull
docker compose up -d --build
```

## Troubleshooting

- Logs: `docker compose logs -f web` (app) or `docker compose logs -f caddy` (HTTPS/proxy)
- "Certificate error": DNS not propagated yet, or Caddyfile domain doesn't match.
- Login redirect loops / "UntrustedHost": check `AUTH_TRUST_HOST=true` and `AUTH_URL`.
- DB timeouts: server IP not whitelisted in MongoDB Atlas.

## 8. Turn off AWS

Once the site works on Hetzner, delete/stop everything in the AWS console so you don't get billed after the free credits run out. Also cancel any AWS budgets/alarms you no longer need.
