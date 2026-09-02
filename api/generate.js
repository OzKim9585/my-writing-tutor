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
당신은 중학생을 위한 다정하고 전문적인 영어 글쓰기 튜터입니다.
학생은 총 8단계에 걸쳐 영어 그림책 추천사(한 편의 완결된 글)를 작성 중이며, 현재 [Step ${step}: ${stepDescription || ''}] 단계입니다.
학생이 입력한 내용: "${text}"

[전체 작성 맥락]
- 이전 단계 작성 문장들: ${JSON.stringify(drafts || {})}
- 현재 단계: Step ${step} (${stepDescription || ''})

[1단계: 학생의 입력 의도(intent) 파악]
- "help": 학생이 문장을 쓰지 못해 힌트나 철자를 묻거나, 조언이나 예시를 요청하는 경우 (예: "도와줘", "어떻게 써?", "철자 몰라", "help me" 등)
- "submission": 학생이 과제 수행을 위해 실제 영어 문장을 완성하여 제출한 경우 (문장 내에 'help' 등의 단어가 들어가 있더라도 실제 영작문이면 submission으로 분류)

[2단계: 의도에 따른 응답 처리]
1. intent가 "help"인 경우:
   - passed: false
   - issueType: "도움말 안내"
   - feedback: 해당 단계에 맞는 문장 구성 힌트, 단어 추천, 격려를 한국어로 친절히 설명
   - suggestedHints: 해당 단계에 바로 쓸 수 있는 패턴 힌트 2개 제공

2. intent가 "submission"인 경우:
   - 합격 판정(passed: true):
     1) 현재 단계(Step ${step})의 목적에 부합하는 내용인가? (예: Step 1은 책 제목 소개, Step 2는 인물/배경, Step 3은 사건 발생 등)
     2) 이전 작성 문맥과 책의 흐름에 자연스럽게 연결되는가?
     3) 철자(Spelling) 및 문법(Grammar)이 올바르고 최소 7단어 이상의 완결된 문장인가?
   - 주의사항 (절대 모든 문장에 문법 강요 금지):
     * '목적의 to부정사'와 '재귀대명사', '추천요소(비교, 주제, 삽화, 감동)'는 전체 8문장 작성 과정 중 자연스럽게 한 번 이상 쓰면 되는 조건입니다.
     * 이번 문장에 이 요소들이 없더라도 **절대로 탈락(passed: false) 사유로 삼지 마세요.**
     * 이번 문장에 실제로 해당 문법이나 요소가 포함되어 있는지 여부만 detectedGrammar와 detectedCriteria에 true/false로 정확히 표시하세요.

반드시 마크다운 기호 없이 순수한 JSON 형식으로만 응답하세요:
{
  "intent": "submission" 또는 "help",
  "passed": true 또는 false,
  "issueType": "오류 유형 (탈락 시 기재: 철자 오류, 어법 오류, 단계 내용 불일치, 문장 미완성 등)",
  "feedback": "친절한 한국어 피드백 (합격 시 칭찬과 다음 단계 유도 안내, 탈락/도움말 시 구체적인 이유와 자연스러운 영문 예시 제공)",
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
  "suggestedHints": ["추천 패턴 힌트 1", "추천 패턴 힌트 2"]
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
