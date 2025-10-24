package com.example.demo.service;


import com.example.demo.DTO.GameRoom;
import com.example.demo.Event.TurnSuccessEvent;
import com.example.demo.Event.WordValidationRequestEvent;
//import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class GameRoomService {
    // 게임방 저장
    private final Map<String, GameRoom> activeGameRooms = new ConcurrentHashMap<>();
    // 이벤트 발행을 위한 객체
    private final ApplicationEventPublisher eventPublisher;
    // WebSocket 클라이언트에게 메시지를 방송하기 위한 객체
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 컨트롤러로부터 단어 제출 요청을 받음
     */

//    //테스트용
//    @PostConstruct
//    public void initTestRoom() {
//        // "테스트 방", 최대 4명, 봇 1명 설정
//        GameRoom testRoom = new GameRoom("123", "테스트 방", 4, 1);
//
//        // [중요] "testUser" (index.html의 유저)를 방에 미리 참가시킵니다.
//        testRoom.addPlayer("testUser");
//
//        activeGameRooms.put("123", testRoom);
//        System.out.println("--- [테스트용 123번 방 생성 및 testUser 참가 완료] ---");
//    }


    public void handleWordSubmission(String roomId, String word, String userId) {
        // (1. 게임방 내부의 간단한 규칙 검증: 이미 사용된 단어인가? 턴이 맞는가?)
        // ...
        GameRoom room = activeGameRooms.get(roomId);
        if (room == null) {
            // (방이 없는 경우 - 이 경우는 거의 없지만 1:1 메시지 대신 로그로 남김)
            System.err.println("handleWordSubmission: Room not found: " + roomId);
            return;
        } // 방이 없음

        // [기능 1] 턴 분간
        if (!room.getCurrentPlayer().equals(userId)) {
            messagingTemplate.convertAndSend(
                    "/topic/game-room/" + roomId,
                    "[규칙 오류] " + userId + "님, 아직 턴이 아닙니다! (현재 턴: " + room.getCurrentPlayer() + ")"
            );
            return;
        }
        // [기능 2] 심판 봇: 끝말잇기 규칙 검사
        if (room.getLastWord() != null && !word.startsWith(room.getLastWord().substring(room.getLastWord().length() - 1))) {
            messagingTemplate.convertAndSend(
                    "/topic/game-room/" + roomId,
                    "[규칙 오류] " + userId + "님! '" + room.getLastWord().substring(room.getLastWord().length()-1,room.getLastWord().length()) + "' (으)로 시작하는 단어를 입력하세요!"
            );
            return;
        }

        // [기능 3] 심판 봇: 사용된 단어 검사
        if (room.getUsedWords().contains(word)) {
            messagingTemplate.convertAndSend(
                    "/topic/game-room/" + roomId,
                    "[규칙 오류] '" + word + "' (은)는 이미 사용된 단어입니다!"
            );
            return;
        }

        // [최종 통과] 모든 규칙을 통과했으면, 국어사전 봇에게 '단어 존재 유무'를 검증시킴
        eventPublisher.publishEvent(new WordValidationRequestEvent(this, roomId, word, userId));
    }

    public void processValidationResult(String roomId, String userId, String word, boolean isValid) {
        GameRoom room = activeGameRooms.get(roomId);
        String topic = "/topic/game-room/" + roomId;

        if (isValid) {

            room.getUsedWords().add(word); // 사용 단어 추가
            room.setLastWord(word);        // 마지막 단어 갱신
            String nextPlayer = room.getNextPlayer();// 턴 넘기기

            messagingTemplate.convertAndSend(topic,
                    userId + "님 '" + word + "' 성공! 다음 턴...");

            eventPublisher.publishEvent(new TurnSuccessEvent(this, roomId, nextPlayer, word)); // 봇을 호출하는 이벤트
        } else {
            messagingTemplate.convertAndSend(topic,
                    "'" + word + "' (은)는 사전에 없는 단어입니다. " + userId + "님 다시 시도하세요.");
        }
    }
    public void addPlayerToRoom(String roomId, String userId) {
        GameRoom room = activeGameRooms.get(roomId);
        if (room == null) {
            messagingTemplate.convertAndSendToUser(userId, "/queue/errors", "존재하지 않는 방입니다.");
            return;
        }

        // 1. 플레이어 추가 시도 (인원 제한 체크 포함)
        boolean success = room.addPlayer(userId);

        if (success) {
            // 2. [기존] 새 유저 입장 알림 방송
            messagingTemplate.convertAndSend(
                    "/topic/game-room/" + roomId,
                    "새로운 유저 입장: " + userId + " (현재 인원: " + room.getPlayers().size() + "/" + room.getMaxPlayers() + ")"
            );

            // 3. [!!! 여기가 추가된 부분 !!!]
            // 방금 입장한 플레이어가 '봇 이후의 첫 번째 사람'인지 확인
            // (이 시점에 GameRoom.addPlayer에서 currentTurnIndex가 이 사람으로 설정되었음)
            if (room.getPlayers().size() == room.getBotCount() + 1) {
                // 첫 번째 사람이 입장했으므로, 게임 시작 및 첫 턴 알림 방송
                String firstPlayer = room.getCurrentPlayer(); // 첫 턴 플레이어 가져오기
                messagingTemplate.convertAndSend(
                        "/topic/game-room/" + roomId,
                        "게임 시작! 첫 턴은 " + firstPlayer + "님입니다."
                );

                // [선택 사항] 만약 첫 턴이 봇이라면, 여기서 봇을 바로 깨울 수도 있습니다.
                // (하지만 현재 로직은 첫 사람이 턴을 가져가므로 이 코드는 필요 없음)
                // if (firstPlayer.startsWith("AI_BOT_")) {
                //     // 첫 단어는 없으므로 lastWord를 null 대신 특수 값(예: "")으로 전달
                //     eventPublisher.publishEvent(new TurnSuccessEvent(this, roomId, firstPlayer, ""));
                // }
            }

        } else {
            // [기존] 방 꽉 참 알림 (1:1)
            messagingTemplate.convertAndSendToUser(userId, "/queue/errors", "방이 꽉 찼습니다.");
        }
    }
    public GameRoom createRoom(String roomName, int maxPlayers, int botCount) {
        // 1. 고유한 방 ID 생성
        String roomId = UUID.randomUUID().toString();

        // 2. GameRoom 객체 생성 (이때 봇이 자동으로 추가됨)
        GameRoom newRoom = new GameRoom(roomId, roomName, maxPlayers, botCount);

        // 3. 서비스의 관리 목록에 추가
        activeGameRooms.put(roomId, newRoom);

        // 4. 생성된 방 정보를 컨트롤러에 반환
        return newRoom;
    }
    public void passTurn(String roomId, String userId) {
        GameRoom room = activeGameRooms.get(roomId);

        // 방이 없거나, 현재 턴이 봇의 턴이 아니면 무시
        if (room == null || !room.getCurrentPlayer().equals(userId)) {
            return;
        }

        // 1. 턴을 다음 사람으로 넘김
        String nextPlayer = room.getNextPlayer();

        // 2. 턴이 넘어갔음을 '방송'
        messagingTemplate.convertAndSend(
                "/topic/game-room/" + roomId,
                userId + "님이 턴을 포기했습니다. 다음 턴: " + nextPlayer
        );

        // 3. [중요] 턴이 넘어갔으니, '또 다른 봇'을 깨워야 할 수도 있음
        //    (lastWord는 변경 없이 그대로 전달)
        eventPublisher.publishEvent(new TurnSuccessEvent(
                this,
                roomId,
                nextPlayer,
                room.getLastWord()
        ));
    }
}


