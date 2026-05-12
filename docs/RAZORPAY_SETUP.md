# Razorpay Integration Setup Guide

## Overview

This document explains how to set up Razorpay payments for the BuyASpot application. The integration consists of:

1. **Backend**: Supabase Edge Functions to create orders and verify payments
2. **Frontend**: React components with payment checkout modal
3. **Credentials**: Razorpay API keys (test and production)

## Step 1: Get Razorpay Credentials

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Navigate to **Settings > API Keys**
3. You'll see two sets of credentials:
   - **Test Mode**: For development
   - **Live Mode**: For production (requires KYC approval)

### For Testing:
- **Key ID**: `rzp_test_SoJrKJ1zntTN5c`
- **Key Secret**: `c1UfiHHkn8nbi6UZ0ahs8oNG`

⚠️ **IMPORTANT**: Never commit the Key Secret to version control!

## Step 2: Configure Supabase Edge Functions

The Razorpay credentials must be set as environment variables in your Supabase project.

### Using Supabase Dashboard:

1. Go to your Supabase Project
2. Navigate to **Settings > Edge Functions** (or **Settings > Secrets** in newer versions)
3. Add the following secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `RAZORPAY_KEY_ID` | Your Razorpay Test Key ID | `rzp_test_SoJrKJ1zntTN5c` |
| `RAZORPAY_KEY_SECRET` | Your Razorpay Test Key Secret | `c1UfiHHkn8nbi6UZ0ahs8oNG` |

### Using CLI:

```bash
# Set Razorpay credentials
supabase secrets set RAZORPAY_KEY_ID=rzp_test_SoJrKJ1zntTN5c
supabase secrets set RAZORPAY_KEY_SECRET=c1UfiHHkn8nbi6UZ0ahs8oNG
```

## Step 3: Frontend Configuration

### Install Dependencies (if not already installed)

The Razorpay SDK is loaded dynamically from the Razorpay CDN in the `PurchasePreview` component.

### Environment Variables

No frontend environment variables needed for Razorpay (the key ID is fetched from the backend response).

## Step 4: Database Tables

Ensure these tables exist in your Supabase database:

### `payment_orders` table

```sql
CREATE TABLE payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  amount BIGINT NOT NULL,
  currency TEXT DEFAULT 'INR',
  purchase_type TEXT NOT NULL,
  purchase_metadata JSONB,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON payment_orders(user_id);
CREATE INDEX ON payment_orders(razorpay_order_id);
```

### `orphaned_orders` table (for recovery)

```sql
CREATE TABLE orphaned_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  amount BIGINT,
  error_message TEXT,
  attempted_at TIMESTAMP,
  status TEXT DEFAULT 'pending_manual_review',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Step 5: Testing the Integration

### 1. Run the Application

```bash
npm run dev
```

### 2. Test Razorpay Checkout

1. Navigate to the "Buy Pixels" page
2. Select some pixels
3. Click "Proceed to Checkout"
4. Fill in the form (pixel name, optional link, optional image)
5. Click "Pay ₹XXX Securely"

### 3. Use Razorpay Test Cards

For testing, use these test card numbers:

| Type | Card Number | Expiry | CVV |
|------|-------------|--------|-----|
| **Visa** | 4111 1111 1111 1111 | Any future date | Any 3 digits |
| **MasterCard** | 5555 5555 5555 4444 | Any future date | Any 3 digits |
| **Amex** | 3782 822463 10005 | Any future date | Any 4 digits |
| **UPI** | success@razorpay | - | - |

### 4. Monitor Logs

Check Supabase Edge Functions logs:
1. Go to Supabase Dashboard > Edge Functions
2. Click on `create-razorpay-order` function
3. View logs for any errors

## Step 6: Production Deployment

### Before Going Live:

1. **Get Live Keys**: Complete Razorpay's KYC verification
2. **Update Secrets**: Replace test keys with production keys in Supabase
3. **Update Frontend**: If using environment-based key selection, ensure production config
4. **Test Again**: Verify everything works with real transactions (in test mode first)
5. **Set Webhook**: Configure Razorpay webhooks for payment confirmations

### Update Razorpay Credentials:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

## Troubleshooting

### 500 Error on Order Creation

**Causes**:
- Razorpay credentials not set in Supabase
- Database table doesn't exist
- Network connectivity issue

**Fix**:
1. Verify secrets are set in Supabase Dashboard
2. Check database table `payment_orders` exists
3. Check browser console and Supabase logs for details

### Payment Modal Doesn't Open

**Causes**:
- Razorpay script failed to load
- Missing order ID from backend

**Fix**:
1. Check network tab for CDN script load status
2. Check browser console for errors
3. Ensure backend returned `razorpay_order_id`

### Payment Verification Failed

**Causes**:
- Signature mismatch
- Missing payment fields

**Fix**:
1. Check backend logs in Supabase
2. Verify `RAZORPAY_KEY_SECRET` is correct
3. Ensure payment data is complete

## Security Best Practices

✅ **DO**:
- Store `RAZORPAY_KEY_SECRET` only in Supabase (never in code)
- Use HTTPS for all payment communications
- Validate signatures on the backend
- Log failed verification attempts
- Use test mode for development

❌ **DON'T**:
- Commit keys to version control
- Pass `KEY_SECRET` to frontend
- Skip signature verification
- Hardcode credentials
- Use production keys in development

## API Endpoints Used

### Backend Functions

1. **`create-razorpay-order`**
   - Endpoint: `https://your-project.supabase.co/functions/v1/create-razorpay-order`
   - Method: `POST`
   - Body: `{ pixels, totalAmount, imageUrl?, linkUrl?, altText? }`
   - Returns: `{ order, user, key_id }`

2. **`verify-razorpay-payment`**
   - Endpoint: `https://your-project.supabase.co/functions/v1/verify-razorpay-payment`
   - Method: `POST`
   - Body: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, ... }`
   - Returns: `{ success, pixel_id, ... }`

### External APIs

- **Razorpay API**: `https://api.razorpay.com/v1/orders`
- **Razorpay Checkout**: `https://checkout.razorpay.com/v1/checkout.js`

## References

- [Razorpay Documentation](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Test Credentials](https://razorpay.com/docs/payments/payment-gateway/test-mode/)
