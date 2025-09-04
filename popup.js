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
  const sortSelect = document.getElementById('sort-select');
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

  // Event Listeners
  addApiButton.addEventListener('click', () => openModal());
  closeButton.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);
  addApiForm.addEventListener('submit', handleFormSubmit);
  searchInput.addEventListener('input', handleSearch);
  sortSelect.addEventListener('change', handleSort);
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  deleteSelectedButton.addEventListener('click', handleDeleteSelected);
  exportSelectedButton.addEventListener('click', handleExportSelected);
  document.getElementById('import-json').addEventListener('click', handleImportJson);
  infoButton.addEventListener('click', openInfoModal);
  document.getElementById('info-close-button').addEventListener('click', closeInfoModal);

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
    const sortSelect = document.getElementById('sort-select');
    
    // Remove any existing tag items
    const existingTagItems = sortSelect.querySelectorAll('.tag-item');
    existingTagItems.forEach(item => item.remove());
    
    // Add tags as options
    const sortedTags = Array.from(allTags).sort();
    const tagOption = sortSelect.querySelector('.tag-option');
    
    sortedTags.forEach(tag => {
      const option = document.createElement('option');
      option.value = 'tag:' + tag;
      option.textContent = tag;
      option.className = 'tag-item';
      
      // Insert after the tag option
      if (tagOption && tagOption.nextSibling) {
        sortSelect.insertBefore(option, tagOption.nextSibling);
      } else {
        sortSelect.appendChild(option);
      }
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
    
    // Tags will be handled in the HTML template

    apiItem.innerHTML = `
      <div class="api-item-header">
        <div class="api-checkbox-container">
          <input type="checkbox" class="api-checkbox" ${isSelected ? 'checked' : ''}>
        </div>
        <div class="api-info">
          <div class="api-vendor">${api.vendor}</div>
          <div class="api-account">${api.account}</div>
          <div class="api-date">${formatDate(api.createdAt)}</div>
        </div>
      </div>
      <div class="api-key-container">
        <span class="api-key-label">API Key:</span>
        <span class="api-key-value" data-masked="true">${maskApiKey(api.apiKey)}</span>
        <div class="api-key-actions">
          <button class="api-key-action toggle-visibility" title="Toggle Visibility">
            <span class="material-icons-round">visibility</span>
          </button>
          <button class="api-key-action copy-key" title="Copy to Clipboard">
            <span class="material-icons-round">content_copy</span>
          </button>
          <button class="api-key-action edit-item" title="Edit Item">
            <span class="material-icons-round">edit</span>
          </button>
        </div>
      </div>
      <div class="api-tags">
        ${api.tag.split(',').map(tag => `<span class="api-tag ${getTagClass(tag.trim())}" data-tag="${tag.trim()}">${tag.trim()}</span>`).join('')}
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

    const toggleVisibilityButton = apiItem.querySelector('.toggle-visibility');
    toggleVisibilityButton.addEventListener('click', () => {
      const apiKeyValue = apiItem.querySelector('.api-key-value');
      const isMasked = apiKeyValue.dataset.masked === 'true';
      
      if (isMasked) {
        apiKeyValue.textContent = api.apiKey;
        apiKeyValue.dataset.masked = 'false';
        toggleVisibilityButton.querySelector('.material-icons-round').textContent = 'visibility_off';
      } else {
        apiKeyValue.textContent = maskApiKey(api.apiKey);
        apiKeyValue.dataset.masked = 'true';
        toggleVisibilityButton.querySelector('.material-icons-round').textContent = 'visibility';
      }
    });

    const copyKeyButton = apiItem.querySelector('.copy-key');
    copyKeyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(api.apiKey).then(() => {
        showToast('API key copied to clipboard');
      });
    });
    
    const editButton = apiItem.querySelector('.edit-item');
    editButton.addEventListener('click', () => {
      openModal(api);
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
    if (apiKey.length <= 5) {
      return '•'.repeat(apiKey.length);
    }
    return apiKey.substring(0, 3) + '•'.repeat(apiKey.length - 5) + apiKey.substring(apiKey.length - 2);
  }

  function openModal(apiToEdit = null) {
    const modalTitle = document.getElementById('modal-title');
    const editIdField = document.getElementById('edit-id');
    
    addApiModal.classList.add('show');
    addApiForm.reset();
    
    if (apiToEdit) {
      modalTitle.textContent = 'Edit API';
      document.getElementById('vendor').value = apiToEdit.vendor;
      document.getElementById('account').value = apiToEdit.account;
      document.getElementById('api-key').value = apiToEdit.apiKey;
      document.getElementById('tag').value = apiToEdit.tag;
      editIdField.value = apiToEdit.id;
    } else {
      modalTitle.textContent = 'Add New API';
      editIdField.value = '';
    }
    
    document.getElementById('vendor').focus();
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

  function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(addApiForm);
    const editId = formData.get('editId');
    
    if (editId) {
      // Edit existing API
      const apiIndex = apiKeys.findIndex(api => api.id === editId);
      if (apiIndex !== -1) {
        apiKeys[apiIndex] = {
          ...apiKeys[apiIndex],
          vendor: formData.get('vendor'),
          account: formData.get('account'),
          apiKey: formData.get('apiKey'),
          tag: formData.get('tag'),
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
        vendor: formData.get('vendor'),
        account: formData.get('account'),
        apiKey: formData.get('apiKey'),
        tag: formData.get('tag'),
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
  }

  function showToast(message) {
    // Toast notifications have been removed as per requirements
    console.log('Message:', message);
  }

  function handleSearch() {
    applyFiltersAndSort();
  }

  function handleSort() {
    const sortBy = sortSelect.value;
    
    // Update the dropdown text if a tag is selected
    if (sortBy.startsWith('tag:')) {
      const selectedTag = sortBy.substring(4); // Remove 'tag:' prefix
      const tagOption = sortSelect.querySelector('.tag-option');
      if (tagOption) {
        tagOption.textContent = `Tag: ${selectedTag}`;
      }
    } else if (sortBy === 'tag') {
      // Reset the tag option text
      const tagOption = sortSelect.querySelector('.tag-option');
      if (tagOption) {
        tagOption.textContent = 'Sort by Tag ▾';
      }
    }
    
    applyFiltersAndSort();
  }

  // Remove the filterByTag function as we're using dropdown now

  function applyFiltersAndSort() {
    const searchTerm = searchInput.value.toLowerCase();
    const sortValue = sortSelect.value;
    let sortBy = sortValue;
    let selectedTag = '';
    
    // Check if a tag is selected
    if (sortValue.startsWith('tag:')) {
      sortBy = 'tag';
      selectedTag = sortValue.substring(4); // Remove 'tag:' prefix
    }

    // Filter
    filteredApiKeys = apiKeys.filter(api => {
      // Search filter
      const matchesSearch = (
        api.vendor.toLowerCase().includes(searchTerm) ||
        api.account.toLowerCase().includes(searchTerm) ||
        api.tag.toLowerCase().includes(searchTerm)
      );
      
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
});