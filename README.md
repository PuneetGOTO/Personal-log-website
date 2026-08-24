# My Diary

My Diary is a Vite + React personal journal website. The interface keeps a warm-white paper background, hand-drawn black borders, handwritten headings, irregular corners, and small yellow accents across public pages, settings, and the admin workspace.

## Features

- Public and private journal entries, drafts, tags, moods, and reports.
- Admin dashboard with overview, user management, article moderation, and report handling.
- Admin actions: create accounts, assign roles, ban/unban users, change passwords, delete accounts, view articles, hide/restore articles, and permanently delete articles.
- Responsive layout for desktop and mobile.

## Security note

This repository is a frontend prototype. Users, entries, reports, and passwords are stored in browser `localStorage`; there is no server-side database, session system, password hashing, or API authorization. Do not use it as a production account system without replacing the storage/authentication layer with a backend, HTTPS-only cookies, server-side authorization, and Argon2id or bcrypt password hashing.

Seeded demo credentials:

- `demo@example.com` / `demo1234`
- `admin@example.com` / `admin1234`

Change these immediately for any public demo. They are only convenience credentials for this prototype.

## Local development

Requirements: Node.js 20 or newer, Git, and pnpm 9 or newer.

```bash
git clone https://github.com/PuneetGOTO/Personal-log-website.git
cd Personal-log-website
corepack enable
corepack prepare pnpm@9 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173/`. For a production-style local check:

```bash
pnpm build
pnpm preview -- --host 127.0.0.1 --port 4173
```

## Windows deployment

### 1. Install prerequisites

Install Git for Windows and Node.js 20 LTS. Open PowerShell:

```powershell
git --version
node --version
corepack enable
corepack prepare pnpm@9 --activate
```

### 2. Download, build, and run

```powershell
git clone https://github.com/PuneetGOTO/Personal-log-website.git C:\\Apps\\my-diary
Set-Location C:\\Apps\\my-diary
pnpm install --frozen-lockfile
pnpm build
pnpm preview -- --host 127.0.0.1 --port 4173
```

Keep the process running, or install it as a Windows service using NSSM. Keep the app on `127.0.0.1`; expose it through IIS or Caddy on ports 80 and 443.

### 3. Windows Firewall

Run PowerShell as Administrator. Only open web ports when a reverse proxy is configured:

```powershell
New-NetFirewallRule -DisplayName "My Diary HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "My Diary HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Do not expose port 4173 publicly unless this is a temporary test.

### 4. Domain and public IP on Windows

At your DNS provider create `A: diary.example.com -> YOUR_PUBLIC_IPV4`. Add an `AAAA` record only when the server, firewall, and router support IPv6. For a home network, forward TCP 80 and 443 on the router to the Windows machine's private IP. If the ISP uses CGNAT, inbound port forwarding will not work; use a VPS, a tunnel, or request a public IPv4 from the ISP.

For HTTPS, install Caddy and create `C:\\Caddy\\Caddyfile`:

```text
diary.example.com {
    reverse_proxy 127.0.0.1:4173
}
```

Caddy requests and renews certificates automatically after DNS and ports 80/443 are ready. IIS can use URL Rewrite + Application Request Routing with the same target: `http://127.0.0.1:4173`.

## Linux deployment

On Debian/Ubuntu, the manual flow is:

```bash
sudo apt update
sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install --global pnpm@9
git clone https://github.com/PuneetGOTO/Personal-log-website.git /var/www/my-diary
cd /var/www/my-diary
sudo pnpm install --frozen-lockfile
sudo pnpm build
```

Create a systemd service that runs `pnpm exec vite preview --host 127.0.0.1 --port 4173`, then reverse proxy it from Nginx. The Ubuntu script below automates these steps.

## Ubuntu automated deployment

[`deploy/ubuntu-deploy.sh`](./deploy/ubuntu-deploy.sh) installs Node.js, pnpm, Git, Nginx, and UFW; clones or updates the repository; builds the app; creates a `my-diary.service` systemd unit; writes the Nginx virtual host; and optionally runs Certbot.

### 1. Prepare DNS first

Create this record at your DNS provider:

```text
Type: A
Name: diary
Value: YOUR_PUBLIC_IPV4
TTL: 300
```

If you configure `www`, create `www.diary.example.com` as an `A` or `CNAME` record too. Verify propagation and the server's public IP:

```bash
dig +short diary.example.com
curl -4 https://ifconfig.me
```

The values must point to the same public server. For a home server, forward TCP 80 and 443 from the router to Ubuntu. For a cloud VPS, allow 80/443 in the provider security group as well as UFW.

### 2. Run the deployment script

From a checkout of this repository:

```bash
sudo bash deploy/ubuntu-deploy.sh \
  --domain diary.example.com \
  --email admin@example.com \
  --https
```

To include `www.diary.example.com`:

```bash
sudo bash deploy/ubuntu-deploy.sh \
  --domain diary.example.com \
  --email admin@example.com \
  --https \
  --www
```

Useful options:

```bash
sudo bash deploy/ubuntu-deploy.sh --help
sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com --app-dir /srv/my-diary --port 4173
sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com --skip-firewall
```

The script creates `/etc/systemd/system/my-diary.service`, `/etc/nginx/sites-available/my-diary`, `/etc/nginx/sites-enabled/my-diary`, and `/var/www/my-diary` by default.

### 3. Verify and operate the service

```bash
sudo systemctl status my-diary
sudo systemctl restart my-diary
sudo journalctl -u my-diary -f
sudo nginx -t
curl -I http://127.0.0.1:4173
curl -I https://diary.example.com
```

After a new GitHub commit, rerun the same deployment command. It performs a fast-forward pull, reinstalls the lockfile dependencies, rebuilds the bundle, and restarts the service.

## Public IP and domain checklist

1. Reserve or confirm a public IPv4/IPv6 address. `192.168.x.x`, `10.x.x.x`, and `172.16.x.x` are private addresses and cannot be used in public DNS.
2. Point the domain's `A` record to the public IPv4. Add `AAAA` only when IPv6 is fully reachable.
3. Forward TCP 80 and 443 at the router, or allow them in the cloud firewall/security group.
4. Allow `Nginx Full` in UFW or the equivalent host firewall.
5. Wait for DNS propagation, then run Certbot. Certificate issuance fails if DNS or port 80 is not reachable.
6. Keep Vite preview on `127.0.0.1:4173`; Nginx or Caddy should be the only public listener.

## Troubleshooting

- `502 Bad Gateway`: check `sudo systemctl status my-diary` and `curl http://127.0.0.1:4173`.
- Domain resolves to the wrong server: check `dig +short diary.example.com` and the provider's DNS records.
- Certbot validation fails: check DNS, router forwarding, cloud security rules, UFW, and that Nginx listens on port 80.
- Home server cannot be reached: check CGNAT, double NAT, ISP inbound-port blocking, and the router forwarding target.
- Blank page after a deep link: make sure traffic reaches Vite preview and that the proxy preserves SPA fallback behavior.
