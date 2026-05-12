# 🚀 Quick Start: Razorpay Integration

## Immediate Setup (5 minutes)

### Step 1: Set Razorpay Credentials
Go to **Supabase Dashboard > Settings > Secrets** and add:


### Step 2: Deploy Edge Functions
```bash
# The functions are already in the codebase
# They will auto-deploy when you push to production or use:
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

### Step 3: Test Locally
```bash
npm run dev
```

1. Go to **Buy Pixels** page
2. Select pixels and click **Proceed to Checkout**
3. Fill form (pixel name, optional link/image)
4. Click **Pay ₹XXX Securely**
5. Use test card: **4111 1111 1111 1111** (any expiry, any CVV)

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/create-razorpay-order/index.ts` | Removed faulty rate limiting, fixed error handling |
| `src/components/ImageCropper.tsx` | Fixed accessibility issue with DialogTitle |
| `src/components/ui/visually-hidden.tsx` | ✨ NEW - Accessibility component |

## Documentation

- 📖 [Full Setup Guide](./RAZORPAY_SETUP.md)
- 📋 [Implementation Details](./RAZORPAY_IMPLEMENTATION_SUMMARY.md)

## Issues Fixed

✅ **DialogContent accessibility warning** - Fixed with VisuallyHidden component  
✅ **500 error on order creation** - Removed broken rate limiting call  
✅ **Improved error handling** - Better status codes and logging

## Troubleshooting

**Payment modal doesn't open?**
- Check browser console (F12) for errors
- Check Supabase logs
- Verify backend returned `razorpay_order_id`

**500 error?**
- Verify Razorpay secrets are set in Supabase
- Check that `payment_orders` table exists
- Check Supabase Edge Functions logs

**Payment verification fails?**
- Verify `RAZORPAY_KEY_SECRET` is correct
- Check backend logs for signature mismatch
- Ensure all payment data fields are present

---

**Status**: ✅ Ready to Test

For complete details, see [RAZORPAY_SETUP.md](./RAZORPAY_SETUP.md)
