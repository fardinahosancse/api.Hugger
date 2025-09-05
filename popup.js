document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const apiList = document.getElementById('api-list');
  const emptyState = document.getElementById('empty-state');
  const addApiButton = document.getElementById('add-api-button');
  const addApiModal = document.getElementById('add-api-modal');
  const addApiForm = document.getElementById('add-api-form');
  const closeButton = document.querySelector('.close-button');
  const cancelButton = document.getElementById('cancel-button');
  const searchInput = document.getElementById('search-input');
  const sortDropdown = document.getElementById('sort-dropdown');
  const sortTrigger = document.getElementById('sort-trigger');
  const sortMenu = document.getElementById('sort-menu');
  const dropdownText = sortTrigger.querySelector('.dropdown-text');
  const tagItemsContainer = document.getElementById('tag-items-container');
  const selectAllCheckbox = document.getElementById('select-all');
  const deleteSelectedButton = document.getElementById('delete-selected');
  const exportSelectedButton = document.getElementById('export-selected');
  const infoButton = document.getElementById('info-button');

  // State
  let apiKeys = [];
  let filteredApiKeys = [];
  let selectedApiIds = new Set();
  let allTags = new Set();

  // Initialize
  loadApiKeys();
  initializeDropdownItems();

  // Event Listeners
  addApiButton.addEventListener('click', () => openModal());
  closeButton.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);
  addApiForm.addEventListener('submit', handleFormSubmit);
  searchInput.addEventListener('input', handleSearch);
  sortTrigger.addEventListener('click', toggleDropdown);
  document.addEventListener('click', handleOutsideClick);
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  deleteSelectedButton.addEventListener('click', handleDeleteSelected);
  exportSelectedButton.addEventListener('click', handleExportSelected);
  document.getElementById('import-json').addEventListener('click', handleImportJson);
  infoButton.addEventListener('click', openInfoModal);
  document.getElementById('info-close-button').addEventListener('click', closeInfoModal);
  document.getElementById('full-info-close-button').addEventListener('click', closeFullInfoModal);
  document.getElementById('add-field-button').addEventListener('click', addCustomField);
  document.getElementById('import-json-modal').addEventListener('click', handleImportJsonToModal);

  // Functions
  function loadApiKeys() {
    chrome.storage.sync.get(['apiKeys'], (result) => {
      apiKeys = result.apiKeys || [];
      filteredApiKeys = [...apiKeys];
      
      // Extract all unique tags
      allTags.clear();
      apiKeys.forEach(api => {
        if (api.tag) {
          api.tag.split(',').forEach(tag => {
            allTags.add(tag.trim());
          });
        }
      });
      
      // Populate tag dropdown
      populateTagDropdown();
      
      renderApiList();
      updateBulkActionButtons();
    });
  }
  
  function populateTagDropdown() {
    // Clear existing tag items
    tagItemsContainer.innerHTML = '';
    
    // Add tags as dropdown items
    const sortedTags = Array.from(allTags).sort();
    
    sortedTags.forEach(tag => {
      const tagItem = document.createElement('div');
      tagItem.className = 'dropdown-item tag-item';
      tagItem.textContent = tag;
      tagItem.setAttribute('data-value', 'tag:' + tag);
      
      tagItem.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDropdownItemClick('tag:' + tag, `Tag: ${tag}`);
      });
      
      tagItemsContainer.appendChild(tagItem);
    });
  }

  function saveApiKeys(successCallback, errorCallback) {
    try {
      chrome.storage.sync.set({ apiKeys }, () => {
        if (chrome.runtime.lastError) {
          if (errorCallback) errorCallback(chrome.runtime.lastError.message);
        } else {
          if (successCallback) successCallback();
        }
      });
    } catch (error) {
      if (errorCallback) errorCallback(error.message);
    }
  }

  function renderApiList() {
    // Clear the API list except for the empty state
    const apiItems = apiList.querySelectorAll('.api-item');
    apiItems.forEach(item => item.remove());

    // Show or hide empty state
    if (filteredApiKeys.length === 0) {
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';

      // Render API items
      filteredApiKeys.forEach(api => {
        const apiItem = createApiItem(api);
        apiList.appendChild(apiItem);
      });
    }
  }

  function createApiItem(api) {
    const apiItem = document.createElement('div');
    apiItem.className = 'api-item';
    apiItem.dataset.id = api.id;

    const isSelected = selectedApiIds.has(api.id);
    
    // Check if there are custom fields
    const hasCustomFields = api.customFields && Object.keys(api.customFields).length > 0;
    
    // Determine what to display as the API key
    let displayKey = api.apiKey;
    let displayKeyLabel = 'API Key:';
    
    // Check for pinned fields from JSON import
    if (api.pinnedFields && api.pinnedFields.length > 0) {
      const pinnedField = api.pinnedFields[0]; // Use the first pinned field
      
      // Handle nested pinned fields
      if (pinnedField.includes('.')) {
        const keys = pinnedField.split('.');
        let current = api;
        for (const key of keys) {
          if (current && current[key] !== undefined) {
            current = current[key];
          } else {
            current = null;
            break;
          }
        }
        if (current !== null) {
          displayKey = current;
          displayKeyLabel = `${pinnedField}:`;
        }
      } else if (api[pinnedField] !== undefined) {
        displayKey = api[pinnedField];
        displayKeyLabel = `${pinnedField}:`;
      }
    }
    // If there's a marked field and it exists in custom fields, use that instead
    else if (api.markedField && api.customFields && api.customFields[api.markedField]) {
      displayKey = api.customFields[api.markedField];
      displayKeyLabel = `${api.markedField}:`;
    }
    
    // Tags will be handled in the HTML template

    apiItem.innerHTML = `
      <div class="api-info">
        <div class="api-vendor">${api.vendor}</div>
        <div class="api-account">${api.account}</div>
        <div class="api-date">${formatDate(api.createdAt)}</div>
        <div class="api-checkbox-container">
          <input type="checkbox" class="api-checkbox" ${isSelected ? 'checked' : ''}>
        </div>
      </div>
      <div class="api-key-container">
        <span class="api-key-label">${displayKeyLabel}</span>
        <div class="api-item-header">
          <span class="api-key-value">${maskApiKey(displayKey)}</span>
          <div class="api-key-actions">
            <button class="api-key-action copy-key" title="Copy to Clipboard">
              <span class="material-icons-round">content_copy</span>
            </button>
            <button class="api-key-action edit-item" title="Edit Item">
              <span class="material-icons-round">edit</span>
            </button>
            <button class="api-key-action view-full-info" title="View Full Information">
              <span class="material-icons-round">info</span>
            </button>
            ${hasCustomFields ? '<span class="custom-fields-indicator" title="Has Custom Fields"><span class="material-icons-round">more_horiz</span></span>' : ''}
          </div>
        </div>
      </div>
      <div class="api-tags-visible">
        ${api.tag.split(',').slice(0, 3).map(tag => `<span class="api-tag-small ${getTagClass(tag.trim())}" data-tag="${tag.trim()}">${tag.trim()}</span>`).join('')}
      </div>
    `;

    // Add event listeners
    const checkbox = apiItem.querySelector('.api-checkbox');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedApiIds.add(api.id);
      } else {
        selectedApiIds.delete(api.id);
      }
      updateSelectAllCheckbox();
      updateBulkActionButtons();
    });

    // Toggle visibility button removed

    const copyKeyButton = apiItem.querySelector('.copy-key');
    copyKeyButton.addEventListener('click', () => {
      let valueToCopy = api.apiKey;
      let fieldName = 'API key';
      
      // Check for pinned fields from JSON import
      if (api.pinnedFields && api.pinnedFields.length > 0) {
        const pinnedField = api.pinnedFields[0];
        
        // Handle nested pinned fields
        if (pinnedField.includes('.')) {
          const keys = pinnedField.split('.');
          let current = api;
          for (const key of keys) {
            if (current && current[key] !== undefined) {
              current = current[key];
            } else {
              current = null;
              break;
            }
          }
          if (current !== null) {
            valueToCopy = current;
            fieldName = pinnedField;
          }
        } else if (api[pinnedField] !== undefined) {
          valueToCopy = api[pinnedField];
          fieldName = pinnedField;
        }
      }
      // Check for marked field in custom fields
      else if (api.markedField && api.customFields && api.customFields[api.markedField]) {
        valueToCopy = api.customFields[api.markedField];
        fieldName = api.markedField;
      }
        
      navigator.clipboard.writeText(valueToCopy).then(() => {
        showToast(`${fieldName} copied to clipboard`);
      });
    });
    
    const editButton = apiItem.querySelector('.edit-item');
    editButton.addEventListener('click', () => {
      openModal(api);
    });
    
    const viewFullInfoButton = apiItem.querySelector('.view-full-info');
    viewFullInfoButton.addEventListener('click', () => {
      openFullInfoModal(api);
    });
    
    // No need for tag click listeners anymore as we're using dropdown

    return apiItem;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getTagClass(tag) {
    const tagLower = tag.toLowerCase();
    if (tagLower.includes('dev')) {
      return 'tag-development';
    } else if (tagLower.includes('prod')) {
      return 'tag-production';
    } else if (tagLower.includes('test')) {
      return 'tag-testing';
    } else if (tagLower.includes('stag')) {
      return 'tag-staging';
    }
    return 'tag-other';
  }

  function maskApiKey(apiKey) {
    if (apiKey.length <= 4) {
      return '•'.repeat(apiKey.length);
    }
    return apiKey.substring(0, 2) + '•'.repeat(8) + apiKey.substring(apiKey.length - 2);
  }

  function openModal(apiToEdit = null) {
    const modalTitle = document.getElementById('modal-title');
    const editIdField = document.getElementById('edit-id');
    const customFieldsContainer = document.getElementById('custom-fields-container');
    
    addApiModal.classList.add('show');
    addApiForm.reset();
    addApiForm.removeAttribute('data-marked-field');
    
    // Clear any existing custom fields and dynamic fields
    customFieldsContainer.innerHTML = '';
    
    // Clear any existing dynamic fields from JSON import
    const existingDynamicFields = document.querySelectorAll('.dynamic-field');
    existingDynamicFields.forEach(field => field.remove());
    
    if (apiToEdit) {
      modalTitle.textContent = 'Edit API';
      document.getElementById('vendor').value = apiToEdit.vendor;
      document.getElementById('account').value = apiToEdit.account;
      document.getElementById('api-key').value = apiToEdit.apiKey;
      document.getElementById('tag').value = apiToEdit.tag;
      editIdField.value = apiToEdit.id;
      
      // Set the marked field if it exists
      if (apiToEdit.markedField) {
        addApiForm.setAttribute('data-marked-field', apiToEdit.markedField);
      }
      
      // Check if this API has imported JSON data (has pinnedFields or non-standard fields)
      const hasImportedData = apiToEdit.pinnedFields || hasNonStandardFields(apiToEdit);
      
      if (hasImportedData) {
        // Hide only the import button for imported data, keep standard fields visible
         document.querySelector('.import-json-container').style.display = 'none';
         
         // Populate standard fields with current values
         document.getElementById('vendor').value = apiToEdit.vendor || '';
         document.getElementById('account').value = apiToEdit.account || '';
         document.getElementById('api-key').value = apiToEdit.apiKey || '';
         document.getElementById('tag').value = apiToEdit.tag || '';
        
        // Add dynamic header
        const dynamicHeader = document.createElement('div');
        dynamicHeader.className = 'dynamic-fields-header';
        dynamicHeader.innerHTML = '<h3>Imported JSON Fields</h3>';
        customFieldsContainer.appendChild(dynamicHeader);
        
        // Recreate all imported fields as dynamic inputs
        recreateImportedFields(apiToEdit, customFieldsContainer);
      } else {
        // Standard custom fields handling
        if (apiToEdit.customFields) {
          Object.entries(apiToEdit.customFields).forEach(([key, value]) => {
            const fieldElement = addCustomField(null, key, value);
            
            // If this field is marked as the API key, highlight it
            if (apiToEdit.markedField && key === apiToEdit.markedField) {
              const markButton = fieldElement.querySelector('.mark-as-api-key');
              if (markButton) {
                markButton.classList.add('active');
              }
            }
          });
        }
      }
    } else {
      modalTitle.textContent = 'Add New API';
      editIdField.value = '';
    }
    
    document.getElementById('vendor').focus();
  }
  
  function addCustomField(event, key = '', value = '') {
    const customFieldsContainer = document.getElementById('custom-fields-container');
    const fieldId = Date.now().toString();
    
    const customField = document.createElement('div');
    customField.className = 'custom-field';
    customField.dataset.id = fieldId;
    
    customField.innerHTML = `
      <div class="custom-field-inputs">
        <input type="text" class="custom-field-key" placeholder="Field Name" value="${key}">
        <input type="text" class="custom-field-value" placeholder="Value" value="${value}">
      </div>
      <div class="field-actions">
        <button type="button" class="mark-as-api-key" title="Mark as API Key for list display">
          <span class="material-icons-round">key</span>
        </button>
        <button type="button" class="remove-field-button" title="Remove Field">
          <span class="material-icons-round">close</span>
        </button>
      </div>
    `;
    
    const removeButton = customField.querySelector('.remove-field-button');
    removeButton.addEventListener('click', () => {
      customField.remove();
    });
    
    const markAsApiKeyButton = customField.querySelector('.mark-as-api-key');
    markAsApiKeyButton.addEventListener('click', function() {
      // Remove active class from all mark buttons
      document.querySelectorAll('.mark-as-api-key').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add active class to this button
      this.classList.add('active');
      
      // Get the key name and set it as the API key
      const keyName = customField.querySelector('.custom-field-key').value;
      const keyValue = customField.querySelector('.custom-field-value').value;
      
      // Store the marked field name as a data attribute on the form
      document.getElementById('add-api-form').setAttribute('data-marked-field', keyName);
      
      showToast(`"${keyName}" will be displayed as the API key in the list view`);
    });
    
    customFieldsContainer.appendChild(customField);
    
    // Return the created element so it can be referenced
    return customField;
  }
  
  // Helper function to check if API has non-standard fields (imported JSON data)
   function hasNonStandardFields(api) {
     const standardFields = ['id', 'vendor', 'account', 'apiKey', 'tag', 'customFields', 'markedField', 'pinnedFields', 'createdAt', 'updatedAt'];
     return Object.keys(api).some(key => !standardFields.includes(key));
   }
   
   // Helper function to display imported fields in modal
    function displayImportedFieldsInModal(api) {
      const standardFields = ['id', 'vendor', 'account', 'apiKey', 'tag', 'customFields', 'markedField', 'pinnedFields', 'createdAt', 'updatedAt'];
      let fieldsHTML = '';
      
      function processObject(obj, prefix = '') {
        Object.entries(obj).forEach(([key, value]) => {
          if (standardFields.includes(key)) return;
          
          const fullKey = prefix ? `${prefix}.${key}` : key;
          const isPinned = api.pinnedFields && api.pinnedFields.includes(fullKey);
          
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            processObject(value, fullKey);
          } else {
            const pinnedIndicator = isPinned ? 
              `<span class="pinned-field-indicator" title="Pinned as API key"><span class="material-icons-round">push_pin</span></span>` : '';
            const fieldClass = isPinned ? 'pinned-field' : '';
            
            fieldsHTML += `
              <div class="info-field ${fieldClass}">
                <div class="info-label">${fullKey}: ${pinnedIndicator}</div>
                <input type="${isPinned ? 'password' : 'text'}" class="info-input" value="${value}" readonly>
              </div>
            `;
          }
        });
      }
      
      processObject(api);
      return fieldsHTML;
    }
  
  // Helper function to recreate imported fields as dynamic inputs
  function recreateImportedFields(api, container) {
    const standardFields = ['id', 'vendor', 'account', 'apiKey', 'tag', 'customFields', 'markedField', 'pinnedFields', 'createdAt', 'updatedAt'];
    
    // Function to create dynamic inputs from nested objects
    function createInputsFromObject(obj, prefix = '') {
      Object.entries(obj).forEach(([key, value]) => {
        if (standardFields.includes(key)) return; // Skip standard fields
        
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursively handle nested objects
          createInputsFromObject(value, fullKey);
        } else {
          // Create dynamic input for this field
          const inputContainer = createDynamicInput(fullKey, value, api.pinnedFields);
          container.appendChild(inputContainer);
        }
      });
    }
    
    createInputsFromObject(api);
  }
  
  // Helper function to create dynamic input with pin button
  function createDynamicInput(key, value, pinnedFields = []) {
    const isPinned = pinnedFields && pinnedFields.includes(key);
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'dynamic-input-container';
    
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group dynamic-field';
    
    const label = document.createElement('label');
    label.textContent = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
    
    const input = document.createElement('input');
    input.type = isPinned ? 'password' : 'text';
    input.className = 'dynamic-input';
    input.value = value || '';
    input.setAttribute('data-json-key', key);
    
    if (isPinned) {
      input.setAttribute('data-pinned-as-api-key', 'true');
    }
    
    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = `pin-button ${isPinned ? 'pinned' : ''}`;
    pinButton.innerHTML = '<span class="material-icons-round">push_pin</span>';
    pinButton.title = isPinned ? 'Unpin from API key masking' : 'Pin as API key for masking in list';
    
    pinButton.addEventListener('click', function() {
      const isCurrentlyPinned = input.hasAttribute('data-pinned-as-api-key');
      
      if (isCurrentlyPinned) {
        // Unpin
        input.removeAttribute('data-pinned-as-api-key');
        input.type = 'text';
        pinButton.classList.remove('pinned');
        pinButton.title = 'Pin as API key for masking in list';
      } else {
        // Pin (first unpin all other fields)
        document.querySelectorAll('.dynamic-input[data-pinned-as-api-key]').forEach(otherInput => {
          otherInput.removeAttribute('data-pinned-as-api-key');
          otherInput.type = 'text';
          const otherButton = otherInput.parentElement.querySelector('.pin-button');
          if (otherButton) {
            otherButton.classList.remove('pinned');
            otherButton.title = 'Pin as API key for masking in list';
          }
        });
        
        // Pin this field
        input.setAttribute('data-pinned-as-api-key', 'true');
        input.type = 'password';
        pinButton.classList.add('pinned');
        pinButton.title = 'Unpin from API key masking';
      }
    });
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(pinButton);
    
    formGroup.appendChild(label);
    formGroup.appendChild(inputContainer);
    
    return formGroup;
  }

  function closeModal() {
    addApiModal.classList.remove('show');
  }
  
  function openInfoModal() {
    document.getElementById('info-modal').classList.add('show');
  }
  
  function closeInfoModal() {
    document.getElementById('info-modal').classList.remove('show');
  }
  
  function openFullInfoModal(api) {
    const fullInfoModal = document.getElementById('full-info-modal');
    const modalBody = fullInfoModal.querySelector('.full-info-modal-body');
    
    // Format the creation and update dates
    const createdDate = formatDate(api.createdAt);
    const updatedDate = formatDate(api.updatedAt);
    
    // Check if this API has imported JSON data
    const hasImportedData = api.pinnedFields || hasNonStandardFields(api);
    
    let modalHTML = '';
    
    if (hasImportedData) {
      // Display imported JSON data
      modalHTML += `<div class="full-info-section imported-data-section">
        <h3>Imported JSON Data</h3>`;
      
      // Display all imported fields
       modalHTML += displayImportedFieldsInModal(api);
      
      modalHTML += `</div>`;
      
      // Add basic info section for imported data
      modalHTML += `
        <div class="full-info-section basic-info-section">
          <h3>Basic Information</h3>
          <div class="info-field">
            <div class="info-label">Vendor:</div>
            <input type="text" class="info-input" value="${api.vendor}" readonly>
          </div>
          <div class="info-field">
            <div class="info-label">Account:</div>
            <input type="text" class="info-input" value="${api.account}" readonly>
          </div>
          <div class="info-field">
            <div class="info-label">API Key:</div>
            <input type="text" class="info-input" value="${api.apiKey}" readonly>
          </div>
        </div>
      `;
    } else {
      // Standard display for non-imported data
      modalHTML += `
        <div class="full-info-section api-key-section">
          <h3>API Key</h3>
          <div class="info-field">
            <div class="info-label">API Key:</div>
            <input type="text" class="info-input" value="${api.apiKey}" readonly>
          </div>
        </div>
        
        <div class="full-info-section basic-info-section">
          <h3>Basic Information</h3>
          <div class="info-field">
            <div class="info-label">Vendor:</div>
            <input type="text" class="info-input" value="${api.vendor}" readonly>
          </div>
          <div class="info-field">
            <div class="info-label">Account:</div>
            <input type="text" class="info-input" value="${api.account}" readonly>
          </div>
        </div>
      `;
      
      // Add custom fields if they exist
      if (api.customFields && Object.keys(api.customFields).length > 0) {
        modalHTML += `<div class="full-info-section custom-fields-section">
          <h3>Custom Fields</h3>`;
        
        Object.entries(api.customFields).forEach(([key, value]) => {
          // Check if this is the marked field
          const isMarkedField = api.markedField && key === api.markedField;
          const markedFieldClass = isMarkedField ? 'marked-field' : '';
          const markedFieldIndicator = isMarkedField ? 
            `<span class="marked-field-indicator" title="Displayed in list view"><span class="material-icons-round">key</span></span>` : '';
          
          modalHTML += `
            <div class="info-field ${markedFieldClass}">
              <div class="info-label">${key}: ${markedFieldIndicator}</div>
              <input type="text" class="info-input" value="${value}" readonly>
            </div>
          `;
        });
        
        modalHTML += `</div>`;
      }
    }
    
    // Add tags section
    modalHTML += `
      <div class="full-info-section tags-section">
        <h3>Tags</h3>
        <div class="info-field">
          <div class="info-label">Tags:</div>
          <input type="text" class="info-input" value="${api.tag}" readonly>
        </div>
        <div class="tags-field">
          ${api.tag.split(',').map(tag => `<span class="api-tag ${getTagClass(tag.trim())}" data-tag="${tag.trim()}">${tag.trim()}</span>`).join('')}
        </div>
      </div>
    `;
    
    // Add timestamps section
    modalHTML += `
      <div class="full-info-section dates-section">
        <h3>Timestamps</h3>
        <div class="info-field">
          <div class="info-label">Created:</div>
          <input type="text" class="info-input" value="${createdDate}" readonly>
        </div>
        <div class="info-field">
          <div class="info-label">Last Updated:</div>
          <input type="text" class="info-input" value="${updatedDate}" readonly>
        </div>
      </div>
    `;
    
    // Set the HTML content
    modalBody.innerHTML = modalHTML;
    
    // Add event listeners to all input fields for easy copying
    const inputFields = modalBody.querySelectorAll('.info-input');
    inputFields.forEach(input => {
      input.addEventListener('click', function() {
        this.select();
        navigator.clipboard.writeText(this.value).then(() => {
          showToast('Copied to clipboard');
        });
      });
    });
    
    fullInfoModal.classList.add('show');
  }
  
  function closeFullInfoModal() {
    document.getElementById('full-info-modal').classList.remove('show');
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(addApiForm);
    const editId = formData.get('editId');
    const markedField = addApiForm.getAttribute('data-marked-field');
    
    // Check if we're in dynamic mode (JSON imported)
    const dynamicFields = document.querySelectorAll('.dynamic-input');
    const isDynamicMode = dynamicFields.length > 0;
    
    let apiData = {};
    
    if (isDynamicMode) {
      // Collect data from dynamic fields
      const pinnedFields = [];
      
      dynamicFields.forEach(input => {
        const key = input.getAttribute('data-json-key');
        const value = input.value.trim();
        const isPinned = input.hasAttribute('data-pinned-as-api-key');
        
        // Track pinned fields for masking in list
        if (isPinned) {
          pinnedFields.push(key);
        }
        
        // Handle nested keys (e.g., "web.client_id")
        if (key.includes('.')) {
          const keys = key.split('.');
          let current = apiData;
          
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          
          current[keys[keys.length - 1]] = value;
        } else {
          apiData[key] = value;
        }
      });
      
      // Store pinned fields information
      if (pinnedFields.length > 0) {
        apiData.pinnedFields = pinnedFields;
      }
      
      // Get values from static fields (Vendor, Account, API Key) if they exist
      const vendorValue = document.getElementById('vendor')?.value?.trim();
      const accountValue = document.getElementById('account')?.value?.trim();
      const apiKeyValue = document.getElementById('api-key')?.value?.trim();
      
      // Use static field values if provided, otherwise use defaults
      apiData.vendor = vendorValue || apiData.vendor || 'Imported API';
      apiData.account = accountValue || apiData.account || 'Default';
      
      // Handle API key assignment
      if (apiKeyValue && apiKeyValue.trim() !== '') {
        // Use the manually entered API key
        apiData.apiKey = apiKeyValue;
      } else {
        // API key field is blank, try to use pinned field or find suitable field
        if (pinnedFields.length > 0) {
          // Use the first pinned field as the API key
          const pinnedKey = pinnedFields[0];
          if (pinnedKey.includes('.')) {
            // Handle nested pinned keys
            const keys = pinnedKey.split('.');
            let current = apiData;
            for (const k of keys) {
              if (current && current[k] !== undefined) {
                current = current[k];
              } else {
                current = null;
                break;
              }
            }
            apiData.apiKey = current || 'No API Key Found';
          } else {
            apiData.apiKey = apiData[pinnedKey] || 'No API Key Found';
          }
        } else {
          // Try to find an API key-like field
          const possibleApiKeys = Object.keys(apiData).filter(key => 
            key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('token')
          );
          if (possibleApiKeys.length > 0) {
            apiData.apiKey = apiData[possibleApiKeys[0]];
          } else {
            apiData.apiKey = 'No API Key Found';
          }
        }
      }
      
      if (!apiData.tag) apiData.tag = 'imported';
    } else {
      // Collect data from static form fields
      apiData = {
        vendor: formData.get('vendor'),
        account: formData.get('account'),
        apiKey: formData.get('apiKey'),
        tag: formData.get('tag')
      };
      
      // Collect custom fields
      const customFields = {};
      const customFieldElements = document.querySelectorAll('.custom-field');
      
      customFieldElements.forEach(field => {
        const keyInput = field.querySelector('.custom-field-key');
        const valueInput = field.querySelector('.custom-field-value');
        
        if (keyInput && valueInput && keyInput.value.trim()) {
          customFields[keyInput.value.trim()] = valueInput.value.trim();
        }
      });
      
      if (Object.keys(customFields).length > 0) {
        apiData.customFields = customFields;
      }
    }
    
    if (editId) {
      // Edit existing API
      const apiIndex = apiKeys.findIndex(api => api.id === editId);
      if (apiIndex !== -1) {
        apiKeys[apiIndex] = {
          ...apiKeys[apiIndex],
          ...apiData,
          markedField: markedField || undefined,
          updatedAt: new Date().toISOString()
        };
        
        saveApiKeys(() => {
          closeModal();
          showToast('API updated successfully!');
          applyFiltersAndSort();
        }, (error) => {
          showToast('Error updating API: ' + error);
        });
      }
    } else {
      // Add new API
      const newApi = {
        id: Date.now().toString(),
        ...apiData,
        markedField: markedField || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      apiKeys.push(newApi);
      saveApiKeys(() => {
        closeModal();
        showToast('API saved successfully!');
        applyFiltersAndSort();
      }, (error) => {
        showToast('Error saving API: ' + error);
      });
    }
    
    // Clear the marked field data attribute
    addApiForm.removeAttribute('data-marked-field');
  }

  function showToast(message) {
    // Toast notifications have been removed as per requirements
    console.log('Message:', message);
  }

  function handleSearch() {
    applyFiltersAndSort();
  }

  let currentSortValue = 'vendor-asc';
  
  function toggleDropdown() {
    const isOpen = sortMenu.classList.contains('show');
    
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }
  
  function openDropdown() {
    sortMenu.classList.add('show');
    sortTrigger.classList.add('active');
    
    // Update selected states
    updateDropdownSelection();
  }
  
  function closeDropdown() {
    sortMenu.classList.remove('show');
    sortTrigger.classList.remove('active');
  }
  
  function handleOutsideClick(event) {
    if (!sortDropdown.contains(event.target)) {
      closeDropdown();
    }
  }
  
  function updateDropdownSelection() {
    // Remove all selected states
    sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    // Add selected state to current item
    const currentItem = sortMenu.querySelector(`[data-value="${currentSortValue}"]`);
    if (currentItem) {
      currentItem.classList.add('selected');
    }
  }
  
  function handleDropdownItemClick(value, displayText) {
    currentSortValue = value;
    dropdownText.textContent = displayText;
    
    updateDropdownSelection();
    closeDropdown();
    applyFiltersAndSort();
  }
  
  // Add click handlers to dropdown items
  function initializeDropdownItems() {
    sortMenu.querySelectorAll('.dropdown-item:not(.tag-item)').forEach(item => {
      const value = item.getAttribute('data-value');
      if (value && value !== 'tag') {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDropdownItemClick(value, item.textContent);
        });
      }
    });
    
    // Handle tag header click
    const tagHeader = sortMenu.querySelector('.tag-header');
    if (tagHeader) {
      tagHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDropdownItemClick('tag', 'Sort by Tag');
      });
    }
  }

  // Remove the filterByTag function as we're using dropdown now

  function applyFiltersAndSort() {
    const searchTerm = searchInput.value.toLowerCase();
    const sortValue = currentSortValue;
    let sortBy = sortValue;
    let selectedTag = '';
    
    // Check if a tag is selected
    if (sortValue.startsWith('tag:')) {
      sortBy = 'tag';
      selectedTag = sortValue.substring(4); // Remove 'tag:' prefix
    }

    // Filter
    filteredApiKeys = apiKeys.filter(api => {
      // Enhanced search filter - includes custom fields
      let matchesSearch = false;
      
      if (!searchTerm) {
        matchesSearch = true;
      } else {
        // Search in main fields
        matchesSearch = (
          api.vendor.toLowerCase().includes(searchTerm) ||
          api.account.toLowerCase().includes(searchTerm) ||
          api.tag.toLowerCase().includes(searchTerm) ||
          api.apiKey.toLowerCase().includes(searchTerm)
        );
        
        // Search in custom fields if they exist
        if (!matchesSearch && api.customFields) {
          for (const [key, value] of Object.entries(api.customFields)) {
            if (key.toLowerCase().includes(searchTerm) || 
                value.toLowerCase().includes(searchTerm)) {
              matchesSearch = true;
              break;
            }
          }
        }
        
        // Search in dynamic JSON fields if they exist
        if (!matchesSearch && api.jsonData) {
          const jsonString = JSON.stringify(api.jsonData).toLowerCase();
          matchesSearch = jsonString.includes(searchTerm);
        }
      }
      
      // Tag filter
      const matchesTag = selectedTag ? 
        api.tag.split(',').some(tag => tag.trim() === selectedTag) : 
        true;
      
      return matchesSearch && matchesTag;
    });

    // Sort
    filteredApiKeys.sort((a, b) => {
      if (sortBy === 'vendor-asc') {
        return a.vendor.localeCompare(b.vendor);
      } else if (sortBy === 'vendor-desc') {
        return b.vendor.localeCompare(a.vendor);
      } else if (sortBy === 'tag') {
        return a.tag.localeCompare(b.tag);
      } else if (sortBy === 'date-desc') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === 'date-asc') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return 0;
    });

    renderApiList();
    updateSelectAllCheckbox();
  }

  function handleSelectAll() {
    if (selectAllCheckbox.checked) {
      filteredApiKeys.forEach(api => {
        selectedApiIds.add(api.id);
      });
    } else {
      selectedApiIds.clear();
    }

    renderApiList();
    updateBulkActionButtons();
  }

  function updateSelectAllCheckbox() {
    if (filteredApiKeys.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.disabled = true;
    } else {
      selectAllCheckbox.disabled = false;
      const allSelected = filteredApiKeys.every(api => selectedApiIds.has(api.id));
      selectAllCheckbox.checked = allSelected && filteredApiKeys.length > 0;
    }
  }

  function updateBulkActionButtons() {
    const hasSelected = selectedApiIds.size > 0;
    deleteSelectedButton.disabled = !hasSelected;
    exportSelectedButton.disabled = !hasSelected;
  }

  function handleDeleteSelected() {
    if (selectedApiIds.size === 0) return;

    const confirmDelete = confirm(`Are you sure you want to delete ${selectedApiIds.size} API key(s)?`);
    if (!confirmDelete) return;

    apiKeys = apiKeys.filter(api => !selectedApiIds.has(api.id));
    selectedApiIds.clear();

    saveApiKeys(() => {
      showToast('Selected API keys deleted successfully');
      applyFiltersAndSort();
      updateBulkActionButtons();
    });
  }

  function handleExportSelected() {
    if (selectedApiIds.size === 0) return;

    const selectedApis = apiKeys.filter(api => selectedApiIds.has(api.id));
    const exportData = JSON.stringify(selectedApis, null, 2);
    
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'api-keys-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Selected API keys exported successfully');
  }
  
  function handleImportJson() {
    // Create a hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Trigger click on the file input
    fileInput.click();
    
    // Handle file selection
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) {
        document.body.removeChild(fileInput);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedApis = JSON.parse(e.target.result);
          
          if (!Array.isArray(importedApis)) {
            showToast('Invalid JSON format. Expected an array of API objects.');
            document.body.removeChild(fileInput);
            return;
          }
          
          let importCount = 0;
          let duplicateCount = 0;
          
          importedApis.forEach(importedApi => {
            // Check if this API already exists (by vendor and account)
            const existingApiIndex = apiKeys.findIndex(api => 
              api.vendor.toLowerCase() === importedApi.vendor.toLowerCase() && 
              api.account.toLowerCase() === importedApi.account.toLowerCase()
            );
            
            if (existingApiIndex !== -1) {
              // Rename the vendor to indicate it's a duplicate
              importedApi.vendor = `${importedApi.vendor} (1)`;
              duplicateCount++;
            }
            
            // Ensure the imported API has all required fields
            const newApi = {
              id: Date.now().toString() + importCount,
              vendor: importedApi.vendor,
              account: importedApi.account,
              apiKey: importedApi.apiKey,
              tag: importedApi.tag || 'imported',
              createdAt: importedApi.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            apiKeys.push(newApi);
            importCount++;
          });
          
          if (importCount > 0) {
            saveApiKeys(() => {
              let message = `Imported ${importCount} API key(s) successfully`;
              if (duplicateCount > 0) {
                message += `. ${duplicateCount} duplicate(s) renamed.`;
              }
              showToast(message);
              applyFiltersAndSort();
            }, (error) => {
              showToast('Error importing APIs: ' + error);
            });
          } else {
            showToast('No valid APIs found in the imported file.');
          }
        } catch (error) {
          showToast('Error parsing JSON file: ' + error.message);
        }
        
        document.body.removeChild(fileInput);
      };
      
      reader.onerror = () => {
        showToast('Error reading file');
        document.body.removeChild(fileInput);
      };
      
      reader.readAsText(file);
    });
  }
  
  function handleImportJsonToModal() {
    // Create a hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Trigger click on the file input
    fileInput.click();
    
    // Handle file selection
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) {
        document.body.removeChild(fileInput);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let jsonData = JSON.parse(e.target.result);
          
          // If it's an array, take the first item
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            jsonData = jsonData[0];
          }
          
          // Check if it's an object
          if (typeof jsonData !== 'object' || jsonData === null) {
            showToast('Invalid JSON format. Expected an object.');
            document.body.removeChild(fileInput);
            return;
          }
          
          // Hide only Tags and Custom Fields sections, keep Vendor, Account, API Key visible
          const tagsGroup = document.querySelector('.form-group:has(#tags)');
          if (tagsGroup) {
            tagsGroup.style.display = 'none';
          }
          
          // Make the main fields non-mandatory by removing required attributes
          const vendorInput = document.getElementById('vendor');
          const accountInput = document.getElementById('account');
          const apiKeyInput = document.getElementById('api-key');
          
          if (vendorInput) vendorInput.removeAttribute('required');
          if (accountInput) accountInput.removeAttribute('required');
          if (apiKeyInput) apiKeyInput.removeAttribute('required');
          
          // Hide import button after use
          const importContainer = document.querySelector('.import-json-container');
          if (importContainer) {
            importContainer.style.display = 'none';
          }
          
          // Clear existing custom fields and create dynamic form
          const customFieldsContainer = document.getElementById('custom-fields-container');
          customFieldsContainer.innerHTML = '';
          
          // Add a header for dynamic fields
          const dynamicHeader = document.createElement('div');
          dynamicHeader.className = 'dynamic-form-header';
          dynamicHeader.innerHTML = `
            <h3>JSON Data Fields</h3>
            <button type="button" id="reset-to-static" class="reset-button">
              <span class="material-icons-round">refresh</span>
              Reset to Manual Entry
            </button>
          `;
          customFieldsContainer.appendChild(dynamicHeader);
          
          let fieldCount = 0;
          
          // Recursive function to process nested JSON objects
          function createInputsFromJson(obj, container, prefix = '') {
            for (const key in obj) {
              const fullKey = prefix ? `${prefix}.${key}` : key;
              
              if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
                // Create a fieldset for nested object
                const fieldset = document.createElement('fieldset');
                fieldset.className = 'json-fieldset';
                
                const legend = document.createElement('legend');
                legend.textContent = fullKey;
                fieldset.appendChild(legend);
                
                // Process nested object
                createInputsFromJson(obj[key], fieldset, fullKey);
                container.appendChild(fieldset);
                
                fieldCount++;
              } else if (Array.isArray(obj[key])) {
                // Create inputs for array items
                obj[key].forEach((val, index) => {
                  if (typeof val === "object" && val !== null) {
                    // For object in array, create a fieldset
                    const arrayFieldset = document.createElement('fieldset');
                    arrayFieldset.className = 'json-fieldset';
                    
                    const arrayLegend = document.createElement('legend');
                    arrayLegend.textContent = `${fullKey}[${index}]`;
                    arrayFieldset.appendChild(arrayLegend);
                    
                    // Process nested object in array
                    createInputsFromJson(val, arrayFieldset, `${fullKey}[${index}]`);
                    container.appendChild(arrayFieldset);
                  } else {
                    // For primitive values in array
                    createDynamicInput(container, `${fullKey}[${index}]`, val);
                  }
                });
                
                fieldCount++;
              } else {
                // Create input for primitive value
                createDynamicInput(container, fullKey, obj[key]);
                fieldCount++;
              }
            }
          }
          
          // Helper function to create a dynamic input field
          function createDynamicInput(container, key, value) {
            // Handle different value types
            let displayValue = value;
            
            // Convert value to string if needed
            if (value === null) {
              displayValue = "null";
            } else if (value === undefined) {
              displayValue = "";
            } else if (typeof value === "object") {
              displayValue = JSON.stringify(value);
            }
            
            // Create a form group for the dynamic field
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group dynamic-field';
            
            const label = document.createElement('label');
            label.textContent = key;
            
            const inputContainer = document.createElement('div');
            inputContainer.className = 'dynamic-input-container';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.name = key;
            input.value = displayValue;
            input.className = 'dynamic-input';
            input.setAttribute('data-json-key', key);
            
            // Create pin button
            const pinButton = document.createElement('button');
            pinButton.type = 'button';
            pinButton.className = 'pin-button';
            pinButton.innerHTML = '<span class="material-icons-round">push_pin</span>';
            pinButton.title = 'Pin as API Key (will be masked in list)';
            
            // Add pin functionality
            pinButton.addEventListener('click', function() {
              const isPinned = input.hasAttribute('data-pinned-as-api-key');
              
              if (isPinned) {
                // Unpin
                input.removeAttribute('data-pinned-as-api-key');
                pinButton.classList.remove('pinned');
                pinButton.title = 'Pin as API Key (will be masked in list)';
                input.type = 'text';
              } else {
                // Pin as API key
                input.setAttribute('data-pinned-as-api-key', 'true');
                pinButton.classList.add('pinned');
                pinButton.title = 'Unpin API Key';
                input.type = 'password';
              }
            });
            
            inputContainer.appendChild(input);
            inputContainer.appendChild(pinButton);
            
            formGroup.appendChild(label);
            formGroup.appendChild(inputContainer);
            container.appendChild(formGroup);
          }
          
          // Create dynamic inputs from JSON data
          createInputsFromJson(jsonData, customFieldsContainer);
          
          // Add reset functionality
          document.getElementById('reset-to-static').addEventListener('click', function() {
            // Show all static form fields including tags
            const tagsGroup = document.querySelector('.form-group:has(#tags)');
            if (tagsGroup) {
              tagsGroup.style.display = 'block';
            }
            
            // Restore required attributes for main fields
            const vendorInput = document.getElementById('vendor');
            const accountInput = document.getElementById('account');
            const apiKeyInput = document.getElementById('api-key');
            
            if (vendorInput) vendorInput.setAttribute('required', 'required');
            if (accountInput) accountInput.setAttribute('required', 'required');
            if (apiKeyInput) apiKeyInput.setAttribute('required', 'required');
            
            // Show import button
            const importContainer = document.querySelector('.import-json-container');
            if (importContainer) {
              importContainer.style.display = 'block';
            }
            
            // Clear dynamic fields
            customFieldsContainer.innerHTML = '';
            
            // Reset form
            document.getElementById('add-api-form').reset();
            
            showToast('Reset to manual entry mode');
          });
          
          showToast(`JSON imported with ${fieldCount} dynamic fields`);
        } catch (error) {
          showToast('Error parsing JSON file: ' + error.message);
        }
        
        document.body.removeChild(fileInput);
      };
      
      reader.onerror = () => {
        showToast('Error reading file');
        document.body.removeChild(fileInput);
      };
      
      reader.readAsText(file);
    });
  }
});