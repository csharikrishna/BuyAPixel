# 🧪 Feature Testing Guide

## Quick Start - Testing the New Implementation

### 1. File Upload & Compression Testing

**Scenario: Upload Large Image**
1. Navigate to BuyPixels page
2. Select some pixels
3. In purchase preview, upload an image > 500KB
4. Expected: Auto-compression with success toast showing size reduction
5. Verify: "Compressed! XXkb → YYkb (ZZkb saved)"

**Scenario: Upload Spoofed File**
1. Rename a PDF file to have `.jpg` extension
2. Try to upload it
3. Expected: Error message "Invalid file format"
4. Reason: Magic byte validation detected it's not actually a JPG

**Scenario: Upload Unsupported Format**
1. Try to upload an SVG file
2. Expected: Error "SVG files are not supported for security reasons"
3. Reason: XSS prevention - SVGs can contain malicious scripts

### 2. Pricing Tier Testing

**Scenario: Check Pricing Display**
1. Go to BuyPixels page
2. Look at right sidebar in idle mode
3. Verify pricing zones show:
   - Gold Center: ₹499
   - Premium: ₹299
   - Economy: ₹99
4. Expected: New prices correctly displayed

**Scenario: View Price Breakdown**
1. Select 5 pixels:
   - 2 from center (gold zone)
   - 2 from middle (premium zone)
   - 1 from edge (economy zone)
2. Expected breakdown:
   - Gold: 2 × ₹499 = ₹998
   - Premium: 2 × ₹299 = ₹598
   - Economy: 1 × ₹99 = ₹99
   - Total: ₹1,695

**Scenario: Ad Tier Preview**
1. During checkout, observe AdTierPreview component
2. Select mix of pixels to get different total prices:
   - < ₹99: Should show nothing (select invalid)
   - ₹99-₹298: Economy tier (3 rows, 1s ad)
   - ₹299-₹498: Premium tier (5 rows, 3s ad)
   - ≥ ₹499: Gold tier (full section, 6s ad)
3. Expected: Ad preview plays countdown timer animation

### 3. Payment Notification Testing

**Scenario: Successful Payment**
1. Complete full checkout flow
2. Select valid test payment method in Razorpay
3. Expected notification:
   - ✅ "Purchase Successful!" with green banner
   - Shows pixel count, amount, and "Live ✨" status
   - Badge with congratulations message
   - Buttons: "View in Profile" & "Continue"

**Scenario: Failed Payment**
1. Select "Card Declined" or cancel payment in Razorpay
2. Expected notification:
   - ❌ "Payment Failed" with red banner
   - Shows error details
   - Lists troubleshooting tips
   - Button: "Try Again"

**Scenario: Processing State**
1. During order creation/verification
2. Expected notification:
   - ⏳ Loading spinner
   - "Processing Payment" message
   - "Please wait..." subtext

### 4. Form Validation Testing

**Scenario: Pixel Name Validation**
1. Try to submit empty name
2. Expected: "Pixel name is required" error
3. Enter 1 character
4. Expected: "Pixel name must be at least 2 characters" error
5. Enter 100+ characters
6. Expected: "Pixel name must be less than 100 characters" error
7. Enter "spam"
8. Expected: "Please choose a different name" error
9. Submit valid name
10. Expected: No error, form progress increases

**Scenario: URL Validation**
1. Enter "www.example.com" (missing protocol)
2. Expected: "URL must start with http:// or https://"
3. Enter "ftp://example.com"
4. Expected: "Only HTTP and HTTPS protocols are allowed"
5. Enter "http://localhost:3000"
6. Expected: "Localhost URLs are not allowed" (in production)
7. Enter valid "https://example.com"
8. Expected: No error

**Scenario: Mobile Keyboard Stay Open**
1. On mobile/tablet, focus on Pixel Name field
2. Type characters
3. Verify: Keyboard stays open while typing
4. Previous fix: Removed conditional DOM rendering that caused layout shift

### 5. Multi-Pixel Single Upload Testing

**Scenario: Upload Image to Multiple Pixels**
1. Select 5 different pixels (across different zones)
2. Upload single image in purchase preview
3. Complete payment
4. Navigate to profile
5. Expected: All 5 pixels show same image
6. Verify: Image URL is identical for all purchased pixels

**Scenario: Verify Image Persistence**
1. After purchase, view pixels on main canvas
2. Hover over purchased pixels
3. Expected: Image tooltip shows correctly
4. Click pixel
5. Expected: Link opens to specified URL

### 6. Security & Edge Cases

**Scenario: Duplicate Payment Prevention**
1. During verification, simulate network retry
2. Use same order ID for multiple verification attempts
3. Expected: Only first verification succeeds
4. Second attempt: "Payment already processed" or similar
5. Verify database: Only one pixel purchase record created

**Scenario: Rate Limiting**
1. Send 6 order creation requests within 1 minute
2. Expected: 6th request returns 429 Too Many Requests
3. Wait 1 minute
4. Expected: Can create order again

**Scenario: Tampered Payment Signature**
1. Intercept payment verification request
2. Modify razorpay_signature value
3. Expected: Verification fails with "Invalid signature"
4. Verify database: No pixels created

### 7. Browser Compatibility

**Test on:**
- ✅ Chrome/Edge (Latest)
- ✅ Firefox (Latest)
- ✅ Safari (Latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

**Expected Features:**
- Image compression works (OffscreenCanvas > Canvas API)
- File validation works consistently
- Payment flow completes
- Notifications display correctly
- Mobile layout responsive

### 8. Performance Testing

**Scenario: Large File Compression**
1. Upload 50MB video file
2. System should:
   - Compress in < 5 seconds
   - Show progress indication
   - React remains responsive
3. Expected: File reduced to ~500KB

**Scenario: Multiple Simultaneous Uploads**
1. Attempt 3 simultaneous image uploads
2. Expected: All process without interference
3. Verify: No file corruption
4. Check: All URLs are unique

**Scenario: Grid Rendering**
1. Purchase and view 100+ pixels on canvas
2. Expected: Grid renders smoothly
3. Verify: No lag when zooming/panning
4. Check: Performance metrics < 16ms per frame

### 9. Accessibility Testing

**Screen Reader:**
1. Use VoiceOver (Mac) or NVDA (Windows)
2. Navigate checkout form
3. Expected: All fields announced with labels
4. Verify: Error messages are read aloud
5. Check: Form completion progress is announced

**Keyboard Navigation:**
1. On checkout, use only Tab key
2. Expected: Focus visible on all controls
3. Verify: Can submit form with Enter
4. Check: Can cancel with ESC

**Color Contrast:**
1. Use Color Contrast Analyzer
2. Check all text against backgrounds
3. Expected: WCAG AA compliance (4.5:1 ratio)
4. Verify: Error messages in red + icon

### 10. Data Integrity

**Scenario: Payment Metadata**
1. Complete purchase with specific details:
   - Pixel Name: "Test Brand Summer 2026"
   - Link: "https://example.com/promo"
   - Image: Custom uploaded PNG
2. Verify database:
   - alt_text matches entered name
   - link_url matches entered URL
   - image_url points to uploaded file
   - owner_id is current user
   - created_at is current timestamp

**Scenario: Pixel Grid State**
1. Purchase pixels
2. Refresh page
3. Expected: Pixels still visible on grid
4. Verify: Data persisted to database
5. Check: Same image shown after reload

---

## 📊 Test Results Tracking

| Test Case | Status | Notes | Date |
|-----------|--------|-------|------|
| Large file compression | ⬜ | | |
| Spoofed file rejection | ⬜ | | |
| Pricing display | ⬜ | | |
| Ad tier preview | ⬜ | | |
| Payment success | ⬜ | | |
| Payment failure | ⬜ | | |
| Form validation | ⬜ | | |
| Mobile keyboard | ⬜ | | |
| Multi-pixel upload | ⬜ | | |
| Duplicate prevention | ⬜ | | |
| Rate limiting | ⬜ | | |
| Signature tampering | ⬜ | | |

---

## 🔍 Debugging Tips

### If file upload fails:
```javascript
// Check browser console
console.log('File size:', file.size);
console.log('File type:', file.type);
console.log('File name:', file.name);

// Test magic bytes
const buffer = await file.arrayBuffer();
const view = new Uint8Array(buffer);
console.log('First bytes:', view.slice(0, 4));
```

### If payment verification fails:
```javascript
// Check function logs in Supabase
// Edge Functions > verify-razorpay-payment > Logs

// Verify signature manually
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', webhookSecret);
hmac.update(orderID + '|' + paymentID);
const signature = hmac.digest('hex');
console.log('Expected:', signature);
console.log('Received:', razorpaySignature);
```

### If form validation seems wrong:
```javascript
// Check validation logic in PurchasePreview
// Search for validatePixelName or validateUrl
// Add console.logs to debug specific cases
console.log('Form validation:', validateForm());
console.log('Name error:', pixelNameError);
console.log('URL error:', linkUrlError);
```

---

## 🚀 Testing Checklist Before Deploy

- [ ] All 10 scenarios tested
- [ ] No console errors
- [ ] No performance warnings
- [ ] Mobile tested on actual device
- [ ] Payment test transaction successful
- [ ] File compression working
- [ ] Notifications showing correctly
- [ ] Database records verified
- [ ] Security tests passed
- [ ] Accessibility checked

---

**Last Updated**: April 8, 2026  
**Test Suite**: Complete  
**Status**: Ready for Testing
