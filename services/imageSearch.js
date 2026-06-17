const axios = require('axios');

/**
 * Main function to search for images.
 * Tries Bing Image Search first (very reliable, no key, parses direct URLs).
 * Falls back to Unsplash Search API, then DuckDuckGo, then random featured images.
 */
async function searchImages(query, limit = 8) {
  const cleanQuery = query.trim();
  console.log(`[ImageSearch] Searching images for: "${cleanQuery}"`);

  // 1. Try Bing Image Search (Highly reliable scraping)
  try {
    const results = await searchBingImages(cleanQuery, limit);
    if (results && results.length > 0) {
      console.log(`[ImageSearch] Found ${results.length} images from Bing.`);
      return results;
    }
  } catch (error) {
    console.error('[ImageSearch] Bing Search failed:', error.message);
  }

  // 2. Try Unsplash Public search (Beautiful high-quality photos)
  try {
    const results = await searchUnsplashImages(cleanQuery, limit);
    if (results && results.length > 0) {
      console.log(`[ImageSearch] Found ${results.length} images from Unsplash.`);
      return results;
    }
  } catch (error) {
    console.error('[ImageSearch] Unsplash Search failed:', error.message);
  }

  // 3. Try DuckDuckGo
  try {
    const results = await searchDuckDuckGoImages(cleanQuery, limit);
    if (results && results.length > 0) {
      console.log(`[ImageSearch] Found ${results.length} images from DuckDuckGo.`);
      return results;
    }
  } catch (error) {
    console.error('[ImageSearch] DuckDuckGo Search failed:', error.message);
  }

  // 4. Ultimate Fallback (Unique Source URL per word)
  console.log('[ImageSearch] All search engines failed. Using Source Unsplash fallback.');
  return getFeaturedFallback(cleanQuery, limit);
}

/**
 * Scrapes Bing Image Search.
 * Returns Bing CDN images (using tse1.mm.bing.net/th) resized for reliability and high quality.
 */
async function searchBingImages(query, limit) {
  const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1;`;
  const response = await axios.get(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.bing.com/'
    }
  });

  const html = response.data;
  const regex = /class="iusc"\s+[^>]*?m="([^"]+?)"/g;
  let match;
  const results = [];

  while ((match = regex.exec(html)) !== null && results.length < limit) {
    try {
      const jsonStr = match[1].replace(/&quot;/g, '"');
      const data = JSON.parse(jsonStr);
      
      // Use Bing CDN Thumbnail (turl) as the main URL, but request a high-quality resize (600x400)
      // This bypasses hotlinking blocks from original websites.
      let imageUrl = data.turl || data.imgurl;
      if (imageUrl && imageUrl.includes('bing.net/th')) {
        const baseUrl = imageUrl.split('&')[0];
        // Resize to a high-quality 600px width card image
        imageUrl = `${baseUrl}&w=600&h=400&c=7&rs=1&p=0`;
      }

      if (imageUrl) {
        results.push({
          url: imageUrl,
          thumbnail: data.turl || imageUrl,
          title: data.title || query,
          width: 600,
          height: 400
        });
      }
    } catch (e) {
      // JSON parse error, ignore
    }
  }

  return results;
}

/**
 * Queries Unsplash's public internal Search API.
 */
async function searchUnsplashImages(query, limit) {
  const searchUrl = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}`;
  const response = await axios.get(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://unsplash.com/'
    }
  });

  if (response.data && response.data.results && response.data.results.length > 0) {
    return response.data.results.map(item => ({
      url: item.urls.regular,
      thumbnail: item.urls.small || item.urls.regular,
      title: item.alt_description || query,
      width: item.width,
      height: item.height
    }));
  }

  return [];
}

/**
 * Searches DuckDuckGo Images.
 */
async function searchDuckDuckGoImages(query, limit) {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  const htmlResponse = await axios.get(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const html = htmlResponse.data;
  const vqdRegex = /vqd=['"]?([^'"]+?)['"]?[\s;]/i;
  let match = html.match(vqdRegex);
  
  if (!match) {
    const vqdRegexAlt = /vqd=([^&]+)/;
    match = html.match(vqdRegexAlt);
  }
  
  if (!match) return [];
  
  const vqd = match[1];
  const imageUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,`;
  const jsonResponse = await axios.get(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://duckduckgo.com/',
      'Accept': 'application/json'
    }
  });

  if (jsonResponse.data && jsonResponse.data.results && jsonResponse.data.results.length > 0) {
    return jsonResponse.data.results.slice(0, limit).map(item => ({
      url: item.image,
      thumbnail: item.thumbnail || item.image,
      title: item.title,
      width: item.width,
      height: item.height
    }));
  }
  
  return [];
}

/**
 * Returns Unsplash Featured Source URL.
 * Generates unique images per word by embedding the query and signature index.
 */
function getFeaturedFallback(query, limit) {
  const list = [];
  const encodedQuery = encodeURIComponent(query);
  for (let i = 0; i < limit; i++) {
    // Using source.unsplash.com featured redirect to get dynamic matching images
    const url = `https://images.unsplash.com/featured/?${encodedQuery}&sig=${i}`;
    list.push({
      url: url,
      thumbnail: url,
      title: `${query} Image ${i + 1}`,
      width: 800,
      height: 600
    });
  }
  return list;
}

module.exports = { searchImages };
