const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const http = require('http');

// Import services
const { searchImages } = require('./services/imageSearch');
const { generateImagePrompt } = require('./services/promptGenerator');
const { 
  getAuthUrl, 
  exchangeCodeForTokens, 
  refreshAccessToken, 
  getUserInfo, 
  uploadVocabList, 
  downloadVocabList 
} = require('./services/googleDrive');

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'VocabAI - Image Finder & Vocabulary Manager',
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.png'), // Will add fallback if not present
    titleBarStyle: 'default'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development if needed
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: Image Search
ipcMain.handle('image:search', async (event, { query, limit }) => {
  try {
    return await searchImages(query, limit);
  } catch (error) {
    return [];
  }
});

// IPC Handler: Gemini prompt generator
ipcMain.handle('gemini:generate-prompt', async (event, { apiKey, word, definition, topic }) => {
  try {
    return await generateImagePrompt(apiKey, word, definition, topic);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Download image locally
ipcMain.handle('file:download-image', async (event, { url, word }) => {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // Detect file type
    const contentType = response.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Định dạng dữ liệu không hợp lệ: ${contentType}. Cần tải về một hình ảnh.`);
    }

    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('gif')) extension = 'gif';

    const safeWord = word.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
    const filename = `${safeWord}_${Date.now()}.${extension}`;
    const downloadsDir = path.join(__dirname, 'downloads');

    // Create downloads directory if not exists
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const filePath = path.join(downloadsDir, filename);
    fs.writeFileSync(filePath, response.data);

    return { 
      success: true, 
      filePath: filePath,
      relativeUrl: `../downloads/${filename}`,
      filename 
    };
  } catch (error) {
    console.error('Image Download Error:', error);
    return { success: false, error: error.message };
  }
});

let oauthServer = null;

// IPC Handler: Start Google OAuth Flow
ipcMain.handle('gdrive:start-auth', async (event, { clientId, clientSecret }) => {
  if (oauthServer) {
    oauthServer.close();
    oauthServer = null;
  }

  return new Promise((resolve) => {
    oauthServer = http.createServer(async (req, res) => {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      if (urlObj.pathname === '/oauth2callback') {
        const code = urlObj.searchParams.get('code');
        const err = urlObj.searchParams.get('error');

        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Lỗi đăng nhập!</h1><p>${err}</p>`);
          mainWindow.webContents.send('gdrive:auth-fail', err);
          resolve({ success: false, error: err });
          if (oauthServer) {
            oauthServer.close();
            oauthServer = null;
          }
          return;
        }

        if (code) {
          try {
            const tokens = await exchangeCodeForTokens(clientId, clientSecret, code);
            const userInfo = await getUserInfo(tokens.access_token);
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Đăng nhập Google Drive thành công!</h1><p>Bạn có thể đóng trình duyệt này và quay lại ứng dụng VocabAI.</p>');
            
            mainWindow.webContents.send('gdrive:auth-success', { tokens, userInfo });
            resolve({ success: true, tokens, userInfo });
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>Lỗi xác thực!</h1><p>${e.message}</p>`);
            mainWindow.webContents.send('gdrive:auth-fail', e.message);
            resolve({ success: false, error: e.message });
          } finally {
            if (oauthServer) {
              oauthServer.close();
              oauthServer = null;
            }
          }
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    oauthServer.listen(8599, () => {
      console.log('[Google Auth] Local server listening on port 8599');
      const authUrl = getAuthUrl(clientId);
      shell.openExternal(authUrl);
    });
  });
});

// IPC Handler: Refresh Google Access Token
ipcMain.handle('gdrive:refresh-token', async (event, { clientId, clientSecret, refreshToken }) => {
  try {
    const data = await refreshAccessToken(clientId, clientSecret, refreshToken);
    return { success: true, accessToken: data.access_token };
  } catch (error) {
    console.error('Refresh Token Error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Get User Info
ipcMain.handle('gdrive:get-user-info', async (event, accessToken) => {
  try {
    const data = await getUserInfo(accessToken);
    return { success: true, userInfo: data };
  } catch (error) {
    console.error('Get User Info Error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Sync Upload to Google Drive
ipcMain.handle('gdrive:sync-upload', async (event, { accessToken, vocabList, folderId }) => {
  try {
    const vocabData = JSON.stringify(vocabList, null, 2);
    await uploadVocabList(accessToken, vocabData, folderId);
    return { success: true };
  } catch (error) {
    console.error('Sync Upload Error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Sync Download from Google Drive
ipcMain.handle('gdrive:sync-download', async (event, { accessToken, folderId }) => {
  try {
    const vocabList = await downloadVocabList(accessToken, folderId);
    if (!Array.isArray(vocabList)) {
      throw new Error('Định dạng tệp dữ liệu trên Google Drive không đúng chuẩn (phải là danh sách từ vựng).');
    }
    return { success: true, vocabList };
  } catch (error) {
    console.error('Sync Download Error:', error);
    return { success: false, error: error.message };
  }
});
