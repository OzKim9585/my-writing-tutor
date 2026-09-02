// api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

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
학생은 총 8단계에 걸쳐 영어 그림책 추천사(한 편의 완결된 글)를 작성하고 있습니다.
지금은 [Step ${step}: ${stepDescription || ''}] 단계의 한 문장을 제출했습니다.

[전체 글 작성 맥락]
- 이전 단계에서 작성한 문장들: ${JSON.stringify(drafts || {})}
- 현재 단계: Step ${step} (${stepDescription || ''})
- 학생이 작성한 문장: "${text}"

[중요 채점 규칙 - 필독]
1. 합격(passed: true) 판정 기준:
   - 현재 단계(Step ${step})의 목적에 부합하는 내용인가? 
     (예: Step 1은 추천 책 제목, Step 2는 주인공/배경, Step 3은 주요 사건, Step 4는 결말, Step 5는 비교/총평, Step 6~7은 주제/삽화/감동 세부이유, Step 8은 마무리 추천)
   - 영문 철자(Spelling)와 기본 문법(Grammar)이 올바른가?
   - 최소 7단어 이상이며 완전한 문장 구조를 갖추었는가?
   - 앞서 작성한 문맥과 자연스럽게 이어지는가?

2. 문법 및 추천 요소 점검 주의사항 (절대 모든 문장에 강요 금지):
   - '목적의 to부정사(to + 동사원형)'와 '재귀대명사(-self, -selves)', '추천 요소(비교, 주제, 삽화, 감동)'는 전체 8문장을 쓰는 동안 적재적소에 나누어 쓰는 과제 조건입니다.
   - 현재 문장에 이 요소들이 포함되어 있지 않더라도 **절대로 탈락(passed: false) 사유로 삼지 마세요.**
   - 현재 제출한 문장에 해당 요소가 쓰였는지 여부만 감지하여 detectedGrammar와 detectedCriteria의 boolean 값(true/false)으로만 정확히 표기하세요.

[출력 형식]
반드시 마크다운 기호(백틱 등) 없이 순수한 JSON 포맷으로만 응답하세요:
{
  "passed": true 또는 false,
  "issueType": "오류 유형 (탈락 시에만 기재: 철자 오류, 어법 오류, 문장 불완전, 단계 내용 불일치 등)",
  "feedback": "친절한 한국어 피드백 (합격 시 칭찬과 다음 단계 유도 안내, 탈락 시 구체적 원인 및 자연스러운 영문 예시 제공)",
  "detectedGrammar": {
    "hasToInfinitive": false,
    "hasReflexive": false
  },
  "detectedCriteria": {
    "comp": false,
    "theme": false,
    "art": false,
    "emotion": false
  },
  "suggestedHints": ["다음에 쓸 수 있는 추천 패턴 힌트 1", "다음에 쓸 수 있는 추천 패턴 힌트 2"]
}
`;

    try {
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

        const rawText = data.candidates[0].content.parts[0].text;
        const cleanedJson = rawText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanedJson);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
}
