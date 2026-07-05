// Vercel Serverless Function (Gemini版)
// クライアント(ブラウザ)から直接 Gemini API を呼ぶと API キーが漏れるため、
// このサーバー側関数を経由させる。API キーは Vercel の環境変数に保存する。

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { catName, question } = req.body || {};
  if (!catName || !question) {
    return res.status(400).json({ error: 'catName and question are required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
  }

  const systemInstruction =
    'あなたは日商簿記3級の問題作成者です。与えられた元の問題と同じ分野・同程度の難易度の類似問題を1問だけ作成してください。' +
    '数値や勘定科目の組み合わせは変えてください。出力は指定されたJSON形式のみとし、前置きなどの文章は一切含めないでください。' +
    'answerには正解の選択肢のインデックス(0始まり)を数値で入れてください。';

  const userPrompt = `分野: ${catName}\n元の問題: ${question}\n上記と同分野・同難易度の類似問題をJSON形式で1問作成してください。`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          // JSON形式での出力をGemini側に強制させる
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              question: { type: 'STRING' },
              choices: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
              answer: { type: 'INTEGER' },
              explanation: { type: 'STRING' },
            },
            required: ['question', 'choices', 'answer', 'explanation'],
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'Gemini API request failed' });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('Unexpected Gemini response shape:', JSON.stringify(data));
      return res.status(502).json({ error: 'Unexpected Gemini response' });
    }

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('generate.js error:', err);
    return res.status(500).json({ error: 'Question generation failed' });
  }
}
