# 🚀 Direct Binary Upload Architecture - Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Frontend      │────▶│  Google Apps Script  │────▶│  Google Drive API   │
│   (Browser)     │     │  (getUploadUrls)     │     │  (Resumable Upload) │
│                 │◀────│                      │◀────│  (Direct PUT)       │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
        │                        │
        │                        ▼
        │                 ┌─────────────────────┐
        └────────────────▶│  Google Sheets      │
          (logOrder)      │  (Order Metadata)   │
                          └─────────────────────┘
```

## Two-Step Upload Flow

### Step 1: Get Upload URLs
```
Frontend → GAS (getUploadUrls) → Creates Drive folder → Returns upload URLs
```

### Step 2: Direct Upload
```
Frontend → Google Drive API (PUT) → Files stored directly in Drive
```

### Step 3: Log Order
```
Frontend → GAS (logOrder) → Appends metadata to Google Sheets
```

---

## ⚠️ CRITICAL: Enable Drive API

The new architecture requires the **Google Drive API** to be enabled.

### Method 1: Via Apps Script Editor (Required)

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1La55rhdiX3vI_OAIk_BVMkQ7x-rc24sq/edit
2. Click **Extensions** → **Apps Script**
3. In the left sidebar, click **Services** (or **Resources** → **Advanced Google Services**)
4. Find **Drive API** in the list
5. Click **Enable**
6. Click **OK** to confirm

### Method 2: Via Google Cloud Console (Also Required)

1. Go to: https://console.cloud.google.com/apis/library/drive.googleapis.com
2. Select your project (or create new one)
3. Click **Enable**

### Verify Drive API is Enabled

In Apps Script editor, run this test function:
```javascript
function testDriveAPI() {
  try {
    const folder = DriveApp.getFolderById('1LH5p6ZpsCy-dxNlNky_6yS0cpZU1CZyR');
    Logger.log('Drive API enabled! Folder: ' + folder.getName());
  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
  }
}
```

---

## 📋 Deployment Checklist

### Phase 1: Update Google Apps Script

1. **Open Apps Script Editor**
   - Extensions → Apps Script from your Google Sheet

2. **Delete existing code** and paste new `gas/backend.gs`

3. **Copy `gas/appsscript.json`** content:
   - Click on the manifest file (appsscript.json) in left sidebar
   - If it doesn't exist, create it
   - Paste the content from `gas/appsscript.json`

4. **Verify configuration** at top of backend.gs:
   ```javascript
   const TARGET_FOLDER_ID = "1LH5p6ZpsCy-dxNlNky_6yS0cpZU1CZyR";
   const SPREADSHEET_ID = "1La55rhdiX3vI_OAIk_BVMkQ7x-rc24sq";
   ```

5. **Save the project** (Ctrl+S)

6. **Run testConfiguration()** to verify:
   - Select function from dropdown
   - Click Run (▶️)
   - Check Execution log for ✓ marks

7. **Deploy as Web App**:
   - Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy
   - **Copy the Web App URL**

### Phase 2: Update Frontend

1. **Open `src/js/app.js`**

2. **Update line 22** with your Web App URL:
   ```javascript
   const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```

3. **Rebuild the site**:
   ```bash
   npm run build
   ```

### Phase 3: Test the Upload Flow

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Open http://localhost:8080**

3. **Fill the form** with test data:
   - Name, Email, Mobile (+91...)
   - Add 1-2 designs with images
   - Check IP Declaration

4. **Submit and monitor**:
   - Check browser console (F12) for logs
   - Watch loading states:
     - "Requesting secure upload tunnel..."
     - "Uploading high-resolution files..."
     - "Finalizing order..."

5. **Verify results**:
   - Check Google Drive folder for new order folder with images
   - Check Google Sheet for new row with order data

---

## 🔧 Important Notes

### CORS Considerations

Direct uploads to Google Drive from browser may encounter CORS issues. The current implementation attempts direct PUT requests, but if this fails:

**Option A: Use a Proxy Server**
Deploy a simple Cloud Function or serverless function to proxy uploads.

**Option B: Fallback to Base64 for Small Files**
Modify `uploadToDriveUrl_()` to fallback to Base64 for files under 1MB.

**Option C: Use Google Cloud Storage**
Set up a GCS bucket with signed URLs for direct browser uploads.

### File Size Limits

| Method | Max File Size | Max Total |
|--------|--------------|-----------|
| Direct Upload (new) | 50MB | 200MB |
| Base64 (old) | 4MB | 4MB |

### Upload Timeout

Default timeout is set to **10 minutes** per file. For larger files, increase:
```javascript
const UPLOAD_TIMEOUT = 10 * 60 * 1000; // milliseconds
```

### OAuth Scopes

The `appsscript.json` includes these scopes:
- `drive` - Full Drive access
- `drive.file` - Access to files created by app
- `spreadsheets` - Sheet access
- `script.external_request` - URLFetch to Drive API
- `script.scriptapp` - Script management
- `userinfo.email` - User identification

---

## 🐛 Troubleshooting

### "Drive API not enabled" Error

**Solution:**
1. Enable Drive API via Apps Script (Services panel)
2. Enable Drive API via Google Cloud Console
3. Wait 2-3 minutes for propagation
4. Redeploy the Web App

### CORS Error on Upload

**Error:** `Access to fetch at 'googleapis.com' has been blocked by CORS policy`

**Solutions:**
1. **Temporary workaround:** Use development mode (files simulate upload)
2. **Production fix:** Set up a Cloud Function proxy
3. **Alternative:** Use signed URLs with Google Cloud Storage

### Upload Returns 401/403

**Cause:** OAuth token expired or insufficient permissions

**Solution:**
1. Redeploy the Web App
2. Re-authorize when prompted
3. Verify OAuth scopes in appsscript.json

### Files Upload But Sheet Doesn't Update

**Check:**
1. Browser console for errors in Step 3 (logOrder)
2. GAS Execution log for errors
3. Verify SPREADSHEET_ID is correct

---

## 📊 Performance Expectations

| File Size | Upload Time (approx) |
|-----------|---------------------|
| 1MB | 1-3 seconds |
| 10MB | 10-30 seconds |
| 50MB | 1-3 minutes |

*Times vary based on internet connection speed*

---

## 🔒 Security Notes

1. **Upload URLs are single-use** - Each URL can only be used once
2. **Upload URLs expire** - Typically after 1 hour
3. **Folder permissions** - Order folders inherit parent folder permissions
4. **No Base64 in transit** - Files upload directly, no encoding overhead

---

## 📞 Support

If you encounter issues:

1. Check **GAS Execution Log** (View → Execution log)
2. Check **Browser Console** (F12)
3. Verify **Drive API is enabled** in both places
4. Test with small files first (< 1MB)

---

**Last Updated:** March 29, 2026  
**Version:** 2.0.0 (Direct Binary Upload)
