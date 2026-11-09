import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/**
 * Determine the port:
 * AI Studio nginx listens on 8080 and proxies traffic to the app on port 3000.
 * Therefore, in this container environment, the dev server must always bind to port 3000
 * even if process.env.PORT is set to 8080 by Cloud Run.
 */
function getPort(): number {
  const portIdx = process.argv.indexOf('--port');
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    return parseInt(process.argv[portIdx + 1], 10);
  }
  return 3000;
}

app.use(express.json({ limit: '10mb' }));

// Helper to get GoogleGenAI client lazily
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please attach your API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
});

/**
 * POST /api/analyze
 * Generate 6-section post-campaign analysis in Burmese based strictly on JS-calculated data
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const { client, goalSummaries, campaigns, flags, validLessons, manualResults } = req.body;

    const ai = getGeminiClient();

    const systemInstruction = `You are "Ads Analyst", an expert digital marketing analyst assisting a Meta Ads specialist in Myanmar.
CRITICAL RULES:
1. ALL your explanations and recommendations MUST be written in natural, fluent Burmese (Myanmar Unicode).
2. DO NOT translate metric names or ad/campaign names: keep metrics (Spend, Reach, Impressions, Frequency, CPM, Link clicks, CTR, CPC, Landing page views, Cost per LPV, LPV rate, Results, Cost per result) and all Campaign, Ad Set, and Ad names strictly in English.
3. NEVER calculate, round, or invent numbers! You only receive the pre-calculated numbers from JavaScript. Only quote the exact numbers provided in the input payload.
4. You may ONLY mention campaign/ad set/ad names that exist in the input data. Do not hallucinate or make up fictional names.
5. Provide high-density, sharp marketing insights tailored to the client's business, goals, and audience in Myanmar.
6. Provide output in the 6 specified sections formatted as structured JSON:
   - summary (အခြေအနေ အကျဉ်းချုပ်): spend vs results per goal, overall campaign delivery.
   - bestWorst (အကောင်းဆုံး / အညံ့ဆုံး): compare ONLY within the same goal, quoting exact real numbers (CPR, CTR, spend).
   - issues (ပြဿနာများ): explain each detected automatic flag, its root cause (e.g., slow mobile load in Myanmar, auction competition, creative quality issue).
   - creativeLessons (Creative သင်ခန်းစာ): which creative styles succeeded or failed, referencing CTR, CPR, Quality ranking, Engagement rate ranking, and Conversion rate ranking.
   - recommendations (နောက် campaign အတွက် အကြံ): prioritized action items (most urgent first), specific budget split, which ads to turn off, which winners to scale.
   - suggestedLessons (suggestedLessons): 3 to 5 concise, actionable bullet lessons for the marketer to approve and save to their long-term client lessons repository.`;

    const prompt = `Analyze this Meta Ads campaign data for client "${client?.name || 'Client'}":

CLIENT PROFILE:
- Business & Product: ${client?.businessAndProduct || 'N/A'}
- Main Goals: ${client?.mainGoals || 'N/A'}
- Target Location: ${client?.targetLocation || 'N/A'}
- Target Audience: ${client?.targetAudience || 'N/A'}
- Currency: ${client?.currency || 'THB'}
- Targets: CPC=${client?.targets?.targetCpc ?? 'N/A'}, Cost per LPV=${client?.targets?.targetCostPerLpv ?? 'N/A'}, CPM=${client?.targets?.targetCpm ?? 'N/A'}

GOAL SUMMARIES (Calculated in JS):
${JSON.stringify(goalSummaries, null, 2)}

CAMPAIGNS (Calculated in JS):
${JSON.stringify(campaigns, null, 2)}

AUTOMATIC FLAGS DETECTED (Calculated in JS):
${JSON.stringify(flags, null, 2)}

REAL BUSINESS RESULTS:
${JSON.stringify(manualResults || {}, null, 2)}

APPROVED LESSONS FROM RECENT PERIODS:
${validLessons && validLessons.length > 0 ? JSON.stringify(validLessons, null, 2) : 'No previous saved lessons yet.'}

Respond strictly with a JSON object matching the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Section 1: အခြေအနေ အကျဉ်းချုပ် — spend vs results per goal',
            },
            bestWorst: {
              type: Type.STRING,
              description: 'Section 2: အကောင်းဆုံး / အညံ့ဆုံး — compare within same goal, quoting real numbers',
            },
            issues: {
              type: Type.STRING,
              description: 'Section 3: ပြဿနာများ — explain each flag and its cause',
            },
            creativeLessons: {
              type: Type.STRING,
              description: 'Section 4: Creative သင်ခန်းစာ — creative styles, CTR, CPR and rankings',
            },
            recommendations: {
              type: Type.STRING,
              description: 'Section 5: နောက် campaign အတွက် အကြံ — prioritized action list',
            },
            suggestedLessons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Section 6: 3-5 concise lessons to suggest for approval',
            },
          },
          required: ['summary', 'bestWorst', 'issues', 'creativeLessons', 'recommendations', 'suggestedLessons'],
        },
      },
    });

    const text = response.text || '{}';
    const jsonResult = JSON.parse(text);
    return res.json(jsonResult);
  } catch (error: any) {
    console.error('Error generating AI analysis:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate analysis',
    });
  }
});

/**
 * POST /api/chat
 * Multi-turn follow-up chat using the calculated context
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, context } = req.body;

    const ai = getGeminiClient();

    const systemInstruction = `You are "Ads Analyst", assisting a Meta Ads specialist in Myanmar with follow-up questions.
CRITICAL RULES:
1. ALL your answers MUST be written in natural, fluent Burmese (Myanmar Unicode).
2. DO NOT translate metric names or ad/campaign names: keep metrics (Spend, Reach, Impressions, Frequency, CPM, Link clicks, CTR, CPC, Landing page views, Cost per LPV, LPV rate, Results, Cost per result) and all Campaign, Ad Set, and Ad names strictly in English.
3. NEVER calculate, round, or invent numbers! You only receive the pre-calculated numbers from JavaScript. Only quote the exact numbers provided in the context.
4. You may ONLY mention campaign/ad set/ad names that exist in the context data.
5. Provide concise, clear, and actionable answers.`;

    const contextString = `CURRENT CAMPAIGN CONTEXT:
Client: ${context.client?.name || 'Client'} (${context.client?.currency || 'THB'})
Business & Product: ${context.client?.businessAndProduct || 'N/A'}
Main Goals: ${context.client?.mainGoals || 'N/A'}
Goal Summaries: ${JSON.stringify(context.goalSummaries || {})}
Campaigns: ${JSON.stringify(context.campaigns || [])}
Flags: ${JSON.stringify(context.flags || [])}
Valid Lessons: ${JSON.stringify(context.validLessons || [])}`;

    let conversationHistoryText = '';
    if (Array.isArray(history) && history.length > 0) {
      conversationHistoryText = history
        .map((h: any) => `${h.role === 'user' ? 'Marketer' : 'Ads Analyst'}: ${h.content}`)
        .join('\n');
    }

    const fullPrompt = `${contextString}

CONVERSATION HISTORY:
${conversationHistoryText}

MARKETER QUESTION:
${message}

Please respond in Burmese (keeping metric and ad names in English, quoting real numbers only):`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: fullPrompt,
      config: {
        systemInstruction,
      },
    });

    return res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Error in chat:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process chat message',
    });
  }
});

// Setup Vite Dev Server or Production Static Serving
async function startServer() {
  const PORT = getPort();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ads Analyst server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
