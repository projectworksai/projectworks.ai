# Plan Forge – Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL database
- [Ollama](https://ollama.ai) (for local AI): `ollama pull phi3:mini`
- Stripe account (for Pro subscriptions)

## 1. Install dependencies

```bash
npm install
```

## 2. Environment variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Required for auth and database
DATABASE_URL="postgresql://user:password@localhost:5432/projectworks?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"

# Ollama (local AI)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="phi3:mini"

# Stripe (optional – payments disabled if not set)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 3. Database migration

```bash
npx prisma migrate dev
```

## 4. Run the app

```bash
npm run dev
```

Visit http://localhost:3000

## Stripe setup

1. Create a Product in Stripe Dashboard (e.g. "Plan Forge Pro").
2. Add a recurring Price and copy the `price_xxx` ID to `STRIPE_PRO_PRICE_ID`.
3. Create a webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
4. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

## Tiers

- **Free**: Index, Background, Scope, Methodology (summary view only)
- **Pro**: Full plan including Quality, Risk, Safety, Schedule, appendices, and Word download
