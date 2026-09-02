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
이 과제에서 다루는 책은 기존 출판물이 아닌 **"학생들이 직접 만든 창작 그림책"**입니다.
따라서 시중 서적의 사전 지식을 기준으로 판단하지 마시고, 오직 학생이 지금까지 단계별로 작성한 내용(drafts)만을 유일한 원작 줄거리이자 배경 맥락으로 삼아야 합니다.

[작성 진행 맥락]
- 이전 단계에서 학생이 직접 적은 내용: ${JSON.stringify(drafts || {})}
- 현재 작성 단계: Step ${step} (${stepDescription || ''})
- 학생이 이번에 입력한 문장: "${text}"

[1단계: 의도(Intent) 파악]
- "help": 영작을 못 하겠어서 힌트나 단어, 철자, 작성 방법을 묻는 경우
- "submission": 과제를 위해 실제 영어 문장을 완성하여 제출한 경우 (문장에 'help' 동사가 쓰였더라도 영작문이면 submission)

[2단계: 평가 및 피드백 규칙]
1. Intent가 "help"인 경우:
   - passed: false, issueType: "도움말 안내"
   - 한국어로 친절한 문장 구조 안내 및 힌트 제공
   - suggestedHints는 반드시 빈칸(______ ) 패턴으로 2개 제공

2. Intent가 "submission"인 경우:
   - 합격(passed: true) 기준:
     1) 현재 단계(Step ${step})의 지시 사항에 부합하는 내용인가?
     2) 앞 단계(Step 1~${step-1})에서 학생이 스스로 정립한 등장인물, 설정, 사건 흐름과 논리적·내용적 일관성을 유지하는가? (모순이나 뜬금없는 전개 차단)
     3) 철자(Spelling) 및 문법(Grammar)이 올바르고 최소 7단어 이상의 완결된 문장인가?
   - 주의사항:
     * '목적의 to부정사', '재귀대명사', '추천요소(비교, 주제, 삽화, 감동)'는 전체 8문장 중 어디서든 쓰면 되므로, 이번 문장에 없다고 탈락(passed: false)시키지 마세요.
     * 이번 문장에 실제 쓰였는지만 감지하여 detectedGrammar와 detectedCriteria에 true/false로 기록하세요.
     * 탈락 시에는 학생이 창작한 이야기 맥락에 맞춰 어디가 어색한지, 철자/문법 오류는 무엇인지 구체적인 수정 이유와 올바른 표현을 안내하세요.

[3단계: 힌트 생성 절대 규칙 (중요)]
- suggestedHints에는 절대로 학생이 그대로 베껴 쓸 수 있는 완성형 문장 전체를 주지 마세요.
- 학생이 핵심 단어나 표현을 직접 채워 넣을 수 있도록 **반드시 '______' (언더바 빈칸)**을 포함한 문장 뼈대 패턴 형태로만 2개를 제공하세요.
  * 잘못된 힌트 예시: "I truly recommend this heart-warming story to everyone."
  * 올바른 힌트 예시: "I truly recommend this ______ story to ______."
  * 올바른 힌트 예시: "This book is a must-read for anyone who wants to ______."

반드시 마크다운 기호 없이 순수한 JSON 포맷으로만 응답하세요:
{
  "intent": "submission" 또는 "help",
  "passed": true 또는 false,
  "issueType": "오류 유형 (탈락 시: 철자 오류, 어법 오류, 단계 불일치, 전개 모순 등)",
  "feedback": "친절한 한국어 피드백 (칭찬, 오류 수정 가이드 등)",
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
  "suggestedHints": ["반드시 ______ 빈칸이 포함된 패턴 힌트 1", "반드시 ______ 빈칸이 포함된 패턴 힌트 2"]
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
