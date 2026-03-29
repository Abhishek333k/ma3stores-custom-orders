/**
 * =============================================================================
 * CUSTOM DESIGN SUBMISSION PORTAL - BACKEND v2.0
 * Google Apps Script Serverless Middleware with Direct Binary Upload
 * =============================================================================
 * 
 * ARCHITECTURE CHANGE: Direct Binary Upload via Google Drive Resumable Upload API
 * 
 * This eliminates Base64 payload limits by:
 * 1. Generating secure upload URLs from Google Drive API
 * 2. Frontend uploads files directly to Drive via PUT requests
 * 3. Backend only logs order metadata after files are uploaded
 * 
 * SUPPORTS: Files up to 50MB each (Google Drive limit via resumable upload)
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open Google Sheet → Extensions → Apps Script
 * 2. Enable Drive API: Resources → Advanced Google Services → Drive API → Enable
 * 3. Also enable at: https://console.cloud.google.com/apis/library/drive.googleapis.com
 * 4. Paste this code, update IDs, Deploy as Web App
 * 
 * @version 2.0.0
 * @author Fashion Brand Tech Team
 * @license MIT
 */

// =============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE DEPLOYMENT
// =============================================================================

/**
 * Google Drive Folder ID where order folders will be created.
 */
const TARGET_FOLDER_ID = "1LH5p6ZpsCy-dxNlNky_6yS0cpZU1CZyR";

/**
 * Google Spreadsheet ID that contains Orders and Config sheets.
 */
const SPREADSHEET_ID = "1La55rhdiX3vI_OAIk_BVMkQ7x-rc24sq";

/**
 * Sheet names (must match your Google Sheet exactly)
 */
const CONFIG_SHEET_NAME = 'Config';
const ORDERS_SHEET_NAME = 'Orders';

/**
 * Status options for dropdown validation in Google Sheets
 */
const ORDER_STATUS_OPTIONS = ['Pending', 'In Production', 'Shipped', 'Rejected'];
const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid'];

/**
 * Maximum file size per file (50MB in bytes) - Google Drive resumable upload limit
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Maximum number of sub-designs per order
 */
const MAX_DESIGNS_PER_ORDER = 10;

// =============================================================================
// CORS HANDLING
// =============================================================================

/**
 * Handles preflight OPTIONS requests for CORS
 * Critical for allowing requests from GitHub Pages or any external domain
 * 
 * @param {Object} e - Event object from Apps Script
 * @returns {GoogleAppsScript.Content.TextOutput} Response with CORS headers
 */
function doOptions(e) {
  return buildCorsResponse_('', {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Action',
    'Access-Control-Max-Age': '86400'
  });
}

/**
 * Helper to build CORS-enabled response
 * 
 * @param {string} content - Response body content
 * @param {Object} headers - Additional headers to include
 * @returns {GoogleAppsScript.Content.TextOutput} TextOutput with CORS headers
 */
function buildCorsResponse_(content, headers) {
  const output = ContentService.createTextOutput(content);
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// =============================================================================
// HTTP GET HANDLER - Order Status Gate
// =============================================================================

/**
 * Handles GET requests to check if orders are being accepted
 * 
 * @param {Object} e - Event object from Apps Script
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response with acceptance status
 */
function doGet(e) {
  try {
    const acceptingOrders = isAcceptingOrders_();
    
    return buildCorsResponse_(JSON.stringify({
      success: true,
      acceptingOrders: acceptingOrders,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    Logger.log('GET Error: ' + error.toString());
    
    // Fail open - allow orders if config check fails
    return buildCorsResponse_(JSON.stringify({
      success: false,
      acceptingOrders: true,
      error: 'Could not verify order status',
      timestamp: new Date().toISOString()
    }));
  }
}

// =============================================================================
// HTTP POST HANDLER - Multi-Action Router
// =============================================================================

/**
 * Handles POST requests with action-based routing
 * 
 * SUPPORTED ACTIONS:
 * 1. getUploadUrls - Generate secure Drive upload URLs (Step 1)
 * 2. logOrder - Log order metadata to Sheets after files uploaded (Step 2)
 * 3. submitOrder - Legacy single-step submission (for backwards compatibility)
 * 
 * @param {Object} e - Event object containing request data
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response with action result
 */
function doPost(e) {
  try {
    // Parse incoming data
    const data = parsePostData_(e);
    
    // Route to appropriate action handler
    const action = data.action || 'submitOrder';
    
    Logger.log('Received action: ' + action);
    
    switch (action) {
      case 'getUploadUrls':
        return handleGetUploadUrls_(data);
      
      case 'logOrder':
        return handleLogOrder_(data);
      
      case 'submitOrder':
      default:
        return handleLegacySubmit_(data);
    }
    
  } catch (error) {
    Logger.log('CRITICAL ERROR in doPost: ' + error.toString());
    Logger.log(error.stack);
    
    return buildCorsResponse_(JSON.stringify({
      success: false,
      error: 'An unexpected error occurred. Please try again or contact support.',
      code: 'INTERNAL_ERROR',
      details: error.toString()
    }), 500);
  }
}

// =============================================================================
// ACTION HANDLER: getUploadUrls
// =============================================================================

/**
 * ACTION: getUploadUrls
 * 
 * Creates customer folder in Drive and generates secure resumable upload URLs
 * for each file. Frontend will use these URLs to upload files directly to Drive.
 * 
 * Expected payload:
 * {
 *   action: 'getUploadUrls',
 *   customerName: string,
 *   files: [
 *     { fileName: 'design-1.png', mimeType: 'image/png' },
 *     { fileName: 'design-2.jpg', mimeType: 'image/jpeg' }
 *   ]
 * }
 * 
 * @param {Object} data - Parsed request data
 * @returns {GoogleAppsScript.Content.TextOutput} JSON with uploadUrls array
 */
function handleGetUploadUrls_(data) {
  try {
    // Validate required fields
    if (!data.customerName || !data.files || !Array.isArray(data.files)) {
      return buildCorsResponse_(JSON.stringify({
        success: false,
        error: 'Missing required fields: customerName and files array',
        code: 'VALIDATION_ERROR'
      }), 400);
    }
    
    if (data.files.length === 0) {
      return buildCorsResponse_(JSON.stringify({
        success: false,
        error: 'At least one file is required',
        code: 'VALIDATION_ERROR'
      }), 400);
    }
    
    if (data.files.length > MAX_DESIGNS_PER_ORDER) {
      return buildCorsResponse_(JSON.stringify({
        success: false,
        error: 'Maximum ' + MAX_DESIGNS_PER_ORDER + ' files allowed per order',
        code: 'VALIDATION_ERROR'
      }), 400);
    }
    
    // Validate each file metadata
    for (let i = 0; i < data.files.length; i++) {
      const file = data.files[i];
      if (!file.fileName || !file.mimeType) {
        return buildCorsResponse_(JSON.stringify({
          success: false,
          error: 'File ' + (i + 1) + ' missing fileName or mimeType',
          code: 'VALIDATION_ERROR'
        }), 400);
      }
      
      // Validate MIME type is an image
      if (!file.mimeType.startsWith('image/')) {
        return buildCorsResponse_(JSON.stringify({
          success: false,
          error: 'File ' + (i + 1) + ' must be an image',
          code: 'VALIDATION_ERROR'
        }), 400);
      }
    }
    
    // Check if accepting orders
    if (!isAcceptingOrders_()) {
      return buildCorsResponse_(JSON.stringify({
        success: false,
        error: 'We are not currently accepting new orders',
        code: 'NOT_ACCEPTING_ORDERS'
      }), 503);
    }
    
    // Generate Order ID
    const orderId = generateOrderId_(new Date());
    const folderName = orderId + ' - ' + data.customerName.trim();
    
    Logger.log('Creating folder for order: ' + orderId);
    
    // Get parent folder
    let parentFolder;
    try {
      parentFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    } catch (error) {
      throw new Error('Drive folder not found. Check TARGET_FOLDER_ID: ' + TARGET_FOLDER_ID);
    }
    
    // Create customer subfolder
    const orderFolder = parentFolder.createFolder(folderName);
    const folderId = orderFolder.getId();
    const folderUrl = orderFolder.getUrl();
    
    Logger.log('Created folder: ' + folderName + ' (ID: ' + folderId + ')');
    
    // Generate resumable upload URLs for each file
    const uploadUrls = [];
    
    for (let i = 0; i < data.files.length; i++) {
      const file = data.files[i];
      
      // Create upload URL using Drive API
      const uploadUrl = createResumableUploadUrl_(folderId, file.fileName, file.mimeType);
      
      if (!uploadUrl) {
        throw new Error('Failed to generate upload URL for file ' + (i + 1));
      }
      
      uploadUrls.push({
        fileName: file.fileName,
        mimeType: file.mimeType,
        uploadUrl: uploadUrl,
        index: i
      });
      
      Logger.log('Generated upload URL for: ' + file.fileName);
    }
    
    // Return upload URLs and folder info
    return buildCorsResponse_(JSON.stringify({
      success: true,
      orderId: orderId,
      folderId: folderId,
      folderUrl: folderUrl,
      uploadUrls: uploadUrls,
      message: 'Upload URLs generated successfully',
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    Logger.log('Error in handleGetUploadUrls_: ' + error.toString());
    
    return buildCorsResponse_(JSON.stringify({
      success: false,
      error: 'Failed to generate upload URLs: ' + error.toString(),
      code: 'UPLOAD_URL_ERROR'
    }), 500);
  }
}

// =============================================================================
// ACTION HANDLER: logOrder
// =============================================================================

/**
 * ACTION: logOrder
 * 
 * Logs order metadata to Google Sheets after all files have been uploaded
 * directly to Drive by the frontend.
 * 
 * Expected payload:
 * {
 *   action: 'logOrder',
 *   orderId: string,
 *   customerName: string,
 *   email: string,
 *   mobileNumber: string,
 *   subDesigns: [
 *     { productType: 'T-Shirt', specs: 'Cotton, Blue', fileName: 'design-1.png' }
 *   ],
 *   folderUrl: string,
 *   legalConsent: boolean
 * }
 * 
 * @param {Object} data - Parsed request data
 * @returns {GoogleAppsScript.Content.TextOutput} JSON with order confirmation
 */
function handleLogOrder_(data) {
  try {
    // Validate payload
    const validationError = validateOrderData_(data);
    if (validationError) {
      return buildCorsResponse_(JSON.stringify({
        success: false,
        error: validationError,
        code: 'VALIDATION_ERROR'
      }), 400);
    }
    
    Logger.log('Logging order: ' + data.orderId);
    
    // Open spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ordersSheet = ss.getSheetByName(ORDERS_SHEET_NAME);
    
    if (!ordersSheet) {
      throw new Error('Orders sheet not found: ' + ORDERS_SHEET_NAME);
    }
    
    // Format design specs as Notion-style bulleted list
    const formattedSpecs = formatDesignSpecs_(data.subDesigns);
    
    // Prepare row data
    // Schema: Timestamp | Order ID | Name | Email | Mobile | Order Status | Payment Status | Design Specs | Folder URL | Legal Consent
    const rowData = [
      new Date(),                                 // Column A: Timestamp
      data.orderId,                               // Column B: Order ID
      data.customerName.trim(),                   // Column C: Name
      data.email ? data.email.trim() : '',        // Column D: Email (optional)
      data.mobileNumber.trim(),                   // Column E: Mobile Number
      ORDER_STATUS_OPTIONS[0],                    // Column F: Order Status (Pending)
      PAYMENT_STATUS_OPTIONS[0],                  // Column G: Payment Status (Unpaid)
      formattedSpecs,                             // Column H: Design Specs (Bulleted)
      data.folderUrl,                             // Column I: Folder URL
      data.legalConsent ? 'Granted' : 'Failed'    // Column J: Legal Consent
    ];
    
    // Append row to sheet
    const lastRow = ordersSheet.getLastRow();
    ordersSheet.appendRow(rowData);
    
    // Apply data validation to new row
    const newRow = lastRow + 1;
    applyDataValidation_(ordersSheet, newRow);
    formatNewRow_(ordersSheet, newRow);
    
    Logger.log('Order logged successfully: ' + data.orderId);
    
    return buildCorsResponse_(JSON.stringify({
      success: true,
      orderId: data.orderId,
      message: 'Order logged successfully',
      sheetRow: newRow,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    Logger.log('Error in handleLogOrder_: ' + error.toString());
    
    return buildCorsResponse_(JSON.stringify({
      success: false,
      error: 'Failed to log order: ' + error.toString(),
      code: 'LOG_ORDER_ERROR'
    }), 500);
  }
}

// =============================================================================
// LEGACY HANDLER: submitOrder (Backwards Compatibility)
// =============================================================================

/**
 * Legacy single-step submission handler (for backwards compatibility)
 * Kept for transition period - deprecated, use two-step flow instead
 */
function handleLegacySubmit_(data) {
  return buildCorsResponse_(JSON.stringify({
    success: false,
    error: 'Legacy submission is deprecated. Please use the two-step upload flow (getUploadUrls → logOrder).',
    code: 'LEGACY_DEPRECATED'
  }), 400);
}

// =============================================================================
// CORE BUSINESS LOGIC - Private Functions
// =============================================================================

/**
 * Creates a resumable upload session URL using Google Drive API
 * 
 * Uses UrlFetchApp to make authenticated API call to Drive API
 * The returned URL can be used by frontend to upload file directly via PUT
 * 
 * @param {string} folderId - Parent folder ID in Drive
 * @param {string} fileName - Name of the file to upload
 * @param {string} mimeType - MIME type of the file
 * @returns {string|null} Resumable upload URL or null on failure
 * @private
 */
function createResumableUploadUrl_(folderId, fileName, mimeType) {
  try {
    // Metadata for the file
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: mimeType
    };
    
    // Drive API endpoint for resumable uploads
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&alt=json';
    
    // Headers for the request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    };
    
    // Make the request to initiate resumable upload session
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: headers,
      payload: JSON.stringify(metadata),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log('Drive API error: ' + response.getContentText());
      throw new Error('Drive API returned status ' + responseCode);
    }
    
    // The upload URL is in the Location header
    const uploadUrl = response.getHeader('Location');
    
    if (!uploadUrl) {
      throw new Error('No Location header in response');
    }
    
    return uploadUrl;
    
  } catch (error) {
    Logger.log('Error creating resumable upload URL: ' + error.toString());
    return null;
  }
}

/**
 * Validates order data for logOrder action
 * 
 * @param {Object} data - Order data to validate
 * @returns {string|null} Error message if invalid, null if valid
 * @private
 */
function validateOrderData_(data) {
  if (!data) {
    return 'No data provided';
  }
  
  if (!data.orderId) {
    return 'Order ID is required';
  }
  
  if (!data.customerName || data.customerName.trim() === '') {
    return 'Customer name is required';
  }
  
  if (data.customerName.trim().length < 2) {
    return 'Customer name must be at least 2 characters';
  }
  
  // Email is optional - only validate if provided
  if (data.email && data.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      return 'Please provide a valid email address';
    }
  }
  
  // Mobile number validation (Indian format - required)
  if (!data.mobileNumber || data.mobileNumber.trim() === '') {
    return 'Mobile number is required';
  }
  
  const mobileDigits = data.mobileNumber.replace(/\D/g, '');
  if (!/^\+?91[0-9]{10}$/.test(data.mobileNumber.replace(/\s/g, '')) || mobileDigits.length !== 12) {
    return 'Please provide a valid Indian mobile number (e.g., +91 9876543210)';
  }
  
  // Sub-designs validation
  if (!data.subDesigns || !Array.isArray(data.subDesigns) || data.subDesigns.length === 0) {
    return 'At least one design is required';
  }
  
  if (data.subDesigns.length > MAX_DESIGNS_PER_ORDER) {
    return 'Maximum ' + MAX_DESIGNS_PER_ORDER + ' designs allowed';
  }
  
  for (let i = 0; i < data.subDesigns.length; i++) {
    const design = data.subDesigns[i];
    if (!design.productType || design.productType.trim() === '') {
      return 'Product type required for design #' + (i + 1);
    }
    if (!design.specs || design.specs.trim() === '') {
      return 'Specifications required for design #' + (i + 1);
    }
  }
  
  if (!data.folderUrl) {
    return 'Folder URL is required';
  }
  
  if (data.legalConsent !== true) {
    return 'IP Declaration must be accepted';
  }
  
  return null;
}

/**
 * Checks if the portal is currently accepting orders
 * 
 * @returns {boolean} True if accepting orders, false otherwise
 * @private
 */
function isAcceptingOrders_() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    
    if (!configSheet) {
      Logger.log('Config sheet not found');
      return false;
    }
    
    // Find the row where Key = "AcceptingOrders"
    const data = configSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const key = data[i][0];
      const value = data[i][1];
      
      if (key === 'AcceptingOrders') {
        return value === true || value === 'TRUE' || value === 'true' || value === 1;
      }
    }
    
    // Fallback to B2
    const fallbackValue = configSheet.getRange('B2').getValue();
    return fallbackValue === true || fallbackValue === 'TRUE' || fallbackValue === 'true';
    
  } catch (error) {
    Logger.log('Error reading config: ' + error.toString());
    return false;
  }
}

/**
 * Parses the incoming POST data
 * 
 * @param {Object} e - Event object from Apps Script
 * @returns {Object} Parsed data object
 * @private
 */
function parsePostData_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('No data received in request');
  }
  
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Invalid JSON format in request');
  }
}

/**
 * Generates a unique Order ID
 * Format: ORD-YYYYMMDD-XXXX (4-digit random)
 * 
 * @param {Date} timestamp - Current timestamp
 * @returns {string} Generated order ID
 * @private
 */
function generateOrderId_(timestamp) {
  const dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyyMMdd');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return 'ORD-' + dateStr + '-' + randomNum;
}

/**
 * Formats sub-designs array into Notion-style bulleted string
 * 
 * @param {Array} subDesigns - Array of sub-design objects
 * @returns {string} Formatted bulleted string
 * @private
 */
function formatDesignSpecs_(subDesigns) {
  if (!subDesigns || subDesigns.length === 0) {
    return 'No designs submitted';
  }
  
  const bulletChar = '•';
  const lines = subDesigns.map(function(subDesign) {
    const productType = subDesign.productType || 'Custom Item';
    const specs = subDesign.specs || 'No specifications provided';
    return bulletChar + ' ' + productType + ': ' + specs;
  });
  
  return lines.join('\n');
}

/**
 * Applies data validation dropdowns to status columns
 * 
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Orders sheet
 * @param {number} row - Row number to apply validation
 * @private
 */
function applyDataValidation_(sheet, row) {
  try {
    // Column F (6): Order Status
    const orderStatusRange = sheet.getRange(row, 6);
    const orderStatusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(ORDER_STATUS_OPTIONS, true)
      .setAllowInvalid(false)
      .setHelpText('Select order status')
      .build();
    orderStatusRange.setDataValidation(orderStatusRule);
    
    // Column G (7): Payment Status
    const paymentStatusRange = sheet.getRange(row, 7);
    const paymentStatusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(PAYMENT_STATUS_OPTIONS, true)
      .setAllowInvalid(false)
      .setHelpText('Select payment status')
      .build();
    paymentStatusRange.setDataValidation(paymentStatusRule);
    
  } catch (error) {
    Logger.log('Error applying data validation: ' + error.toString());
  }
}

/**
 * Formats new row for readability
 * 
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Orders sheet
 * @param {number} row - Row number to format
 * @private
 */
function formatNewRow_(sheet, row) {
  try {
    sheet.getRange(row, 8).setWrap(true);
    
    const range = sheet.getRange(row, 1, 1, 10);
    range.setFontFamily('Arial, sans-serif');
    range.setFontSize(10);
    range.setVerticalAlignment('top');
    
    const backgroundColor = row % 2 === 0 ? '#f8f9fa' : '#ffffff';
    range.setBackground(backgroundColor);
    
  } catch (error) {
    Logger.log('Error formatting row: ' + error.toString());
  }
}

// =============================================================================
// HELPER FUNCTIONS FOR TESTING
// =============================================================================

/**
 * Test configuration
 */
function testConfiguration() {
  Logger.log('=== Testing Configuration ===\n');
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✓ Spreadsheet: ' + ss.getName());
    Logger.log('✓ Config sheet: ' + (ss.getSheetByName(CONFIG_SHEET_NAME) !== null));
    Logger.log('✓ Orders sheet: ' + (ss.getSheetByName(ORDERS_SHEET_NAME) !== null));
  } catch (error) {
    Logger.log('✗ Spreadsheet error: ' + error.toString());
  }
  
  try {
    const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    Logger.log('✓ Drive folder: ' + folder.getName());
  } catch (error) {
    Logger.log('✗ Drive folder error: ' + error.toString());
  }
  
  Logger.log('✓ Accepting orders: ' + isAcceptingOrders_());
  Logger.log('\n=== Test Complete ===');
}
