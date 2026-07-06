// Vercel Serverless Function (Gemini版)
// クライアント(ブラウザ)から直接 Gemini API を呼ぶと API キーが漏れるため、
// このサーバー側関数を経由させる。API キーは Vercel の環境変数に保存する。

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 4択問題用のスキーマ(REST APIでは type は小文字で指定する)
const MCQ_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    choices: { type: 'array', items: { type: 'string' } },
    answer: { type: 'integer' },
    explanation: { type: 'string' },
  },
  required: ['question', 'choices', 'answer', 'explanation'],
};

// 仕訳問題用のスキーマ(借方・貸方はそれぞれ複数行になりうるので配列にする)
const JOURNAL_LINE_SCHEMA = {
  type: 'object',
  properties: {
    account: { type: 'string' },
    amount: { type: 'integer' },
  },
  required: ['account', 'amount'],
};
const JOURNAL_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    debits: { type: 'array', items: JOURNAL_LINE_SCHEMA },
    credits: { type: 'array', items: JOURNAL_LINE_SCHEMA },
    explanation: { type: 'string' },
  },
  required: ['question', 'debits', 'credits', 'explanation'],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { catName, question, qtype } = req.body || {};
  if (!catName || !question) {
    return res.status(400).json({ error: 'catName and question are required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
  }

  const isJournal = qtype === 'journal';

  const systemInstruction = isJournal
    ? 'あなたは日商簿記3級の問題作成者です。与えられた元の問題と同じ分野・同程度の難易度の「仕訳問題」を1問だけ作成してください。' +
      '数値や勘定科目の組み合わせは変えてください。debitsとcreditsはそれぞれ1〜3行程度の配列で出力し、' +
      '各行はaccount(勘定科目名)とamount(金額)を持つオブジェクトにしてください。借方の金額合計と貸方の金額合計は必ず一致させてください。' +
      '出力は指定されたJSON形式のみとし、前置きなどの文章は一切含めないでください。'
    : 'あなたは日商簿記3級の問題作成者です。与えられた元の問題と同じ分野・同程度の難易度の類似問題を1問だけ作成してください。' +
      '数値や勘定科目の組み合わせは変えてください。出力は指定されたJSON形式のみとし、前置きなどの文章は一切含めないでください。' +
      'answerには正解の選択肢のインデックス(0始まり)を数値で入れてください。';

  const userPrompt = `分野: ${catName}\n元の問題: ${question}\n上記と同分野・同難易度の類似問題をJSON形式で1問作成してください。`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: isJournal ? JOURNAL_SCHEMA : MCQ_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      return res.status(502).json({ error: 'Gemini API request failed', detail: errText });
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Unexpected Gemini response shape:', JSON.stringify(data));
      const reason = candidate?.finishReason || 'unknown';
      return res.status(502).json({ error: `Unexpected Gemini response (finishReason: ${reason})` });
    }

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('generate.js error:', err);
    return res.status(500).json({ error: 'Question generation failed' });
  }
}
