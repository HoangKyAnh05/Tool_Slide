const axios = require('axios');
const fs = require('fs');
const path = require('path');

const REDIRECT_URI = 'http://localhost:8599/oauth2callback';

// Generate Google Auth URL
function getAuthUrl(clientId) {
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `access_type=offline&` +
    `prompt=consent`;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(clientId, clientSecret, code) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  });
  return response.data;
}

// Refresh access token using refresh token
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  return response.data;
}

// Get Google user info
async function getUserInfo(accessToken) {
  const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.data; // { email, name, picture }
}

// Get or create VocabAI folder on Google Drive
async function getOrCreateFolder(accessToken) {
  // 1. Search for existing folder
  const searchResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      q: "name = 'VocabAI' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)'
    }
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    return searchResponse.data.files[0].id;
  }

  // 2. Create the folder if not found
  const createResponse = await axios.post('https://www.googleapis.com/drive/v3/files', {
    name: 'VocabAI',
    mimeType: 'application/vnd.google-apps.folder'
  }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  return createResponse.data.id;
}


// Search for vocab_list (Google Doc) on Google Drive
async function findDocFile(accessToken, folderId, fileName = 'vocab_list') {
  const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      q: `name = '${fileName}' and '${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
      fields: 'files(id, name)'
    }
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  }
  return null;
}

// Helper to parse vocabulary list back from Google Doc HTML export
function parseGoogleDocHtml(html) {
  const list = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let isHeader = true;
  
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.push(cellMatch[1]);
    }
    
    if (cells.length >= 2) {
      if (isHeader) {
        if (cells[0].includes('Từ vựng') || cells[0].includes('Định nghĩa')) {
          isHeader = false;
          continue;
        }
      }
      
      const firstCell = cells[0];
      const secondCell = cells[1];
      
      const lines = firstCell
        .replace(/<br[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
        
      if (lines.length >= 1) {
        const word = lines[0];
        let definitionLines = [];
        let topic = 'Nhập hàng loạt';
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('Chủ đề:') || line.startsWith('Folder:')) {
            topic = line.replace(/^(Chủ đề:|Folder:)/, '').trim();
          } else if (line.startsWith('Thư mục:')) {
            topic = line.replace(/^Thư mục:/, '').trim();
          } else {
            definitionLines.push(line);
          }
        }
        
        const definition = definitionLines.join('\n') || 'Chưa có định nghĩa';
        
        // Extract image url
        let image = '';
        const imgMatch = secondCell.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) {
          image = imgMatch[1];
        }
        
        list.push({
          id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          word,
          definition,
          image,
          localImagePath: '',
          image_prompt: `A simple high-quality image of "${word}"`,
          topic
        });
      }
    }
  }
  return list;
}

// Upload/Sync vocab list data to Google Drive
async function uploadVocabList(accessToken, vocabData, folderId, fileName = 'vocab_list', syncMode = 'overwrite') {
  // 1. Get or create VocabAI folder if none provided
  const targetFolderId = folderId || await getOrCreateFolder(accessToken);

  // 4. Clean up any loose image files in targetFolderId (parent folder) from previous syncs
  try {
    const parentFilesResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: `'${targetFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 1000
      }
    });
    for (const file of parentFilesResponse.data.files || []) {
      if (
        file.mimeType.startsWith('image/') || 
        file.name.endsWith('.jpg') || 
        file.name.endsWith('.png') || 
        file.name === `${fileName}.doc` || 
        file.name === `${fileName}.html` ||
        file.name === `${fileName}.json`
      ) {
        try {
          await axios.delete(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        } catch (delErr) {
          console.error(`Failed to delete cluttered file: ${file.name}`, delErr);
        }
      }
    }
  } catch (cleanErr) {
    console.error('Failed to clean up parent folder:', cleanErr);
  }

  // 5. Upload images to Google Drive as temporary files
  const vocabList = JSON.parse(vocabData);
  const tableRowsHtml = [];
  const tempImageIds = [];

  for (const item of vocabList) {
    let imgSrc = '';
    let imageUploadedId = null;

    if (item.localImagePath) {
      const absPath = path.resolve(__dirname, item.localImagePath);
      if (fs.existsSync(absPath)) {
        const fileName = path.basename(absPath);
        try {
          const fileBuffer = fs.readFileSync(absPath);
          // 1) Create metadata for image in targetFolderId
          const createImgMeta = await axios.post('https://www.googleapis.com/drive/v3/files', {
            name: fileName,
            parents: [targetFolderId],
            mimeType: 'image/jpeg'
          }, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          const imgId = createImgMeta.data.id;
          
          // 2) Upload image media content
          await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${imgId}?uploadType=media`, fileBuffer, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'image/jpeg'
            }
          });

          // 3) Share file to "anyone" so Google Docs conversion engine can load it
          try {
            await axios.post(`https://www.googleapis.com/drive/v3/files/${imgId}/permissions`, {
              role: 'reader',
              type: 'anyone'
            }, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });
          } catch (permErr) {
            console.error('Failed to set permission for image on Drive:', permErr);
          }

          imageUploadedId = imgId;
          tempImageIds.push(imgId);
        } catch (uploadErr) {
          console.error('Failed to upload image to Drive:', uploadErr);
        }
      }
    }

    if (imageUploadedId) {
      // Use export=view URL format for embedding in HTML to ensure Google Docs conversion reads it
      imgSrc = `https://drive.google.com/uc?export=view&id=${imageUploadedId}`;
    } else {
      imgSrc = item.image || '';
    }

    const imgHtml = imgSrc 
      ? `<img src="${imgSrc}" width="200" height="150" style="object-fit: cover; border-radius: 6px;" />` 
      : `<i>Không có ảnh</i>`;

    tableRowsHtml.push(`
      <tr>
        <td style="border: 1px solid #cccccc; padding: 12px; vertical-align: top;">
          <div style="font-size: 16pt; font-weight: bold; color: #333333; margin-bottom: 6px;">${item.word}</div>
          <div style="font-size: 12pt; color: #555555; margin-bottom: 8px;">${item.definition}</div>
          <div style="font-size: 9pt; color: #999999;">Chủ đề: ${item.topic || 'Chưa phân loại'}</div>
        </td>
        <td style="border: 1px solid #cccccc; padding: 12px; text-align: center; vertical-align: middle; width: 220px;">
          ${imgHtml}
        </td>
      </tr>
    `);
  }

  const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Vocab List</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <h2 style="color: #333333; border-bottom: 2px solid #333333; padding-bottom: 8px; margin-bottom: 20px;">Danh sách từ vựng VocabAI (${vocabList.length} từ)</h2>
  <table style="border-collapse: collapse; width: 100%; border: 1px solid #cccccc;">
    <thead>
      <tr style="background-color: #f2f2f2;">
        <th style="border: 1px solid #cccccc; padding: 12px; text-align: left; font-weight: bold;">Từ vựng & Định nghĩa</th>
        <th style="border: 1px solid #cccccc; padding: 12px; text-align: center; font-weight: bold; width: 220px;">Hình ảnh</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml.join('\n')}
    </tbody>
  </table>
</body>
</html>`;

  // 6. Find or create the Google Doc (if in overwrite mode)
  let docFileId = null;
  if (syncMode === 'overwrite') {
    docFileId = await findDocFile(accessToken, targetFolderId, fileName);
  }

  if (!docFileId) {
    const createDocMetaResponse = await axios.post('https://www.googleapis.com/drive/v3/files', {
      name: fileName,
      parents: [targetFolderId],
      mimeType: 'application/vnd.google-apps.document' // target type is Google Doc
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    docFileId = createDocMetaResponse.data.id;
  }

  // 7. Upload HTML content to the Google Doc (Google Drive converts it synchronously)
  await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${docFileId}?uploadType=media`, docContent, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/html'
    }
  });

  // 8. Delete the temporary images from Drive (since they have been embedded inside the Doc)
  for (const imgId of tempImageIds) {
    try {
      await axios.delete(`https://www.googleapis.com/drive/v3/files/${imgId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (delErr) {
      console.error(`Failed to delete temporary image ${imgId}:`, delErr);
    }
  }

  return docFileId;
}

// Download vocab list data from Google Drive
async function downloadVocabList(accessToken, folderId, fileName = 'vocab_list') {
  // 1. Find the target folder
  const targetFolderId = folderId || await getOrCreateFolder(accessToken);

  // 2. Find the Google Doc by custom name
  const docFileId = await findDocFile(accessToken, targetFolderId, fileName);
  if (!docFileId) {
    throw new Error(`Không tìm thấy tài liệu Google Doc "${fileName}" trên Drive.`);
  }

  // 3. Export the Google Doc content as HTML
  const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${docFileId}/export?mimeType=text/html`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'text'
  });

  // 4. Parse the exported HTML back to the vocabList structure
  const vocabList = parseGoogleDocHtml(response.data);
  return vocabList;
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserInfo,
  uploadVocabList,
  downloadVocabList
};
