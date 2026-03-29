# Custom Design Submission Portal

A professional design submission portal for custom fashion orders. Built with Eleventy (11ty) for the frontend and Google Apps Script as a serverless backend connected to Google Sheets and Google Drive.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📋 Prerequisites

- **Node.js** v16.0.0 or higher
- **Google Account** with access to Google Sheets and Google Drive
- **Git** (for deployment to GitHub Pages)

---

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Eleventy      │────▶│  Google Apps Script  │────▶│  Google Sheets      │
│   Frontend      │     │  (Serverless API)    │     │  (Orders Database)  │
│   (HTML/CSS/JS) │◀────│  doGet / doPost      │◀────│  (Config & Data)    │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
                               │
                               ▼
                        ┌─────────────────────┐
                        │  Google Drive       │
                        │  (Design Images)    │
                        └─────────────────────┘
```

---

## 📁 Project Structure

```
custom-design-portal/
├── gas/
│   └── backend.gs          # Google Apps Script backend
├── src/
│   ├── _includes/
│   │   └── base.njk        # Base layout template
│   ├── css/
│   │   └── style.css       # Stylesheet
│   ├── js/
│   │   └── app.js          # Frontend JavaScript
│   └── index.njk           # Main page template
├── .eleventy.js            # Eleventy configuration
├── package.json            # Node.js dependencies
├── README.md               # This file
└── _site/                  # Generated static files (after build)
```

---

## 🔧 Setup Instructions

### Step 1: Google Sheet Setup

1. **Create a new Google Sheet** at [sheets.google.com](https://sheets.google.com)

2. **Rename the default sheet** to `Orders`

3. **Create the "Orders" sheet headers** (Row 1):
   ```
   A1: Timestamp
   B1: Order ID
   C1: Name
   D1: Email
   E1: Order Status
   F1: Payment Status
   G1: Design Specs (Bulleted)
   H1: Folder URL
   I1: Legal Consent
   ```

4. **Create a second sheet** named `Config`

5. **Set up the Config sheet**:
   ```
   A1: Setting          B1: Value
   A2: AcceptingOrders  B2: TRUE
   ```

6. **Copy the Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
                                              ^^^^^^^^^^^^^^^^^^^^
   ```

### Step 2: Google Drive Setup

1. **Create a new folder** in Google Drive for storing order folders

2. **Copy the Folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/FOLDER_ID_HERE
                                            ^^^^^^^^^^^^
   ```

### Step 3: Google Apps Script Deployment

1. **Open the Apps Script Editor**:
   - In your Google Sheet, go to `Extensions` → `Apps Script`
   - Or visit [script.google.com](https://script.google.com) and create a new project

2. **Copy the backend code**:
   - Open `gas/backend.gs` from this project
   - Copy ALL the code into the Apps Script editor
   - Replace the default `function myFunction()` code

3. **Configure the script**:
   - At the top of `backend.gs`, update these values:
   ```javascript
   const DRIVE_FOLDER_ID = 'YOUR_ACTUAL_FOLDER_ID_HERE';
   const SPREADSHEET_ID = 'YOUR_ACTUAL_SPREADSHEET_ID_HERE';
   ```

4. **Save the project** (Ctrl+S or Cmd+S)
   - Give it a name like "Design Portal Backend"

5. **Deploy as Web App**:
   - Click `Deploy` → `New deployment`
   - Click the gear icon → Select `Web app`
   - Configure:
     - **Description**: "Design Portal API v1"
     - **Execute as**: `Me` (your email)
     - **Who has access**: `Anyone` (IMPORTANT for frontend access)
   - Click `Deploy`
   - **Authorize the script** when prompted
   - **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`)

### Step 4: Frontend Configuration

1. **Open `src/js/app.js`**

2. **Update the GAS URL** (line 17):
   ```javascript
   const GAS_WEB_APP_URL = 'YOUR_WEB_APP_URL_HERE';
   ```
   Paste your deployed Web App URL from Step 3.

3. **Optional**: Adjust file size limits if needed:
   ```javascript
   const MAX_TOTAL_FILE_SIZE = 4 * 1024 * 1024; // 4MB
   const MAX_FILE_SIZE = 3 * 1024 * 1024;       // 3MB
   ```

### Step 5: Install & Run Locally

```bash
# Install dependencies
npm install

# Start development server (http://localhost:8080)
npm run dev
```

The site will be available at `http://localhost:8080` with hot-reload enabled.

### Step 6: Build for Production

```bash
# Build static files to _site/ directory
npm run build
```

The built files will be in the `_site/` folder.

---

## 🚀 Deployment to GitHub Pages

### Option A: Manual Deployment

```bash
# Build the site
npm run build

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Create orphan gh-pages branch
git checkout --orphan gh-pages
git reset --hard

# Copy build files
cp -r _site/* .
rm -rf _site

# Add and commit
git add .
git commit -m "Deploy to GitHub Pages"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -f origin gh-pages
```

### Option B: Using GitHub Actions (Recommended)

1. **Create `.github/workflows/deploy.yml`**:

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

2. **Enable GitHub Pages**:
   - Go to your repository Settings → Pages
   - Source: `GitHub Actions`

---

## 🎨 Customization

### Styling

Edit `src/css/style.css` to customize:
- Colors (CSS custom properties in `:root`)
- Typography
- Spacing
- Component styles

### Form Fields

To add/modify product types, edit the `<select>` in `src/index.njk`:

```html
<select class="field-input field-select" name="productType" required>
  <option value="">Select a product type...</option>
  <option value="T-Shirt">T-Shirt</option>
  <!-- Add more options here -->
</select>
```

### Order Status Options

In `gas/backend.gs`, modify these arrays:

```javascript
const ORDER_STATUS_OPTIONS = ['Pending', 'In Production', 'Shipped', 'Rejected'];
const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid'];
```

---

## 🔒 Security Considerations

1. **CORS**: The GAS backend handles CORS automatically for ContentService responses.

2. **File Size Limits**: Enforced on both frontend (4MB total) and individual files (3MB) to prevent GAS timeout.

3. **Input Validation**: Both frontend and backend validate all inputs.

4. **Legal Consent**: Required checkbox for IP declaration.

5. **Rate Limiting**: Consider adding rate limiting in GAS if expecting high traffic.

---

## 🐛 Troubleshooting

### "We are not accepting orders" modal appears

- Check the `Config` sheet, cell `B2` should be `TRUE` (not `"TRUE"` as text)
- Ensure the sheet name is exactly `Config`

### Submission fails with CORS error

- Verify the GAS Web App is deployed with "Anyone" access
- Check that `GAS_WEB_APP_URL` is correctly set in `app.js`

### Files not appearing in Drive

- Verify `DRIVE_FOLDER_ID` is correct
- Ensure the script has Drive API permissions
- Check file sizes don't exceed limits

### Data not appearing in Sheet

- Verify `SPREADSHEET_ID` is correct
- Ensure sheet is named exactly `Orders`
- Check column headers match expected format

### GAS Timeout Errors

- Reduce total file size (keep under 4MB)
- Compress images before upload
- Consider reducing `MAX_TOTAL_FILE_SIZE` in both frontend and backend

---

## 📊 Google Sheet Formulas (Optional)

Add these formulas to enhance your Orders sheet:

**Auto-calculate days in production** (Column J):
```excel
=IF(E2="In Production", TODAY()-A2, "")
```

**Count orders by status** (separate summary sheet):
```excel
=COUNTIF(Orders!E:E, "Pending")
=COUNTIF(Orders!E:E, "In Production")
=COUNTIF(Orders!E:E, "Shipped")
```

**Total revenue** (if you add a Price column):
```excel
=SUMIF(Orders!F:F, "Paid", Orders!J:J)
```

---

## 📝 API Reference

### GET Endpoint (Check Order Status)

```
GET https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

**Response:**
```json
{
  "success": true,
  "acceptingOrders": true
}
```

### POST Endpoint (Submit Order)

```
POST https://script.google.com/macros/s/DEPLOYMENT_ID/exec
Content-Type: application/json
```

**Request Body:**
```json
{
  "customerName": "John Doe",
  "email": "john@example.com",
  "subDesigns": [
    {
      "productType": "T-Shirt",
      "specs": "Cotton, Blue, Size L",
      "imageData": {
        "type": "image/png",
        "base64": "data:image/png;base64,..."
      }
    }
  ],
  "legalConsent": true
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "ORD-20260329-001",
  "message": "Your design submission has been received successfully!",
  "folderUrl": "https://drive.google.com/drive/folders/..."
}
```

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🤝 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review GAS execution logs (Extensions → Apps Script → Executions)
3. Check browser console for frontend errors

---

## 🎯 Deployment Checklist

- [ ] Google Sheet created with "Orders" and "Config" sheets
- [ ] Config sheet has `AcceptingOrders` in A2 and `TRUE` in B2
- [ ] Orders sheet has correct headers in Row 1
- [ ] Drive folder created for order storage
- [ ] GAS script deployed with "Anyone" access
- [ ] `DRIVE_FOLDER_ID` updated in `backend.gs`
- [ ] `SPREADSHEET_ID` updated in `backend.gs`
- [ ] `GAS_WEB_APP_URL` updated in `app.js`
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Site deployed to GitHub Pages
- [ ] Test submission with small files
- [ ] Verify data appears in Google Sheet
- [ ] Verify images appear in Drive folder

---

**Built with ❤️ for the Fashion Brand Team**

*Last Updated: March 29, 2026*
