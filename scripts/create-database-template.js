/**
 * Custom Orders Database Template Generator
 * 
 * Creates an Excel file template for the Custom Design Submission Portal
 * that can be uploaded to Google Drive and used as a Google Sheets backend.
 * 
 * Usage: node scripts/create-database-template.js
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '..', 'database-templates');
const OUTPUT_FILENAME = 'Custom_Orders_Main.xlsx';
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILENAME);

// Sheet names
const ORDERS_SHEET_NAME = 'Orders';
const CONFIG_SHEET_NAME = 'Config';

// Column headers for Orders sheet (UPDATED with Mobile Number)
const ORDERS_HEADERS = [
  'Timestamp',
  'Order ID',
  'Name',
  'Email',
  'Mobile Number',
  'Order Status',
  'Payment Status',
  'Design Specs (Bulleted)',
  'Folder URL',
  'Legal Consent'
];

// Column headers for Config sheet
const CONFIG_HEADERS = ['Key', 'Value'];

// Data validation options
const ORDER_STATUS_OPTIONS = ['Pending', 'In Production', 'Shipped', 'Rejected'];
const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid'];

// Column indices (1-based for ExcelJS) - UPDATED after adding Mobile Number
const ORDER_STATUS_COLUMN = 6;  // Column F (was E, shifted due to Mobile Number)
const PAYMENT_STATUS_COLUMN = 7; // Column G (was F, shifted due to Mobile Number)

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function createDatabaseTemplate() {
  console.log('🚀 Creating Custom Orders Database Template...\n');
  
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
    }
    
    // Initialize workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Custom Design Portal';
    workbook.created = new Date();
    workbook.lastModifiedBy = 'Custom Design Portal';
    workbook.modified = new Date();
    
    // ========================================================================
    // CREATE ORDERS SHEET
    // ========================================================================
    
    console.log('📊 Creating Orders sheet...');
    
    const ordersSheet = workbook.addWorksheet(ORDERS_SHEET_NAME, {
      properties: {
        tabColor: { argb: 'FF1A1A2E' },
        defaultRowHeight: 20
      },
      views: [
        {
          state: 'frozen',
          xSplit: 0,
          ySplit: 1  // Freeze top row
        }
      ]
    });
    
    // Add headers to row 1
    ordersSheet.getRow(1).values = ORDERS_HEADERS;
    
    // Format headers (bold, background color, centered)
    const headerRow = ordersSheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A1A2E' }  // Dark blue background
    };
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };  // White text
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;
    
    // Set column widths (UPDATED with Mobile Number column)
    ordersSheet.getColumn(1).width = 22;  // Timestamp
    ordersSheet.getColumn(2).width = 20;  // Order ID
    ordersSheet.getColumn(3).width = 25;  // Name
    ordersSheet.getColumn(4).width = 30;  // Email
    ordersSheet.getColumn(5).width = 22;  // Mobile Number (NEW)
    ordersSheet.getColumn(6).width = 18;  // Order Status
    ordersSheet.getColumn(7).width = 18;  // Payment Status
    ordersSheet.getColumn(8).width = 40;  // Design Specs
    ordersSheet.getColumn(9).width = 35;  // Folder URL
    ordersSheet.getColumn(10).width = 15;  // Legal Consent
    
    // Apply data validation to Order Status column (Column F, starting from row 2)
    console.log('  ✓ Adding Order Status dropdown validation...');
    const orderStatusRange = `${getColumnName(ORDER_STATUS_COLUMN)}2:${getColumnName(ORDER_STATUS_COLUMN)}10000`;
    ordersSheet.dataValidations.add(orderStatusRange, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${ORDER_STATUS_OPTIONS.join(',')}"`]
    });
    
    // Apply data validation to Payment Status column (Column G, starting from row 2)
    console.log('  ✓ Adding Payment Status dropdown validation...');
    const paymentStatusRange = `${getColumnName(PAYMENT_STATUS_COLUMN)}2:${getColumnName(PAYMENT_STATUS_COLUMN)}10000`;
    ordersSheet.dataValidations.add(paymentStatusRange, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${PAYMENT_STATUS_OPTIONS.join(',')}"`]
    });
    
    // Set default alignment for all cells in Orders sheet
    ordersSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'top', wrapText: true };
      }
    });
    
    // ========================================================================
    // CREATE CONFIG SHEET
    // ========================================================================
    
    console.log('📋 Creating Config sheet...');
    
    const configSheet = workbook.addWorksheet(CONFIG_SHEET_NAME, {
      properties: {
        tabColor: { argb: 'FFE94560' },
        defaultRowHeight: 20
      }
    });
    
    // Add headers to row 1
    configSheet.getRow(1).values = CONFIG_HEADERS;
    
    // Format headers
    const configHeaderRow = configSheet.getRow(1);
    configHeaderRow.font = { bold: true, size: 12 };
    configHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE94560' }  // Accent color background
    };
    configHeaderRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };  // White text
    configHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    configHeaderRow.height = 30;
    
    // Set column widths
    configSheet.getColumn(1).width = 25;
    configSheet.getColumn(2).width = 25;
    
    // Add Config data row (Row 2)
    const configDataRow = configSheet.getRow(2);
    configDataRow.values = ['AcceptingOrders', true];  // Key and boolean TRUE value
    configDataRow.alignment = { vertical: 'middle', horizontal: 'left' };
    
    // Format the Value cell to explicitly show TRUE as boolean
    const valueCell = configSheet.getCell(2, 2);
    valueCell.type = ExcelJS.ValueType.Boolean;
    valueCell.value = true;
    
    // ========================================================================
    // SAVE WORKBOOK
    // ========================================================================
    
    console.log('💾 Saving workbook...\n');
    
    await workbook.xlsx.writeFile(OUTPUT_PATH);
    
    // ========================================================================
    // VERIFICATION & OUTPUT
    // ========================================================================
    
    console.log('✅ Database template created successfully!\n');
    console.log('━'.repeat(60));
    console.log('📄 File Details:');
    console.log(`   Name: ${OUTPUT_FILENAME}`);
    console.log(`   Path: ${OUTPUT_PATH}`);
    console.log(`   Size: ${formatBytes(fs.statSync(OUTPUT_PATH).size)}`);
    console.log('━'.repeat(60));
    console.log('\n📊 Orders Sheet Structure:');
    console.log('   Headers:', ORDERS_HEADERS.join(' | '));
    console.log(`   Order Status Options: ${ORDER_STATUS_OPTIONS.join(', ')}`);
    console.log(`   Payment Status Options: ${PAYMENT_STATUS_OPTIONS.join(', ')}`);
    console.log('━'.repeat(60));
    console.log('\n📋 Config Sheet Structure:');
    console.log('   Headers:', CONFIG_HEADERS.join(' | '));
    console.log('   Row 2: AcceptingOrders | TRUE');
    console.log('━'.repeat(60));
    console.log('\n🚀 Next Steps:');
    console.log('   1. Upload the generated file to Google Drive');
    console.log('   2. Open with Google Sheets (right-click → Open with → Google Sheets)');
    console.log('   3. Copy the Spreadsheet ID from the URL');
    console.log('   4. Update SPREADSHEET_ID in gas/backend.gs');
    console.log('━'.repeat(60));
    console.log('');
    
  } catch (error) {
    console.error('❌ Error creating database template:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts a column number to Excel column letter(s)
 * @param {number} num - Column number (1-based)
 * @returns {string} Column letter(s)
 */
function getColumnName(num) {
  let columnName = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    num = Math.floor((num - 1) / 26);
  }
  return columnName;
}

/**
 * Formats bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// RUN SCRIPT
// ============================================================================

createDatabaseTemplate();
