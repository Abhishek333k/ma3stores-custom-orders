# 🚀 Complete Deployment Checklist

**Custom Design Submission Portal - Step-by-Step Guide**

Follow these steps IN ORDER to deploy your design submission portal.

---

## ✅ PHASE 1: Google Sheets Setup (10 minutes)

### Step 1.1: Upload Database Template to Google Drive

1. Go to your Google Drive: https://drive.google.com
2. Navigate to the folder where you want to store the database
3. Upload the file: `database-templates/Custom_Orders_Main.xlsx`
4. **Right-click** the uploaded file → **Open with** → **Google Sheets**
5. This converts it to a Google Sheet format

### Step 1.2: Verify Sheet Structure

After opening in Google Sheets, verify:

**Orders Sheet:**
- [ ] Sheet tab named "Orders"
- [ ] Row 1 has headers: `Timestamp | Order ID | Name | Email | Mobile Number | Order Status | Payment Status | Design Specs (Bulleted) | Folder URL | Legal Consent`
- [ ] Cell F2 has a dropdown (Order Status options)
- [ ] Cell G2 has a dropdown (Payment Status options)

**Config Sheet:**
- [ ] Sheet tab named "Config"
- [ ] Row 1: `Key | Value`
- [ ] Cell A2: `AcceptingOrders`
- [ ] Cell B2: `TRUE` (should show as checkbox or TRUE)

### Step 1.3: Copy Spreadsheet ID (Already Done!)

Your Spreadsheet ID is: `1La55rhdiX3vI_OAIk_BVMkQ7x-rc24sq`

✅ This is already configured in `gas/backend.gs`

---

## ✅ PHASE 2: Google Apps Script Deployment (15 minutes)

### Step 2.1: Open Apps Script Editor

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1La55rhdiX3vI_OAIk_BVMkQ7x-rc24sq/edit
2. Click **Extensions** → **Apps Script**

### Step 2.2: Copy Backend Code

1. Delete any existing code in the editor (like `function myFunction() {...}`)
2. Open the file: `gas/backend.gs` from your project
3. **Copy ALL the code** (Ctrl+A, Ctrl+C)
4. **Paste** into the Apps Script editor (Ctrl+V)

### Step 2.3: Save the Project

1. Click the **Save** icon (💾) or press Ctrl+S
2. Name the project: `Design Portal Backend`
3. Click **Save**

### Step 2.4: Deploy as Web App

1. Click the blue **Deploy** button (top right)
2. Select **New deployment**
3. Click the **gear icon** ⚙️ next to "Select type"
4. Choose **Web app**

### Step 2.5: Configure Deployment Settings

Fill in:
- **Description**: `Design Portal API v1`
- **Execute as**: `Me` (your email address)
- **Who has access**: `Anyone` ⚠️ (CRITICAL - must be "Anyone")

### Step 2.6: Authorize Access

1. Click **Deploy**
2. Google will ask for authorization:
   - Click **Authorize access**
   - Select your Google account
   - Click **Advanced** → **Go to Design Portal Backend (unsafe)** (it's safe, this is normal)
   - Click **Allow**

### Step 2.7: Copy Web App URL

After deployment, you'll see:
```
Web app URL:
https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXX/exec
```

**COPY THIS URL** - You'll need it in the next phase!

### Step 2.8: Test Configuration (Optional)

1. In Apps Script editor, select `testConfiguration` from the function dropdown (top)
2. Click **Run** (▶️)
3. Check the **Execution log** (View → Execution log)
4. You should see all ✓ checks passing

---

## ✅ PHASE 3: Frontend Configuration (5 minutes)

### Step 3.1: Update Frontend with Web App URL

1. Open: `src/js/app.js`
2. Find line 22 (approximately):
   ```javascript
   const GAS_WEB_APP_URL = 'YOUR_GAS_WEB_APP_URL_HERE';
   ```
3. Replace with your actual URL:
   ```javascript
   const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```

### Step 3.2: Verify Dev Server

Your dev server should already be running at: http://localhost:8080

If not, run:
```bash
npm run dev
```

### Step 3.3: Test Locally

1. Open: http://localhost:8080
2. You should see the form (no "at capacity" message if Config sheet B2 = TRUE)
3. Fill in the form with test data
4. Submit and check:
   - Browser console for any errors
   - Your Google Sheet for new row
   - Your Drive folder for new order folder with images

---

## ✅ PHASE 4: Build & Deploy to GitHub Pages (10 minutes)

### Step 4.1: Build for Production

In your terminal:
```bash
npm run build
```

This creates the `_site/` folder with static files.

### Step 4.2: Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - Design Submission Portal"
```

### Step 4.3: Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `custom-design-portal` (or your choice)
3. Visibility: **Public** (required for free GitHub Pages)
4. **Don't** initialize with README
5. Click **Create repository**

### Step 4.4: Push to GitHub

```bash
# Replace with your GitHub username and repo name
git remote add origin https://github.com/YOUR_USERNAME/custom-design-portal.git
git branch -M main
git push -u origin main
```

### Step 4.5: Enable GitHub Pages

**Option A: Using GitHub Actions (Recommended)**

1. Create folder: `.github/workflows/`
2. Create file: `.github/workflows/deploy.yml` with this content:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./_site
```

3. Commit and push:
```bash
git add .
git commit -m "Add GitHub Actions deployment"
git push
```

4. The action will run automatically and deploy your site

**Option B: Manual Deployment**

```bash
npm run build
git checkout --orphan gh-pages
git reset --hard
cp -r _site/* .
git add .
git commit -m "Deploy to GitHub Pages"
git push -f origin gh-pages
```

### Step 4.6: Configure GitHub Pages Settings

1. Go to your repository **Settings** → **Pages**
2. Source: Select **GitHub Actions** (if using Option A) or **gh-pages branch** (if using Option B)
3. Your site will be live at: `https://YOUR_USERNAME.github.io/custom-design-portal/`

---

## ✅ PHASE 5: Final Verification (5 minutes)

### Step 5.1: Test Live Site

1. Open your GitHub Pages URL
2. Verify the form loads without errors
3. Check browser console (F12) for any errors

### Step 5.2: Test Full Submission

1. Fill out the form with real test data:
   - Name: Your name
   - Email: Your email
   - Mobile: Your phone
   - Add 1-2 designs with images
   - Check the IP Declaration
2. Submit the form
3. Verify:
   - [ ] Success message appears with Order ID
   - [ ] New row appears in Google Sheet
   - [ ] New folder created in Drive with images

### Step 5.3: Test Order Gate

1. In Google Sheet, go to Config sheet
2. Change B2 from `TRUE` to `FALSE`
3. Refresh your website
4. You should see the "Currently at Capacity" modal
5. Change B2 back to `TRUE`
6. Refresh - form should be visible again

---

## 🔧 Troubleshooting

### "Currently at Capacity" appears even with TRUE

- Check Config sheet: B2 must be boolean `TRUE`, not text `"TRUE"`
- Refresh the Google Sheet
- Wait 1-2 minutes for changes to propagate

### CORS errors in browser console

- Verify GAS Web App is deployed with "Anyone" access
- Check Web App URL is correct in `app.js`
- Redeploy the GAS if needed

### Images not appearing in Drive

- Check `TARGET_FOLDER_ID` is correct
- Verify folder sharing allows your script to write
- Check file sizes are under 4MB total

### Data not appearing in Sheet

- Verify `SPREADSHEET_ID` is correct
- Check sheet is named exactly "Orders" (case-sensitive)
- Run `testConfiguration()` in Apps Script to verify access

### Form submission timeout

- Images are too large - compress them before upload
- Reduce MAX_TOTAL_FILE_SIZE in both frontend and backend
- Check internet connection speed

---

## 📋 Quick Reference

### Your Configuration (Already Set)

| Setting | Value |
|---------|-------|
| Spreadsheet ID | `1La55rhdiX3vI_OAIk_BVMkQ7x-rc24sq` |
| Drive Folder ID | `1LH5p6ZpsCy-dxNlNky_6yS0cpZU1CZyR` |
| Configured Files | `gas/backend.gs` ✅ |

### Files You Need to Update

| File | Action | Status |
|------|--------|--------|
| `src/js/app.js` | Add GAS Web App URL | ⏳ Pending |

### Commands Reference

```bash
# Development
npm run dev          # Start local dev server
npm run build        # Build for production

# Git
git add .
git commit -m "message"
git push
```

---

## 🎯 What to Do Right Now (Priority Order)

1. **RIGHT NOW**: Complete Phase 1 & 2 (Google Sheets + Apps Script)
2. **THEN**: Update `src/js/app.js` with Web App URL
3. **THEN**: Test locally at http://localhost:8080
4. **THEN**: Deploy to GitHub Pages (Phase 4)
5. **FINALLY**: Test the live site

---

## 📞 Support

If you get stuck:
1. Check the Execution log in Apps Script (View → Execution log)
2. Check browser console (F12) for frontend errors
3. Verify all IDs are correctly copied (no extra spaces)

**Estimated Total Time: 45 minutes**

Good luck! 🚀
