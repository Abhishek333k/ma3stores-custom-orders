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
    .setMimeType(ContentService.MimeType.TEXT);
}

// =============================================================================
// HTTP GET HANDLER - Order Status Gate
// =============================================================================

/**
 * Handles GET requests to check if orders are being accepted
 * Note: ContentService automatically handles CORS for all responses
 */
function doGet(e) {
  try {
    const acceptingOrders = isAcceptingOrders_();
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      acceptingOrders: acceptingOrders,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('GET Error: ' + error.toString());
    
    // Fail open - allow orders if config check fails
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      acceptingOrders: true,
      error: 'Could not verify order status',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================================================
// HTTP POST HANDLER
// =============================================================================

function doPost(e) {
  try {
    let data;

    // Handle both FormData and JSON payloads
    if (e.parameter && e.parameter.action) {
      // FormData submission
      data = {
        action: e.parameter.action,
        orderId: e.parameter.orderId,
        customerName: e.parameter.customerName,
        customerEmail: e.parameter.customerEmail,
        mobileNumber: e.parameter.mobileNumber,
        files: e.parameter.files ? JSON.parse(e.parameter.files) : [],
        formattedSpecs: e.parameter.formattedSpecs,
        folderUrl: e.parameter.folderUrl,
        legalConsent: e.parameter.legalConsent === 'true'
      };
    } else if (e.postData && e.postData.contents) {
      // JSON submission (fallback)
      data = JSON.parse(e.postData.contents);
    } else {
      throw new Error('No post data received');
    }

    if (data.action === 'getUploadUrls') {
      return handleGetUploadUrls_(data);
    }
    if (data.action === 'logOrder') {
      return handleLogOrder_(data);
    }

    throw new Error('Unknown action: ' + (data.action || 'none'));

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================================================
// ACTION A: GET UPLOAD URLS
// =============================================================================

function handleGetUploadUrls_(data) {
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
    const uploadedFiles = [];

    // First pass: create design subfolders
    data.files.forEach(fileData => {
      const designFolderName = fileData.designFolderName || `Design ${fileData.designIndex} - ${fileData.productType}`;

      if (!designFolders[designFolderName]) {
        // Create design subfolder
        const designFolder = orderFolder.createFolder(designFolderName);
        designFolders[designFolderName] = designFolder.getId();
      }
    });

    // Second pass: upload files directly if base64 data provided
    for (let i = 0; i < data.files.length; i++) {
      const fileData = data.files[i];
      const designFolderName = fileData.designFolderName || `Design ${fileData.designIndex} - ${fileData.productType}`;
      const designFolderId = designFolders[designFolderName];

      // Check if base64 image data is provided
      if (fileData.base64Image) {
        try {
          // Extract base64 data (remove data URL prefix if present)
          let base64Data = fileData.base64Image;
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }

          // Decode base64 to bytes
          const bytes = Utilities.base64Decode(base64Data);
          
          // Create blob
          const blob = Utilities.newBlob(bytes, fileData.mimeType, fileData.fileName);
          
          // Get design folder and upload file
          const designFolder = DriveApp.getFolderById(designFolderId);
          const file = designFolder.createFile(blob);
          
          uploadedFiles.push({
            fileName: fileData.fileName,
            fileId: file.getId(),
            fileUrl: file.getUrl()
          });
          
          console.log('Uploaded file:', fileData.fileName, 'to folder:', designFolderName);
        } catch (e) {
          console.error('Failed to upload file:', e.toString());
          throw new Error(`Failed to upload file ${i}: ${e.toString()}`);
        }
      }
    }

    // Return success with uploaded file info
    const responseData = {
      status: 'success',
      uploadUrls: [], // Not needed when we upload directly
      uploadedFiles: uploadedFiles,
      folderUrl: orderFolderUrl,
      orderId: data.orderId,
      message: `Created ${Object.keys(designFolders).length} design folders, uploaded ${uploadedFiles.length} files`
    };

    return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const errorData = {
      status: 'error',
      message: 'getUploadUrls: ' + error.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorData)).setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================================================
// ACTION B: LOG ORDER
// =============================================================================

function handleLogOrder_(data) {
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

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Order Logged Successfully',
      orderId: data.orderId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'logOrder: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
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
