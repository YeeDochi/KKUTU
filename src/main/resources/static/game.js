// [KKUTU] game.js - 캐치마인드와 동일한 Clean 버전

// --- 테마 로직 ---
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeBtn').innerText = isDark ? 'Light' : 'Dark';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeBtn').innerText = 'Light';
}

// --- 전역 변수 ---
let stompClient = null;
let currentRoomId = null;
let myUid = null;
let myNickname = null;
let myTurn = false;

// --- DOM 요소 ---
const lobbyDiv = document.getElementById('lobby');
const gameRoomDiv = document.getElementById('gameRoom');
const nicknameInput = document.getElementById('nicknameInput');
const wordInput = document.getElementById('wordInput');
const chatOutput = document.getElementById('chatOutput');
const errorOutput = document.getElementById('errorOutput');
const roomTitle = document.getElementById('roomTitle');
const timerDisplay = document.getElementById('timerDisplay');
const forfeitBtn = document.getElementById('forfeitBtn');

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

// --- 초기화 ---
// 페이지 로드 시 UID 생성 및 방 목록 로드
window.addEventListener('load', () => {
    myUid = getOrCreateUid();
    if (!lobbyDiv.classList.contains('hidden')) {
        loadRooms();
    }
});

// --- UI 함수 (HTML onclick에서 자동 연결됨) ---

// 1. 로그인 -> 로비 이동
function goToLobby() {
    const input = document.getElementById('nicknameInput').value.trim();
    if (!input) return alert("닉네임을 입력해주세요!");

    myNickname = input;
    document.getElementById('welcome-msg').innerText = `${myNickname}님 환영합니다!`;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby').classList.remove('hidden');

    loadRooms();
}

// 2. 방 목록 불러오기 (캐치마인드와 동일 로직)
async function loadRooms() {
    const list = document.getElementById('room-list');
    list.innerHTML = '<li style="padding:20px; text-align:center; color:var(--text-secondary);">불러오는 중...</li>';

    try {
        const response = await fetch('/KKUTU/api/rooms');
        const rooms = await response.json();

        if (!rooms.length) {
            list.innerHTML = '<li style="padding:20px; text-align:center; color:var(--text-secondary);">개설된 방이 없습니다.</li>';
        } else {
            list.innerHTML = '';
            rooms.forEach(room => {
                const li = document.createElement('li');
                li.className = 'room-item';
                li.innerHTML = `
                    <span style="font-weight:600;">${room.roomName || '이름 없는 방'}</span>
                    <button class="btn-default" onclick="joinExistingRoom('${room.roomId}')" style="font-size:12px;">참가</button>
                `;
                list.appendChild(li);
            });
        }
    } catch (error) {
        console.error(error);
        list.innerHTML = '<li style="padding:20px; text-align:center; color:#cf222e;">목록 로드 실패</li>';
    }
}

// 3. 방 생성
async function createRoom() {
    const roomName = document.getElementById('roomName').value.trim();
    const maxPlayers = parseInt(document.getElementById('maxPlayers').value, 10);
    const botCount = parseInt(document.getElementById('botCount').value, 10);

    if (!roomName) return alert("방 제목을 입력하세요.");

    try {
        const response = await fetch('/KKUTU/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, maxPlayers, botCount })
        });
        if (!response.ok) throw new Error("방 생성 실패");
        const room = await response.json();
        currentRoomId = room.roomId;
        connectAndJoin(myUid, myNickname);
    } catch (error) {
        alert("방 생성 중 오류가 발생했습니다.");
    }
}

// 4. 방 참가
function joinExistingRoom(roomId) {
    if (!myNickname) return alert("닉네임이 없습니다. 다시 로그인해주세요.");
    currentRoomId = roomId;
    connectAndJoin(myUid, myNickname);
}

// --- WebSocket 연결 및 게임 로직 ---
function connectAndJoin(uid, nickname) {
    if (stompClient && stompClient.connected) return;

    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('gameRoom').classList.remove('hidden');
    document.getElementById('roomTitle').innerText = `Room: ${currentRoomId}`;
    clearLogs();

    const socket = new SockJS('/KKUTU/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, (frame) => {
        addToLog('서버에 연결되었습니다.', chatOutput);

        stompClient.subscribe(`/topic/game-room/${currentRoomId}`, (message) => {
            const body = message.body;
            try {
                if (body.startsWith('{')) {
                    const data = JSON.parse(body);
                    if (data.type === 'TURN_CHANGE') {
                        handleTurnChange(data.nextPlayer);
                        return;
                    }
                }
            } catch (e) {}

            addToLog(body, chatOutput);

            if (body.includes("님이 입력했습니다:")) return;
            const startMatch = body.match(/첫 턴은 (\S+)님입니다./);
            if (startMatch) handleTurnChange(startMatch[1].replace('님', ''));
            const nextMatch = body.match(/다음 턴: (\S+)/);
            if (nextMatch) handleTurnChange(nextMatch[1]);
        });

        stompClient.subscribe('/user/queue/errors', (message) => {
            addToLog(`[에러] ${message.body}`, errorOutput);
            if (message.body.includes("실패") || message.body.includes("full")) {
                alert(message.body);
                exitRoom();
            }
        });

        stompClient.send(`/app/game/${currentRoomId}/join`, {}, JSON.stringify({ uid: uid, nickname: nickname }));
    }, (error) => {
        console.error(error);
        exitRoom();
    });
}

function sendWord() {
    const word = wordInput.value.trim();
    if (word && stompClient && currentRoomId) {
        stompClient.send(`/app/game/${currentRoomId}/word`, {}, JSON.stringify({ word: word, uid: myUid }));
        wordInput.value = '';
    }
}

function exitRoom() {
    if (stompClient) {
        stompClient.disconnect();
        stompClient = null;
    }
    document.getElementById('lobby').classList.remove('hidden');
    document.getElementById('gameRoom').classList.add('hidden');
    currentRoomId = null;
    loadRooms();
}

// --- 유틸리티 ---
function handleTurnChange(nextPlayer) {
    if (nextPlayer === myNickname) {
        myTurn = true;
        wordInput.disabled = false;
        forfeitBtn.disabled = false;
        timerDisplay.innerText = "[내 차례!]";
        timerDisplay.style.color = "var(--btn-primary-bg)";
        wordInput.focus();
    } else {
        myTurn = false;
        wordInput.disabled = true;
        forfeitBtn.disabled = true;
        timerDisplay.innerText = `[대기: ${nextPlayer}]`;
        timerDisplay.style.color = "var(--btn-danger)";
    }
}

function addToLog(msg, element) {
    const p = document.createElement('p');
    p.textContent = msg;
    element.appendChild(p);
    element.scrollTop = element.scrollHeight;
}

function clearLogs() {
    chatOutput.innerHTML = '';
    errorOutput.innerHTML = '';
}