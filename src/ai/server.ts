import 'dotenv/config';
import express from 'express';
import { defineCapturedWord } from './flows/define-captured-word';
import { extractWordAndDefine } from './flows/extract-word-and-define';

const app = express();
const port = 3400;

app.use(express.json({ limit: '10mb' })); // Increase limit to handle base64 images

// Endpoint for defining a word
app.post('/flows/defineCapturedWordFlow', async (req, res) => {
  console.log(`[AI Service] Received request for defineCapturedWordFlow.`);
  try {
    const input = req.body.data;
    if (!input) {
      console.error('[AI Service] Request body missing "data" field.');
      return res.status(400).json({ error: 'Missing data in request body' });
    }
    console.log(`[AI Service] Calling AI model for defineCapturedWord...`);
    const result = await defineCapturedWord(input);
    console.log(`[AI Service] AI model returned a result for defineCapturedWord.`);
    console.log('[AI Service] Result payload:', JSON.stringify(result, null, 2)); // Log the actual result
    // Mimic the structure of the genkit CLI response
    res.json({ result: { output: result } });
  } catch (error: any) {
    console.error('[AI Service] Error in defineCapturedWordFlow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for extracting words from an image
app.post('/flows/extractWordAndDefineFlow', async (req, res) => {
  console.log(`[AI Service] Received request for extractWordAndDefineFlow.`);
  try {
    const input = req.body.data;
    if (!input) {
      console.error('[AI Service] Request body missing "data" field.');
      return res.status(400).json({ error: 'Missing data in request body' });
    }
    console.log(`[AI Service] Calling AI model for extractWordAndDefine...`);
    const result = await extractWordAndDefine(input);
    console.log(`[AI Service] AI model returned a result for extractWordAndDefine.`);
    console.log('[AI Service] Result payload:', JSON.stringify(result, null, 2)); // Log the actual result
    // Mimic the structure of the genkit CLI response
    res.json({ result: { output: result } });
  } catch (error: any) {
    console.error('[AI Service] Error in extractWordAndDefineFlow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`[AI Service] Custom server listening on http://localhost:${port}`);
});