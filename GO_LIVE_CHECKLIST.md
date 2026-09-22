# 🚀 BEARD BANNA — Production Go-Live Deployment Checklist

This document contains everything you need to launch **BEARD BANNA** live on your custom domain!

---

## 📁 Project Directory Structure

```
BEARD-BANNA/
├── frontend/       (Storefront application for customers)
├── backend/        (Node.js Express API & MongoDB connection)
└── admin-panel/    (Internal management dashboard)
```

---

## 📋 4-Step Free Deployment Checklist

### 1️⃣ Step 1: Deploy Frontend & Admin Panel to Netlify (Free)
1. Open [Netlify Drop](https://app.netlify.com/drop) in your browser.
2. Drag and drop the **`frontend`** folder to deploy your storefront.
3. Drag and drop the **`admin-panel`** folder (or host under `/admin` routing).
4. Netlify will publish your site instantly!

---

### 2️⃣ Step 2: Connect Custom Domain (GoDaddy / Namecheap)
1. In Netlify Dashboard → **Domain Settings** → **Add Custom Domain**.
2. Enter your domain name (e.g. `beardbanna.com`).
3. Copy the 4 Netlify Custom Nameservers (`dns1.p01.nsone.net`...).
4. Log into **GoDaddy / Namecheap** → **Domains** → **DNS / Nameservers** → Choose **Custom Nameservers** and paste Netlify's 4 nameservers.
5. Netlify will automatically issue a **Free SSL Certificate (HTTPS 🔒)**.

---

### 3️⃣ Step 3: Set Up Database & Backend (MongoDB Atlas + Render)
1. **Database**: Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (Free M0 Cluster in **Mumbai, India**).
   * Connection URL: `mongodb+srv://admin:<password>@cluster0.mongodb.net/beardbanna?retryWrites=true&w=majority`
2. **Backend Server**: Sign up at [render.com](https://render.com) → **New Web Service** (Connect your repository or upload `backend` folder).
   * Build Command: `npm install`
   * Start Command: `npm start`
   * Environment Variables:
     * `MONGODB_URI`: `<Your MongoDB URL>`
     * `PORT`: `5000`
     * `JWT_SECRET`: `beard_banna_royal_secret_2026`

---

### 4️⃣ Step 4: Update API Endpoint in Frontend & Admin
In `frontend/js/api.js` and `admin-panel/js/api.js`, update with your live Render backend API URL:
```javascript
const API_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:5000/api/v1'
  : 'https://<your-render-app-name>.onrender.com/api/v1';
```

---

## 🔐 Default Admin Access Credentials
* **Admin Login URL**: `https://<your-domain>/admin-panel/login.html`
* **Default Admin Email**: `beardbanna07773@gmail.com` or `admin@clothing.com` (or username `beardbanna` / `admin`)
* **Admin Password**: `Banna@7773` (also accepts legacy `AdminPass123!`)

---

## 🏛️ Business Information
* **Official Support Email**: `beardbanna07773@gmail.com`
* **Official Phone**: `+91 9586479121`
* **Seller GSTIN**: `08AAAFB1234A1Z1` (State: 08 - Rajasthan)
* **Apparel HSN**: `6109` (T-Shirts / Hoodies / Polo)
* **GST Rates**: 2.5% CGST + 2.5% SGST (5% Total)
