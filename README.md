# MongoDB Platform

MongoDB Platform is a NestJS API and Next.js control panel for administering MongoDB projects, databases, backups, monitoring, users, and settings. The production installer targets a small Ubuntu host with 2 CPUs and 4 GB RAM and deploys the Node applications as native systemd services behind Nginx.

## Local Development

Requirements: Node.js 22, pnpm 10, MongoDB, and MongoDB Database Tools.

1. Create a MongoDB administrator and enable authentication, or provide credentials for an existing development MongoDB instance.
2. Copy `.env.example` to `apps/api/.env` and replace the MongoDB credentials and `JWT_SECRET`.
3. Install and run the workspace:

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install --no-frozen-lockfile
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api pnpm dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:3001/api`. For local development, the browser needs an API base reachable from the browser. Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api` when building/running the web app unless a local reverse proxy provides same-origin `/api` routing.

Create the first administrator once:

```bash
curl --fail --request POST http://127.0.0.1:3001/api/auth/bootstrap \
  --header 'Content-Type: application/json' \
  --data '{"email":"admin@example.com","password":"replace-with-a-strong-password"}'
```

## Production Installation

Use a fresh Ubuntu 22.04 or 24.04 server with DNS already pointing the domain to it. Run the checked-out repository installer as root:

```bash
sudo bash scripts/install.sh
```

The installer prompts through `/dev/tty`, including when its script body arrived over a pipe. It installs Node.js 22, pnpm, MongoDB 8 from MongoDB's official Ubuntu repository, Database Tools, Nginx, Certbot, UFW, fail2ban, Docker Engine with Compose, and Git. Docker is installed as requested but the application and MongoDB run natively under systemd.

Install directly from the public repository with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/dungxga27/zun-db/main/scripts/install.sh | sudo bash
```

The installer logs each installation stage, asks for the domain and administrator credentials through `/dev/tty`, clones this repository automatically, and prints the dashboard URL when the health check succeeds.

Noninteractive automation supplies all required values as environment variables:

```bash
curl -fsSL https://raw.example.invalid/OWNER/REPO/REF/scripts/install.sh | \
  sudo env NONINTERACTIVE=true \
    DOMAIN=db.example.com \
    ADMIN_EMAIL=admin@example.com \
    ADMIN_PASSWORD='use-a-long-unique-secret' \
    ENABLE_HTTPS=true \
    EXPOSE_MONGODB=false \
    ENABLE_BACKUPS=true \
    BACKUP_RETENTION_DAYS=14 bash
```

Be aware that environment values may be visible to privileged process inspection or automation logs. Prefer a protected provisioning environment and clear shell history. Interactive mode hides the admin password. Generated MongoDB and JWT secrets are stored only in `/opt/mongodb-platform/.env`, owned by root with mode `0600`; rerunning the installer preserves them.

The installer obtains a Let's Encrypt certificate only when HTTPS is enabled. Port 80 must be reachable and the domain must resolve to the server. If HTTPS is disabled, cookies are not marked secure and production traffic is unencrypted.

## External MongoDB Access

MongoDB binds only to `127.0.0.1` by default, and generated project URIs therefore use localhost. Selecting external exposure changes generated project URIs to the configured domain and requires `MONGODB_ALLOWED_CIDR`; UFW then permits port `27017` only from that CIDR. Example:

```bash
sudo env EXPOSE_MONGODB=true MONGODB_ALLOWED_CIDR=203.0.113.10/32 bash scripts/install.sh
```

MongoDB authentication and CIDR filtering do not encrypt network traffic. The installer does **not** configure MongoDB TLS. Do not expose MongoDB across an untrusted network without separately configuring server/client TLS, or use a VPN/SSH tunnel and leave MongoDB bound to localhost. Nginx HTTPS protects the web/API connection only, not direct MongoDB connections.

## Vercel

After securely exposing MongoDB, create a project in the dashboard and copy its one-time connection URI. In Vercel, open **Project -> Settings -> Environment Variables**, add it as `MONGODB_URI` for Production, Preview, and Development as needed, then redeploy. Vercel cannot reach the default localhost-bound installation. Vercel workloads may not have one stable outbound address, so a single `/32` UFW allowlist is usually unsuitable; use a fixed-egress proxy/VPN, Vercel Secure Compute, or a TLS-enabled managed MongoDB service. The current native API reads `METADATA_MONGODB_URI` and `MONGO_ADMIN_URI`; `MONGODB_URI` is intended for each managed Next.js application.

## Operations

```bash
sudo systemctl status mongodb-platform-api mongodb-platform-web mongod nginx
sudo systemctl restart mongodb-platform-api mongodb-platform-web
sudo journalctl -u mongodb-platform-api -f
sudo journalctl -u mongodb-platform-web -f
sudo nginx -t
sudo certbot renew --dry-run
sudo ufw status verbose
docker compose version
```

Application services run as the dedicated `mongodb-platform` system user. Nginx routes `/api/` to the API on loopback port `3001`, including WebSocket upgrade headers, and all other paths to Next.js on loopback port `3000`.

## Backups And Restore

Automatic backups run daily at approximately 02:30 through `mongodb-platform-backup.timer`. Archives and SHA-256 sidecars are root-only under `/var/backups/mongodb-platform`; retention is controlled by `BACKUP_RETENTION_DAYS` in `/opt/mongodb-platform/.env`.

```bash
sudo systemctl list-timers mongodb-platform-backup.timer
sudo systemctl start mongodb-platform-backup.service
sudo journalctl -u mongodb-platform-backup.service
sudo /opt/mongodb-platform/app/scripts/backup.sh
sudo /opt/mongodb-platform/app/scripts/restore.sh /var/backups/mongodb-platform/mongodb-platform-YYYYMMDDTHHMMSSZ.archive.gz
```

Restore verifies the checksum when present, requires an archive inside the configured backup directory, takes the same exclusive lock as backup, and asks for confirmation. It uses `mongorestore --drop`, so matching collections are replaced. Use `--yes` only for controlled noninteractive recovery. Backup and restore place credentials in temporary root-only Database Tools config files rather than command arguments.

`mongodump` against this standalone server is not a point-in-time snapshot across concurrent writes. For strict consistency, schedule a write-maintenance window or deploy a replica set and an appropriate coordinated backup strategy. Keep off-host copies and test restores regularly.

## API

All endpoints are prefixed with `/api`. Authentication uses HTTP-only access and refresh cookies.

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Authentication | `POST /api/auth/bootstrap`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Projects | `GET/POST /api/projects`, `GET/DELETE /api/projects/:id`, `POST /api/projects/:id/rotate-credentials` |
| Databases | `/api/projects/:projectId/database/collections` and document/index subresources |
| Backups | `GET/POST /api/projects/:projectId/backups`, restore and delete subresources |
| Operations | `/api/monitoring`, `/api/mongodb/service`, `/api/settings`, `/api/audit`, `/api/admin/users` |

The bootstrap endpoint succeeds only while no platform user exists. The installer calls it through `127.0.0.1` and treats HTTP `409` as an already initialized installation.
"# zun-db" 
