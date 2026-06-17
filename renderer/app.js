// Application State
let vocabList = [];
let foldersList = [];
let selectedCards = new Set(); // tracks selected card IDs in the current folder view
let currentSelectedFolderId = 'all';

let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
let currentImageSelectorCardId = null;
let currentEditingCardId = null;
let isSyncing = false;

// Helper to show floating mini-toast for background sync progress
function showSyncMiniToast(text, type = 'loading') {
  if (!syncMiniToast || !syncToastText || !syncToastIcon) return;
  syncToastText.textContent = text;
  syncMiniToast.classList.remove('hidden');
  
  if (type === 'loading') {
    syncToastIcon.className = 'sync-toast-spinner';
    syncToastIcon.innerHTML = '';
  } else if (type === 'success') {
    syncToastIcon.className = 'sync-toast-success-icon';
    syncToastIcon.innerHTML = '✓';
    setTimeout(() => {
      syncMiniToast.classList.add('hidden');
    }, 3000);
  } else if (type === 'error') {
    syncToastIcon.className = 'sync-toast-error-icon';
    syncToastIcon.innerHTML = '✗';
    setTimeout(() => {
      syncMiniToast.classList.add('hidden');
    }, 5000);
  }
}

// Settings
const settings = {
  imageSource: localStorage.getItem('settings_image_source') || 'bing',
  imageLimit: parseInt(localStorage.getItem('settings_image_limit') || '8'),
};

// DOM Elements
const tabButtons = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const vocabCountBadge = document.getElementById('vocab-count');

// Import & Progress Elements
const progressContainer = document.getElementById('progress-container');
const progressTitle = document.getElementById('progress-title');
const progressPercent = document.getElementById('progress-percent');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressDetail = document.getElementById('progress-detail');

// Bulk Import Elements
const bulkTextarea = document.getElementById('bulk-text');
const btnImportBulk = document.getElementById('btn-import-bulk');
const optBulkDownload = document.getElementById('opt-bulk-download');
const optBulkPrompt = document.getElementById('opt-bulk-prompt');

// Manual Add Elements
const manualWordInput = document.getElementById('manual-word');
const manualDefInput = document.getElementById('manual-def');
const manualTopicInput = document.getElementById('manual-topic');
const btnAddManual = document.getElementById('btn-add-manual');

// Vocab Tab & Folder Elements
const folderListContainer = document.getElementById('folder-list');
const btnCreateFolder = document.getElementById('btn-create-folder');
const vocabGrid = document.getElementById('vocab-grid');
const vocabSearchInput = document.getElementById('vocab-search');
const vocabFilterStatus = document.getElementById('vocab-filter-status');
const btnClearAll = document.getElementById('btn-clear-all');

// Bulk Toolbar Elements
const bulkActionsBar = document.getElementById('bulk-actions-bar');
const chkSelectAll = document.getElementById('chk-select-all');
const bulkSelectedCount = document.getElementById('bulk-selected-count');
const btnBulkMove = document.getElementById('btn-bulk-move');
const bulkMoveDropdown = document.getElementById('bulk-move-dropdown');
const btnBulkDelete = document.getElementById('btn-bulk-delete');

// Settings Tab Elements
const geminiKeyInput = document.getElementById('settings-gemini-key');
const imageSourceSelect = document.getElementById('settings-image-source');
const imageLimitInput = document.getElementById('settings-image-limit');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsSaveSuccess = document.getElementById('settings-save-success');

// Google Drive Config Elements
const gdriveClientIdInput = document.getElementById('settings-gdrive-client-id');
const gdriveClientSecretInput = document.getElementById('settings-gdrive-client-secret');
const gdriveFolderLinkInput = document.getElementById('settings-gdrive-folder-link');
const btnGDriveLogin = document.getElementById('btn-gdrive-login');
const gdriveStatusText = document.getElementById('gdrive-status-text');

// Google Drive Sync Modal
const btnCloudSync = document.getElementById('btn-cloud-sync');
const syncModal = document.getElementById('sync-modal');
const btnCloseSyncModal = document.getElementById('btn-close-sync-modal');
const btnSyncUpload = document.getElementById('btn-sync-upload');
const btnSyncDownload = document.getElementById('btn-sync-download');
const syncProgressText = document.getElementById('sync-progress-text');

// Google Drive Mini Toast Progress Elements
const syncMiniToast = document.getElementById('sync-mini-toast');
const syncToastIcon = document.getElementById('sync-toast-icon');
const syncToastText = document.getElementById('sync-toast-text');

// Image Selection Modal Elements
const imageModal = document.getElementById('image-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalSearchInput = document.getElementById('modal-search-input');
const btnModalSearch = document.getElementById('btn-modal-search');
const btnCloseModal = document.getElementById('btn-close-modal');
const imageResultsGrid = document.getElementById('image-results-grid');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editWordInput = document.getElementById('edit-word');
const editDefInput = document.getElementById('edit-def');
const editFolderSelect = document.getElementById('edit-folder');
const editPromptInput = document.getElementById('edit-prompt');
const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnModalRegenerate = document.getElementById('btn-modal-regenerate');

// Slideshow Modal Elements
const btnSlideshow = document.getElementById('btn-slideshow');
const slideshowModal = document.getElementById('slideshow-modal');
const btnCloseSlideshow = document.getElementById('btn-close-slideshow');
const slideCardElement = document.getElementById('slide-card-element');
const slideImg = document.getElementById('slide-img');
const slideWord = document.getElementById('slide-word');
const slideDefinition = document.getElementById('slide-definition');
const slidePrompt = document.getElementById('slide-prompt');
const btnSlidePrev = document.getElementById('btn-slide-prev');
const btnSlideNext = document.getElementById('btn-slide-next');
const slideCounter = document.getElementById('slide-counter');
const btnSlideAutoplay = document.getElementById('btn-slide-autoplay');
const autoplayIcon = document.getElementById('autoplay-icon');
const autoplayText = document.getElementById('autoplay-text');
const selectAutoplaySpeed = document.getElementById('select-autoplay-speed');

let visibleVocabList = []; // tracks cards currently visible (filtered)
let slideshowIndex = 0;
let slideshowAutoplayInterval = null;
let isSlideshowPlaying = false;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // Load state from localStorage
  const savedList = localStorage.getItem('vocab_list');
  if (savedList) {
    try {
      vocabList = JSON.parse(savedList);
    } catch (e) {
      console.error('Failed to parse saved vocabulary list', e);
    }
  }

  const savedFolders = localStorage.getItem('folders_list');
  if (savedFolders) {
    try {
      foldersList = JSON.parse(savedFolders);
    } catch (e) {
      console.error('Failed to parse folders list', e);
    }
  }

  // Load API key and settings to fields
  geminiKeyInput.value = geminiApiKey;
  imageSourceSelect.value = settings.imageSource;
  imageLimitInput.value = settings.imageLimit;

  // Restore Google Drive configs
  gdriveClientIdInput.value = localStorage.getItem('gdrive_client_id') || '';
  gdriveClientSecretInput.value = localStorage.getItem('gdrive_client_secret') || '';
  gdriveFolderLinkInput.value = localStorage.getItem('gdrive_folder_link') || 'https://drive.google.com/drive/folders/1qAiFrO5nDPm3HN-A8qDQkVrFZSUpyCUE';
  updateGoogleDriveUI();
  attemptSilentGoogleDriveRefresh();

  // Initial render
  updateVocabCount();
  renderFolderSidebar();
  renderVocabGrid();

  // Add Event Listeners
  initNavigation();
  initImportListeners();
  initVocabTabListeners();
  initFolderListeners();
  initSettingsListeners();
  initGoogleDriveListeners();
  initModalListeners();
  initSlideshowListeners();
});

// --- NAVIGATION ---
function initNavigation() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      // Update buttons active state
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update panes active state
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${targetTab}`) {
          pane.classList.add('active');
        }
      });
    });
  });
}

// Password toggle helper (globally accessible)
window.togglePasswordVisibility = function(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
};

// Save Application state
function saveState() {
  localStorage.setItem('vocab_list', JSON.stringify(vocabList));
  updateVocabCount();
  renderFolderSidebar();
  renderVocabGrid();
}

function updateVocabCount() {
  if (vocabCountBadge) {
    vocabCountBadge.textContent = vocabList.length.toString();
  }
}

// --- FOLDER MANAGEMENT ---
function initFolderListeners() {
  btnCreateFolder.addEventListener('click', () => {
    const name = prompt('Nhập tên thư mục mới:');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    // Check duplicate
    if (foldersList.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Thư mục này đã tồn tại!');
      return;
    }

    const newFolder = {
      id: 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: trimmed
    };

    foldersList.push(newFolder);
    localStorage.setItem('folders_list', JSON.stringify(foldersList));
    renderFolderSidebar();
  });
}

function renderFolderSidebar() {
  if (!folderListContainer) return;

  // Clear previous folders except default ones
  folderListContainer.innerHTML = `
    <li class="folder-item ${currentSelectedFolderId === 'all' ? 'active' : ''}" data-folder-id="all">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="folder-name">Tất cả từ vựng</span>
      <span class="folder-badge" id="badge-all">${vocabList.length}</span>
    </li>
    <li class="folder-item ${currentSelectedFolderId === 'uncategorized' ? 'active' : ''}" data-folder-id="uncategorized">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="folder-name">Chưa phân loại</span>
      <span class="folder-badge" id="badge-uncategorized">${vocabList.filter(item => !item.folderId || item.folderId === 'uncategorized').length}</span>
    </li>
  `;

  // Append custom folders
  foldersList.forEach(folder => {
    const count = vocabList.filter(item => item.folderId === folder.id).length;
    const li = document.createElement('li');
    li.className = `folder-item ${currentSelectedFolderId === folder.id ? 'active' : ''}`;
    li.setAttribute('data-folder-id', folder.id);
    li.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="folder-name">${folder.name}</span>
      <span class="folder-badge">${count}</span>
      <button class="btn-delete-folder" title="Xóa thư mục (từ vựng sẽ chuyển về Chưa phân loại)" onclick="event.stopPropagation(); deleteFolder('${folder.id}')">×</button>
    `;
    folderListContainer.appendChild(li);
  });

  // Bind click listeners
  const folderItems = folderListContainer.querySelectorAll('.folder-item');
  folderItems.forEach(item => {
    item.addEventListener('click', () => {
      currentSelectedFolderId = item.getAttribute('data-folder-id');
      selectedCards.clear();
      updateBulkActionsToolbar();
      renderFolderSidebar();
      renderVocabGrid();
    });
  });
}

// Delete folder (move cards to uncategorized)
window.deleteFolder = function(folderId) {
  if (confirm('Xóa thư mục này? (Các từ vựng trong thư mục sẽ chuyển về mục "Chưa phân loại")')) {
    foldersList = foldersList.filter(f => f.id !== folderId);
    localStorage.setItem('folders_list', JSON.stringify(foldersList));

    // Reset folder ID of vocabulary cards in that folder
    vocabList.forEach(item => {
      if (item.folderId === folderId) {
        item.folderId = 'uncategorized';
      }
    });

    if (currentSelectedFolderId === folderId) {
      currentSelectedFolderId = 'all';
    }

    selectedCards.clear();
    saveState();
  }
};

// --- IMPORT & MANUAL ADD ---
function initImportListeners() {
  btnImportBulk.addEventListener('click', handleBulkImport);
  btnAddManual.addEventListener('click', handleManualAdd);
}

// Progress UI Helper
function updateProgress(percent, title, detail) {
  progressTitle.textContent = title;
  progressPercent.textContent = `${percent}%`;
  progressBarFill.style.width = `${percent}%`;
  progressDetail.textContent = detail;
}

// Bulk Import and Web Image Search (non-AI)
async function handleBulkImport() {
  const text = bulkTextarea.value.trim();
  if (!text) {
    alert('Vui lòng nhập danh sách từ vựng & định nghĩa!');
    return;
  }

  // Clear previous progress UI and show it
  progressContainer.classList.remove('hidden');
  updateProgress(0, 'Đang chuẩn bị...', 'Phân tích dữ liệu nhập vào...');
  btnImportBulk.disabled = true;

  try {
    // Parse list (lines formatted as Word - Definition or Word : Definition)
    const lines = text.split('\n');
    const parsedItems = [];

    lines.forEach(line => {
      const parts = line.split(/[-:]/);
      if (parts.length >= 2) {
        const word = parts[0].trim();
        const definition = parts[1].trim();
        if (word || definition) {
          parsedItems.push({ word, definition });
        }
      } else {
        const word = line.trim();
        if (word) {
          parsedItems.push({ word, definition: '' });
        }
      }
    });

    const total = parsedItems.length;
    if (total === 0) {
      throw new Error('Không phân tích được từ vựng nào! Vui lòng nhập đúng định dạng "Từ vựng - Định nghĩa".');
    }

    updateProgress(10, `Đang xử lý (Tổng cộng: ${total})`, 'Bắt đầu cào ảnh và viết prompt...');

    const processedTerms = [];
    const downloadImg = optBulkDownload.checked;
    const autoPrompt = optBulkPrompt.checked;

    for (let i = 0; i < total; i++) {
      const item = parsedItems[i];
      const percent = Math.floor(10 + (i / total) * 90);
      updateProgress(
        percent, 
        `Đang xử lý: "${item.word}" (${i + 1}/${total})`, 
        `Đang tìm hình ảnh thực tế...`
      );

      let imagePrompt = '';
      let finalDefinition = item.definition;

      // 1. Generate prompt with Gemini if checked
      if (autoPrompt && geminiApiKey) {
        const geminiResult = await window.api.generatePrompt(geminiApiKey, item.word, item.definition, 'Manual Bulk Import');
        if (geminiResult.success) {
          imagePrompt = geminiResult.image_prompt;
          if (geminiResult.vietnamese_definition) {
            finalDefinition = geminiResult.vietnamese_definition;
          }
        }
      }

      // 2. Search images (limit to 1 for bulk)
      let imageUrl = '';
      let localPath = '';

      const searchResults = await window.api.searchImages(item.word, 1);
      if (searchResults && searchResults.length > 0) {
        imageUrl = searchResults[0].url;

        // 3. Download image
        if (downloadImg && imageUrl) {
          const downloadResult = await window.api.downloadImage(imageUrl, item.word);
          if (downloadResult.success) {
            localPath = downloadResult.relativeUrl;
          }
        }
      }

      processedTerms.push({
        id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        word: item.word,
        definition: finalDefinition || 'Chưa có định nghĩa',
        image: imageUrl,
        localImagePath: localPath,
        image_prompt: imagePrompt || `A simple high-quality image of "${item.word}"`,
        folderId: currentSelectedFolderId === 'all' ? 'uncategorized' : currentSelectedFolderId
      });
    }

    // Append newly processed terms to the global list
    vocabList = [...processedTerms, ...vocabList];
    saveState();
    bulkTextarea.value = ''; // Clear textarea

    updateProgress(100, 'Hoàn thành!', `Đã thêm thành công ${total} từ vào sổ từ vựng.`);
    setTimeout(() => {
      progressContainer.classList.add('hidden');
      
      // Go to Vocab Tab
      const vocabTabBtn = document.querySelector('[data-tab="vocab"]');
      if (vocabTabBtn) vocabTabBtn.click();
    }, 2000);

  } catch (error) {
    console.error(error);
    alert(`Lỗi nhập hàng loạt: ${error.message}`);
    progressContainer.classList.add('hidden');
  } finally {
    btnImportBulk.disabled = false;
  }
}

// Single Manual Add
async function handleManualAdd() {
  const word = manualWordInput.value.trim();
  const definition = manualDefInput.value.trim();
  const topicName = manualTopicInput.value.trim();

  if (!word) {
    alert('Vui lòng nhập từ vựng!');
    return;
  }

  btnAddManual.disabled = true;
  btnAddManual.textContent = 'Đang thêm...';

  try {
    let folderId = 'uncategorized';

    // Check custom folder matching topic name
    if (topicName) {
      let existingFolder = foldersList.find(f => f.name.toLowerCase() === topicName.toLowerCase());
      if (existingFolder) {
        folderId = existingFolder.id;
      } else {
        // Create new folder
        const newFolder = {
          id: 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: topicName
        };
        foldersList.push(newFolder);
        localStorage.setItem('folders_list', JSON.stringify(foldersList));
        folderId = newFolder.id;
        renderFolderSidebar();
      }
    }

    let imagePrompt = '';
    let finalDefinition = definition;

    // 1. Generate prompt with Gemini if key is present
    if (geminiApiKey) {
      const geminiResult = await window.api.generatePrompt(geminiApiKey, word, definition, topicName || 'General');
      if (geminiResult.success) {
        imagePrompt = geminiResult.image_prompt;
        if (geminiResult.vietnamese_definition) {
          finalDefinition = geminiResult.vietnamese_definition;
        }
      }
    }

    // 2. Search images
    let imageUrl = '';
    let localPath = '';
    const searchResults = await window.api.searchImages(word, 1);
    if (searchResults && searchResults.length > 0) {
      imageUrl = searchResults[0].url;
      
      // 3. Download image
      const downloadResult = await window.api.downloadImage(imageUrl, word);
      if (downloadResult.success) {
        localPath = downloadResult.relativeUrl;
      }
    }

    const newItem = {
      id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      word: word,
      definition: finalDefinition || 'Chưa có định nghĩa',
      image: imageUrl,
      localImagePath: localPath,
      image_prompt: imagePrompt || `A simple high-quality image of "${word}"`,
      folderId: folderId
    };

    vocabList.unshift(newItem);
    saveState();

    // Clear inputs
    manualWordInput.value = '';
    manualDefInput.value = '';
    manualTopicInput.value = '';

    alert(`Đã thêm từ "${word}" thành công!`);

  } catch (error) {
    console.error(error);
    alert(`Lỗi khi thêm từ vựng: ${error.message}`);
  } finally {
    btnAddManual.disabled = false;
    btnAddManual.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Thêm từ
    `;
  }
}

// --- VOCAB GRID RENDERING ---
function renderVocabGrid() {
  if (!vocabGrid) return;

  const searchQuery = vocabSearchInput.value.toLowerCase().trim();
  const filterVal = vocabFilterStatus.value;

  // Filter list
  visibleVocabList = vocabList.filter(item => {
    // 1. Filter by Folder
    if (currentSelectedFolderId === 'uncategorized') {
      if (item.folderId && item.folderId !== 'uncategorized') return false;
    } else if (currentSelectedFolderId !== 'all') {
      if (item.folderId !== currentSelectedFolderId) return false;
    }

    // 2. Filter by search query
    if (searchQuery) {
      const inWord = item.word.toLowerCase().includes(searchQuery);
      const inDef = item.definition.toLowerCase().includes(searchQuery);
      const inPrompt = (item.image_prompt || '').toLowerCase().includes(searchQuery);
      if (!inWord && !inDef && !inPrompt) return false;
    }

    // 3. Filter by status selection
    if (filterVal === 'has_image') {
      if (!item.image && !item.localImagePath) return false;
    } else if (filterVal === 'no_image') {
      if (item.image || item.localImagePath) return false;
    } else if (filterVal === 'has_prompt') {
      if (!item.image_prompt) return false;
    }

    return true;
  });

  // Display empty messages
  if (visibleVocabList.length === 0) {
    vocabGrid.innerHTML = `
      <div class="no-data-msg">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>Không tìm thấy từ vựng nào khớp với bộ lọc hiện tại.</p>
      </div>
    `;
    return;
  }

  // Populate cards
  vocabGrid.innerHTML = visibleVocabList.map(item => {
    const imgSrc = item.localImagePath || item.image || '';
    const hasImage = !!imgSrc;
    const isSelected = selectedCards.has(item.id);

    // Get folder name
    let folderName = 'Chưa phân loại';
    if (item.folderId && item.folderId !== 'uncategorized') {
      const match = foldersList.find(f => f.id === item.folderId);
      if (match) folderName = match.name;
    }

    return `
      <div class="card glass-card vocab-card ${isSelected ? 'selected' : ''}" data-card-id="${item.id}">
        <!-- Select box overlay -->
        <div class="card-select-overlay">
          <input type="checkbox" class="card-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleCardSelection('${item.id}')">
        </div>

        <div class="vocab-card-img-wrapper">
          ${hasImage ? 
            `<img src="${imgSrc}" alt="${item.word}" onerror="this.src=''; this.parentNode.innerHTML='<div class=&quot;no-image-placeholder&quot;>⚠️ Lỗi tải ảnh local</div>'">` 
           : 
            `<div class="no-image-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Chưa có hình ảnh</span>
            </div>`
          }
          <div class="change-img-overlay">
            <button class="btn btn-secondary btn-change-img" onclick="event.stopPropagation(); openImageSelector('${item.id}')">Đổi hình ảnh</button>
          </div>
        </div>

        <div class="vocab-card-info" onclick="toggleCardSelection('${item.id}')">
          <div class="vocab-card-header">
            <span class="vocab-word">${item.word}</span>
            <span class="vocab-topic-tag" title="Thư mục: ${folderName}">${folderName}</span>
          </div>
          <p class="vocab-def">${item.definition}</p>
          <div class="vocab-prompt-box">
            <span class="vocab-prompt-label">AI Image Prompt</span>
            <p class="vocab-prompt-text" title="${item.image_prompt || ''}">${item.image_prompt || 'Chưa viết prompt.'}</p>
          </div>
        </div>

        <div class="vocab-card-actions">
          <button class="btn btn-secondary" onclick="event.stopPropagation(); openEditModal('${item.id}')">
            Chỉnh sửa
          </button>
          <button class="btn btn-secondary btn-danger" onclick="event.stopPropagation(); deleteCard('${item.id}')">
            Xóa
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- CARD SELECTIONS & BULK OPERATIONS ---
window.toggleCardSelection = function(id) {
  if (selectedCards.has(id)) {
    selectedCards.delete(id);
  } else {
    selectedCards.add(id);
  }
  
  // Toggle UI selected class and checkbox state directly
  const cardEl = vocabGrid.querySelector(`.vocab-card[data-card-id="${id}"]`);
  if (cardEl) {
    const chk = cardEl.querySelector('.card-checkbox');
    if (selectedCards.has(id)) {
      cardEl.classList.add('selected');
      if (chk) chk.checked = true;
    } else {
      cardEl.classList.remove('selected');
      if (chk) chk.checked = false;
    }
  }

  updateBulkActionsToolbar();
};

function updateBulkActionsToolbar() {
  if (selectedCards.size > 0) {
    bulkActionsBar.classList.remove('hidden');
    bulkSelectedCount.textContent = `Đã chọn ${selectedCards.size} từ`;
    
    // Set state of Master checkbox
    const allVisibleSelected = visibleVocabList.every(item => selectedCards.has(item.id));
    chkSelectAll.checked = allVisibleSelected;
  } else {
    bulkActionsBar.classList.add('hidden');
    chkSelectAll.checked = false;
  }
}

// Bind bulk listeners
function initVocabTabListeners() {
  vocabSearchInput.addEventListener('input', renderVocabGrid);
  vocabFilterStatus.addEventListener('change', renderVocabGrid);
  btnClearAll.addEventListener('click', handleClearAll);

  // Master checkbox
  chkSelectAll.addEventListener('change', (e) => {
    if (e.target.checked) {
      visibleVocabList.forEach(item => selectedCards.add(item.id));
    } else {
      visibleVocabList.forEach(item => selectedCards.delete(item.id));
    }
    renderVocabGrid();
    updateBulkActionsToolbar();
  });

  // Bulk dropdown move
  btnBulkMove.addEventListener('click', (e) => {
    e.stopPropagation();
    bulkMoveDropdown.classList.toggle('hidden');
    populateBulkMoveDropdown();
  });

  // Hide dropdown on click outside
  document.addEventListener('click', () => {
    bulkMoveDropdown.classList.add('hidden');
  });

  // Bulk Delete
  btnBulkDelete.addEventListener('click', () => {
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedCards.size} từ vựng đã chọn?`)) {
      vocabList = vocabList.filter(item => !selectedCards.has(item.id));
      selectedCards.clear();
      saveState();
      updateBulkActionsToolbar();
    }
  });

  // Cloud sync modal trigger
  btnCloudSync.addEventListener('click', () => {
    if (isSyncing) {
      // Flash the mini-toast to remind user sync is in progress
      syncMiniToast.style.transform = 'scale(1.05)';
      setTimeout(() => {
        syncMiniToast.style.transform = 'scale(1)';
      }, 150);
      return;
    }
    const refreshToken = localStorage.getItem('gdrive_refresh_token');
    if (!refreshToken) {
      alert('Vui lòng liên kết tài khoản Google Drive của bạn tại tab Cấu Hình trước khi đồng bộ đám mây!');
      return;
    }
    syncProgressText.textContent = '';
    syncModal.classList.remove('hidden');
  });
}

function populateBulkMoveDropdown() {
  bulkMoveDropdown.innerHTML = '';
  
  // Uncategorized Option
  const uncategorizedOption = document.createElement('button');
  uncategorizedOption.className = 'bulk-dropdown-item';
  uncategorizedOption.textContent = 'Chưa phân loại';
  uncategorizedOption.addEventListener('click', () => moveSelectedToFolder('uncategorized'));
  bulkMoveDropdown.appendChild(uncategorizedOption);

  // Custom Folders Options
  foldersList.forEach(folder => {
    const opt = document.createElement('button');
    opt.className = 'bulk-dropdown-item';
    opt.textContent = folder.name;
    opt.addEventListener('click', () => moveSelectedToFolder(folder.id));
    bulkMoveDropdown.appendChild(opt);
  });
}

function moveSelectedToFolder(targetFolderId) {
  vocabList.forEach(item => {
    if (selectedCards.has(item.id)) {
      item.folderId = targetFolderId;
    }
  });

  selectedCards.clear();
  saveState();
  updateBulkActionsToolbar();
  bulkMoveDropdown.classList.add('hidden');
}

// Delete single card
window.deleteCard = function(id) {
  if (confirm('Bạn có chắc chắn muốn xóa từ vựng này?')) {
    vocabList = vocabList.filter(item => item.id !== id);
    selectedCards.delete(id);
    saveState();
    updateBulkActionsToolbar();
  }
};

// Clear all cards
function handleClearAll() {
  if (confirm('CẢNH BÁO: Hành động này sẽ xóa toàn bộ sổ từ vựng hiện tại của bạn. Bạn vẫn muốn tiếp tục?')) {
    vocabList = [];
    selectedCards.clear();
    saveState();
    updateBulkActionsToolbar();
  }
}

// --- SETTINGS TAB ---
function initSettingsListeners() {
  btnSaveSettings.addEventListener('click', () => {
    geminiApiKey = geminiKeyInput.value.trim();
    settings.imageSource = imageSourceSelect.value;
    settings.imageLimit = parseInt(imageLimitInput.value || '8');

    // Save credentials
    localStorage.setItem('gemini_api_key', geminiApiKey);
    localStorage.setItem('settings_image_source', settings.imageSource);
    localStorage.setItem('settings_image_limit', settings.imageLimit.toString());

    // Save Google Drive keys
    const gdriveId = gdriveClientIdInput.value.trim();
    const gdriveSecret = gdriveClientSecretInput.value.trim();
    const gdriveFolderLink = gdriveFolderLinkInput.value.trim();
    localStorage.setItem('gdrive_client_id', gdriveId);
    localStorage.setItem('gdrive_client_secret', gdriveSecret);
    localStorage.setItem('gdrive_folder_link', gdriveFolderLink);

    // Show visual status
    settingsSaveSuccess.classList.remove('hidden');
    setTimeout(() => {
      settingsSaveSuccess.classList.add('hidden');
    }, 2500);
  });
}

// --- GOOGLE DRIVE INTEGRATION & SYNC ---
function initGoogleDriveListeners() {
  btnGDriveLogin.addEventListener('click', async () => {
    const isConnected = !!localStorage.getItem('gdrive_refresh_token');
    
    if (isConnected) {
      // Disconnect flow
      if (confirm('Bạn có muốn hủy liên kết tài khoản Google Drive hiện tại?')) {
        localStorage.removeItem('gdrive_refresh_token');
        localStorage.removeItem('gdrive_access_token');
        localStorage.removeItem('gdrive_user_info');
        updateGoogleDriveUI();
        alert('Đã hủy liên kết Google Drive thành công.');
      }
    } else {
      // Connect flow
      const clientId = gdriveClientIdInput.value.trim();
      const clientSecret = gdriveClientSecretInput.value.trim();

      if (!clientId || !clientSecret) {
        alert('Vui lòng điền đầy đủ thông tin Google Client ID và Client Secret!');
        return;
      }

      btnGDriveLogin.disabled = true;
      btnGDriveLogin.textContent = 'Đang kết nối...';
      gdriveStatusText.textContent = 'Đang chờ xác nhận từ trình duyệt của bạn...';

      // Start auth flow
      try {
        await window.api.startGoogleAuth(clientId, clientSecret);
      } catch (err) {
        alert(`Lỗi xác thực: ${err.message}`);
        btnGDriveLogin.disabled = false;
        updateGoogleDriveUI();
      }
    }
  });

  // Listen for login callback success from Main Process
  window.api.onGoogleAuthSuccess(({ tokens, userInfo }) => {
    localStorage.setItem('gdrive_refresh_token', tokens.refresh_token || '');
    localStorage.setItem('gdrive_access_token', tokens.access_token);
    localStorage.setItem('gdrive_user_info', JSON.stringify(userInfo));

    btnGDriveLogin.disabled = false;
    updateGoogleDriveUI();
    alert(`Kết nối tài khoản Google Drive thành công!\nTài khoản liên kết: ${userInfo.name} (${userInfo.email})`);
  });

  window.api.onGoogleAuthFail((err) => {
    btnGDriveLogin.disabled = false;
    updateGoogleDriveUI();
    alert(`Lỗi đăng nhập Google Drive: ${err}`);
  });

  // Helper to extract Folder ID from link or input value
  function getFolderIdFromLink(link) {
    if (!link) return '';
    const match = link.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    const trimmed = link.trim();
    if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
      return trimmed;
    }
    return '';
  }

  // Upload/Download sync button actions
  btnSyncUpload.addEventListener('click', async () => {
    try {
      isSyncing = true;
      // Close the modal immediately so user can continue slide study!
      syncModal.classList.add('hidden');
      showSyncMiniToast('Đang làm mới token xác thực...', 'loading');

      const accessToken = await getGoogleDriveAccessToken();
      showSyncMiniToast('Đang đồng bộ từ vựng & ảnh lên Drive...', 'loading');

      const folderLink = localStorage.getItem('gdrive_folder_link') || 'https://drive.google.com/drive/folders/1qAiFrO5nDPm3HN-A8qDQkVrFZSUpyCUE';
      const folderId = getFolderIdFromLink(folderLink);

      const uploadResult = await window.api.syncUpload(accessToken, vocabList, folderId);
      if (uploadResult.success) {
        showSyncMiniToast('Đồng bộ tải lên Drive thành công!', 'success');
      } else {
        throw new Error(uploadResult.error);
      }
    } catch (e) {
      showSyncMiniToast(`Đồng bộ thất bại: ${e.message}`, 'error');
    } finally {
      isSyncing = false;
    }
  });

  btnSyncDownload.addEventListener('click', async () => {
    try {
      if (vocabList.length > 0) {
        const confirmDownload = confirm('CẢNH BÁO: Tải dữ liệu về sẽ GHI ĐÈ và XÓA toàn bộ từ vựng hiện có trên máy này. Bạn có chắc chắn muốn tải về?');
        if (!confirmDownload) return;
      }

      isSyncing = true;
      // Close the modal immediately so user can continue slide study!
      syncModal.classList.add('hidden');
      showSyncMiniToast('Đang làm mới token xác thực...', 'loading');

      const accessToken = await getGoogleDriveAccessToken();
      showSyncMiniToast('Đang tải dữ liệu từ Google Drive...', 'loading');

      const folderLink = localStorage.getItem('gdrive_folder_link') || 'https://drive.google.com/drive/folders/1qAiFrO5nDPm3HN-A8qDQkVrFZSUpyCUE';
      const folderId = getFolderIdFromLink(folderLink);

      const downloadResult = await window.api.syncDownload(accessToken, folderId);
      if (downloadResult.success) {
        vocabList = downloadResult.vocabList;
        saveState(); // Save locally, update badges/grid
        renderVocabGrid();
        updateVocabCount();
        showSyncMiniToast('Tải về máy thành công! Đã cập nhật.', 'success');
      } else {
        throw new Error(downloadResult.error);
      }
    } catch (e) {
      showSyncMiniToast(`Tải dữ liệu thất bại: ${e.message}`, 'error');
    } finally {
      isSyncing = false;
    }
  });
}

function updateGoogleDriveUI() {
  const refreshToken = localStorage.getItem('gdrive_refresh_token');
  const userInfoStr = localStorage.getItem('gdrive_user_info');

  if (refreshToken && userInfoStr) {
    try {
      const userInfo = JSON.parse(userInfoStr);
      gdriveStatusText.innerHTML = `<span style="color:#10b981; font-weight:bold;">Đã kết nối:</span> ${userInfo.name} (${userInfo.email})`;
      btnGDriveLogin.textContent = 'Hủy liên kết tài khoản';
      btnGDriveLogin.className = 'btn btn-secondary btn-danger';
    } catch (e) {
      gdriveStatusText.textContent = 'Đã kết nối (Lỗi đọc thông tin profile)';
    }
  } else {
    gdriveStatusText.textContent = 'Chưa kết nối đám mây';
    btnGDriveLogin.textContent = 'Kết nối Google Drive';
    btnGDriveLogin.className = 'btn btn-secondary';
  }
}

// Internal function to secure token validity
async function getGoogleDriveAccessToken() {
  const clientId = localStorage.getItem('gdrive_client_id');
  const clientSecret = localStorage.getItem('gdrive_client_secret');
  const refreshToken = localStorage.getItem('gdrive_refresh_token');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Vui lòng kiểm tra lại cấu hình Google Drive trong tab Cấu Hình.');
  }

  const result = await window.api.refreshGoogleToken(clientId, clientSecret, refreshToken);
  if (result.success) {
    localStorage.setItem('gdrive_access_token', result.accessToken);
    return result.accessToken;
  } else {
    throw new Error(`Không thể tự động làm mới token: ${result.error}. Vui lòng nhấp kết nối lại.`);
  }
}

async function attemptSilentGoogleDriveRefresh() {
  const refreshToken = localStorage.getItem('gdrive_refresh_token');
  if (!refreshToken) return;
  
  try {
    const accessToken = await getGoogleDriveAccessToken();
    const infoResult = await window.api.getGoogleUserInfo(accessToken);
    if (infoResult.success) {
      localStorage.setItem('gdrive_user_info', JSON.stringify(infoResult.userInfo));
      updateGoogleDriveUI();
    }
  } catch (e) {
    console.warn('Silent Google Drive Refresh failed:', e.message);
  }
}

// --- SLIDESHOW PRESENTATION MODE ---
function initSlideshowListeners() {
  btnSlideshow.addEventListener('click', () => {
    if (visibleVocabList.length === 0) {
      alert('Không có từ vựng nào trong danh mục hiện tại để trình chiếu!');
      return;
    }
    
    // Stop autoplay if somehow running
    stopSlideshowAutoplay();
    
    slideshowIndex = 0;
    slideshowModal.classList.remove('hidden');
    slideCardElement.classList.remove('flipped');
    
    renderSlide();
  });

  // Close Slideshow
  btnCloseSlideshow.addEventListener('click', closeSlideshow);

  // Card Flip Action
  slideCardElement.addEventListener('click', () => {
    slideCardElement.classList.toggle('flipped');
  });

  // Prev / Next buttons
  btnSlidePrev.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateSlide(-1);
  });
  btnSlideNext.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateSlide(1);
  });

  // Autoplay Trigger
  btnSlideAutoplay.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isSlideshowPlaying) {
      stopSlideshowAutoplay();
    } else {
      startSlideshowAutoplay();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', handleSlideshowKeydown);
}

function renderSlide() {
  if (visibleVocabList.length === 0) return;
  const card = visibleVocabList[slideshowIndex];
  if (!card) return;

  const imgSrc = card.localImagePath || card.image || '';
  if (imgSrc) {
    slideImg.src = imgSrc;
    slideImg.style.display = 'block';
  } else {
    slideImg.src = '';
    slideImg.style.display = 'none';
  }

  slideWord.textContent = card.word;
  slideDefinition.textContent = card.definition;
  slidePrompt.textContent = card.image_prompt || `A simple high-quality image of "${card.word}"`;
  slideCounter.textContent = `${slideshowIndex + 1} / ${visibleVocabList.length}`;
}

function navigateSlide(direction) {
  slideCardElement.classList.remove('flipped');
  setTimeout(() => {
    slideshowIndex = (slideshowIndex + direction + visibleVocabList.length) % visibleVocabList.length;
    renderSlide();
  }, 150); // slight delay for smooth back flip before slide change
}

function startSlideshowAutoplay() {
  isSlideshowPlaying = true;
  autoplayText.textContent = 'Dừng chạy';
  
  // Change icon to Pause
  autoplayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  btnSlideAutoplay.classList.add('btn-secondary');
  btnSlideAutoplay.classList.remove('btn-primary');

  const speed = parseInt(selectAutoplaySpeed.value || '5000');
  
  slideshowAutoplayInterval = setInterval(() => {
    navigateSlide(1);
  }, speed);
}

function stopSlideshowAutoplay() {
  isSlideshowPlaying = false;
  autoplayText.textContent = 'Tự động chạy';
  
  // Change icon to Play
  autoplayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  btnSlideAutoplay.classList.remove('btn-secondary');
  btnSlideAutoplay.classList.add('btn-primary');

  if (slideshowAutoplayInterval) {
    clearInterval(slideshowAutoplayInterval);
    slideshowAutoplayInterval = null;
  }
}

function closeSlideshow() {
  stopSlideshowAutoplay();
  slideshowModal.classList.add('hidden');
}

function handleSlideshowKeydown(e) {
  if (slideshowModal.classList.contains('hidden')) return;

  if (e.key === 'ArrowLeft') {
    navigateSlide(-1);
  } else if (e.key === 'ArrowRight') {
    navigateSlide(1);
  } else if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault(); // prevent scroll
    slideCardElement.classList.toggle('flipped');
  } else if (e.key === 'Escape') {
    closeSlideshow();
  }
}

// --- MODAL & CARD EDITOR LISTENERS ---
function initModalListeners() {
  // Close buttons
  btnCloseModal.addEventListener('click', () => imageModal.classList.add('hidden'));
  btnCloseEditModal.addEventListener('click', () => editModal.classList.add('hidden'));
  btnCloseSyncModal.addEventListener('click', () => syncModal.classList.add('hidden'));
  
  // Close on outer overlay click
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) imageModal.classList.add('hidden');
  });
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.classList.add('hidden');
  });
  syncModal.addEventListener('click', (e) => {
    if (e.target === syncModal) syncModal.classList.add('hidden');
  });

  // Save edit
  btnSaveEdit.addEventListener('click', () => {
    const card = vocabList.find(item => item.id === currentEditingCardId);
    if (card) {
      card.definition = editDefInput.value.trim();
      card.image_prompt = editPromptInput.value.trim();
      card.folderId = editFolderSelect.value;
      saveState();
    }
    editModal.classList.add('hidden');
  });

  // Regenerate prompt with Gemini inside modal
  btnModalRegenerate.addEventListener('click', async () => {
    if (!geminiApiKey) {
      alert('Vui lòng điền và lưu Gemini API Key tại tab Cấu Hằng để tạo prompt AI!');
      return;
    }

    const card = vocabList.find(item => item.id === currentEditingCardId);
    if (!card) return;

    btnModalRegenerate.disabled = true;
    btnModalRegenerate.textContent = 'Đang tạo prompt...';

    try {
      const result = await window.api.generatePrompt(geminiApiKey, card.word, editDefInput.value.trim(), 'Edit Modal');
      if (result.success) {
        editPromptInput.value = result.image_prompt;
        if (result.vietnamese_definition) {
          editDefInput.value = result.vietnamese_definition;
        }
      } else {
        alert(`Không thể tạo prompt: ${result.error}`);
      }
    } catch (error) {
      alert(`Đã xảy ra lỗi: ${error.message}`);
    } finally {
      btnModalRegenerate.disabled = false;
      btnModalRegenerate.textContent = 'Tạo Lại Prompt (Gemini)';
    }
  });

  // Image search in Modal
  btnModalSearch.addEventListener('click', () => {
    const searchQuery = modalSearchInput.value.trim();
    if (searchQuery) {
      loadModalImages(searchQuery);
    }
  });

  modalSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const searchQuery = modalSearchInput.value.trim();
      if (searchQuery) {
        loadModalImages(searchQuery);
      }
    }
  });
}

// --- MODAL: EDIT CARD POPULATE ---
window.openEditModal = function(id) {
  currentEditingCardId = id;
  const card = vocabList.find(item => item.id === id);
  if (!card) return;

  editWordInput.value = card.word;
  editDefInput.value = card.definition;
  editPromptInput.value = card.image_prompt || '';

  // Populate folder select options
  editFolderSelect.innerHTML = '<option value="uncategorized">Chưa phân loại</option>';
  foldersList.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    editFolderSelect.appendChild(option);
  });

  editFolderSelect.value = card.folderId || 'uncategorized';

  editModal.classList.remove('hidden');
};

// --- MODAL: IMAGE SELECTOR ---
window.openImageSelector = function(id) {
  currentImageSelectorCardId = id;
  const card = vocabList.find(item => item.id === id);
  if (!card) return;

  modalTitle.textContent = `Chọn hình ảnh cho: "${card.word}"`;
  modalSubtitle.textContent = 'Đang tìm hình ảnh...';
  modalSearchInput.value = card.word;
  imageResultsGrid.innerHTML = '<div class="no-data-msg"><p>Đang kết nối tìm kiếm...</p></div>';

  imageModal.classList.remove('hidden');
  loadModalImages(card.word);
};

// Fetch images and display in Modal
async function loadModalImages(query) {
  imageResultsGrid.innerHTML = `
    <div class="no-data-msg">
      <svg class="progress-bar-fill" style="animation: spin 1s infinite linear" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      <p>Đang tìm hình ảnh liên quan...</p>
    </div>
  `;

  try {
    const results = await window.api.searchImages(query, settings.imageLimit);
    modalSubtitle.textContent = `Tìm thấy ${results.length} hình ảnh phù hợp.`;

    if (results.length === 0) {
      imageResultsGrid.innerHTML = '<div class="no-data-msg"><p>Không tìm thấy hình ảnh phù hợp nào. Hãy thử từ khóa khác.</p></div>';
      return;
    }

    const card = vocabList.find(item => item.id === currentImageSelectorCardId);

    imageResultsGrid.innerHTML = results.map(img => {
      const isCurrent = card && (card.image === img.url || card.localImagePath === img.url);
      return `
        <div class="image-result-item ${isCurrent ? 'selected' : ''}" onclick="selectImage('${img.url}')">
          <img src="${img.thumbnail || img.url}" alt="${img.title}" title="${img.title}">
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error(error);
    imageResultsGrid.innerHTML = '<div class="no-data-msg"><p>Lỗi kết nối tải hình ảnh.</p></div>';
  }
}

// Select Image and download it locally
window.selectImage = async function(url) {
  const card = vocabList.find(item => item.id === currentImageSelectorCardId);
  if (!card) return;

  // Show status inside modal
  modalSubtitle.textContent = 'Đang tải hình ảnh được chọn...';
  
  // Highlight chosen image
  const items = imageResultsGrid.querySelectorAll('.image-result-item');
  items.forEach(el => {
    const imgEl = el.querySelector('img');
    if (imgEl && imgEl.src.includes(url)) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  try {
    // 1. Update web URL in card
    card.image = url;

    // 2. Download locally
    const downloadResult = await window.api.downloadImage(url, card.word);
    if (downloadResult.success) {
      card.localImagePath = downloadResult.relativeUrl;
    } else {
      card.localImagePath = ''; // fall back to web URL directly
    }

    saveState();
    imageModal.classList.add('hidden');
  } catch (error) {
    alert(`Không tải được ảnh: ${error.message}. Sẽ hiển thị trực tiếp bằng link web.`);
    card.localImagePath = '';
    saveState();
    imageModal.classList.add('hidden');
  }
};
