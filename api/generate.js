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
        6: "'First,'로 시작하여 책의 '주제나 메시지(Theme)'에 관한 세부 추천 이유를 작성하세요. (Start with 'First,' and write a reason about the Theme.)",
        7: "'Second,'로 시작하여 책의 '감동 요소(Emotional impact)' 또는 '완성도(Completeness)'에 관한 추천 이유를 작성하세요. (Start with 'Second,' and write a reason about Emotional Impact or Completeness.)",
        8: "'Finally,'로 시작하여 책의 '삽화/그림(Artwork/Illustration)'에 관한 추천 이유를 작성하세요. (Start with 'Finally,' and write a reason about the Artwork.)",
        9: "'Therefore,'로 시작하여 독자들에게 책을 권하는 마무리 종합 추천 문장을 작성하세요. (Start with 'Therefore,' and write a closing recommendation sentence to your readers.)"
    };

    const prompt = `
당신은 중학생을 위한 친절하지만 **어법, 철자, 표현의 정확성에는 매우 엄격한** 전문 영어 글쓰기 튜터입니다.
학생들이 시중에 없는 **"자신만의 창작 그림책"**을 직접 만들고 추천사를 총 9단계에 걸쳐 작성하고 있습니다.
외부 시중 서적의 지식은 배제하고, 오직 학생이 지금까지 단계별로 작성한 내용(drafts)만을 유일한 이야기 배경 및 맥락으로 간주하세요.

[단계 구성 가이드 - 총 9단계]
- Step 1: 추천 책 제목 소개
- Step 2: 줄거리 1/3 (주인공 및 배경)
- Step 3: 줄거리 2/3 (주요 사건)
- Step 4: 줄거리 3/3 (전개 및 결말)
- Step 5: 추천 이유 1 (비교 및 전체 총평 - Compared to / Unlike 활용 권장)
- Step 6: 추천 이유 2 (주제/메시지 - 반드시 'First,'로 시작)
- Step 7: 추천 이유 3 (감동 요소/완성도 - 반드시 'Second,'로 시작)
- Step 8: 추천 이유 4 (삽화/그림 - 반드시 'Finally,'로 시작)
- Step 9: 추천 이유 5 (마무리 종합 추천 - 반드시 'Therefore,'로 시작)

[작성 맥락]
- 이전 단계까지 작성된 내용: ${JSON.stringify(drafts || {})}
- 현재 작성 단계: Step ${step} (${stepDescription || ''})
- 학생 제출 문장: "${text}"
- 합격 시 진행할 다음 단계: Step ${nextStep}

[1단계: 의도(intent) 파악]
- "help": 영작 방법을 모르겠어서 힌트, 단어, 철자, 작성 패턴을 묻거나 조언을 요청하는 경우
- "submission": 영어 문장을 실제로 작성하여 제출한 경우 ('help' 단어가 문장 내에 쓰였어도 submission으로 분류)

[2단계: 평가 및 합격 판정 절대 규칙]
1. 철자(Spelling) 및 문법(Grammar) 엄격 검사 (무관용 원칙):
   - 단어 중복(예: "a a"), 철자 오타(예: "solder" -> "soldier"), 고유명사 대소문자(예: "turkish" -> "Turkish", "korean war" -> "Korean War"), 수일치, 시제 불일치 등 오류가 단 하나라도 남아있다면 절대로 합격(passed: true)시키지 마세요.
   - 직전 피드백에서 지적받은 오류를 고치지 않고 그대로 다시 제출한 경우 무조건 passed: false로 처리하고 동일 오류를 다시 지적하세요.
   - 단, 목적의 to부정사와 재귀대명사는 전체 9문장 중 어디서든 쓰면 되므로 이번 문장에 없다고 탈락시키지는 마세요.
2. 접속부사 필수 확인:
   - Step 6은 'First,', Step 7은 'Second,', Step 8은 'Finally,', Step 9는 'Therefore,'로 시작하지 않았거나 누락된 경우 passed: false로 처리하고 해당 단어로 문장을 시작하도록 안내하세요.
3. 합격(passed: true) 조건:
   - 현재 단계(Step ${step})의 지시 사항 및 접속부사 조건 부합
   - 앞 단계 맥락과 모순 없이 자연스럽게 이어짐
   - 최소 7단어 이상이며 철자/문법 하자가 전혀 없는 완벽한 문장
4. 피드백 및 안내문 작성 규칙:
   - **합격(passed: true) 시:**
     * 문장에 대한 구체적 칭찬 작성
     * 문단 아래에 반드시 다음 단계 안내를 포함:
       ${nextStep <= 9 ? `
       ---
       ### [Step ${nextStep}] 다음 단계 안내
       ${stepQuestions[nextStep] || ''}
       ` : `모든 9단계 작성을 성공적으로 완료했다는 축하 인사와 함께 우측의 [View Final Report] 버튼을 누르라는 안내.`}
     * **suggestedHints는 반드시 '다음 단계(Step ${nextStep})'에서 쓸 수 있는 '______' 빈칸 포함 문장 패턴 2개를 제공 (방금 통과한 Step ${step} 힌트 제공 금지)**
   - **불합격(passed: false) 시:**
     * 철자, 문법, 접속부사 누락, 내용 모순을 구체적으로 짚어 한국어로 피드백 작성
     * suggestedHints는 현재 단계(Step ${step})를 다시 작성할 때 참고할 '______' 빈칸 포함 패턴 2개 제공

[3단계: 힌트 작성 규칙]
- 절대로 완성된 문장 전체를 주지 말고, 학생이 어휘를 직접 채워 넣도록 **반드시 '______' 빈칸이 포함된 패턴 2개**를 제공하세요.

반드시 마크다운 기호 없이 순수한 JSON 포맷으로만 응답하세요:
{
  "intent": "submission" 또는 "help",
  "passed": true 또는 false,
  "issueType": "오류 유형 (탈락 시 기재: 철자 오류, 접속부사 누락, 문법 오류 등)",
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
