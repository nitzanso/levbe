# Levbe — Setup Guide

Follow these steps in order. Each step should take 2–5 minutes.

---

## Step 1 — Create your Supabase project

1. Go to **supabase.com** and sign in (or create a free account)
2. Click **"New project"**
3. Choose a name — e.g. `levbe`
4. Set a strong database password (Levbe2026!!)
5. Choose region: **Europe (Frankfurt)** — closest to you both
6. Click **"Create new project"** — wait ~1 minute for it to spin up

---

## Step 2 — Get your Supabase keys

1. Inside your new project, click **Settings** (gear icon, bottom left)
2. Click **API** in the settings menu
3. You need two values:
   - **Project URL** — looks like `https://iuotqrtctgnpgsacktdm.supabase.co`
   - **anon public** key — a long string starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1b3RxcnRjdGducGdzYWNrdGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4Mjg1NTAsImV4cCI6MjA5ODQwNDU1MH0.qgQHVfLLhhpdnrBpfyKlDebRTJAa3VUde3DwGKYCMO0`

---

## Step 3 — Add the keys to the app

1. Open the file `.env.local` in your levbe folder
2. Replace the placeholder values with your real ones:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJyour-actual-key-here
```

Save the file.

---

## Step 4 — Run the database schema

This creates all the tables and seeds the starter quotes and ideas.

1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase-schema.sql` from your levbe folder
4. Copy the entire contents and paste it into the SQL editor
5. Click **"Run"** — you should see "Success. No rows returned."

---

## Step 5 — Create two user accounts (Nitzan and Jens)

1. In Supabase, go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter Nitzan's email and a password → click **"Create user"**
4. Do the same for Jens' email and password

**Important:** Write down both emails and passwords — share Jens' login with him securely (e.g. Signal message).

---

## Step 6 — Set the display names (optional but nice)

After both users are created:

1. Go to **SQL Editor** → **New query**
2. Run this (replace emails and names):

```sql
update public.users 
set name = 'Nitzan'
where id = (select id from auth.users where email = 'nitzan@example.com');

update public.users 
set name = 'Jens'
where id = (select id from auth.users where email = 'jens@example.com');
```

---

## Step 7 — Test locally first

In your terminal, from the levbe folder:

```
npm run dev
```

Open **http://localhost:3000** in your browser.
You should be redirected to the login page.
Log in with Nitzan's credentials — you should see the Home screen.

---

## Step 8 — Deploy to Vercel

1. Create a new GitHub repository called `levbe` at github.com
2. Push the code:
   ```
   git init
   git add .
   git commit -m "initial levbe build"
   git remote add origin https://github.com/YOUR_USERNAME/levbe.git
   git push -u origin main
   ```
3. Go to **vercel.com** and sign in
4. Click **"Add New Project"** → import your `levbe` repo
5. Before deploying, click **"Environment Variables"** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `NEXT_PUBLIC_SITE_URL` = your Vercel URL (e.g. `https://levbe-abc123.vercel.app`) — needed for password reset emails to link back to the right place. If you don't know it yet, deploy first and then add it from the Vercel dashboard.
6. Click **"Deploy"**

Vercel will give you a URL like `levbe-abc123.vercel.app` — that's your app link. Share it with Jens.

### After deploying — one Supabase dashboard setting

For the "Forgot password?" email links to work, Supabase needs to know your app's URL:

1. In Supabase → **Authentication** → **URL Configuration**
2. Under **"Redirect URLs"**, click **"Add URL"**
3. Add: `https://your-vercel-url.vercel.app/reset-password`
4. Click **"Save"**

Without this step, users who click the reset link in their email will get a "redirect URI mismatch" error instead of the password form.

---

## Step 9 — Install on your phones

On iPhone:
1. Open Safari (must be Safari, not Chrome)
2. Go to your Vercel URL
3. Tap the **Share** button → **"Add to Home Screen"**
4. Tap **"Add"**

The Levbe app icon will appear on your home screen like a real app.

On Android:
1. Open Chrome
2. Go to your Vercel URL
3. Tap the three-dot menu → **"Add to Home screen"**

---

## What's inside

| Screen | What it does |
|--------|-------------|
| Home | Daily quote, check-in prompt, this week's moment, next visit |
| Check in | Log your mood (1–5) + optional note. See each other's mood. |
| Notes | Leave handwritten notes and doodles for each other |
| Proud of us | Achievements feed — add things you're proud of |
| This week | Propose and confirm a shared moment. Pull from idea bank or write your own. |
| Visits | Track proposed and confirmed visits with dates |
| Milestones | 5-track milestone board (Us, Wellbeing, Germany prep, Career, Contingency) |
| Talk it out | Threaded conversations for things that need addressing |

---

## Things to fill in after first use

- Go to **Milestones** and add your actual milestones per track
- Go to **This week → Idea bank** and edit/add ideas you like
- If you have quotes that are meaningful to both of you, add them via SQL:
  ```sql
  insert into daily_quotes (text, author, category) 
  values ('Your text here', 'Optional author', 'ours');
  ```
  Use category `'ours'` for personal ones — lyrics, things you've said to each other.
