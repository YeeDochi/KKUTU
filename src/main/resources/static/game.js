// [KKUTU] game.js - 오류 수정 및 안전장치 강화 버전

// 1. 전역 변수 선언 (가장 먼저 실행됨)
window.stompClient = null; // window에 붙여서 어디서든 접근 가능하게 함
window.currentRoomId = null;
window.myUid = null;
window.myNickname = null;
window.myTurn = false;
window.currentPlayerName = null;

// --- DOM 요소 안전하게 가져오기 ---
// 요소를 못 찾으면 null을 반환하므로, 사용할 때 체크해야 함
const getEl = (id) => document.getElementById(id);

// --- UID 생성/조회 ---
function getOrCreateUid() {
    let uid = localStorage.getItem('kkutu_uid');
    if (!uid) {
        uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('kkutu_uid', uid);
    }
    return uid;
}

// --- 초기화 (페이지 로드 시 실행) ---
window.addEventListener('load', () => {
    window.myUid = getOrCreateUid();

    // 1. 자동 로그인 체크
    init();

    // 2. 이미 로비가 보이는 상태라면 방 목록 로드
    const lobby = getEl('lobby');
    if (lobby && !lobby.classList.contains('hidden')) {
        loadRooms();
    }
});

function init(implementation, config) {
    // 설정 적용 (에러 방지용 체크 포함)
    if(typeof GameImpl !== 'undefined') GameImpl = implementation;

    if(config && config.gameName) {
        const titleEl = getEl('game-title-header');
        if(titleEl) titleEl.innerText = config.gameName; // 요소가 있을 때만 실행!
    }

    // 테마 적용
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-mode');

    // 테마 버튼 텍스트 초기화 (에러 1번 해결)
    const themeBtn = getEl('themeBtn');
    if(themeBtn) {
        themeBtn.innerText = (savedTheme === 'dark') ? 'Light' : 'Dark';
    }

    // ★ 자동 로그인 로직 ★
    let savedNick = localStorage.getItem('nickname');

    // 토큰 확인 로직
    if (!savedNick) {
        const token = localStorage.getItem('token') || localStorage.getItem('jwt');
        if (token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const payload = JSON.parse(jsonPayload);

                if (payload.nickname) savedNick = payload.nickname;
                else if (payload.name) savedNick = payload.name;

                if(savedNick) localStorage.setItem('nickname', savedNick);
            } catch (e) {
                console.warn("토큰 파싱 실패:", e);
            }
        }
    }

    // 자동 로그인 실행
    if (savedNick) {
        console.log("자동 로그인 감지: " + savedNick);
        window.myNickname = savedNick;

        const inputEl = getEl('nicknameInput');
        if (inputEl) inputEl.value = savedNick;

        // 바로 로그인 완료 처리
        completeLogin();
    }
}

// --- 화면 전환 (로그인 완료) ---
function completeLogin() {
    // 환영 메시지
    const welcomeMsg = getEl('welcome-msg');
    if (welcomeMsg) welcomeMsg.innerText = `${window.myNickname}님 환영합니다!`;

    // 화면 전환
    const loginScreen = getEl('login-screen');
    const lobby = getEl('lobby');
    const lobbyScreen = getEl('lobby-screen'); // 호환성

    if (loginScreen) loginScreen.classList.add('hidden');
    if (lobby) lobby.classList.remove('hidden');
    if (lobbyScreen) lobbyScreen.classList.remove('hidden');

    // 상단 정보
    const loggedInArea = getEl('loggedInArea');
    const userNicknameDisplay = getEl('userNickname');

    if (loggedInArea) loggedInArea.classList.remove('hidden');
    if (userNicknameDisplay) userNicknameDisplay.innerText = window.myNickname;

    // 방 목록 로드
    loadRooms();
}

// --- 로그인 버튼 클릭 ---
function goToLobby() {
    const inputEl = getEl('nicknameInput');
    if (!inputEl) return;

    const input = inputEl.value.trim();
    if (!input) return showAlert("닉네임을 입력해주세요!");

    localStorage.setItem('nickname', input);
    window.myNickname = input;

    completeLogin();
}

// --- 테마 토글 ---
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');

    const themeBtn = getEl('themeBtn');
    if(themeBtn) themeBtn.innerText = isDark ? 'Light' : 'Dark'; // 에러 방지

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// --- 방 목록 로드 ---
async function loadRooms() {
    const list = getEl('room-list');
    if(!list) return;

    list.innerHTML = '<li style="padding:20px; text-align:center;">불러오는 중...</li>';

    try {
        const response = await fetch('/KKUTU/api/rooms');
        if (!response.ok) throw new Error("서버 응답 오류");
        const rooms = await response.json();

        list.innerHTML = '';
        if (!rooms || rooms.length === 0) {
            list.innerHTML = '<li style="padding:20px; text-align:center;">개설된 방이 없습니다.</li>';
        } else {
            rooms.forEach(room => {
                const li = document.createElement('li');
                li.className = 'room-item';
                li.innerHTML = `
                    <span style="font-weight:600;">${room.roomName || '방'}</span>
                    <button class="btn-default" onclick="joinExistingRoom('${room.roomId}')">참가</button>
                `;
                list.appendChild(li);
            });
        }
    } catch (error) {
        console.error(error);
        list.innerHTML = '<li style="padding:20px; text-align:center; color:red;">목록 로드 실패</li>';
    }
}

// --- 방 생성 ---
async function createRoom() {
    const nameInput = getEl('roomName');
    const maxInput = getEl('maxPlayers');

    const roomName = nameInput ? nameInput.value.trim() : "새로운 방";
    const maxPlayers = maxInput ? parseInt(maxInput.value, 10) : 8;

    if (!roomName) return showAlert("방 제목을 입력하세요.");

    try {
        const response = await fetch('/KKUTU/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, maxPlayers })
        });
        if (!response.ok) throw new Error("생성 실패");
        const room = await response.json();

        window.currentRoomId = room.roomId;
        connectAndJoin(window.myUid, window.myNickname);
    } catch (error) {
        showAlert("방 생성 오류");
    }
}

function joinExistingRoom(roomId) {
    if (!window.myNickname) return showAlert("닉네임이 없습니다.");
    window.currentRoomId = roomId;
    connectAndJoin(window.myUid, window.myNickname);
}

// --- 웹소켓 연결 ---
function connectAndJoin(uid, nickname) {
    if (window.stompClient && window.stompClient.connected) return;

    // 화면 전환 로직 (기존 유지)
    const lobby = document.getElementById('lobby');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameRoom = document.getElementById('gameRoom');
    const roomTitle = document.getElementById('roomTitle');

    if(lobby) lobby.classList.add('hidden');
    if(lobbyScreen) lobbyScreen.classList.add('hidden');
    if(gameRoom) gameRoom.classList.remove('hidden');
    if(roomTitle) roomTitle.innerText = `Room: ${window.currentRoomId}`;

    clearLogs();

    const socket = new SockJS('/KKUTU/ws');
    window.stompClient = Stomp.over(socket);
    window.stompClient.debug = null;

    window.stompClient.connect({}, () => {
        showChat('SYSTEM', '서버에 연결되었습니다.');

        window.stompClient.subscribe(`/topic/game-room/${window.currentRoomId}`, (message) => {
            const body = message.body;
            console.log("📩 받은 메시지:", body); // [디버깅용] 콘솔에서 확인 가능

            let data = null;
            try { if(body.startsWith('{')) data = JSON.parse(body); } catch(e){}

            // 1. JSON 형태의 메시지 처리 (완벽한 채팅/게임오버)
            if (data) {
                if (data.type === 'TURN_CHANGE') {
                    handleTurnChange(data.nextPlayer);
                    showChat('SYSTEM', `👉 다음 턴: ${data.nextPlayer}`);
                    return;
                }
                if (data.type === 'GAME_OVER') {
                    showChat('SYSTEM', `🏆 게임 종료! 승자: ${data.winner}`);
                    fireConfetti();
                    return;
                }
                if (data.sender && data.content) {
                    showChat(data.sender, data.content);
                    return;
                }
            }

            // 2. 텍스트 형태의 메시지 분석 (여기가 핵심!)

            // [A] 채팅 메시지 ("OOO님이 입력했습니다: 안녕")
            if (body.includes("님이 입력했습니다:")) {
                const parts = body.split("님이 입력했습니다:");
                const senderName = parts[0].trim();
                const chatContent = parts[1].trim();
                showChat(senderName, chatContent);
            }
            // [B] 게임 성공/실패 메시지 -> 현재 턴 유저의 말풍선으로 표시!
            else if (body.includes("(성공!") || body.includes("유효하지 않은") || body.includes("(실패")) {
                // 현재 턴인 사람의 이름으로 말풍선을 띄웁니다.
                // 만약 턴 정보가 없으면 시스템으로 띄웁니다.
                const speaker = window.currentPlayerName || 'SYSTEM';
                showChat(speaker, body);
            }
            // [C] 그 외 시스템 메시지 (입장, 퇴장 등)
            else {
                showChat('SYSTEM', body);
            }
        });

        window.stompClient.send(`/app/game/${window.currentRoomId}/join`, {}, JSON.stringify({ uid, nickname }));
    }, (err) => {
        console.error(err);
        exitRoom();
    });
}
function sendWord() {
    const input = getEl('wordInput');
    if(!input) return;

    const word = input.value.trim();
    if (word && window.stompClient && window.currentRoomId) {
        window.stompClient.send(`/app/game/${window.currentRoomId}/word`, {}, JSON.stringify({ word, uid: window.myUid }));
        input.value = '';
    }
}
// [추가] 기권(턴 넘기기) 함수
function forfeitTurn() {
    // 연결되어 있고 방에 있을 때만 작동
    if (window.stompClient && window.currentRoomId) {
        // 서버로 'forfeit' 메시지 전송 (내 UID 포함)
        window.stompClient.send(`/app/game/${window.currentRoomId}/forfeit`, {}, JSON.stringify({ uid: window.myUid }));

        // 버튼을 바로 비활성화해서 중복 클릭 방지
        const btn = document.getElementById('forfeitBtn');
        if(btn) btn.disabled = true;
    }
}
function exitRoom() {
    if (window.stompClient) {
        window.stompClient.disconnect();
        window.stompClient = null;
    }

    const gameRoom = getEl('gameRoom');
    const lobby = getEl('lobby');
    const lobbyScreen = getEl('lobby-screen');

    if(gameRoom) gameRoom.classList.add('hidden');
    if(lobby) lobby.classList.remove('hidden');
    if(lobbyScreen) lobbyScreen.classList.remove('hidden');

    window.currentRoomId = null;
    loadRooms();
}

function handleTurnChange(nextPlayer) {
    // ★ [추가] 현재 턴인 사람을 전역 변수에 저장해둡니다.
    window.currentPlayerName = nextPlayer;

    const isMe = (nextPlayer === window.myNickname);
    window.myTurn = isMe;

    const input = document.getElementById('wordInput');
    const forfeit = document.getElementById('forfeitBtn');
    const timer = document.getElementById('timerDisplay');

    if(input) {
        input.disabled = !isMe;
        if(isMe) input.focus();
    }
    if(forfeit) forfeit.disabled = !isMe;

    if(timer) {
        timer.innerText = isMe ? "[내 차례!]" : `[대기: ${nextPlayer}]`;
        timer.style.color = isMe ? "var(--btn-primary-bg)" : "var(--btn-danger)";
    }
}

// --- 채팅/로그 표시 ---
function showChat(sender, msg) {
    const chatOutput = getEl('chatOutput');
    if(!chatOutput) return;

    const div = document.createElement('div');
    const isMe = (sender === window.myNickname);
    const isSystem = (sender === 'SYSTEM');

    if (isSystem) {
        div.className = 'msg-system';
        div.innerHTML = `<span class="badge">${msg}</span>`;
    } else {
        div.className = isMe ? 'msg-row msg-right' : 'msg-row msg-left';
        div.innerHTML = isMe
            ? `<div class="msg-bubble">${msg}</div>`
            : `<div class="msg-name">${sender}</div><div class="msg-bubble">${msg}</div>`;
    }

    chatOutput.appendChild(div);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

function clearLogs() {
    const chat = getEl('chatOutput');
    const err = getEl('errorOutput');
    if(chat) chat.innerHTML = '';
    if(err) err.innerHTML = '';
}

// --- 알림창 (에러 3번 해결: window에 등록) ---
function showAlert(msg) {
    const modal = getEl('alert-modal');
    const text = getEl('alert-msg-text');

    if (modal && text) {
        text.innerText = msg;
        modal.classList.remove('hidden');
    } else {
        alert(msg);
    }
}

function closeAlert() {
    const modal = getEl('alert-modal');
    if (modal) modal.classList.add('hidden');
}

// --- 로그아웃 (에러 2번 해결: 안전 체크) ---
function logout() {
    // stompClient가 없어도 에러 안 나게 체크
    if(window.stompClient) {
        try { window.stompClient.disconnect(); } catch(e){}
    }

    localStorage.removeItem('token');
    localStorage.removeItem('nickname');
    localStorage.removeItem('jwt');

    showAlert("로그아웃 되었습니다.");

    setTimeout(() => {
        location.reload();
    }, 500);
}

// --- 폭죽 효과 ---
function fireConfetti() {
    if(typeof confetti === 'undefined') return;
    var duration = 3000;
    var end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

// --- Window에 함수 확실하게 등록 (HTML onclick에서 찾을 수 있게) ---
window.toggleTheme = toggleTheme;
window.goToLobby = goToLobby;
window.loadRooms = loadRooms;
window.createRoom = createRoom;
window.joinExistingRoom = joinExistingRoom;
window.sendWord = sendWord;
window.exitRoom = exitRoom;
window.logout = logout;
window.showAlert = showAlert;
window.closeAlert = closeAlert; // ★ 중요: 여기서 에러 3번 해결됨
window.init = init;
window.forfeitTurn = forfeitTurn;