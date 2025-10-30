// DOM(HTML) 로드가 완료되면 스크립트 실행
document.addEventListener('DOMContentLoaded', () => {
    // 1. 파일에서 코드를 불러와 에디터에 채웁니다.
    loadCodeContent();

    // 2. 탭 전환 이벤트를 설정합니다.
    setupTabSwitching();
});

/**
 * 텍스트 파일(.txt)에서 원본 코드 내용을 비동기(async)로 불러옵니다.
 */
async function loadCodeContent() {
    try {
        // 두 개의 파일을 동시에(Promise.all) 불러옵니다.
        const [htmlResponse, jsResponse] = await Promise.all([
            fetch('content-html.txt'), // HTML 코드 요청
            fetch('content-js.txt')    // JS 코드 요청
        ]);

        // 응답이 성공했는지 확인
        if (!htmlResponse.ok || !jsResponse.ok) {
            throw new Error('코드 파일을 불러오는 데 실패했습니다.');
        }

        // 응답을 텍스트로 변환
        const htmlCode = await htmlResponse.text();
        const jsCode = await jsResponse.text();

        // 2. 불러온 텍스트를 <code> 태그의 '내용'으로 삽입합니다.
        document.querySelector('#html-content-display pre code').textContent = htmlCode;
        document.querySelector('#js-content-display pre code').textContent = jsCode;

    } catch (error) {
        // 오류 발생 시 터미널에 로그를 남기고 에디터 창에 오류 메시지 표시
        console.error('코드 로딩 중 오류:', error);
        document.querySelector('#html-content-display pre code').textContent =
            `오류: 'content-html.txt' 파일을 불러올 수 없습니다.\n\n` +
            `1. 파일 이름이 올바른지 확인하세요.\n` +
            `2. (중요) 'file://' 프로토콜(로컬에서 바로 열기)이 아닌, 'http://' 프로토콜(로컬 서버)로 실행해야 합니다.`;

        document.querySelector('#js-content-display pre code').textContent =
            `오류: 'content-js.txt' 파일을 불러올 수 없습니다.`;
    }
}

/**
 * 사이드바와 상단 탭의 클릭 이벤트를 설정합니다.
 */
function setupTabSwitching() {
    // '.tab' (상단 탭)과 '.file-item' (사이드바 파일)을 모두 선택
    const tabs = document.querySelectorAll('.tab, .file-item');
    const codeContents = document.querySelectorAll('.code-content');
    const tabElements = document.querySelectorAll('.tab');
    const fileElements = document.querySelectorAll('.file-item');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // 클릭된 탭의 'data-tab' 속성 값 ('html' 또는 'js')을 가져옵니다.
            const targetTab = e.currentTarget.dataset.tab;

            // --- 모든 탭과 컨텐츠의 'active' 클래스 초기화 ---
            tabElements.forEach(t => t.classList.remove('active-tab'));
            fileElements.forEach(f => f.classList.remove('active-file'));
            codeContents.forEach(c => c.classList.remove('active-content'));

            // --- 클릭된 탭과 매칭되는 요소들에 'active' 클래스 추가 ---

            // 1. 상단 탭 활성화
            document.querySelector(`.tab[data-tab="${targetTab}"]`).classList.add('active-tab');
            // 2. 사이드바 파일 활성화
            document.querySelector(`.file-item[data-tab="${targetTab}"]`).classList.add('active-file');
            // 3. 에디터 코드 내용 표시
            document.getElementById(`${targetTab}-content-display`).classList.add('active-content');
        });
    });
}