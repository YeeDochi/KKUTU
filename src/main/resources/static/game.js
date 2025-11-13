// game.js (JSON 신호 처리 기능이 포함된 최신 버전)

// --- 전역 변수 ---
let stompClient = null;
let currentRoomId = null;
let myUid = null;         // localStorage에서 가져올 UID
let myNickname = null;  // 접속 시 사용한 닉네임
let myTurn = false;

// --- DOM 요소 ---
// 이 스크립트는 game.html의 DOM을 조작합니다.
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

// --- UID 헬퍼 함수 (localStorage) ---
function getOrCreateUid() {
    let uid = localStorage.getItem('kkutu_uid');
    if (!uid) {
        // 간단한 UUID 생성기
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

// 페이지 로드 시 UID 가져오기 및 방 목록 표시
window.addEventListener('load', () => {
    myUid = getOrCreateUid();
    fetchAndDisplayRoomList();
});


// --- 방 생성/참가 함수 ---
async function createRoomAndJoin() {
    myNickname = nicknameInput.value.trim();
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

    connectAndJoin(myUid, myNickname);
}

// --- WebSocket 함수 ---
function connectAndJoin(uid, nickname) {
    if (stompClient && stompClient.connected) {
        lobbyDiv.style.display = 'none'; gameRoomDiv.style.display = 'block';
        roomTitle.innerText = `// 2. Game Room (ID: ${currentRoomId})`;
        return;
    }
    lobbyDiv.style.display = 'none'; gameRoomDiv.style.display = 'block';
    roomTitle.innerText = `// 2. Game Room (ID: ${currentRoomId})`;
    clearLogs();

    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = console.log; // 디버그 로그 활성화

    stompClient.connect({},
        (frame) => {
            addToLog('서버 연결 성공!', chatOutput);

            // [!!!] 1. 공용 채팅 구독 (수정됨)
            stompClient.subscribe(`/topic/game-room/${currentRoomId}`, (message) => {
                const messageBody = message.body;

                let isTurnSignal = false;
                try {
                    // [!!!] 2. JSON 파싱 시도
                    const data = JSON.parse(messageBody);

                    // [!!!] 3. JSON이고, 타입이 'TURN_CHANGE'인지 확인
                    if (data && data.type === 'TURN_CHANGE') {
                        isTurnSignal = true;
                        // [!!!] 4. 턴 변경 함수를 *직접* 호출 (채팅창에 안 씀)
                        handleTurnChange(data.nextPlayer);
                    }
                } catch (e) {
                    // JSON 파싱 실패 시, 일반 텍스트 메시지로 간주
                }

                // [!!!] 5. 턴 신호가 *아닌* 일반 메시지만 채팅창에 추가
                if (!isTurnSignal) {
                    addToLog(messageBody, chatOutput);
                    // [!!!] 6. 텍스트 메시지에서 '첫 턴'/'재시작' 텍스트 파싱
                    parseAndHandleTurnChange(messageBody);
                }
            });

            // 2. 입장 실패 에러 구독 (변경 없음)
            stompClient.subscribe('/user/queue/errors', (message) => {
                const errorBody = message.body;
                addToLog(errorBody, errorOutput);
                if (errorBody.includes("닉네임") || errorBody.includes("꽉 찼습니다") || errorBody.includes("존재하지 않는 방") || errorBody.includes("접속 중인 유저")) {
                    addToLog("방 참가에 실패하여 로비로 돌아갑니다.", errorOutput);
                    disconnect();
                }
            });

            addToLog('방 참가 메시지 전송 중...', chatOutput);
            stompClient.send(`/app/game/${currentRoomId}/join`, {},
                JSON.stringify({ uid: uid, nickname: nickname }) // uid 포함
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

    if(wordInput) wordInput.disabled = true;
    if(forfeitBtn) forfeitBtn.disabled = true;
    if(timerDisplay) timerDisplay.innerText = "[Timer]";
    console.log("UI switched to lobby.");
    fetchAndDisplayRoomList();
}

function sendWord() {
    const word = wordInput.value.trim();
    if (word && stompClient && stompClient.connected && currentRoomId && myUid) {
        stompClient.send(`/app/game/${currentRoomId}/word`, {},
            JSON.stringify({ word: word, uid: myUid })
        );
        wordInput.value = '';
    } else {
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

// --- 방 목록 함수 ---
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
        roomListOutput.innerHTML = `<p style="color:#f44747;">오류: ${error.message}</p>`;
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

        const roomInfo = document.createElement('span');
        const roomName = room.roomName || '이름 없는 방';
        const currentPlayers = typeof room.currentPlayerCount === 'number' ? room.currentPlayerCount : '?';
        const maxPlayers = typeof room.maxPlayers === 'number' ? room.maxPlayers : '?';
        const botCount = typeof room.botCount === 'number' ? room.botCount : '?';
        // 스타일 테마에 맞게 텍스트 포맷 변경
        roomInfo.textContent = `"${roomName}" [${currentPlayers}/${maxPlayers}] (Bots: ${botCount})`;

        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'join()';
        joinBtn.addEventListener('click', () => joinExistingRoom(room.roomId));

        li.appendChild(roomInfo);
        li.appendChild(joinBtn);
        ul.appendChild(li);
    });
    roomListOutput.appendChild(ul);
}

// --- 유틸리티 함수 ---
function addToLog(message, outputElement = chatOutput) {
    if (!outputElement) { console.warn("addToLog: outputElement is null"); return; }
    const p = document.createElement('p');
    // 터미널 스타일 프롬프트 추가
    if (outputElement.id === 'chatOutput') {
        p.textContent = `[Log] > ${message}`;
    } else {
        p.textContent = `[Error] > ${message}`;
    }

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

    // [!!!] "다음 턴:" 매치 로직 (제거됨) - JSON으로 처리

    // [!!!] '첫 턴'과 '탈락 후 재시작' 텍스트만 파싱
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
        timerDisplay.innerText = `[My Turn: ${myNickname}]`; // "내 턴!"
        wordInput.focus();
    } else {
        myTurn = false;
        wordInput.disabled = true;
        forfeitBtn.disabled = true;
        if (nextPlayerNickname) {
            timerDisplay.innerText = `[Wait: ${nextPlayerNickname}'s Turn]`; // "다른 사람 턴"
        } else {
            timerDisplay.innerText = "[Timer]"; // 기본값
        }
    }
}

