const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Uses Google Gemini model to generate a descriptive image prompt based on the vocabulary word.
 * Also refines the definition or translates it into Vietnamese.
 */
async function generateImagePrompt(apiKey, word, definition = '', topic = '') {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Using gemini-1.5-flash as it is fast, cheap, and very capable
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const systemPrompt = `You are a professional prompt engineer for AI image generators (DALL-E 3, Midjourney, Stable Diffusion).
Your goal is to write a highly detailed, visually descriptive image prompt in English for the given vocabulary word.
The prompt should describe a scene or concept that perfectly illustrates the word's definition so that students can visually memorize the word.

Make the prompt rich, creative, and professional. Avoid text in the image. Specify visual styles (e.g. 3D render, studio lighting, clear background, vibrant colors).

You must respond with a JSON object in this exact format:
{
  "image_prompt": "A detailed English prompt for image generation...",
  "vietnamese_definition": "A clear, concise translation or definition in Vietnamese"
}`;

    const userPrompt = `Word: "${word}"
Definition from user: "${definition}"
Topic/Theme: "${topic}"`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);
    
    const responseText = result.response.text().trim();
    
    // Extract JSON from response text
    let jsonText = responseText;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.substring(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.substring(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.substring(0, jsonText.length - 3);
    }
    jsonText = jsonText.trim();

    const data = JSON.parse(jsonText);
    return {
      success: true,
      image_prompt: data.image_prompt,
      vietnamese_definition: data.vietnamese_definition || definition
    };
  } catch (error) {
    console.error('Gemini prompt generation error:', error);
    return {
      success: false,
      error: error.message,
      image_prompt: `A clean visual concept showing the meaning of '${word}' (${definition}), high quality photo, detailed, studio lighting, white background`,
      vietnamese_definition: definition || 'Chưa rõ định nghĩa'
    };
  }
}

module.exports = { generateImagePrompt };
