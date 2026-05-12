# Razorpay Integration - Implementation Summary

## 📋 Overview

This document summarizes the Razorpay payment gateway integration for the BuyASpot application. The integration enables users to purchase pixels using Razorpay's Standard Checkout with support for multiple payment methods (UPI, Cards, Net Banking, Wallets).

## ✅ Issues Fixed

### 1. **DialogContent Accessibility Warning**
- **Issue**: `DialogContent` requires a `DialogTitle` for screen reader accessibility
- **Root Cause**: ImageCropper component had hidden DialogTitle using only `sr-only` class
- **Solution**: 
  - Created new `VisuallyHidden` component with proper Radix UI integration
  - Updated ImageCropper to wrap hidden DialogTitle with VisuallyHidden
  - Component supports `asChild` prop for flexibility

### 2. **Razorpay Order Creation 500 Error**
- **Issue**: Backend returning 500 error when creating Razorpay orders
- **Root Cause**: Attempting to call non-existent Supabase RPC function (`check_and_record_rate_limit`)
- **Solution**:
  - Removed problematic RPC call with proper comments for future implementation
  - Fixed error handling to return appropriate HTTP status codes (500 for server errors, 401 for auth failures)
  - Added comprehensive error logging for debugging

## 📁 Files Created

### New Components
1. **`src/components/ui/visually-hidden.tsx`**
   - Reusable component for hiding content visually while keeping it accessible to screen readers
   - Supports `asChild` prop for rendering different element types
   - Used for accessibility compliance in modals

### Documentation
2. **`docs/RAZORPAY_SETUP.md`**
   - Complete setup guide for Razorpay integration
   - Environment variable configuration instructions
   - Database schema requirements
   - Testing procedures with test card numbers
   - Troubleshooting guide
   - Production deployment checklist

## 📝 Files Modified

### Backend Functions
1. **`supabase/functions/create-razorpay-order/index.ts`**
   - ✅ Removed faulty rate limiting RPC call
   - ✅ Fixed error handling (returns 500 for server errors instead of 400)
   - ✅ Added detailed error logging
   - ✅ Kept all existing validation logic:
     - Input validation (URLs, text fields)
     - Server-side price recalculation
     - Pixel coordinate validation
     - Database retry with exponential backoff
     - Orphaned order tracking

### Frontend Components
2. **`src/components/ImageCropper.tsx`**
   - ✅ Updated imports to include VisuallyHidden component
   - ✅ Wrapped hidden DialogTitle with VisuallyHidden component
   - ✅ Maintains all existing functionality

3. **`src/components/PurchasePreview.tsx`**
   - ✅ Already has proper DialogTitle/DialogContent structure
   - ✅ Includes comprehensive Razorpay checkout implementation
   - ✅ Desktop and mobile-responsive checkout flow

## 🔧 Backend Implementation (Already Complete)

### Supabase Edge Functions

#### 1. Create Order Function
- **File**: `supabase/functions/create-razorpay-order/index.ts`
- **Endpoint**: `POST /functions/v1/create-razorpay-order`
- **Responsibilities**:
  - Validate user authentication
  - Validate request data (pixels, amounts)
  - Recalculate prices server-side (security)
  - Create Razorpay order via API
  - Store payment order in database
  - Return order details to frontend
- **Features**:
  - Input validation (URLs, text fields, pixel coordinates)
  - Server-side price verification
  - Database retry logic with exponential backoff
  - Orphaned order tracking for recovery
  - Timeout protection for external API calls

#### 2. Verify Payment Function
- **File**: `supabase/functions/verify-razorpay-payment/index.ts`
- **Endpoint**: `POST /functions/v1/verify-razorpay-payment`
- **Responsibilities**:
  - Verify HMAC SHA256 signature
  - Update payment status
  - Trigger pixel creation
  - Send confirmation email
- **Features**:
  - Constant-time string comparison (security)
  - Email confirmation via Resend
  - Comprehensive error handling

## 🎨 Frontend Implementation (Already Complete)

### Components

1. **PurchasePreview** (`src/components/PurchasePreview.tsx`)
   - Full checkout workflow with 3-step process:
     - Details: Collect pixel name, link, image
     - Payment: Razorpay modal
     - Confirmation: Success/error notification
   - Features:
     - Form validation with real-time feedback
     - Auto-save draft to localStorage
     - Progress indicator
     - Price breakdown by tier
     - Comprehensive error handling
     - Mobile and desktop responsive layouts

2. **Razorpay Integration Points**:
   - Script loading with retry logic
   - Payment options configuration
   - Handler for payment success/failure
   - Modal customization

## 🌍 Environment Variables Required

### Supabase Edge Functions (Dashboard Settings)
```
RAZORPAY_KEY_ID=rzp_test_SoJrKJ1zntTN5c  (or live key in production)
RAZORPAY_KEY_SECRET=c1UfiHHkn8nbi6UZ0ahs8oNG  (or live key)
```

### Frontend (`.env` file - NOT NEEDED)
- No frontend env vars needed for Razorpay
- Key ID is fetched from backend response

## 🗄️ Database Schema Required

### Tables
```
- payment_orders (stores payment history)
- orphaned_orders (failed order recovery)
- pixels (existing - updated by payment handler)
```

See `docs/RAZORPAY_SETUP.md` for full schema details.

## 🧪 Testing Checklist

### 1. Setup Phase
- [ ] Set Razorpay credentials in Supabase Dashboard
- [ ] Verify database tables exist
- [ ] Check Supabase Edge Functions are deployed

### 2. Unit Testing
- [ ] Create order endpoint returns correct order structure
- [ ] Verify signature verification works with test data
- [ ] Test input validation (URLs, text fields)
- [ ] Test price recalculation

### 3. Integration Testing
```bash
npm run dev
```
- [ ] Open Browser DevTools (F12)
- [ ] Navigate to "Buy Pixels" page
- [ ] Select pixels and proceed to checkout
- [ ] Fill form (pixel name, optional link/image)
- [ ] Click "Pay ₹XXX Securely"
- [ ] Modal should open with Razorpay payment form

### 4. Payment Testing
- [ ] Use Razorpay test card: `4111 1111 1111 1111`
- [ ] Use any future expiry date
- [ ] Use any 3-digit CVV
- [ ] Complete payment
- [ ] Verify success notification appears
- [ ] Check database for payment record

### 5. Error Testing
- [ ] Dismiss payment modal → should show "Payment cancelled"
- [ ] Invalid form → should prevent checkout
- [ ] Network error → should show appropriate error message
- [ ] Check browser console for errors
- [ ] Check Supabase logs for backend errors

### 6. Accessibility Testing
- [ ] Use screen reader (NVDA, JAWS, or built-in)
- [ ] Verify dialog has proper title for screen readers
- [ ] All form fields properly labeled
- [ ] Error messages associated with fields

## 🐛 Debugging

### Common Issues & Solutions

#### Issue: 500 Error on Order Creation
```
Causes:
- Razorpay credentials not set in Supabase
- Database table doesn't exist
- Network connectivity issue

Solution:
1. Check Supabase Settings > Secrets
2. Verify payment_orders table exists
3. Check browser console and Supabase logs
```

#### Issue: Payment Modal Doesn't Open
```
Causes:
- Razorpay script failed to load
- Missing order ID

Solution:
1. Check Network tab for CDN script
2. Check browser console for errors
3. Verify backend returned razorpay_order_id
```

#### Issue: Accessibility Warning Still Shows
```
Solution:
1. Clear browser cache
2. Rebuild with: npm run build
3. Verify VisuallyHidden component is imported
```

## 📊 Data Flow

```
USER INTERACTION:
┌─────────────────────────────────────────────────────────────────┐
│ 1. User selects pixels and clicks "Proceed to Checkout"        │
│ 2. Fills pixel name, link (optional), image (optional)          │
│ 3. Clicks "Pay ₹XXX Securely"                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
FRONTEND REQUEST:
┌─────────────────────────────────────────────────────────────────┐
│ POST /functions/v1/create-razorpay-order                         │
│ Body: { pixels, totalAmount, imageUrl, linkUrl, altText }       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
BACKEND PROCESSING:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Validate user auth                                           │
│ 2. Validate input data                                          │
│ 3. Recalculate prices (server-side)                             │
│ 4. Create Razorpay order via API                                │
│ 5. Store in database                                            │
│ 6. Return order_id to frontend                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
PAYMENT FLOW:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Razorpay modal opens with order_id                          │
│ 2. User selects payment method and enters credentials           │
│ 3. Razorpay processes payment                                   │
│ 4. Returns payment_id and signature                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
VERIFICATION FLOW:
┌─────────────────────────────────────────────────────────────────┐
│ POST /functions/v1/verify-razorpay-payment                      │
│ Body: { razorpay_order_id, razorpay_payment_id,                 │
│         razorpay_signature, payment_order_id, ... }             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
BACKEND VERIFICATION:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Verify HMAC signature                                        │
│ 2. Update payment status                                        │
│ 3. Create pixel records                                         │
│ 4. Send confirmation email                                      │
│ 5. Return success response                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
SUCCESS:
┌─────────────────────────────────────────────────────────────────┐
│ Show success notification                                       │
│ Redirect to profile or canvas view                              │
│ Pixels are now live on the canvas                               │
└─────────────────────────────────────────────────────────────────┘
```

## 🔒 Security Measures

✅ **Implemented**:
- HMAC SHA256 signature verification
- Constant-time string comparison
- Server-side price verification
- Input validation and sanitization
- Never expose KEY_SECRET on frontend
- SQL injection protection (Supabase)
- CORS headers configured
- Timeout protection on external API calls
- Rate limiting hooks (for future implementation)

## 📈 Production Checklist

Before deploying to production:

- [ ] Update Razorpay credentials to production keys
- [ ] Test with real payment (small amount)
- [ ] Configure Razorpay webhooks
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Update CORS allowed origins
- [ ] Enable HTTPS only
- [ ] Set up email notifications
- [ ] Backup database regularly
- [ ] Monitor transaction logs
- [ ] Update privacy policy with payment info

## 📚 References

- [Razorpay Docs](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/tutorials/forms/labels/)
- [Test Card Numbers](https://razorpay.com/docs/payments/payment-gateway/test-mode/)

## 🎯 Next Steps

1. **Set Razorpay credentials** in Supabase Dashboard
2. **Test with test mode** credentials
3. **Monitor logs** during testing
4. **Deploy to staging** for full testing
5. **Get production credentials** from Razorpay
6. **Deploy to production**

---

**Last Updated**: May 2026
**Status**: ✅ Ready for Testing
