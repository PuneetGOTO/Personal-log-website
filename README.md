# My Diary

My Diary is a warm-white personal journal with hand-drawn black lines, handwritten headings, irregular corners, and small yellow accents. Public pages, settings, forms, and the administrator workspace use the same visual language.

## Production features

- Server-side accounts, sessions, entries, reports, and administrator actions.
- HttpOnly SameSite session cookie; Secure is enabled automatically when NODE_ENV=production.
- Passwords are salted with Node scrypt; the browser never receives password hashes or salts.
- New registration always creates a normal user. An email containing admin never grants administrator access.
- Administrators can create accounts, grant or revoke roles, ban or unban users, change passwords, delete accounts, view entries, hide or restore entries, delete entries, and resolve reports.
- Login attempts are rate limited in memory (10 attempts per IP per 15 minutes).

The production server is server/index.mjs. It serves the built Vite files and the /api routes from one process. Runtime data is written to data/app.json with restrictive file permissions; .env and data/ are ignored by Git.

This storage layer is intended for one production instance. It is not a horizontally scalable database. For multiple app instances, move users, entries, reports, and sessions to PostgreSQL (or another managed database) and Redis before scaling out.

## First administrator account

There is no fixed public administrator password. On the first start, the server creates admin@example.com and a random password. The Ubuntu deployment script writes that password to the private .env file and prints it once. Log in immediately and change it from the administrator user panel. If ADMIN_INITIAL_PASSWORD is supplied before the first start, that value is used instead.

Old browser localStorage demo data is not imported into the server database. This is intentional: client storage must never become an authority for accounts or roles.

## Local development

Requirements: Node.js 20 or newer, Git, and pnpm 9 or newer.

~~~
git clone https://github.com/PuneetGOTO/Personal-log-website.git
cd Personal-log-website
corepack enable
corepack prepare pnpm@9 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm start
~~~

Run pnpm start in one terminal, then run pnpm dev in a second terminal. Open http://127.0.0.1:5173/. Vite proxies /api to the local Node server.

To exercise the production server directly:

~~~
pnpm build
NODE_ENV=production PORT=4173 ADMIN_INITIAL_PASSWORD='replace-with-a-long-password' pnpm start
~~~

The API health endpoint is http://127.0.0.1:4173/api/health.

## Windows deployment

1. Install Git for Windows and Node.js 20 LTS. In PowerShell:

~~~
corepack enable
corepack prepare pnpm@9 --activate
git clone https://github.com/PuneetGOTO/Personal-log-website.git C:\Apps\my-diary
Set-Location C:\Apps\my-diary
pnpm install --frozen-lockfile
pnpm build
~~~

2. Create a private environment file. Use a long random password and do not commit this file:

~~~
@"
PORT=4173
ADMIN_INITIAL_PASSWORD=replace-with-a-long-random-password
DEMO_INITIAL_PASSWORD=replace-with-a-long-random-password
"@ | Set-Content -Encoding ascii .env
~~~

3. Start the service. For a real server, install it with NSSM or run it under a Windows service account:

~~~
$env:NODE_ENV = 'production'
$env:PORT = '4173'
pnpm start
~~~

Keep Node bound to 127.0.0.1. Put IIS or Caddy in front of it on ports 80/443. Example Caddyfile:

~~~
diary.example.com {
    reverse_proxy 127.0.0.1:4173
}
~~~

Open only the reverse-proxy ports in Windows Firewall (PowerShell as Administrator):

~~~
New-NetFirewallRule -DisplayName "My Diary HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "My Diary HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
~~~

Never expose port 4173 directly to the Internet.

## Linux and Ubuntu manual deployment

~~~
sudo apt update
sudo apt install -y ca-certificates curl git nginx ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install --global pnpm@9
sudo git clone https://github.com/PuneetGOTO/Personal-log-website.git /var/www/my-diary
sudo chown -R "$USER:$USER" /var/www/my-diary
cd /var/www/my-diary
pnpm install --frozen-lockfile
pnpm build
~~~

Create /var/www/my-diary/.env with mode 600:

~~~
umask 077
cat > .env <<'EOF'
PORT=4173
ADMIN_INITIAL_PASSWORD=replace-with-a-long-random-password
DEMO_INITIAL_PASSWORD=replace-with-a-long-random-password
EOF
~~~

Run pnpm start through systemd as the application user, then reverse proxy 127.0.0.1:4173 from Nginx. Do not bind the Node service to 0.0.0.0.

## Ubuntu automated deployment

deploy/ubuntu-deploy.sh installs Node.js, pnpm, Git, Nginx, and UFW; clones or fast-forwards the repository; creates first-boot secrets; builds the app; creates a systemd unit; configures Nginx; and optionally obtains a Let's Encrypt certificate.

### 1. DNS and public IP

Create an A record before requesting HTTPS:

~~~
Type: A
Name: diary
Value: YOUR_PUBLIC_IPV4
TTL: 300
~~~

Check that DNS and the server agree:

~~~
dig +short diary.example.com
curl -4 https://ifconfig.me
~~~

For a home server, forward TCP 80 and 443 from the router to Ubuntu. For a VPS, allow 80/443 in the provider security group as well as UFW. Addresses in 192.168.0.0/16, 10.0.0.0/8, and 172.16.0.0/12 are private and cannot be public DNS targets. CGNAT prevents inbound connections unless the ISP provides a public address or you use a tunnel/VPS.

### 2. Run the script

~~~
sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com --email admin@example.com --https
~~~

Include --www to configure www.diary.example.com too:

~~~
sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com --email admin@example.com --https --www
~~~

Useful options:

~~~
sudo bash deploy/ubuntu-deploy.sh --help
sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com --app-dir /srv/my-diary --port 4173
sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com --skip-firewall
~~~

On first deployment, the script creates .env with random secrets and prints the initial admin password once. Store it securely, log in, and change it. Do not put .env in GitHub or paste it into a public issue.

### 3. Verify and update

~~~
sudo systemctl status my-diary
sudo journalctl -u my-diary -f
sudo nginx -t
curl http://127.0.0.1:4173/api/health
curl -I https://diary.example.com
~~~

After a new commit, rerun the same deployment command. It fast-forwards the checkout, installs the lockfile dependencies, builds, and restarts the service. The service files are /etc/systemd/system/my-diary.service, /etc/nginx/sites-available/my-diary, and /etc/nginx/sites-enabled/my-diary.

## Security checklist

- Use HTTPS and keep port 4173 private.
- Keep .env mode 600; use a unique long admin password.
- Back up data/app.json securely, and test restoring it.
- Restrict SSH to keys and a small allowlist; keep Ubuntu, Node.js, Nginx, and pnpm updated.
- Do not run the Node service as root.
- Before using multiple instances, migrate the JSON store and in-memory sessions to managed database/session services.

## Troubleshooting

- 502 Bad Gateway: check systemctl status my-diary and curl http://127.0.0.1:4173/api/health.
- If /api/health returns the HTML homepage instead of {"ok":true}, the server is still running Vite preview. Pull main and rerun deploy/ubuntu-deploy.sh so systemd uses pnpm start (Node API).
- If an old process still owns port 4173, the deployment script now stops only the existing My Diary/Vite listener, verifies the port, then restarts systemd. You can inspect the owner with `sudo ss -ltnp 'sport = :4173'`.
- Blocked request host error: add the public hostname to server.allowedHosts and preview.allowedHosts in vite.config.ts, then rebuild. The current deployment already includes diary.learnmath2.xyz.
- Certbot validation fails: verify DNS, router forwarding, cloud security rules, UFW, and that Nginx listens on port 80.
- A blank deep link: confirm Nginx proxies all paths to Node; the Node server falls back to dist/index.html for SPA routes.
