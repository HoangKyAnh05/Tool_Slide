const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Search Images via Bing CDN / Unsplash
  searchImages: (query, limit) => ipcRenderer.invoke('image:search', { query, limit }),

  // Generate Prompt using Gemini
  generatePrompt: (apiKey, word, definition, topic) => 
    ipcRenderer.invoke('gemini:generate-prompt', { apiKey, word, definition, topic }),

  // Download image from URL and save locally
  downloadImage: (url, word) => ipcRenderer.invoke('file:download-image', { url, word }),

  // Google Drive Cloud Sync APIs
  startGoogleAuth: (clientId, clientSecret) => ipcRenderer.invoke('gdrive:start-auth', { clientId, clientSecret }),
  refreshGoogleToken: (clientId, clientSecret, refreshToken) => ipcRenderer.invoke('gdrive:refresh-token', { clientId, clientSecret, refreshToken }),
  getGoogleUserInfo: (accessToken) => ipcRenderer.invoke('gdrive:get-user-info', accessToken),
  syncUpload: (accessToken, vocabList, folderId, fileName, syncMode) => 
    ipcRenderer.invoke('gdrive:sync-upload', { accessToken, vocabList, folderId, fileName, syncMode }),
  syncDownload: (accessToken, folderId, fileName) => 
    ipcRenderer.invoke('gdrive:sync-download', { accessToken, folderId, fileName }),

  // Google Auth Listener Events
  onGoogleAuthSuccess: (callback) => {
    ipcRenderer.removeAllListeners('gdrive:auth-success');
    ipcRenderer.on('gdrive:auth-success', (event, data) => callback(data));
  },
  onGoogleAuthFail: (callback) => {
    ipcRenderer.removeAllListeners('gdrive:auth-fail');
    ipcRenderer.on('gdrive:auth-fail', (event, error) => callback(error));
  }
});
