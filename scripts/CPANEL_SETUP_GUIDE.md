# cPanel Node.js App Setup Guide

Since you're on shared hosting without terminal access, follow these steps using the **cPanel UI**.

---

## 1. Create a MySQL Database

1. Go to **cPanel → MySQL® Databases**
2. Create a new database (e.g. `youruser_sonichoice`)
3. Create a new database user with a strong password
4. Add the user to the database with **ALL PRIVILEGES**
5. Note down: `database name`, `username`, `password`

---

## 2. Setup Node.js App

1. Go to **cPanel → Setup Node.js App**
2. Click **CREATE APPLICATION**
3. Fill in the settings:

| Setting | Value |
|---------|-------|
| **Node.js version** | `20.x` (or highest available) |
| **Application mode** | `Production` |
| **Application root** | `sonichoice-api` (or your preferred folder name) |
| **Application URL** | Choose your domain/subdomain |
| **Application startup file** | `dist/src/main.js` |

4. Click **CREATE**

---

## 3. Set Environment Variables

In the Node.js App settings page, add these environment variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | (cPanel assigns this automatically, you may leave it) |
| `DATABASE_URL` | `mysql://db_user:db_password@localhost:3306/db_name` |
| `JWT_SECRET` | (a long random string) |
| `JWT_EXPIRES_IN` | `1h` |
| `JWT_REFRESH_SECRET` | (another long random string) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | `https://yourdomain.com` |
| `BACKEND_URL` | `https://api.yourdomain.com` |
| `MAIL_HOST` | `mail.yourdomain.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USER` | `noreply@yourdomain.com` |
| `MAIL_PASSWORD` | (your email password) |
| `MAIL_FROM` | `noreply@yourdomain.com` |

Click **Save** after adding all variables.

---

## 4. Configure GitHub Actions Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `FTP_SERVER` | Your cPanel FTP hostname (e.g. `ftp.yourdomain.com`) |
| `FTP_USER` | Your cPanel FTP username |
| `FTP_PASSWORD` | Your cPanel FTP password |
| `FTP_PORT` | `21` (or your host's FTP port) |
| `FTP_APP_PATH` | The **Application root** folder (e.g. `/sonichoice-api`) |

---

## 5. First Deployment

1. Push to `main` branch — GitHub Actions will build and FTP the files automatically
2. Go back to **cPanel → Setup Node.js App**
3. Click **Run JS Script** and type: `migrate` — this runs database migrations
4. Click **RESTART** to start your application

---

## 6. Subsequent Deployments

After every push to `main`:
1. GitHub Actions builds and deploys via FTP automatically
2. If you changed the database schema, go to cPanel → Node.js App → **Run JS Script** → `migrate`
3. Click **RESTART** to pick up the new code

---

## Troubleshooting

- **App not starting?** Check the **Application startup file** is set to `dist/src/main.js`
- **Database errors?** Verify `DATABASE_URL` is correct and the DB user has full privileges
- **502 errors?** Click **RESTART** in the Node.js App panel. Check that `PORT` env var matches what cPanel expects
- **FTP deploy failing?** Double-check FTP credentials and that `FTP_APP_PATH` matches your Application root
