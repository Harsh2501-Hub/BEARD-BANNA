# BEARD BANNA — Authentication Setup Guide

> ✅ **STATUS: FULLY CONFIGURED & VERIFIED**
> Google OAuth and Supabase Auth setup has been completed and verified end-to-end.

---

## Step 1 — Database & Schema (COMPLETED ✅)
- `profiles` table created and updated with `avatar_url` and `role` columns.
- RLS enabled with non-recursive policies and `is_admin()` security definer function.
- Auto-profile trigger `on_auth_user_created` configured for both email and Google OAuth signups.

---

## Step 2 & 3 — Google OAuth & Credentials (COMPLETED ✅)
- Project: **`beard-banna-store-507310`**
- **Client ID**: `387673251126-lru649c86kro0i6vc3te4h20s6v9nl5f.apps.googleusercontent.com`
- **Client Secret**: Configured in Supabase
- **Authorized Redirect URI in Google Cloud Console**:
  ```
  https://xdetdylcbcvtsuxteeen.supabase.co/auth/v1/callback
  ```
- **Supabase Google Provider**: Status **Enabled** ✅

---

## Step 3 — Create Google OAuth App

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select project **beard-banna-store-507310** (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
5. Set **Application type**: `Web application`
6. Set **Name**: `BEARD BANNA Store`

### Authorized JavaScript Origins

Add both:
```
http://localhost
http://localhost:5500
http://localhost:3000
```
*(Add any port you use for local development)*

And for production (when you have a domain):
```
https://yourdomain.com
```

### Authorized Redirect URIs

**This is the most critical field.**

Add this **exact** URI:
```
https://xdetdylcbcvtsuxteeen.supabase.co/auth/v1/callback
```

> [!CAUTION]
> No trailing slash. No variations. This must match exactly.

7. Click **Create** → Copy the **Client ID** and **Client Secret**
8. Paste them into Supabase (Step 2)

---

## Step 4 — Configure Supabase Site URL & Redirect URLs

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**

### Site URL
Set to your **primary production URL**:
```
https://yourdomain.com
```
*(Or `http://localhost:5500` while in local development only)*

### Additional Redirect URLs

Add **all** URLs users might land on after authentication:

```
http://localhost:5500/frontend/index.html
http://localhost:3000/frontend/index.html
http://localhost/frontend/index.html
https://yourdomain.com/frontend/index.html
https://yourdomain.com/frontend/reset-password.html
```

> [!IMPORTANT]
> Every URL you add to `redirectTo` in code must also be listed here.
> Supabase blocks any redirect URL not on this allowlist.

---

## Step 5 — Verify Your Supabase Anon Key

Your current key in `frontend/js/supabase-config.js` starts with `sb_publishable_...`

Standard Supabase anon keys start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Verify by:**
1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Under **Project API keys**, copy the **anon / public** key
3. If it differs from what's in `supabase-config.js`, update the file

> [!WARNING]
> Never use the **service_role** key in frontend code. It bypasses all RLS.

---

## Step 6 — Promote Admin User

To grant admin access to a user, run this SQL in the Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'beardbanna07773@gmail.com';
```

> [!CAUTION]
> Never grant admin role from frontend code. Only from the SQL Editor or a trusted backend function.

---

## Redirect URL Reference

| Environment | OAuth `redirectTo` | Reset Password `redirectTo` |
|---|---|---|
| Local (Live Server) | `http://localhost:5500/frontend/index.html` | `http://localhost:5500/frontend/reset-password.html` |
| Local (other port) | `http://localhost:PORT/frontend/index.html` | `http://localhost:PORT/frontend/reset-password.html` |
| Production | `https://yourdomain.com/frontend/index.html` | `https://yourdomain.com/frontend/reset-password.html` |
| Supabase callback | `https://xdetdylcbcvtsuxteeen.supabase.co/auth/v1/callback` | *(not applicable)* |

---

## Environment Variable Reference

These values belong in `frontend/js/supabase-config.js` (frontend-safe):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key — safe for frontend |

These belong in `backend/.env` (never expose):

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing admin JWTs |
| `PORT` | Backend server port |

**Never put in frontend code:**
- Supabase `service_role` key
- Google Client Secret
- Database password
- `JWT_SECRET`

---

## Testing Checklist

After completing setup, test these scenarios:

- [ ] **New Google user** → Click "Continue with Google" → Complete Google auth → Lands on `index.html` logged in → Check Supabase `profiles` table has new row
- [ ] **Existing Google user** → Same flow → No duplicate profile row created
- [ ] **Page refresh** → Reload `index.html` → Still logged in
- [ ] **Logout** → Click logout → Redirected to `index.html` → Navbar shows Login/Register
- [ ] **Protected page** → Without logging in, go to `profile.html` → Redirected to `login.html`
- [ ] **Email/password login** → Works as before
- [ ] **Magic link** → Email sent → Click link → Logged in
- [ ] **Password reset** → Email sent → Click link → Reset password page opens
- [ ] **Mobile** → Repeat Google login test on mobile browser

---

## Supabase Dashboard Quick Links

- Authentication → Providers: `https://supabase.com/dashboard/project/xdetdylcbcvtsuxteeen/auth/providers`
- Authentication → URL Config: `https://supabase.com/dashboard/project/xdetdylcbcvtsuxteeen/auth/url-configuration`
- SQL Editor: `https://supabase.com/dashboard/project/xdetdylcbcvtsuxteeen/sql/new`
- Table Editor → profiles: `https://supabase.com/dashboard/project/xdetdylcbcvtsuxteeen/editor`
- API Settings: `https://supabase.com/dashboard/project/xdetdylcbcvtsuxteeen/settings/api`
