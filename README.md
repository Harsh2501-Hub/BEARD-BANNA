# 👑 BEARD BANNA — Project Workspace

Welcome to the **BEARD BANNA** e-commerce project directory! The workspace is structured cleanly as a monorepo containing three core components:

```
BEARD-BANNA/
├── 🛍️ frontend/       (Customer-facing store web application)
├── ⚙️ backend/        (Node.js & Express REST API + MongoDB logic)
├── 🔐 admin-panel/    (Internal management dashboard)
├── 📋 GO_LIVE_CHECKLIST.md
├── 🙈 .gitignore
└── 📖 README.md
```

---

## 📂 Directory Breakdown

### 1️⃣ `/frontend` — Storefront Web App
* Customer-facing UI (`index.html`, `collection.html`, `product.html`, `cart.html`, `checkout.html`, `order-success.html`, etc.)
* Custom styling in `css/style.css`
* JavaScript store modules & API integration in `js/`

### 2️⃣ `/backend` — Express Server & REST API
* Node.js & Express REST API server (`server.js`)
* Connected to **MongoDB Atlas**
* Environment variables template in `.env.example`

### 3️⃣ `/admin-panel` — Store Admin Dashboard
* Admin management pages (`dashboard.html`, `products.html`, `orders.html`, `customers.html`, `categories.html`, `analytics.html`, `reviews.html`, `settings.html`, `inquiries.html`, `login.html`)
* Admin authentication & stock inventory JS in `js/`
* Admin stylesheet in `css/admin.css`

---

## 🚀 Quick Start & Local Running

1. **Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Frontend & Admin Panel**:
   Open `frontend/index.html` or `admin-panel/login.html` directly in your web browser (or run using Live Server).