import 'dotenv/config';
import express from 'express';
import { defineCapturedWord } from './flows/define-captured-word';
import { defineTermAuto } from './flows/define-term-auto';
import { extractWordAndDefine } from './flows/extract-word-and-define';
import { aiDebug } from './debug';

const app = express();
const port = 3400;

app.use(express.json({ limit: '10mb' })); // Increase limit to handle base64 images

// Endpoint for defining a word
app.post('/flows/defineCapturedWordFlow', async (req, res) => {
  aiDebug('[AI Service] defineCapturedWordFlow received');
  try {
    const input = req.body.data;
    if (!input) {
      console.error('[AI Service] Request body missing "data" field.');
      return res.status(400).json({ error: 'Missing data in request body' });
    }
    aiDebug('[AI Service] defineCapturedWordFlow calling model');
    const result = await defineCapturedWord(input);
    aiDebug('[AI Service] defineCapturedWordFlow ok definitionLen=%s', String(result?.definition || '').length);
    // Mimic the structure of the genkit CLI response
    res.json({ result: { output: result } });
  } catch (error: any) {
    console.error('[AI Service] Error in defineCapturedWordFlow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for extracting words from an image
app.post('/flows/extractWordAndDefineFlow', async (req, res) => {
  aiDebug('[AI Service] extractWordAndDefineFlow received');
  try {
    const input = req.body.data;
    if (!input) {
      console.error('[AI Service] Request body missing "data" field.');
      return res.status(400).json({ error: 'Missing data in request body' });
    }
    aiDebug('[AI Service] extractWordAndDefineFlow calling model');
    const result = await extractWordAndDefine(input);
    aiDebug('[AI Service] extractWordAndDefineFlow ok items=%s', Array.isArray(result) ? result.length : 0);
    // Mimic the structure of the genkit CLI response
    res.json({ result: { output: result } });
  } catch (error: any) {
    console.error('[AI Service] Error in extractWordAndDefineFlow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for defining a term with auto part-of-speech detection
app.post('/flows/defineTermAutoFlow', async (req, res) => {
  aiDebug('[AI Service] defineTermAutoFlow received');
  try {
    const input = req.body.data;
    if (!input) {
      console.error('[AI Service] Request body missing "data" field.');
      return res.status(400).json({ error: 'Missing data in request body' });
    }
    aiDebug('[AI Service] defineTermAutoFlow calling model');
    const result = await defineTermAuto(input);
    aiDebug('[AI Service] defineTermAutoFlow ok items=%s', Array.isArray(result) ? result.length : 0);
    res.json({ result: { output: result } });
  } catch (error: any) {
    console.error('[AI Service] Error in defineTermAutoFlow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`[AI Service] Custom server listening on http://localhost:${port}`);
});
