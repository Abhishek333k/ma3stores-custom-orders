/**
 * =============================================================================
 * MA³ STORE CUSTOM DESIGN PORTAL - BACKEND v3.0
 * Google Apps Script Serverless Middleware
 * =============================================================================
 * 
 * MULTIPLE IMAGES PER DESIGN WITH HIERARCHICAL FOLDER STRUCTURE
 * 
 * Folder Structure:
 * Active Orders/
 *   └── ORD-20260329-1234 - Customer Name/
 *       ├── Design 1 - T-Shirt/
 *       │   ├── design-1-1-t-shirt.png
 *       │   └── design-1-2-t-shirt.png
 *       ├── Design 2 - Hoodie/
 *       │   └── design-2-1-hoodie.png
 *       └── Design 3 - Custom/
 *           └── design-3-1-custom.png
 * 
 * @version 3.0.0
 * @author MA³ Store Tech Team
 */

// =============================================================================
// CONFIGURATION - PRODUCTION IDS
// =============================================================================

/**
 * Folder where active order folders are created
 * URL: https://drive.google.com/drive/folders/1Vd858k2IROkPfl_B6tIy9W_FlWgk3IUd
 */
const ACTIVE_ORDERS_FOLDER_ID = '1Vd858k2IROkPfl_B6tIy9W_FlWgk3IUd';

/**
 * Folder where completed orders are moved for archival
 * URL: https://drive.google.com/drive/folders/1VCcMR4mRMcNFifzip_MYXtbdcRJGy7fA
 */
const COMPLETED_FOLDER_ID = '1VCcMR4mRMcNFifzip_MYXtbdcRJGy7fA';

/**
 * Google Spreadsheet ID for Orders database
 */
const SPREADSHEET_ID = '14RAOoBhYoFzZirbU9zW-qIAYLV8mM9OiLTT-iCdfKGQ';

// =============================================================================
// CORS HANDLING
// =============================================================================

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// =============================================================================
// HTTP POST HANDLER
// =============================================================================

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader("Access-Control-Allow-Origin", "*");
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Route to appropriate action
    if (data.action === 'getUploadUrls') {
      return handleGetUploadUrls_(data, output);
    }
    
    if (data.action === 'logOrder') {
      return handleLogOrder_(data, output);
    }
    
    throw new Error('Unknown action: ' + (data.action || 'none'));
    
  } catch (error) {
    output.setContent(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    }));
    return output;
  }
}

// =============================================================================
// ACTION A: GET UPLOAD URLS
// =============================================================================

function handleGetUploadUrls_(data, output) {
  try {
    // Validate required fields
    if (!data.customerName || !data.files || !Array.isArray(data.files)) {
      throw new Error('Missing required fields: customerName and files array');
    }
    
    if (data.files.length === 0) {
      throw new Error('At least one file is required');
    }
    
    // Get or create main order folder
    const parentFolder = DriveApp.getFolderById(ACTIVE_ORDERS_FOLDER_ID);
    const folderName = data.orderId + " - " + data.customerName.trim();
    
    // Check if folder already exists
    const existingFolders = parentFolder.getFoldersByName(folderName);
    let orderFolder;
    
    if (existingFolders.hasNext()) {
      orderFolder = existingFolders.next();
    } else {
      orderFolder = parentFolder.createFolder(folderName);
    }
    
    const orderFolderId = orderFolder.getId();
    const orderFolderUrl = orderFolder.getUrl();
    
    // Get OAuth token for Drive API
    const token = ScriptApp.getOAuthToken();
    
    // Group files by design folder
    const designFolders = {};
    const uploadUrls = [];
    
    // First pass: create design subfolders
    data.files.forEach(fileData => {
      const designFolderName = fileData.designFolderName || `Design ${fileData.designIndex} - ${fileData.productType}`;
      
      if (!designFolders[designFolderName]) {
        // Create design subfolder
        const designFolder = orderFolder.createFolder(designFolderName);
        designFolders[designFolderName] = designFolder.getId();
      }
    });
    
    // Second pass: generate upload URLs for each file
    for (let i = 0; i < data.files.length; i++) {
      const fileData = data.files[i];
      const designFolderName = fileData.designFolderName || `Design ${fileData.designIndex} - ${fileData.productType}`;
      const designFolderId = designFolders[designFolderName];
      
      // Metadata for the file
      const payload = {
        name: fileData.fileName,
        mimeType: fileData.mimeType,
        parents: [designFolderId]
      };
      
      // Options for Drive API
      const options = {
        method: "post",
        contentType: "application/json",
        headers: { "Authorization": "Bearer " + token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      // Call Drive API to create resumable upload session
      const response = UrlFetchApp.fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", 
        options
      );
      
      if (response.getResponseCode() === 200) {
        const locationHeader = response.getHeaders()['Location'];
        uploadUrls.push(locationHeader);
      } else {
        throw new Error(`Drive API Error for file ${i}: ${response.getContentText()}`);
      }
    }
    
    output.setContent(JSON.stringify({
      status: 'success',
      uploadUrls: uploadUrls,
      folderUrl: orderFolderUrl,
      orderId: data.orderId,
      message: `Created ${Object.keys(designFolders).length} design folders`
    }));
    
    return output;
    
  } catch (error) {
    output.setContent(JSON.stringify({ 
      status: 'error', 
      message: 'getUploadUrls: ' + error.toString() 
    }));
    return output;
  }
}

// =============================================================================
// ACTION B: LOG ORDER
// =============================================================================

function handleLogOrder_(data, output) {
  try {
    // Validate required fields
    if (!data.orderId || !data.customerName || !data.mobileNumber) {
      throw new Error('Missing required order data');
    }
    
    // Open spreadsheet and get Orders sheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Orders');
    
    if (!sheet) {
      throw new Error('Orders sheet not found');
    }
    
    // Append row to sheet
    sheet.appendRow([
      new Date(),                    // Timestamp
      data.orderId,                  // Order ID
      data.customerName,             // Customer Name
      data.customerEmail || '',      // Email (optional)
      data.mobileNumber,             // Mobile Number
      "Pending",                     // Order Status
      "Unpaid",                      // Payment Status
      data.formattedSpecs || '',     // Design Specs (bulleted)
      data.folderUrl || '',          // Folder URL
      data.legalConsent ? "Granted" : "Failed"  // Legal Consent
    ]);
    
    output.setContent(JSON.stringify({ 
      status: 'success', 
      message: 'Order Logged Successfully',
      orderId: data.orderId
    }));
    
    return output;
    
  } catch (error) {
    output.setContent(JSON.stringify({ 
      status: 'error', 
      message: 'logOrder: ' + error.toString() 
    }));
    return output;
  }
}

// =============================================================================
// AUTOMATED CLEANUP FUNCTIONS
// =============================================================================

/**
 * Moves an order folder to Completed folder when order status changes
 * Triggered by onEdit trigger when Sheet status changes to "Shipped" or "Completed"
 * 
 * @param {string} folderUrl - URL of the folder to move
 */
function moveOrderToCompleted(folderUrl) {
  try {
    // Extract folder ID from URL
    const folderId = folderUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
    
    if (!folderId || !folderId[1]) {
      console.error("Invalid folder URL:", folderUrl);
      return;
    }
    
    const folder = DriveApp.getFolderById(folderId[1]);
    const completedFolder = DriveApp.getFolderById(COMPLETED_FOLDER_ID);
    
    // Move folder to Completed
    folder.moveTo(completedFolder);
    
    console.log(`Moved folder "${folder.getName()}" to Completed`);
    
  } catch (e) {
    console.error("Move to Completed failed:", e.toString());
  }
}

/**
 * Nightly cleanup function - deletes folders older than 30 days from Completed
 * Set up a time-driven trigger to run this daily at 2 AM
 * 
 * Trigger setup:
 * 1. Edit → Current project's triggers
 * 2. Add trigger → nightlyArchiveCleanup
 * 3. Event source: Time-driven
 * 4. Type: Day timer (2am-3am)
 */
function nightlyArchiveCleanup() {
  try {
    const completedFolder = DriveApp.getFolderById(COMPLETED_FOLDER_ID);
    const folders = completedFolder.getFolders();
    const now = new Date().getTime();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    let deletedCount = 0;
    
    while (folders.hasNext()) {
      const folder = folders.next();
      const folderCreatedTime = folder.getDateCreated().getTime();
      
      if (now - folderCreatedTime > THIRTY_DAYS) {
        const folderName = folder.getName();
        folder.setTrashed(true);
        deletedCount++;
        console.log(`Deleted old folder: ${folderName}`);
      }
    }
    
    console.log(`Cleanup complete: ${deletedCount} folders deleted`);
    
  } catch (e) {
    console.error("Nightly cleanup failed:", e.toString());
  }
}

/**
 * Helper function to extract order ID from folder name
 * Useful for manual operations or reporting
 * 
 * @param {string} folderName - Folder name (e.g., "ORD-20260329-1234 - John Doe")
 * @returns {string} Order ID
 */
function extractOrderIdFromFolderName(folderName) {
  const match = folderName.match(/(ORD-\d+-\d+)/);
  return match ? match[1] : null;
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

/**
 * Test configuration and API access
 */
function testConfiguration() {
  Logger.log('=== Testing Configuration v3.0 ===\n');
  
  // Test Spreadsheet
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✓ Spreadsheet: ' + ss.getName());
    Logger.log('✓ Orders sheet: ' + (ss.getSheetByName('Orders') !== null));
  } catch (e) {
    Logger.log('✗ Spreadsheet error: ' + e.toString());
  }
  
  // Test Active Orders Folder
  try {
    const folder = DriveApp.getFolderById(ACTIVE_ORDERS_FOLDER_ID);
    Logger.log('✓ Active Orders Folder: ' + folder.getName());
  } catch (e) {
    Logger.log('✗ Active Orders Folder error: ' + e.toString());
  }
  
  // Test Completed Folder (if configured)
  if (COMPLETED_FOLDER_ID !== 'YOUR_COMPLETED_FOLDER_ID_HERE') {
    try {
      const folder = DriveApp.getFolderById(COMPLETED_FOLDER_ID);
      Logger.log('✓ Completed Folder: ' + folder.getName());
    } catch (e) {
      Logger.log('✗ Completed Folder error: ' + e.toString());
    }
  } else {
    Logger.log('⚠ Completed Folder ID not configured');
  }
  
  Logger.log('\n=== Test Complete ===');
}

/**
 * Manual trigger to test cleanup (for testing only)
 */
function testCleanup() {
  Logger.log('Running test cleanup (dry run)...');
  nightlyArchiveCleanup();
}
