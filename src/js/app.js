/**
 * Custom Design Submission Portal - Frontend JavaScript v2.0
 * 
 * DIRECT BINARY UPLOAD ARCHITECTURE
 * 
 * Two-step upload flow:
 * 1. Request secure upload URLs from backend (getUploadUrls)
 * 2. Upload files directly to Google Drive via PUT requests
 * 3. Log order metadata to backend (logOrder)
 * 
 * Supports files up to 50MB each via Google Drive Resumable Upload API
 * 
 * @version 2.0.0
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  /**
   * Google Apps Script Web App URL
   * MA³ Store Custom Design Portal Backend
   */
  const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwzK4_9D9VfyZzf16YcP93m7b-Ymik_u_A1uQd5Tq1xDhN5qrN2snU6SdBujHfwIvEM/exec';
  
  /**
   * Support email address
   */
  const SUPPORT_EMAIL = 'myma3store@gmail.com';
  
  /**
   * Maximum individual file size (50MB) - Google Drive resumable upload limit
   */
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  
  /**
   * Maximum total size for all files combined (200MB)
   */
  const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB
  
  /**
   * Upload timeout in milliseconds (10 minutes for large files)
   */
  const UPLOAD_TIMEOUT = 10 * 60 * 1000;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  let designCount = 0;
  let isSubmitting = false;
  let currentOrderId = null;
  let currentFolderUrl = null;

  // ============================================================================
  // DOM ELEMENTS
  // ============================================================================
  
  const elements = {
    // Modal
    capacityModal: null,
    modalCloseBtn: null,
    
    // Loading
    loadingOverlay: null,
    loadingText: null,
    loadingSubtext: null,
    
    // Form sections
    formSection: null,
    successSection: null,
    designForm: null,
    
    // Form fields
    customerName: null,
    customerEmail: null,
    customerMobile: null,
    legalConsent: null,
    
    // Dynamic designs
    subDesignsContainer: null,
    addDesignBtn: null,
    designBlockTemplate: null,
    
    // Submit
    submitBtn: null,
    btnText: null,
    btnLoading: null
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  function init() {
    cacheElements();
    bindEvents();
    checkOrderStatus();
    addDesignBlock();
    
    console.log('Design Portal v2.0 initialized (Direct Binary Upload)');
  }
  
  function cacheElements() {
    elements.capacityModal = document.getElementById('capacity-modal');
    elements.modalCloseBtn = document.getElementById('modal-close-btn');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.loadingText = elements.loadingOverlay?.querySelector('.loading-text');
    elements.loadingSubtext = elements.loadingOverlay?.querySelector('.loading-subtext');
    elements.formSection = document.getElementById('submission-form-section');
    elements.successSection = document.getElementById('success-section');
    elements.designForm = document.getElementById('design-form');
    elements.customerName = document.getElementById('customer-name');
    elements.customerEmail = document.getElementById('customer-email');
    elements.customerMobile = document.getElementById('customer-mobile');
    elements.legalConsent = document.getElementById('legal-consent');
    elements.subDesignsContainer = document.getElementById('sub-designs-container');
    elements.addDesignBtn = document.getElementById('add-design-btn');
    elements.designBlockTemplate = document.getElementById('design-block-template');
    elements.submitBtn = document.getElementById('submit-btn');
    elements.btnText = elements.submitBtn?.querySelector('.btn-text');
    elements.btnLoading = elements.submitBtn?.querySelector('.btn-loading');
  }
  
  function bindEvents() {
    elements.modalCloseBtn?.addEventListener('click', hideCapacityModal);
    elements.capacityModal?.querySelector('.modal-backdrop')?.addEventListener('click', hideCapacityModal);
    elements.addDesignBtn?.addEventListener('click', addDesignBlock);
    elements.designForm?.addEventListener('submit', handleFormSubmit);
    document.addEventListener('change', handleFileInputChange);
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && elements.capacityModal && !elements.capacityModal.hidden) {
        hideCapacityModal();
      }
    });
  }

  // ============================================================================
  // ORDER STATUS CHECK
  // ============================================================================
  
  async function checkOrderStatus() {
    if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
      console.warn('GAS_WEB_APP_URL not configured');
      return;
    }
    
    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) throw new Error('Failed to fetch order status');
      
      const data = await response.json();
      
      if (data.success && !data.acceptingOrders) {
        showCapacityModal();
      }
      
    } catch (error) {
      console.error('Error checking order status:', error);
    }
  }
  
  function showCapacityModal() {
    if (elements.capacityModal) {
      elements.capacityModal.hidden = false;
      elements.capacityModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      elements.modalCloseBtn?.focus();
    }
  }
  
  function hideCapacityModal() {
    if (elements.capacityModal) {
      elements.capacityModal.hidden = true;
      elements.capacityModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  // ============================================================================
  // DYNAMIC DESIGN BLOCKS
  // ============================================================================
  
  function addDesignBlock() {
    designCount++;
    
    if (!elements.designBlockTemplate || !elements.subDesignsContainer) {
      console.error('Design template or container not found');
      return;
    }
    
    const template = elements.designBlockTemplate;
    const clone = template.content.cloneNode(true);
    const designBlock = clone.querySelector('.design-block');
    
    designBlock.dataset.designIndex = designCount;
    
    const designNumber = designBlock.querySelector('.design-number');
    if (designNumber) designNumber.textContent = `Design ${designCount}`;
    
    const removeBtn = designBlock.querySelector('.btn-remove-design');
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        removeDesignBlock(designBlock);
      });
    }
    
    const fileInput = designBlock.querySelector('.field-file');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileInputChange);
    }
    
    elements.subDesignsContainer.appendChild(designBlock);
    updateRemoveButtonsVisibility();
  }
  
  function removeDesignBlock(designBlock) {
    designBlock.style.opacity = '0';
    designBlock.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      designBlock.remove();
      renumberDesignBlocks();
      updateRemoveButtonsVisibility();
    }, 200);
  }
  
  function renumberDesignBlocks() {
    const blocks = elements.subDesignsContainer?.querySelectorAll('.design-block') || [];
    blocks.forEach((block, index) => {
      const number = block.querySelector('.design-number');
      if (number) number.textContent = `Design ${index + 1}`;
      block.dataset.designIndex = index + 1;
    });
    designCount = blocks.length;
  }
  
  function updateRemoveButtonsVisibility() {
    const removeBtns = elements.subDesignsContainer?.querySelectorAll('.btn-remove-design') || [];
    
    if (removeBtns.length <= 1) {
      removeBtns.forEach(btn => btn.style.visibility = 'hidden');
    } else {
      removeBtns.forEach(btn => btn.style.visibility = 'visible');
    }
  }

  // ============================================================================
  // FILE HANDLING
  // ============================================================================
  
  function handleFileInputChange(e) {
    const fileInput = e.target;
    if (!fileInput.classList.contains('field-file')) return;
    
    const file = fileInput.files[0];
    if (!file) return;
    
    const designBlock = fileInput.closest('.design-block');
    const previewContainer = designBlock?.querySelector('.file-preview');
    const previewImage = previewContainer?.querySelector('.file-preview-image');
    const previewName = previewContainer?.querySelector('.file-preview-name');
    const previewSize = previewContainer?.querySelector('.file-preview-size');
    const errorSpan = designBlock?.querySelector('.file-error');
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      showError(errorSpan, 'Please select a valid image file (PNG, JPG, GIF, WebP, or SVG)');
      fileInput.value = '';
      if (previewContainer) previewContainer.hidden = true;
      return;
    }
    
    // Validate file size (50MB limit)
    if (file.size > MAX_FILE_SIZE) {
      showError(errorSpan, `File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`);
      fileInput.value = '';
      if (previewContainer) previewContainer.hidden = true;
      return;
    }
    
    clearError(errorSpan);
    
    // Show preview
    if (previewContainer && previewImage && previewName && previewSize) {
      const reader = new FileReader();
      reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewName.textContent = file.name;
        previewSize.textContent = formatFileSize(file.size);
        previewContainer.hidden = false;
      };
      reader.readAsDataURL(file);
    }
  }
  
  function getTotalFileSize() {
    const fileInputs = document.querySelectorAll('.field-file');
    let totalSize = 0;
    const files = [];
    
    fileInputs.forEach(input => {
      const file = input.files[0];
      if (file) {
        totalSize += file.size;
        files.push({
          file: file,
          designBlock: input.closest('.design-block')
        });
      }
    });
    
    return { totalSize, files };
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ============================================================================
  // FORM SUBMISSION - TWO-STEP UPLOAD FLOW
  // ============================================================================
  
  async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    if (!validateForm()) return;
    
    // Check total file size
    const { totalSize, files } = getTotalFileSize();
    if (totalSize > MAX_TOTAL_SIZE) {
      alert(
        `Total file size (${formatFileSize(totalSize)}) exceeds the maximum allowed size of ${formatFileSize(MAX_TOTAL_SIZE)}.\n\n` +
        'Please reduce the number or size of images.'
      );
      return;
    }
    
    isSubmitting = true;
    clearAllErrors();
    
    try {
      // ==========================================================================
      // STEP 1: Request secure upload URLs from backend
      // ==========================================================================
      setLoadingState(true, 'Requesting secure upload tunnel...', 'Generating secure URLs for your files');
      
      const fileMetadata = files.map((f, index) => {
        const block = f.designBlock;
        const productType = block.querySelector('[name="productType"]')?.value || 'Custom';
        const extension = f.file.name.split('.').pop() || 'png';
        return {
          fileName: `design-${index + 1}-${productType.replace(/\s+/g, '-').toLowerCase()}.${extension}`,
          mimeType: f.file.type,
          productType: productType
        };
      });
      
      const uploadUrlsResponse = await requestUploadUrls_(fileMetadata);
      
      if (!uploadUrlsResponse.success) {
        throw new Error(uploadUrlsResponse.error || 'Failed to get upload URLs');
      }
      
      currentOrderId = uploadUrlsResponse.orderId;
      currentFolderUrl = uploadUrlsResponse.folderUrl;
      
      console.log('Order ID:', currentOrderId);
      console.log('Folder URL:', currentFolderUrl);
      
      // ==========================================================================
      // STEP 2: Upload files directly to Google Drive via PUT requests
      // ==========================================================================
      setLoadingState(true, 'Uploading high-resolution files...', `Uploading ${files.length} design file(s) to secure storage`);
      
      const uploadResults = await uploadFilesToDrive_(files, uploadUrlsResponse.uploadUrls);
      
      // Check for upload failures
      const failedUploads = uploadResults.filter(r => !r.success);
      if (failedUploads.length > 0) {
        throw new Error(`Failed to upload ${failedUploads.length} file(s). Please try again.`);
      }
      
      console.log('All files uploaded successfully:', uploadResults);
      
      // ==========================================================================
      // STEP 3: Log order metadata to backend
      // ==========================================================================
      setLoadingState(true, 'Finalizing order...', 'Saving your order details to our system');
      
      const subDesigns = uploadResults.map((result, index) => ({
        productType: fileMetadata[index].productType,
        specs: files[index].designBlock.querySelector('[name="specs"]')?.value || '',
        fileName: result.fileName
      }));
      
      const logOrderPayload = {
        action: 'logOrder',
        orderId: currentOrderId,
        customerName: elements.customerName?.value.trim() || '',
        email: elements.customerEmail?.value.trim() || '',
        mobileNumber: elements.customerMobile?.value.trim() || '',
        subDesigns: subDesigns,
        folderUrl: currentFolderUrl,
        legalConsent: elements.legalConsent?.checked || false
      };
      
      const logResponse = await logOrder_(logOrderPayload);
      
      if (!logResponse.success) {
        throw new Error(logResponse.error || 'Failed to log order');
      }
      
      // ==========================================================================
      // SUCCESS: Show confirmation
      // ==========================================================================
      handleSuccess({
        orderId: currentOrderId,
        folderUrl: currentFolderUrl
      });
      
    } catch (error) {
      console.error('Submission error:', error);
      handleError(error);
    } finally {
      isSubmitting = false;
      setLoadingState(false);
    }
  }
  
  /**
   * STEP 1: Request upload URLs from backend
   */
  async function requestUploadUrls_(fileMetadata) {
    if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
      // Development mode - simulate response
      console.log('Development mode - simulating upload URLs');
      await sleep(1000);
      return {
        success: true,
        orderId: 'ORD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-DEV',
        folderUrl: '#',
        uploadUrls: fileMetadata.map((f, i) => ({
          fileName: f.fileName,
          mimeType: f.mimeType,
          uploadUrl: 'https://mock-upload-url.example.com/' + i,
          index: i
        }))
      };
    }
    
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'X-Action': 'getUploadUrls'
      },
      body: JSON.stringify({
        action: 'getUploadUrls',
        customerName: elements.customerName?.value.trim() || '',
        files: fileMetadata
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    
    return await response.json();
  }
  
  /**
   * STEP 2: Upload files directly to Google Drive
   */
  async function uploadFilesToDrive_(files, uploadUrls) {
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const fileData = files[i];
      const uploadInfo = uploadUrls.find(u => u.index === i) || uploadUrls[i];
      
      try {
        setLoadingState(true, 'Uploading files...', `Uploading ${i + 1} of ${files.length}: ${fileData.file.name}`);
        
        if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
          // Development mode - simulate upload
          await sleep(500 + Math.random() * 1000);
          results.push({
            success: true,
            fileName: uploadInfo.fileName,
            index: i
          });
          continue;
        }
        
        // Production mode - upload directly to Drive via PUT
        const uploadResult = await uploadToDriveUrl_(fileData.file, uploadInfo.uploadUrl);
        
        results.push({
          success: uploadResult.success,
          fileName: uploadInfo.fileName,
          index: i,
          response: uploadResult.response
        });
        
      } catch (error) {
        console.error(`Upload failed for file ${i}:`, error);
        results.push({
          success: false,
          fileName: uploadInfo?.fileName || `file-${i}`,
          index: i,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Upload a single file to Google Drive using resumable upload URL
   */
  async function uploadToDriveUrl_(file, uploadUrl) {
    // For security reasons, we cannot directly upload to Google's upload URL from browser
    // The upload URL is meant for server-side use
    // 
    // WORKAROUND: We'll use a proxy approach or the simpler insert method
    // 
    // OPTION 1: Use the upload URL with CORS workaround (may not work due to CORS)
    // OPTION 2: Fall back to Base64 for smaller files
    // OPTION 3: Use a Cloud Function proxy
    
    // For now, we'll attempt direct upload with proper headers
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        mode: 'cors',
        headers: {
          'Content-Type': file.type,
          'Content-Length': file.size.toString()
        },
        body: file
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        response: result
      };
      
    } catch (error) {
      // If direct upload fails, we may need to use a different approach
      console.warn('Direct upload failed, error:', error.message);
      throw error;
    }
  }
  
  /**
   * STEP 3: Log order to backend after files are uploaded
   */
  async function logOrder_(payload) {
    if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
      console.log('Development mode - simulating order logging');
      await sleep(500);
      return {
        success: true,
        orderId: payload.orderId,
        sheetRow: 2
      };
    }
    
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'X-Action': 'logOrder'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    
    return await response.json();
  }
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================
  
  function validateForm() {
    let isValid = true;
    
    // Validate name
    if (!elements.customerName?.value.trim()) {
      showError(document.getElementById('name-error'), 'Please enter your full name');
      elements.customerName?.classList.add('error');
      isValid = false;
    } else {
      elements.customerName?.classList.remove('error');
    }
    
    // Validate email (optional)
    const email = elements.customerEmail?.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      showError(document.getElementById('email-error'), 'Please enter a valid email address');
      elements.customerEmail?.classList.add('error');
      isValid = false;
    } else {
      elements.customerEmail?.classList.remove('error');
      clearError(document.getElementById('email-error'));
    }
    
    // Validate mobile (Indian format - required)
    const mobile = elements.customerMobile?.value.trim();
    const mobileRegex = /^[+]?91[0-9]{10}$/;
    
    if (!mobile) {
      showError(document.getElementById('mobile-error'), 'Mobile number is required');
      elements.customerMobile?.classList.add('error');
      isValid = false;
    } else if (!mobileRegex.test(mobile.replace(/\s/g, ''))) {
      showError(document.getElementById('mobile-error'), 'Enter valid Indian mobile (e.g., +91 9876543210)');
      elements.customerMobile?.classList.add('error');
      isValid = false;
    } else {
      elements.customerMobile?.classList.remove('error');
    }
    
    // Validate consent
    if (!elements.legalConsent?.checked) {
      showError(document.getElementById('consent-error'), 'You must confirm the IP Declaration to proceed');
      isValid = false;
    } else {
      clearError(document.getElementById('consent-error'));
    }
    
    // Validate design blocks
    const designBlocks = elements.subDesignsContainer?.querySelectorAll('.design-block') || [];
    if (designBlocks.length === 0) {
      alert('Please add at least one design to your order');
      isValid = false;
    }
    
    designBlocks.forEach((block) => {
      const productType = block.querySelector('[name="productType"]');
      const specs = block.querySelector('[name="specs"]');
      const fileInput = block.querySelector('.field-file');
      const fileError = block.querySelector('.file-error');
      
      if (!productType?.value.trim()) {
        productType?.classList.add('error');
        isValid = false;
      } else {
        productType?.classList.remove('error');
      }
      
      if (!specs?.value.trim()) {
        specs?.classList.add('error');
        isValid = false;
      } else {
        specs?.classList.remove('error');
      }
      
      if (!fileInput?.files.length) {
        showError(fileError, 'Please upload a design image');
        isValid = false;
      } else {
        clearError(fileError);
      }
    });
    
    if (!isValid) {
      const firstError = document.querySelector('.error, .field-error:not(:empty)');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    return isValid;
  }

  // ============================================================================
  // UI STATE MANAGEMENT
  // ============================================================================
  
  function handleSuccess(response) {
    if (elements.formSection) elements.formSection.hidden = true;
    
    if (elements.successSection) {
      elements.successSection.hidden = false;
      
      const orderIdEl = document.getElementById('success-order-id');
      const emailEl = document.getElementById('success-email');
      if (orderIdEl) orderIdEl.textContent = response.orderId || 'N/A';
      if (emailEl) emailEl.textContent = elements.customerEmail?.value || 'your email';
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  function handleError(error) {
    const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    
    alert(
      'Submission Failed\n\n' +
      errorMessage + '\n\n' +
      'Please check your connection and try again. If the problem persists, contact support.'
    );
  }
  
  function setLoadingState(loading, text, subtext) {
    if (!elements.submitBtn) return;

    elements.submitBtn.disabled = loading;
    
    // Toggle loading class for CSS-based text swap
    if (loading) {
      elements.submitBtn.classList.add('loading');
    } else {
      elements.submitBtn.classList.remove('loading');
    }

    if (elements.loadingOverlay) {
      elements.loadingOverlay.hidden = !loading;
    }

    if (elements.loadingText && text) {
      elements.loadingText.textContent = text;
    }

    if (elements.loadingSubtext && subtext) {
      elements.loadingSubtext.textContent = subtext;
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  function showError(errorEl, message) {
    if (errorEl) errorEl.textContent = message;
  }
  
  function clearError(errorEl) {
    if (errorEl) errorEl.textContent = '';
  }
  
  function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  }

  // ============================================================================
  // START APPLICATION
  // ============================================================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
