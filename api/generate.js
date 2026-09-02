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

    const nextStep = Number(step) + 1;

    const stepQuestions = {
        1: "추천하고 싶은 창작 그림책의 제목을 포함하여 7단어 이상의 완결된 한 문장으로 소개해 보세요. (Introduce your picture book title.)",
        2: "주인공은 누구이며 어떤 배경/장소에서 일어나는 이야기인가요? (Who is the main character, and where/when does the story take place?)",
        3: "주인공에게 어떤 중심 사건이나 도전 과제가 생기나요? (What main event, challenge, or conflict happens to the protagonist?)",
        4: "이야기는 어떻게 전개되며 어떤 결말을 맺나요? (How does the story develop, and how is it resolved in the end?)",
        5: "'Compared to...' 또는 'Unlike...'를 사용하여 다른 책들과 비교한 전체 총평을 한 문장으로 써보세요. (Compare this book with others and write an overall evaluation.)",
        6: "책의 '주제/교훈(Theme)' 또는 인상적인 '삽화/그림(Artwork)'에 대한 추천 이유를 작성하세요. (Write a recommendation reason about the Theme or Artwork.)",
        7: "책을 읽고 난 후의 '감동(Emotional impact)' 또는 스토리의 '완성도(Completeness)'에 대한 추천 이유를 작성하세요. (Write another reason about Emotional Impact or Story Completeness.)",
        8: "친구들과 독자들에게 책을 권하는 마무리 종합 추천 문장을 작성하세요. (Write a closing recommendation sentence to your readers.)"
    };

    const prompt = `
당신은 중학생을 위한 다정하지만 **어법, 철자, 표현의 정확성에는 매우 엄격한** 전문 영어 글쓰기 튜터입니다.
학생들이 시중에 없는 **"자신만의 창작 그림책"**을 직접 만들고 추천사를 작성하고 있습니다.
외부 시중 서적의 지식은 배제하고, 오직 학생이 지금까지 단계별로 작성한 내용(drafts)만을 유일한 이야기 배경 및 맥락으로 간주하세요.

[작성 맥락]
- 이전 단계까지 작성된 내용: ${JSON.stringify(drafts || {})}
- 현재 작성 단계: Step ${step} (${stepDescription || ''})
- 학생 제출 문장: "${text}"
- 합격 시 진행할 다음 단계: Step ${nextStep}

[1단계: 의도(intent) 파악]
- "help": 영작을 못 하겠어서 힌트, 단어, 철자, 작성 방법을 묻거나 조언을 요청하는 경우
- "submission": 영어 문장을 실제로 작성하여 제출한 경우 ('help' 단어가 영작문에 쓰였어도 submission으로 분류)

[2단계: 평가 및 합격 판정 절대 규칙 (엄격 채점 필수)]
1. 철자(Spelling) 및 문법(Grammar) 엄격 검사 (무관용 원칙):
   - **단어 중복(예: "a a"), 오타(예: "solder" -> "soldier", "recomend" -> "recommend"), 고유명사 대소문자 오류(예: "turkish" -> "Turkish", "korean war" -> "Korean War"), 수일치, 시제 불일치 등 명백한 오류가 단 하나라도 남아있다면 절대로 합격(passed: true)시키지 마세요.**
   - 학생이 직전 지적 사항을 수정하지 않고 동일하게 틀린 문장을 다시 보낸 경우, 절대로 통과시키지 말고 반드시 passed: false로 처리하여 미수정된 오류를 다시 지적하세요.
   - 단, '목적의 to부정사'나 '재귀대명사'는 전체 8문장 중 어디서든 쓰면 되므로 이번 문장에 없다고 탈락시키지는 마세요. (순수 철자, 어법, 문장 완결성, 단계 내용 적합성만 엄격 검사)

2. 합격(passed: true) 조건:
   - 현재 단계(Step ${step})의 지시 사항에 부합함
   - 앞 단계 맥락과 모순 없이 자연스럽게 이어짐
   - 7단어 이상이며 **철자 오류, 단어 중복, 문법적 하자가 전혀 없는 완결된 문장**일 때만 passed: true 부여

3. 피드백 및 안내문 작성 규칙 (매우 중요):
   - **합격(passed: true) 시:**
     * 학생 문장에 대한 구체적 칭찬 작성
     * 문단 아래에 반드시 다음 단계 안내를 포함:
       ${nextStep <= 8 ? `
       ---
       ### [Step ${nextStep}] 다음 단계 안내
       ${stepQuestions[nextStep] || ''}
       ` : `모든 작성을 완료했다는 축하 인사.`}
     * **suggestedHints는 반드시 '다음 단계(Step ${nextStep})'에서 쓸 수 있는 '______' 빈칸 포함 문장 패턴 2개를 제공 (방금 끝낸 Step ${step} 힌트 제공 금지)**
   - **불합격(passed: false) 시:**
     * 어떤 단어의 철자가 틀렸는지, 중복된 단어가 무엇인지, 고유명사 대문자 표기가 왜 필요한지 구체적이고 명확하게 하나하나 짚어 한국어로 피드백 작성
     * suggestedHints는 현재 단계(Step ${step})를 다시 고쳐 쓸 때 참고할 '______' 빈칸 포함 패턴 2개 제공

[3단계: 힌트 작성 규칙]
- suggestedHints에는 절대로 완성된 문장 전체를 주지 마시고, 학생이 단어를 직접 채워 넣을 수 있도록 **반드시 '______' 빈칸이 포함된 패턴 2개**를 제공하세요.

반드시 마크다운 기호 없이 순수한 JSON 포맷으로만 응답하세요:
{
  "intent": "submission" 또는 "help",
  "passed": true 또는 false,
  "issueType": "오류 유형 (탈락 시 기재: 철자 오류, 단어 중복, 고유명사 표기 오류, 단계 불일치 등)",
  "feedback": "한국어 피드백 (합격 시 다음 단계 질문 포함)",
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
  "suggestedHints": ["반드시 ______ 빈칸이 포함된 패턴 1", "반드시 ______ 빈칸이 포함된 패턴 2"]
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
        return res.status(200).json(JSON.parse(cleanedJson));

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
}
