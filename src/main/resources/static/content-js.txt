// game.js (클라이언트 UID 생성 방식으로 복구)

// --- 전역 변수 ---
let stompClient = null;
let currentRoomId = null;
let myUid = null;         // [!!!] localStorage에서 가져올 UID
let myNickname = null;  // [!!!] 접속 시 사용한 닉네임
let myTurn = false;

// --- DOM 요소 ---
const lobbyDiv = document.getElementById('lobby');
const gameRoomDiv = document.getElementById('gameRoom');
const nicknameInput = document.getElementById('nickname');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const sendWordBtn = document.getElementById('sendWordBtn');
const wordInput = document.getElementById('wordInput');
const chatOutput = document.getElementById('chatOutput');
const errorOutput = document.getElementById('errorOutput');
const roomTitle = document.getElementById('roomTitle');
const joinRoomIdInput = document.getElementById('joinRoomId');
const roomNameInput = document.getElementById('roomName');
const maxPlayersInput = document.getElementById('maxPlayers');
const botCountInput = document.getElementById('botCount');
const forfeitBtn = document.getElementById('forfeitBtn');
const timerDisplay = document.getElementById('timerDisplay');
const refreshRoomListBtn = document.getElementById('refreshRoomListBtn');
const roomListOutput = document.getElementById('roomListOutput');

// --- [!!!] UID 헬퍼 함수 추가 (localStorage) ---
function getOrCreateUid() {
    let uid = localStorage.getItem('kkutu_uid');
    if (!uid) {
        // 간단한 UUID 생성기 (Crypto API가 더 좋지만, 간단하게 구현)
        uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('kkutu_uid', uid);
    }
    console.log("My UID is: " + uid);
    return uid;
}

// --- 이벤트 리스너 ---
if (createRoomBtn) createRoomBtn.addEventListener('click', createRoomAndJoin);
if (joinRoomBtn) joinRoomBtn.addEventListener('click', () => joinExistingRoom());
if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', disconnect);
if (sendWordBtn) sendWordBtn.addEventListener('click', sendWord);
if (wordInput) {
    wordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendWord();
        }
    });
}
if (forfeitBtn) forfeitBtn.addEventListener('click', forfeitTurn);
if (refreshRoomListBtn) refreshRoomListBtn.addEventListener('click', fetchAndDisplayRoomList);

// [!!!] 페이지 로드 시 UID를 미리 가져오고 방 목록을 표시
window.addEventListener('load', () => {
    myUid = getOrCreateUid();
    fetchAndDisplayRoomList();
});


// --- 방 생성/참가 함수 (UID, Nickname 사용) ---
async function createRoomAndJoin() {
    myNickname = nicknameInput.value.trim();
    // [!!!] myUid는 페이지 로드 시 이미 설정됨

    const roomName = roomNameInput.value.trim();
    const maxPlayers = parseInt(maxPlayersInput.value, 10);
    const botCount = parseInt(botCountInput.value, 10);

    if (!myNickname || !roomName) {
        alert("닉네임과 방 제목을 입력하세요."); return;
    }
    if (isNaN(maxPlayers) || isNaN(botCount) || (botCount >= maxPlayers && maxPlayers > 0)) {
        alert("최대 인원과 봇 수를 올바르게 입력하세요 (봇 수는 최대 인원보다 적어야 함)."); return;
    }

    try {
        addToLog('방 생성 중...', roomListOutput);
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, maxPlayers, botCount })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`방 생성 실패 (${response.status}): ${errorText}`);
        }
        const room = await response.json();
        currentRoomId = room.roomId;
        addToLog(`방 생성 성공 (ID: ${currentRoomId}). 게임방에 연결합니다...`, roomListOutput);

        // [!!!] UID와 Nickname 전달
        connectAndJoin(myUid, myNickname);
    } catch (error) {
        addToLog(`오류: ${error.message}`, roomListOutput);
        console.error("Create room error:", error);
    }
}

function joinExistingRoom(roomIdFromList = null) {
    myNickname = nicknameInput.value.trim();
    currentRoomId = roomIdFromList || joinRoomIdInput.value.trim();

    if (!myNickname || !currentRoomId) {
        alert("닉네임을 입력하고, 참가할 방 ID를 입력하거나 목록에서 선택하세요."); return;
    }
    addToLog(`방 (${currentRoomId}) 참가 시도...`, roomListOutput);

    // [!!!] UID와 Nickname 전달
    connectAndJoin(myUid, myNickname);
}

// --- [!!!] WebSocket 함수 (welcome 구독 삭제, setTimeout 삭제) ---
function connectAndJoin(uid, nickname) {
    if (stompClient && stompClient.connected) {
        lobbyDiv.style.display = 'none'; gameRoomDiv.style.display = 'block';
        roomTitle.innerText = `게임방 (ID: ${currentRoomId})`;
        return;
    }
    lobbyDiv.style.display = 'none'; gameRoomDiv.style.display = 'block';
    roomTitle.innerText = `게임방 (ID: ${currentRoomId})`;
    clearLogs();

    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = console.log; // 디버그 로그 활성화

    stompClient.connect({},
        (frame) => {
            addToLog('서버 연결 성공!', chatOutput);

            // 1. 공용 채팅 구독 (변경 없음)
            stompClient.subscribe(`/topic/game-room/${currentRoomId}`, (message) => {
                const messageBody = message.body;
                addToLog(messageBody, chatOutput);
                parseAndHandleTurnChange(messageBody);
            });

            // 2. 입장 실패 에러 구독 (변경 없음)
            stompClient.subscribe('/user/queue/errors', (message) => {
                const errorBody = message.body;
                addToLog(errorBody, errorOutput);
                // [!!!] UID 중복 시에도 disconnect 처리
                if (errorBody.includes("닉네임") || errorBody.includes("꽉 찼습니다") || errorBody.includes("존재하지 않는 방") || errorBody.includes("접속 중인 유저")) {
                    addToLog("방 참가에 실패하여 로비로 돌아갑니다.", errorOutput);
                    disconnect();
                }
            });

            // 3. [!!!] '/user/queue/welcome' 구독 *삭제*
            // stompClient.subscribe('/user/queue/welcome', ...); // (삭제됨)

            // 4. [!!!] setTimeout *삭제*
            // [!!!] *즉시* 참가 메시지 전송 (uid, nickname 포함)
            addToLog('방 참가 메시지 전송 중...', chatOutput);
            stompClient.send(`/app/game/${currentRoomId}/join`, {},
                JSON.stringify({ uid: uid, nickname: nickname }) // [!!!] uid 포함
            );

            handleTurnChange(null);
        },
        (error) => {
            addToLog(`서버 연결 실패: ${error}`, errorOutput);
            console.error('STOMP connection error:', error);
            disconnect();
        }
    );
}

function disconnect() {
    if (stompClient !== null) {
        if (stompClient.connected) {
            stompClient.disconnect(() => { console.log("Disconnected callback."); });
        }
        stompClient = null;
    }
    lobbyDiv.style.display = 'block'; gameRoomDiv.style.display = 'none';
    currentRoomId = null;
    myTurn = false;

    // [!!!] myUid와 myNickname은 초기화하지 않음 (localStorage 기준)

    if(wordInput) wordInput.disabled = true;
    if(forfeitBtn) forfeitBtn.disabled = true;
    if(timerDisplay) timerDisplay.innerText = "";
    console.log("UI switched to lobby.");
    fetchAndDisplayRoomList();
}

function sendWord() {
    const word = wordInput.value.trim();
    // [!!!] myUid는 이제 localStorage에서 왔으므로 null일 리 없음
    if (word && stompClient && stompClient.connected && currentRoomId && myUid) {
        stompClient.send(`/app/game/${currentRoomId}/word`, {},
            JSON.stringify({ word: word, uid: myUid })
        );
        wordInput.value = '';
    } else {
        // [!!!] myUid 체크 로직 제거 (단순화)
        if (!word) addToLog("단어를 입력하세요.", errorOutput);
        else if (!stompClient || !stompClient.connected) addToLog("서버에 연결되지 않았습니다.", errorOutput);
    }
}

function forfeitTurn() {
    if (stompClient && stompClient.connected && currentRoomId && myUid) {
        stompClient.send(`/app/game/${currentRoomId}/forfeit`, {},
            JSON.stringify({ uid: myUid })
        );
        addToLog("턴 포기 메시지를 전송했습니다.", chatOutput);
        handleTurnChange(null);
    } else {
        addToLog("포기하려면 서버에 연결되어 있어야 합니다.", errorOutput);
    }
}

// --- 방 목록 함수 (변경 없음) ---
async function fetchAndDisplayRoomList() {
    if (!roomListOutput) {
        console.error("Room list output element not found!");
        return;
    }
    roomListOutput.innerHTML = '<p>방 목록 새로고침 중...</p>';
    try {
        const response = await fetch('/api/rooms');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`방 목록 로드 실패 (${response.status}): ${errorText}`);
        }
        const rooms = await response.json();
        displayRoomList(rooms);
    } catch (error) {
        roomListOutput.innerHTML = `<p style="color:red;">오류: ${error.message}</p>`;
        console.error("Fetch room list error:", error);
    }
}

function displayRoomList(rooms) {
    if (!roomListOutput) return;
    roomListOutput.innerHTML = '';
    if (!Array.isArray(rooms) || rooms.length === 0) {
        roomListOutput.innerHTML = '<p>현재 생성된 방이 없습니다.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none'; ul.style.padding = '0';

    rooms.forEach(room => {
        const li = document.createElement('li');
        // (스타일 생략)
        li.style.marginBottom = '10px'; li.style.padding = '10px'; li.style.border = '1px solid #444';
        li.style.borderRadius = '4px'; li.style.display = 'flex'; li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';

        const roomInfo = document.createElement('span');
        const roomName = room.roomName || '이름 없는 방';
        const currentPlayers = typeof room.currentPlayerCount === 'number' ? room.currentPlayerCount : '?';
        const maxPlayers = typeof room.maxPlayers === 'number' ? room.maxPlayers : '?';
        const botCount = typeof room.botCount === 'number' ? room.botCount : '?';
        roomInfo.textContent = `${roomName} (${currentPlayers}/${maxPlayers}) - 봇: ${botCount}명`;

        const joinBtn = document.createElement('button');
        joinBtn.textContent = '참가';
        joinBtn.style.padding = '5px 10px';
        joinBtn.addEventListener('click', () => joinExistingRoom(room.roomId));

        li.appendChild(roomInfo);
        li.appendChild(joinBtn);
        ul.appendChild(li);
    });
    roomListOutput.appendChild(ul);
}

// --- 유틸리티 함수 (변경 없음) ---
function addToLog(message, outputElement = chatOutput) {
    if (!outputElement) { console.warn("addToLog: outputElement is null"); return; }
    const p = document.createElement('p');
    p.textContent = message;
    if (outputElement.firstChild) {
        outputElement.insertBefore(p, outputElement.firstChild);
    } else {
        outputElement.appendChild(p);
    }
}

function clearLogs() {
    if(chatOutput) chatOutput.innerHTML = '';
    if(errorOutput) errorOutput.innerHTML = '';
}

// --- 턴 변경 로직 (myNickname과 비교) ---
function parseAndHandleTurnChange(messageBody) {
    let nextPlayerNickname = null;

    // [!!!] '님'이 붙어있을 경우를 대비해 .replace('님', '') 추가
    const turnMatch = messageBody.match(/다음 턴: (\S+)/);
    if (turnMatch && turnMatch[1]) { nextPlayerNickname = turnMatch[1].replace('님', ''); }

    const startMatch = messageBody.match(/첫 턴은 (\S+)님입니다./);
    if (startMatch && startMatch[1]) { nextPlayerNickname = startMatch[1].replace('님', ''); }

    const eliminatedMatch = messageBody.match(/(\S+)님부터 \(아무 단어나\) 다시 시작하세요/);
    if (eliminatedMatch && eliminatedMatch[1]) { nextPlayerNickname = eliminatedMatch[1].replace('님', ''); }

    if (nextPlayerNickname !== null) {
        handleTurnChange(nextPlayerNickname);
    }
}

function handleTurnChange(nextPlayerNickname) {
    if (!wordInput || !forfeitBtn || !timerDisplay) {
        console.error("Required elements not found for handleTurnChange"); return;
    }

    if (nextPlayerNickname === myNickname) {
        myTurn = true;
        wordInput.disabled = false;
        forfeitBtn.disabled = false;
        timerDisplay.innerText = "내 턴!";
        wordInput.focus();
    } else {
        myTurn = false;
        wordInput.disabled = true;
        forfeitBtn.disabled = true;
        if (nextPlayerNickname) {
            timerDisplay.innerText = `${nextPlayerNickname}님의 턴`;
        } else {
            timerDisplay.innerText = "";
        }
    }
}