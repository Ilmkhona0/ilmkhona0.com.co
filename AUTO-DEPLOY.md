# Auto-deploy from GitHub (making Lightsail behave like Vercel)

Vercel watches your repo and redeploys on every push. A Lightsail instance is a
plain Linux box — nothing watches GitHub, so a push changes nothing until
someone pulls and rebuilds. These two files add the missing piece:

| File | Runs where | Does what |
|------|-----------|-----------|
| `deploy.sh` | on the server | pull, `npm ci`, `npm run build`, `pm2 restart` |
| `.github/workflows/deploy.yml` | on GitHub | on push to `main`, SSH in and run `deploy.sh` |

Result: `git push` → about two minutes later the live site is updated.

**Why rebuild and not just pull:** Next.js compiles CSS and pages into `.next`
at *build* time. Pulling new source without rebuilding leaves the old compiled
stylesheet in place, and the site looks unchanged.

## The actual server

| | |
|---|---|
| Instance | `ilmkhona-web` (Lightsail, Frankfurt `eu-central-1a`) |
| Static IP | `18.197.206.85` |
| SSH user | `ubuntu` |
| Repo path | `/home/ubuntu/ilmkhona0` |
| Stack | nginx `:80/:443` → next-server `:3000` → pm2 |
| RAM | 911 MB — **swap required, see step 1** |

Note: `DEPLOY-HETZNER.md`, `Dockerfile`, `docker-compose.yml` and `Caddyfile`
describe a Docker/Caddy setup that was never used on this box. Ignore them, or
delete them to avoid confusion.

---

## Step 1 — Add swap (do this first, one time)

With 911 MB RAM and ~400 MB free, `next build` gets killed by the kernel
part-way through. 2 GB of swap fixes it permanently:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h                      # should now show a Swap row of 2.0Gi
```

The `/etc/fstab` line makes it survive reboots. Verify a build works before
going further:

```bash
cd ~/ilmkhona0 && bash deploy.sh
```

## Step 2 — Create a deploy key (one time)

On the **server**, a keypair used only by GitHub:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy      # copy ALL of this — it's the private key
```

## Step 3 — Add the GitHub secrets (one time)

Repo → **Settings** → **Secrets and variables** → **Actions** → *New repository secret*:

| Name | Value |
|------|-------|
| `DEPLOY_HOST` | `18.197.206.85` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | the whole private key from step 2, including `BEGIN`/`END` lines |

Defaults cover the rest. Only set `DEPLOY_APP_DIR` if you move the repo.

## Step 4 — Check the firewall

Lightsail console → `ilmkhona-web` → **Networking** → IPv4 firewall must allow
**SSH (TCP 22)**. GitHub's runners are IPv4-only, which is fine — the instance
has static IPv4 `18.197.206.85`.

## Step 5 — Test

Push to `main`, then watch repo → **Actions** → *Deploy*. You can also trigger
it by hand from that tab with **Run workflow**, no commit needed.

---

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| Build killed / `SIGKILL` / job dies at "Building" | swap not set up — step 1 |
| `Permission denied (publickey)` | key secret incomplete, or public key missing from `~/.ssh/authorized_keys` |
| Job hangs then times out | port 22 blocked in the Lightsail firewall |
| Deploy succeeds, site looks unchanged | Cloudflare is caching. Purge the cache, or test with `Ctrl+Shift+R` |
| 502 from nginx after deploy | app didn't come back up — `pm2 logs` |

Useful on the server:

```bash
pm2 ls                  # is the app running
pm2 logs --lines 50     # app errors
sudo nginx -t           # nginx config valid
free -h                 # is swap active
curl -sI localhost:3000 # is Next actually answering
```
