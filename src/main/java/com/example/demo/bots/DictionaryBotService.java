package com.example.demo.bots;

import com.example.demo.service.GameRoomService;
import com.example.demo.Event.WordValidationRequestEvent;
import com.example.demo.service.KoreanApiService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DictionaryBotService {
    private final KoreanApiService koreanApiService;
    private final GameRoomService gameRoomService; // 결과 콜백용

    @Async // [핵심] 이 메서드를 별도 스레드 풀에서 비동기 실행
    @EventListener // WordValidationRequestEvent 이벤트가 발생하면 이 메서드 실행
    public void onWordValidationRequest(WordValidationRequestEvent event) {

        // 1. 봇이 API를 호출해 단어 검증 (시간이 걸릴 수 있음)
        boolean isValid = koreanApiService.validateWord(event.getWord());

        // 2. 검증이 끝나면, GameRoomService의 콜백 메서드를 호출해 결과 전달
        gameRoomService.processValidationResult(
                event.getRoomId(),
                event.getUserId(),
                event.getWord(),
                isValid
        );
    }
}
