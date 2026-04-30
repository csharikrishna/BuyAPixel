# 🟢 BuyASpot.in

**India's First Pixel Marketplace** — Own a piece of digital history on a 100×100 grid canvas.

> Buy spots, upload your image, link your brand, and leave your mark forever.

🌐 **Live:** [https://buyaspot.in](https://buyaspot.in)

---

## ✨ Features

### 🛒 Core Marketplace
- **Buy Spots** — Select pixels on a 100×100 interactive grid, upload images, add links, and pay via Razorpay
- **Marketplace** — Resell owned pixels with built-in listing, bidding, and platform fee support
- **Canvas View** — Full-screen, zoomable, pannable canvas to explore all purchased spots
- **QR Scanner** — Scan any pixel via QR code to view its owner and linked content

### 👤 User Experience
- **Auth System** — Email/password sign-up, sign-in, forgot/reset password, OAuth callback
- **User Profiles** — View owned pixels, purchase history, and account settings
- **Leaderboard** — Gamified ranking of top pixel owners with achievements
- **Live Ticker** — Real-time feed of recent purchases scrolling across the top

### 📝 Content & Communication
- **Blog** — Full CMS with categories, SEO metadata, and admin publishing
- **Contact Form** — Sends emails via Resend API with premium HTML templates
- **Help Center** — FAQ section with structured data for search engines

### 🛡️ Admin Dashboard
- **User Management** — View, search, and manage all registered users
- **Pixel Moderation** — Review and moderate uploaded content
- **Analytics** — Revenue tracking, purchase trends, and grid statistics
- **Refund Processing** — Admin tools for handling payment refunds
- **Blog Admin** — Create, edit, and publish blog posts

### 🔒 Security & Infrastructure
- **Row-Level Security (RLS)** — All Supabase tables protected with fine-grained policies
- **Rate Limiting** — Edge function rate limiting to prevent abuse
- **Idempotency Keys** — Prevents duplicate payment processing
- **HMAC Signature Verification** — Constant-time Razorpay signature validation
- **Payment Amount Re-verification** — Server-side amount check against Razorpay API

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript |
| **Build Tool** | Vite 5 (SWC) |
| **Styling** | Tailwind CSS 3 + Radix UI primitives |
| **State** | TanStack React Query v5 |
| **Routing** | React Router v6 |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| **Payments** | Razorpay (INR) |
| **Email** | Resend API |
| **SEO** | react-helmet-async + JSON-LD structured data |
| **Code Quality** | ESLint 9 + TypeScript strict mode |

---

## 📁 Project Structure

```
├── public/                   # Static assets (favicon, logo, robots.txt)
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # Radix-based design system primitives
│   │   ├── admin/            # Admin dashboard components
│   │   ├── profile/          # Profile page components
│   │   ├── Header.tsx        # Global navigation header
│   │   ├── Footer.tsx        # Global footer
│   │   ├── EnhancedHeroSection.tsx
│   │   ├── VirtualizedPixelGrid.tsx
│   │   ├── PurchasePreview.tsx
│   │   ├── LiveTicker.tsx
│   │   └── ...
│   ├── pages/                # Route-level page components
│   │   ├── BuyPixels.tsx     # Main grid + purchase flow
│   │   ├── Canvas.tsx        # Full-screen canvas viewer
│   │   ├── MarketplacePage.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── Blog.tsx / BlogPost.tsx
│   │   ├── SignIn.tsx / SignUp.tsx
│   │   └── ...
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Utility functions
│   ├── types/                # TypeScript type definitions
│   ├── contexts/             # React context providers
│   ├── integrations/         # Supabase client + types
│   ├── lib/                  # SEO utils, class merge helpers
│   ├── App.tsx               # Root app with routing
│   └── main.tsx              # Entry point
├── supabase/
│   ├── functions/            # Deno edge functions
│   │   ├── create-razorpay-order/
│   │   ├── verify-razorpay-payment/
│   │   ├── create-marketplace-order/
│   │   ├── verify-marketplace-payment/
│   │   ├── razorpay-webhook/
│   │   ├── send-purchase-confirmation/
│   │   ├── send-contact-email/
│   │   ├── validate-image-upload/
│   │   └── get_marketplace_stats/
│   └── migrations/           # 35 sequential SQL migrations (000–034)
├── index.html                # HTML shell
├── vite.config.ts
├── tailwind.config.ts
├── package.json
└── .env.example              # Environment variable template
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A [Supabase](https://supabase.com) project
- A [Razorpay](https://razorpay.com) account (test mode for dev)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/buyaspot.git
cd buyaspot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

### 3. Set Up Database

Run all migrations in order from `supabase/migrations/` against your Supabase project:

```bash
supabase db push
```

### 4. Configure Edge Functions

Set these secrets in your Supabase Dashboard → Settings → Edge Functions:

| Secret | Description |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay API Key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret |
| `RESEND_API_KEY` | Resend email API key |
| `ALLOWED_ORIGIN` | `https://buyaspot.in` (or your domain) |
| `CONTACT_EMAIL` | Email for contact form submissions |

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 6. Build for Production

```bash
npm run build
npm run preview    # Preview the production build
```

---

## 🔑 Key Routes

| Route | Page | Auth Required |
|---|---|---|
| `/` | Buy Pixels (main grid) | No |
| `/canvas` | Full-screen canvas viewer | No |
| `/scan` | QR pixel scanner | No |
| `/marketplace` | Pixel marketplace | No |
| `/leaderboard` | Top pixel owners | No |
| `/blog` | Blog listing | No |
| `/blog/:slug` | Blog post | No |
| `/about` | About page | No |
| `/contact` | Contact form | No |
| `/help` | Help center / FAQ | No |
| `/signin` | Sign in | No |
| `/signup` | Sign up | No |
| `/profile` | User profile & pixels | Yes |
| `/admin` | Admin dashboard | Yes (admin) |
| `/blog/admin` | Blog CMS | Yes (admin) |
| `/terms` | Terms of Service | No |
| `/privacy` | Privacy Policy | No |

---

## 📄 License

All rights reserved. © 2025–2026 BuyASpot.in
