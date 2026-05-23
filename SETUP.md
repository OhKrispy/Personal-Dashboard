# Personal Dashboard — Setup Guide

## What you're getting
- React app hosted free on **Vercel** (accessible anywhere)
- **Supabase** free database so data syncs across all your devices
- Works on phone and laptop, no app install needed

---

## Step 1 — Supabase (your database)

1. Go to **https://supabase.com** → Sign up free
2. Click **New Project** → give it a name (e.g. `my-dashboard`) → set a password → Create
3. Wait ~1 minute for it to spin up
4. In the left sidebar go to **SQL Editor**
5. Paste the entire contents of `supabase_schema.sql` and click **Run**
6. Go to **Project Settings → API**
7. Copy two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under "Project API keys")

> If you already ran the old schema and just need to add `room_cleaning`, run this single line in the SQL Editor:
> ```sql
> alter table activities add column if not exists room_cleaning boolean default false;
> ```

---

## Step 2 — GitHub (host your code)

1. Go to **https://github.com** → Sign up / log in
2. Click **+** → **New repository** → name it `personal-dashboard` → Public → Create
3. On your computer, open a terminal in the `dashboard` folder and run:

```bash
git init
git add .
git commit -m "initial dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/personal-dashboard.git
git push -u origin main
```

---

## Step 3 — Create your .env file (local only, never commit this)

In the `dashboard` folder, create a file called `.env` (copy from `.env.example`):

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with what you copied from Supabase in Step 1.

Add `.env` to your `.gitignore` so it never gets pushed to GitHub:
```bash
echo ".env" >> .gitignore
```

---

## Step 4 — Vercel (free hosting)

1. Go to **https://vercel.com** → Sign up with your GitHub account
2. Click **Add New → Project**
3. Import your `personal-dashboard` repository
4. Before deploying, click **Environment Variables** and add:
   - `REACT_APP_SUPABASE_URL` → your Supabase project URL
   - `REACT_APP_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**
6. In ~2 minutes you'll get a URL like `https://personal-dashboard-xyz.vercel.app`

That URL works on your phone and laptop — bookmark it on both.

---

## Step 5 — Run locally (optional)

If you want to run it on your laptop without internet:

```bash
cd dashboard
npm install
npm start
```

Opens at `http://localhost:3000`

---

## How data flows

```
Your phone/laptop
     │
     ▼
Vercel (serves the app)
     │
     ▼
Supabase (stores your data)
```

Every device reads/writes to the same Supabase database, so everything stays in sync.

---

## Satisfactory day logic

A day counts as **Satisfactory** only if ALL of these are true:
- (Gym OR Basketball) checked
- Athletic Work checked
- Skincare checked
- Reading checked
- Room Cleaning checked
- Sleep > 8 hours
- Work > 4 hours
- Study > 1 hour

---

## CSV Export

Click **Export CSV** in the sidebar. Opens a file with all your data by date, including a computed `Satisfactory` column. Feed this directly to an AI for analysis.

---

## Updating the app later

Any changes you push to GitHub automatically redeploy on Vercel within ~1 minute.

```bash
git add .
git commit -m "your change description"
git push
```
