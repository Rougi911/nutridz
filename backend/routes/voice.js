const express = require('express');
const router = express.Router();
const { parseFoodInput, parseWeightInput, parseGlucoseInput } = require('../services/voiceParser');
const authMiddleware = require('../middleware/auth');

router.post('/parse', authMiddleware, async (req, res) => {
  try {
    const { text, context = 'food', lang = 'fr' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    let result;

    switch (context) {
      case 'food':
        result = parseFoodInput(text, lang);
        break;
      case 'weight': {
        const weight = parseWeightInput(text, lang);
        result = weight !== null
          ? { weight_kg: weight, raw: text }
          : { error: 'Could not parse weight', raw: text };
        break;
      }
      case 'glucose': {
        const glucose = parseGlucoseInput(text, lang);
        result = glucose !== null
          ? { ...glucose, raw: text }
          : { error: 'Could not parse glucose', raw: text };
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid context' });
    }

    res.json(result);
  } catch (error) {
    console.error('Voice parse error:', error);
    res.status(500).json({ error: 'Parse failed' });
  }
});

module.exports = router;
