// api/generate.js
export default async function handler(req, res) {
    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Vercel 환경변수에서 안전하게 API 키 가져오기
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const { step, text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'text 필드가 필요합니다.' });
    }

    const prompt = `
    You are a friendly English writing tutor for middle school students.
    The student is writing a book recommendation (Step ${step}).
    Student Input: "${text}"

    Tasks:
    1. Check for spelling or grammar mistakes.
    2. Check if the sentence is naturally expressing the content for Step ${step}.
    3. Provide feedback in Korean. Keep it simple and encouraging.

    Respond ONLY in valid JSON format like this:
    {
      "passed": true,
      "issueType": "Spelling/Grammar",
      "feedback": "피드백 내용"
    }
    `;

    try {
        // Google Gemini REST API 직접 호출
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data);
            return res.status(500).json({ error: 'Gemini API 호출에 실패했습니다.' });
        }

        // Gemini 응답 텍스트 추출 및 JSON 파싱
        const rawText = data.candidates[0].content.parts[0].text;
        const cleanedJson = rawText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanedJson);

        // 프론트엔드로 성공 응답 전송
        return res.status(200).json(result);

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
}