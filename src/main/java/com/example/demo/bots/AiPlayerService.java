package com.example.demo.bots;

import com.example.demo.Event.TurnSuccessEvent;
import com.example.demo.WordsRepo.WordEntity;
import com.example.demo.WordsRepo.WordRepository;
import com.example.demo.service.GameRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiPlayerService {

    // [필수] 이제 진짜 DB(MySQL)에서 단어를 가져와야 합니다.
    private final WordRepository wordRepository;

    // [필수] 봇도 단어를 제출해야 하므로 GameRoomService가 필요합니다.
    private final GameRoomService gameRoomService;
    private final SimpMessagingTemplate messagingTemplate;
    @Async
    @EventListener
    public void onTurnSuccess(TurnSuccessEvent event) {

        // [수정] 봇 ID가 'AI_BOT_'으로 시작하는지 검사
        String nextPlayerId = event.getNextPlayerId();
        if (nextPlayerId != null && nextPlayerId.startsWith("AI_BOT_")) {

            // (1~2초 지연...)
            try { Thread.sleep(1500); } catch (InterruptedException e) {}

            // (DB에서 단어 찾아오기...)
            String startingLetter = event.getLastword().substring(event.getLastword().length() - 1);
            String aiWord = wordRepository.findRandomWordStartingWith(startingLetter)
                    .map(WordEntity::getName) // Word 객체에서 이름(String)만 추출
                    .orElse(null); // 못찾으면 null

            if (aiWord != null) {
                // [성공] 봇이 단어를 찾음
                gameRoomService.handleWordSubmission(
                        event.getRoomId(),
                        aiWord,
                        nextPlayerId
                );
            } else {
                // [실패] 봇이 단어를 못 찾음
                // (로그를 남겨서 DB에 단어가 없는지 확인)
                System.err.println("!!! AI BOT(" + nextPlayerId + ")가 '" + startingLetter + "'(으)로 시작하는 단어를 DB에서 못 찾았습니다.");

                // 1. 봇이 턴을 포기하도록 GameRoomService에 요청
                gameRoomService.passTurn(event.getRoomId(), nextPlayerId);
            }
        }
    }
}

