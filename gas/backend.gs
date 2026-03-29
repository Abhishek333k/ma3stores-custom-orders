/**
 * =============================================================================
 * CUSTOM DESIGN SUBMISSION PORTAL - BACKEND v3.0
 * Google Apps Script Serverless Middleware
 * =============================================================================
 * 
 * Production Configuration with CORS and OAuth fixes
 * 
 * @version 3.0.0
 * @author MA³ Store Tech Team
 */

// =============================================================================
// CORS HANDLING - doOptions
// =============================================================================

/**
 * Handles preflight OPTIONS requests for CORS
 * Returns proper CORS headers to allow cross-origin requests
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// =============================================================================
// HTTP POST HANDLER - doPost
// =============================================================================

/**
 * Handles POST requests with two actions:
 * 1. getUploadUrls - Generate secure Drive upload URLs
 * 2. logOrder - Log order metadata to Sheets
 */
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader("Access-Control-Allow-Origin", "*");
  
  try {
    // Parse incoming JSON data
    const data = JSON.parse(e.postData.contents);
    
    // Production IDs - Hardcoded
    const SPREADSHEET_ID = '14RAOoBhYoFzZirbU9zW-qIAYLV8mM9OiLTT-iCdfKGQ';
    const TARGET_FOLDER_ID = '1LH5p6ZpsCy-dxNlNky_6yS0cpZU1CZyR';
    
    // ========================================================================
    // ACTION A: Get Upload URLs
    // ========================================================================
    if (data.action === 'getUploadUrls') {
      // Get parent folder
      const parentFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
      
      // Create order folder
      const orderFolder = parentFolder.createFolder(data.orderId + " - " + data.customerName);
      const folderId = orderFolder.getId();
      
      // Prepare upload URLs array
      const uploadUrls = [];
      
      // Get OAuth token for Drive API authentication
      const token = ScriptApp.getOAuthToken();
      
      // Generate resumable upload URL for each file
      for (let i = 0; i < data.files.length; i++) {
        const fileData = data.files[i];
        
        // Metadata for the file
        const payload = {
          name: fileData.fileName,
          mimeType: fileData.mimeType,
          parents: [folderId]
        };
        
        // Options for UrlFetchApp
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
        
        // Check response code
        if (response.getResponseCode() === 200) {
          // Extract the upload URL from Location header
          const locationHeader = response.getHeaders()['Location'];
          uploadUrls.push(locationHeader);
        } else {
          throw new Error("Drive API Error: " + response.getContentText());
        }
      }
      
      // Return success with upload URLs
      output.setContent(JSON.stringify({
        status: 'success',
        uploadUrls: uploadUrls,
        folderUrl: orderFolder.getUrl(),
        orderId: data.orderId
      }));
      return output;
    }
    
    // ========================================================================
    // ACTION B: Log the Order
    // ========================================================================
    if (data.action === 'logOrder') {
      // Open spreadsheet and get Orders sheet
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
      
      // Append row to sheet
      sheet.appendRow([
        new Date(),
        data.orderId,
        data.customerName,
        data.customerEmail,
        data.mobileNumber,
        "Pending",
        "Unpaid",
        data.formattedSpecs,
        data.folderUrl,
        data.legalConsent ? "Granted" : "Failed"
      ]);
      
      // Return success
      output.setContent(JSON.stringify({ 
        status: 'success', 
        message: 'Order Logged' 
      }));
      return output;
    }
    
    // Unknown action
    throw new Error('Unknown action: ' + (data.action || 'none'));
    
  } catch (error) {
    // Return error response
    output.setContent(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    }));
    return output;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Test function to verify configuration
 */
function testConfiguration() {
  Logger.log('=== Testing Configuration ===');
  
  const SPREADSHEET_ID = '14RAOoBhYoFzZirbU9zW-qIAYLV8mM9OiLTT-iCdfKGQ';
  const TARGET_FOLDER_ID = '1LH5p6ZpsCy-dxNlNky_6yS0cpZU1CZyR';
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✓ Spreadsheet: ' + ss.getName());
    Logger.log('✓ Orders sheet: ' + (ss.getSheetByName('Orders') !== null));
  } catch (e) {
    Logger.log('✗ Spreadsheet error: ' + e.toString());
  }
  
  try {
    const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    Logger.log('✓ Drive folder: ' + folder.getName());
  } catch (e) {
    Logger.log('✗ Drive folder error: ' + e.toString());
  }
  
  Logger.log('=== Test Complete ===');
}
