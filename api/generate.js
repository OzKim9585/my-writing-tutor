// api/generate.js
export default async function handler(req, res) {
    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Vercel 환경변수에서 API 키 불러오기
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const { step, text, stepDescription, drafts } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'text 필드가 필요합니다.' });
    }

    const prompt = `
당신은 중학생을 위한 친절하고 전문적인 영어 글쓰기 튜터입니다.
학생이 영어 그림책 추천사 작성 과제 중 현재 단계의 문장을 작성했습니다.

[전체 글 작성 맥락]
- 이전까지 작성된 내용: ${JSON.stringify(drafts || {})}
- 현재 단계: Step ${step} (${stepDescription || ''})
- 학생이 작성한 영문: "${text}"

[평가 및 피드백 기준]
1. 철자 및 문법(Spelling & Grammar): 단어 철자 오류, 시제 불일치, 문장 구조 오류를 철저히 검사합니다.
2. 내용의 적절성(Appropriateness): 현재 단계(Step ${step})에서 요구하는 질문에 적절한 답변인지 확인합니다.
3. 글의 일관성과 논리성(Coherence & Logic): 앞서 작성한 문장들과 주제나 내용이 튀지 않고 자연스럽게 이어지는지 확인합니다.
4. 필수 문법 점검:
   - 목적을 나타내는 to부정사(to + 동사원형, e.g., to help, to learn) 포함 여부
   - 재귀대명사(-self, -selves, e.g., himself, herself, myself) 포함 여부
5. 추천 요소 충족 여부:
   - 다른 책과의 비교/전체 총평(comp)
   - 주제/메시지(theme)
   - 그림/삽화(art)
   - 감동/완성도(emotion)

[출력 형식]
반드시 마크다운 기호 없이 순수한 JSON 포맷으로만 응답하세요:
{
  "passed": true 또는 false,
  "issueType": "오류 유형 (예: 철자/어법 오류, 내용 불일치, 논리적 비약 등)",
  "feedback": "친절한 한국어 피드백 (틀린 경우 구체적인 이유와 자연스러운 개선 예시 제공, 통과 시 칭찬 및 다음 안내)",
  "detectedGrammar": {
    "hasToInfinitive": true 또는 false,
    "hasReflexive": true 또는 false
  },
  "detectedCriteria": {
    "comp": true 또는 false,
    "theme": true 또는 false,
    "art": true 또는 false,
    "emotion": true 또는 false
  },
  "suggestedHints": ["다음에 쓸 수 있는 추천 패턴 힌트 1", "다음에 쓸 수 있는 추천 패턴 힌트 2"]
}
`;

    try {
        // gemini-3.1-flash-lite REST API 호출
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data);
            return res.status(500).json({ error: 'Gemini API 호출에 실패했습니다.' });
        }

        // 응답 텍스트 추출 및 JSON 파싱
        const rawText = data.candidates[0].content.parts[0].text;
        const cleanedJson = rawText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanedJson);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
}
