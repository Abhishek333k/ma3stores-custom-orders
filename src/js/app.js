/**
 * MA³ Store Custom Design Portal - Frontend JavaScript v3.0
 * 
 * MULTIPLE IMAGE UPLOADS PER DESIGN
 * - Supports up to 10 images per design block
 * - Dynamic image preview generation
 * - Groups files by design for backend folder structure
 * 
 * @version 3.0.0
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxROj92INlwWlHUfHgXAnmpYevdAp3xHnmB6yWcjtwl5fuuZslN0hRAm8moNtxQ1yI/exec';
  const SUPPORT_EMAIL = 'myma3store@gmail.com';
  const ACTIVE_ORDERS_FOLDER_ID = '1Vd858k2IROkPfl_B6tIy9W_FlWgk3IUd'; // For fallback URLs
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
  const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total
  const MAX_FILES_PER_DESIGN = 10;

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
  
  const elements = {};

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  function init() {
    cacheElements();
    bindEvents();
    checkOrderStatus();
    addDesignBlock();
    console.log('Design Portal v3.0 initialized (Multiple Images per Design)');
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
  }
  
  function bindEvents() {
    elements.modalCloseBtn?.addEventListener('click', hideCapacityModal);
    elements.capacityModal?.querySelector('.modal-backdrop')?.addEventListener('click', hideCapacityModal);
    elements.addDesignBtn?.addEventListener('click', addDesignBlock);
    elements.designForm?.addEventListener('submit', handleFormSubmit);
    // File input listeners are added individually in addDesignBlock()
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
      await fetch(GAS_WEB_APP_URL, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      console.log('Order status check completed (opaque response)');
    } catch (error) {
      console.error('Error checking order status:', error);
    }
  }
  
  function showCapacityModal() {
    if (elements.capacityModal) {
      elements.capacityModal.hidden = false;
      document.body.style.overflow = 'hidden';
      elements.modalCloseBtn?.focus();
    }
  }
  
  function hideCapacityModal() {
    if (elements.capacityModal) {
      elements.capacityModal.hidden = true;
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
  // FILE HANDLING - MULTIPLE IMAGES WITH PREVIEWS
  // ============================================================================

  function handleFileInputChange(e) {
    const fileInput = e.target;
    if (!fileInput.classList.contains('field-file')) return;

    const files = Array.from(fileInput.files);
    if (files.length === 0) return;

    const designBlock = fileInput.closest('.design-block');
    const previewContainer = designBlock?.querySelector('.image-preview-container');
    const errorSpan = designBlock?.querySelector('.file-error');

    // Validate file count
    if (files.length > MAX_FILES_PER_DESIGN) {
      showError(errorSpan, `Maximum ${MAX_FILES_PER_DESIGN} images allowed per design`);
      fileInput.value = '';
      if (previewContainer) {
        previewContainer.hidden = true;
        previewContainer.innerHTML = '';
      }
      return;
    }

    // Validate each file
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        showError(errorSpan, `Invalid file type: ${file.name}. Please upload images only (PNG, JPG, GIF, WebP, SVG)`);
        fileInput.value = '';
        if (previewContainer) {
          previewContainer.hidden = true;
          previewContainer.innerHTML = '';
        }
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        showError(errorSpan, `File "${file.name}" exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`);
        fileInput.value = '';
        if (previewContainer) {
          previewContainer.hidden = true;
          previewContainer.innerHTML = '';
        }
        return;
      }
    }

    // Clear previous previews completely and generate new ones
    if (previewContainer) {
      previewContainer.innerHTML = '';
      previewContainer.hidden = false;

      // Generate preview for each file (only once)
      files.forEach((file) => {
        generateImagePreview_(file, previewContainer, fileInput);
      });
    }

    clearError(errorSpan);
  }

  function generateImagePreview_(file, container, fileInput) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const previewItem = document.createElement('div');
      previewItem.className = 'image-preview-item';

      // Store file reference directly on the element
      previewItem.file = file;

      previewItem.innerHTML = `
        <img src="${e.target.result}" alt="${file.name}" class="image-preview-thumb">
        <div class="image-preview-info">
          <span class="image-preview-name" title="${file.name}">${file.name}</span>
          <span class="image-preview-size">${formatFileSize(file.size)}</span>
        </div>
        <button type="button" class="image-preview-remove" aria-label="Remove image">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;

      // Remove button handler
      const removeBtn = previewItem.querySelector('.image-preview-remove');
      removeBtn.addEventListener('click', function() {
        removeImageFromInput_(previewItem, fileInput, container);
      });

      container.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
  }

  function removeImageFromInput_(previewItem, fileInput, container) {
    // Get all preview items
    const previews = Array.from(container.querySelectorAll('.image-preview-item'));
    const index = previews.indexOf(previewItem);

    if (index === -1) return;

    // Create new FileList without the removed file
    const files = Array.from(fileInput.files);
    files.splice(index, 1);

    const dataTransfer = new DataTransfer();
    files.forEach(f => dataTransfer.items.add(f));
    fileInput.files = dataTransfer.files;

    // Remove preview element
    previewItem.remove();

    // Hide container if no files left
    if (files.length === 0) {
      container.hidden = true;
      container.innerHTML = '';
    }
  }
  
  function getTotalFileSize() {
    const fileInputs = document.querySelectorAll('.field-file');
    let totalSize = 0;
    const designs = [];
    
    fileInputs.forEach((input, designIndex) => {
      const files = Array.from(input.files);
      const designBlock = input.closest('.design-block');
      const productType = designBlock?.querySelector('[name="productType"]')?.value || 'Custom';
      
      if (files.length > 0) {
        const designSize = files.reduce((sum, file) => sum + file.size, 0);
        totalSize += designSize;
        
        designs.push({
          designIndex: designIndex + 1,
          productType: productType,
          files: files.map(file => ({
            file: file,
            size: file.size
          })),
          totalSize: designSize,
          designBlock: designBlock
        });
      }
    });
    
    return { totalSize, designs };
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ============================================================================
  // FORM SUBMISSION - V3.0 WITH MULTI-IMAGE SUPPORT
  // ============================================================================
  
  async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    if (!validateForm()) return;
    
    const { totalSize, designs } = getTotalFileSize();
    if (totalSize > MAX_TOTAL_SIZE) {
      alert(`Total file size (${formatFileSize(totalSize)}) exceeds maximum allowed (${formatFileSize(MAX_TOTAL_SIZE)}).`);
      return;
    }
    
    isSubmitting = true;
    clearAllErrors();
    
    try {
      // Generate Order ID
      const timestamp = new Date();
      const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      currentOrderId = `ORD-${dateStr}-${randomNum}`;
      
      setLoadingState(true, 'Requesting secure upload tunnel...', 'Generating secure URLs for your files');
      
      // Build file metadata grouped by design
      const allFileMetadata = [];
      designs.forEach(design => {
        const designFolderName = `Design ${design.designIndex} - ${design.productType}`;
        
        design.files.forEach((fileData, fileIndex) => {
          allFileMetadata.push({
            designIndex: design.designIndex,
            designFolderName: designFolderName,
            productType: design.productType,
            fileName: `design-${design.designIndex}-${fileIndex + 1}-${design.productType.replace(/\s+/g, '-').toLowerCase()}.${fileData.file.name.split('.').pop()}`,
            mimeType: fileData.file.type,
            file: fileData.file,
            designBlock: design.designBlock
          });
        });
      });
      
      // STEP 1: Get Upload URLs
      const uploadUrlsResponse = await requestUploadUrls_(allFileMetadata);
      
      if (!uploadUrlsResponse.success) {
        throw new Error(uploadUrlsResponse.error || 'Failed to get upload URLs');
      }
      
      currentOrderId = uploadUrlsResponse.orderId || currentOrderId;
      currentFolderUrl = uploadUrlsResponse.folderUrl;
      
      console.log('Order ID:', currentOrderId);
      console.log('Folder URL:', currentFolderUrl);
      
      // STEP 2: Upload files to Drive
      setLoadingState(true, 'Uploading high-resolution files...', `Uploading ${allFileMetadata.length} images to secure storage`);
      
      const uploadResults = await uploadFilesToDrive_(allFileMetadata, uploadUrlsResponse.uploadUrls);
      
      const failedUploads = uploadResults.filter(r => !r.success);
      if (failedUploads.length > 0) {
        throw new Error(`Failed to upload ${failedUploads.length} file(s). Please try again.`);
      }
      
      console.log('All files uploaded successfully:', uploadResults);
      
      // STEP 3: Log order
      setLoadingState(true, 'Finalizing order...', 'Saving your order details to our system');
      
      // Group upload results by design for formatted specs
      const designsSpecs = {};
      uploadResults.forEach(result => {
        const designKey = `Design ${result.designIndex} - ${result.productType}`;
        if (!designsSpecs[designKey]) {
          designsSpecs[designKey] = [];
        }
        designsSpecs[designKey].push(result.fileName);
      });
      
      const formattedSpecs = Object.entries(designsSpecs)
        .map(([design, files]) => `• ${design}: ${files.length} image(s) uploaded`)
        .join('\n');
      
      const logOrderPayload = {
        orderId: currentOrderId,
        customerName: elements.customerName?.value.trim() || '',
        customerEmail: elements.customerEmail?.value.trim() || '',
        mobileNumber: elements.customerMobile?.value.trim() || '',
        formattedSpecs: formattedSpecs,
        folderUrl: currentFolderUrl,
        legalConsent: elements.legalConsent?.checked || false
      };
      
      const logResponse = await logOrder_(logOrderPayload);
      
      if (!logResponse.success) {
        throw new Error(logResponse.error || 'Failed to log order');
      }
      
      // SUCCESS
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
  
  async function requestUploadUrls_(fileMetadata) {
    return new Promise((resolve, reject) => {
      if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
        console.log('Development mode - simulating upload URLs');
        setTimeout(() => {
          resolve({
            success: true,
            orderId: 'ORD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-DEV',
            folderUrl: '#',
            uploadUrls: fileMetadata.map((f, i) => ({
              uploadUrl: 'https://mock-upload-url.example.com/' + i,
              index: i,
              fileName: f.fileName,
              mimeType: f.mimeType,
              designIndex: f.designIndex,
              designFolderName: f.designFolderName
            }))
          });
        }, 1000);
        return;
      }

      // Use text/plain to bypass CORS preflight, but send JSON body
      // Build payload with base64 images
      const payload = {
        action: 'getUploadUrls',
        orderId: currentOrderId,
        customerName: elements.customerName?.value.trim() || '',
        files: await Promise.all(fileMetadata.map(async f => ({
          fileName: f.fileName,
          mimeType: f.mimeType,
          designIndex: f.designIndex,
          designFolderName: f.designFolderName,
          productType: f.productType,
          base64Image: await fileToBase64(f.file) // Convert file to base64
        })))
      };

      console.log('Sending to GAS:', GAS_WEB_APP_URL);
      console.log('Payload:', payload);

      // Use text/plain to bypass CORS preflight, but send JSON
      const xhr = new XMLHttpRequest();
      xhr.open('POST', GAS_WEB_APP_URL, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      
      xhr.onload = function() {
        console.log('XHR completed with status:', xhr.status);
        console.log('Response text:', xhr.responseText);
        
        // Parse response
        if (xhr.responseText && xhr.responseText.length > 0) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.status === 'success') {
              console.log('✓ GAS response:', data);
              resolve({
                success: true,
                orderId: data.orderId,
                folderUrl: data.folderUrl,
                uploadUrls: data.uploadUrls || [],
                isMock: false
              });
              return;
            } else {
              reject(new Error(data.message || 'GAS returned error'));
              return;
            }
          } catch (e) {
            console.error('Failed to parse GAS response:', e);
          }
        }
        
        reject(new Error('No response from server'));
      };
      
      xhr.onerror = function() {
        console.error('XHR network error');
        reject(new Error('Network error - check console'));
      };
      
      xhr.ontimeout = function() {
        console.error('XHR timeout');
        reject(new Error('Request timeout'));
      };
      
      xhr.timeout = 90000;
      
      // Send JSON with text/plain header (CORS bypass)
      const jsonString = JSON.stringify(payload);
      console.log('Sending JSON payload:', jsonString.substring(0, 200) + '...');
      xhr.send(jsonString);
    });
  }
  
  async function uploadFilesToDrive_(fileMetadata, uploadUrls) {
    const results = [];
    
    // If uploadUrls is empty, backend already uploaded the files
    // Just return success for each file
    if (!uploadUrls || uploadUrls.length === 0) {
      console.log('Backend uploaded files directly, skipping frontend upload');
      for (let i = 0; i < fileMetadata.length; i++) {
        results.push({
          success: true,
          fileName: fileMetadata[i].fileName,
          designIndex: fileMetadata[i].designIndex,
          productType: fileMetadata[i].productType,
          index: i
        });
      }
      return results;
    }
    
    // Real upload flow (if we ever get upload URLs)
    for (let i = 0; i < fileMetadata.length; i++) {
      const metaData = fileMetadata[i];
      const uploadInfo = uploadUrls.find(u => u.index === i) || uploadUrls[i];
      
      try {
        setLoadingState(true, 'Uploading files...', `Uploading ${i + 1} of ${fileMetadata.length}: ${metaData.fileName}`);
        
        const uploadResult = await uploadToDriveUrl_(metaData.file, uploadInfo.uploadUrl);
        
        results.push({
          success: uploadResult.success,
          fileName: uploadInfo.fileName,
          designIndex: uploadInfo.designIndex,
          productType: metaData.productType,
          index: i
        });
        
      } catch (error) {
        console.error(`Upload failed for file ${i}:`, error);
        results.push({
          success: false,
          fileName: uploadInfo?.fileName || `file-${i}`,
          designIndex: uploadInfo?.designIndex || 0,
          index: i,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  async function uploadToDriveUrl_(file, uploadUrl) {
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
      
      return { success: true, response: await response.json() };
      
    } catch (error) {
      console.warn('Direct upload failed:', error.message);
      throw error;
    }
  }
  
  async function logOrder_(payload) {
    return new Promise((resolve, reject) => {
      if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
        console.log('Development mode - simulating order logging');
        setTimeout(() => {
          resolve({ success: true, orderId: payload.orderId, sheetRow: 2 });
        }, 500);
        return;
      }

      console.log('Logging order:', payload.orderId);

      // Use FormData to avoid CORS preflight
      const formData = new FormData();
      formData.append('action', 'logOrder');
      formData.append('orderId', payload.orderId);
      formData.append('customerName', payload.customerName);
      formData.append('customerEmail', payload.customerEmail || '');
      formData.append('mobileNumber', payload.mobileNumber);
      formData.append('formattedSpecs', payload.formattedSpecs);
      formData.append('folderUrl', payload.folderUrl);
      formData.append('legalConsent', payload.legalConsent.toString());

      const xhr = new XMLHttpRequest();
      xhr.open('POST', GAS_WEB_APP_URL, true);
      // No Content-Type header - browser sets multipart/form-data automatically
      
      xhr.onload = function() {
        console.log('Log order XHR status:', xhr.status);
        console.log('Log order response:', xhr.responseText);
        
        if (xhr.responseText && xhr.responseText.length > 0) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.status === 'success') {
              resolve(data);
              return;
            }
          } catch (e) {
            console.log('Response not JSON');
          }
        }
        
        // Assume success even without response
        console.warn('No response from logOrder, assuming success...');
        resolve({ success: true, orderId: payload.orderId });
      };
      
      xhr.onerror = function() {
        console.error('Log order XHR error - but may have completed');
        // Assume success anyway
        console.warn('Continuing assuming order was logged...');
        resolve({ success: true, orderId: payload.orderId });
      };
      
      xhr.ontimeout = function() {
        console.error('Log order timeout');
        reject(new Error('Request timeout'));
      };
      
      xhr.timeout = 90000;
      
      console.log('Sending logOrder FormData');
      xhr.send(formData);
    });
  }
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper: Convert File to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================
  
  function validateForm() {
    let isValid = true;
    
    // Name
    if (!elements.customerName?.value.trim()) {
      showError(document.getElementById('name-error'), 'Please enter your full name');
      elements.customerName?.classList.add('error');
      isValid = false;
    } else {
      elements.customerName?.classList.remove('error');
    }
    
    // Email (optional)
    const email = elements.customerEmail?.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(document.getElementById('email-error'), 'Please enter a valid email address');
      elements.customerEmail?.classList.add('error');
      isValid = false;
    } else {
      elements.customerEmail?.classList.remove('error');
      clearError(document.getElementById('email-error'));
    }
    
    // Mobile (Indian format)
    const mobile = elements.customerMobile?.value.trim();
    if (!mobile) {
      showError(document.getElementById('mobile-error'), 'Mobile number is required');
      elements.customerMobile?.classList.add('error');
      isValid = false;
    } else if (!/^[+]?91[0-9]{10}$/.test(mobile.replace(/\s/g, ''))) {
      showError(document.getElementById('mobile-error'), 'Enter valid Indian mobile (e.g., +91 9876543210)');
      elements.customerMobile?.classList.add('error');
      isValid = false;
    } else {
      elements.customerMobile?.classList.remove('error');
    }
    
    // Consent
    if (!elements.legalConsent?.checked) {
      showError(document.getElementById('consent-error'), 'You must confirm the IP Declaration');
      isValid = false;
    } else {
      clearError(document.getElementById('consent-error'));
    }
    
    // Designs
    const designBlocks = elements.subDesignsContainer?.querySelectorAll('.design-block') || [];
    if (designBlocks.length === 0) {
      alert('Please add at least one design');
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
        showError(fileError, 'Please upload at least one image');
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
  // UI STATE
  // ============================================================================
  
  function handleSuccess(response) {
    if (elements.formSection) elements.formSection.hidden = true;
    if (elements.successSection) {
      elements.successSection.hidden = false;
      document.getElementById('success-order-id').textContent = response.orderId || 'N/A';
      document.getElementById('success-email').textContent = elements.customerEmail?.value || 'your email';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  function handleError(error) {
    alert('Submission Failed\n\n' + (error.message || 'An unexpected error occurred.') + '\n\nPlease try again or contact support.');
  }
  
  function setLoadingState(loading, text, subtext) {
    if (!elements.submitBtn) return;
    
    elements.submitBtn.disabled = loading;
    
    if (loading) {
      elements.submitBtn.classList.add('loading');
    } else {
      elements.submitBtn.classList.remove('loading');
    }
    
    if (elements.loadingOverlay) elements.loadingOverlay.hidden = !loading;
    if (elements.loadingText && text) elements.loadingText.textContent = text;
    if (elements.loadingSubtext && subtext) elements.loadingSubtext.textContent = subtext;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  function showError(el, msg) { if (el) el.textContent = msg; }
  function clearError(el) { if (el) el.textContent = ''; }
  function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  }

  // ============================================================================
  // START
  // ============================================================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
