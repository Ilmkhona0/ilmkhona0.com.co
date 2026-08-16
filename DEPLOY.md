# Deploying ilmkhona0 to AWS Lightsail (beginner guide)

This takes your Next.js site from `localhost` to a live, secure `https://ilmkhona0.com.co`.

There are **three places** you work. Don't mix them up:

| Where | What you do there |
|---|---|
| **Lightsail console** (browser) | Create the server, static IP, open ports, DNS |
| **The server** (SSH terminal) | Install Node, get code, set secrets, build, run, nginx, HTTPS |
| **GitHub / OAuth settings** | Store code, set Google/GitHub login callback URLs |

---

## Phase 1 — Lightsail console (in your browser)

1. Go to https://lightsail.aws.amazon.com → **Create instance**.
2. Platform: **Linux/Unix** → Blueprint: **OS Only → Ubuntu 22.04 LTS**.
3. Choose the **$5/month** plan → name it `ilmkhona0` → **Create**.
4. Open the instance → **Networking** tab:
   - **Create static IP** and attach it (so the address never changes). Note this IP.
   - Under **IPv4 Firewall**, add rules: **HTTP (80)** and **HTTPS (443)**. (SSH 22 is already there.)

## Phase 2 — Point your domain at the server

In your DNS (Lightsail DNS zone, or wherever `ilmkhona0.com.co` is managed):

- **A record**: `@` → your static IP
- **A record**: `www` → your static IP

DNS can take a few minutes to a few hours to update.

## Phase 3 — Connect to the server (SSH)

In the Lightsail console, click the **orange terminal icon** on your instance for a browser SSH window (easiest). You are now "on the server."

Install what's needed:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
node -v      # should show v20.x
```

## Phase 4 — Get your code onto the server

```bash
cd ~
git clone https://github.com/<your-username>/<your-repo>.git ilmkhona0
cd ilmkhona0
```

(If your GitHub repo is private, GitHub will ask you to log in / use a token.)

## Phase 5 — Set your secrets (the secure part)

Create a `.env` file **on the server only** — never commit this to GitHub:

```bash
nano .env
```

Paste and fill in your real values:

```
# Database
MONGODB_URI=your_mongodb_atlas_connection_string

# Auth.js core — REQUIRED
AUTH_SECRET=run: openssl rand -base64 33  and paste the output here
AUTH_URL=https://ilmkhona0.com.co
AUTH_TRUST_HOST=true

# Admin (seeds once into the DB, then lives only in the database)
ADMIN_LOGIN=your_admin_username_or_email
ADMIN_PASSWORD=a_strong_password

# Email (for signup codes + admin 2FA)
RESEND_API_KEY=your_resend_key
EMAIL_FROM=ilmkhona0 <onboarding@resend.dev>
ADMIN_2FA_EMAIL=ilmkhona@gmail.com

# Social login (optional — only if you use them)
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...

# File storage (Vercel Blob works from any server)
BLOB_READ_WRITE_TOKEN=your_blob_token

# AdSense (once approved)
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
```

Save in nano: `Ctrl+O`, `Enter`, then `Ctrl+X`.

To generate the AUTH_SECRET value, run `openssl rand -base64 33` and copy the result.

## Phase 6 — Build and run

```bash
npm install
npm run build
pm2 start npm --name ilmkhona0 -- start
pm2 save
pm2 startup        # run the command it prints, so the app restarts on reboot
```

Your app is now running on the server at port 3000 (but not yet reachable by domain).

## Phase 7 — nginx (send your domain to the app)

```bash
sudo nano /etc/nginx/sites-available/ilmkhona0
```

Paste:

```nginx
server {
    listen 80;
    server_name ilmkhona0.com.co www.ilmkhona0.com.co;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/ilmkhona0 /etc/nginx/sites-enabled/
sudo nginx -t          # should say "syntax is ok"
sudo systemctl reload nginx
```

Now http://ilmkhona0.com.co should show your site.

## Phase 8 — Free HTTPS (the padlock)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ilmkhona0.com.co -d www.ilmkhona0.com.co
```

Follow the prompts (enter your email, agree, choose redirect to HTTPS). Certbot auto-renews.

Now **https://ilmkhona0.com.co** is live and secure.

## Phase 9 — Update OAuth callback URLs

For login to work on the live domain, add these to your provider settings:

- **Google** (console.cloud.google.com → Credentials → your OAuth client → Authorized redirect URIs):
  `https://ilmkhona0.com.co/api/auth/callback/google`
- **GitHub** (Settings → Developer settings → OAuth Apps → Authorization callback URL):
  `https://ilmkhona0.com.co/api/auth/callback/github`

---

## Updating the site later (after you change code)

```bash
cd ~/ilmkhona0
git pull
npm install
npm run build
pm2 restart ilmkhona0
```

## Handy checks

```bash
pm2 logs ilmkhona0        # see app logs / errors
pm2 status                # is it running?
sudo systemctl status nginx
```
