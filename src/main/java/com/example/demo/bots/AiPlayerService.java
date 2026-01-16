package com.example.demo.bots;

import com.example.demo.Event.TurnSuccessEvent;
import com.example.demo.WordsRepo.WordEntity;
import com.example.demo.WordsRepo.WordRepository;
import com.example.demo.service.GameRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
// @Transactional 제거 (필요 시 부분 적용)

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiPlayerService {

    private final WordRepository wordRepository;
    private final GameRoomService gameRoomService;

    @Async
    @EventListener
    // @Transactional 제거: 긴 대기 시간과 외부 API 호출이 포함되므로 제거하는 것이 좋습니다.
    public void onTurnSuccess(TurnSuccessEvent event) {
        String nextPlayerUid = event.getNextPlayerUid();

        // 봇의 차례인지 확인
        if (nextPlayerUid != null && nextPlayerUid.startsWith("AI_BOT_")) {
            try {
                // 생각하는 척 대기 (DB 점유 없이 대기)
                Thread.sleep(1500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            String lastWord = event.getLastword();
            String startingLetter;

            if (lastWord == null) {
                startingLetter = "가"; // 첫 턴 등
            } else {
                startingLetter = lastWord.substring(lastWord.length() - 1);
            }

            System.out.println(">>> AI BOT(" + nextPlayerUid + ") Searching for words starting with: " + startingLetter);

            try {
                // 1. DB에서 후보 단어 조회
                List<WordEntity> potentialWords = new ArrayList<>(wordRepository.findValidWords(startingLetter, "명사"));

                // 두음법칙 적용
                String alternativeLetter = gameRoomService.getAlternativeStartChar(startingLetter);
                if (alternativeLetter != null) {
                    potentialWords.addAll(wordRepository.findValidWords(alternativeLetter, "명사"));
                }

                // 2. 셔플 (랜덤 선택을 위해)
                Collections.shuffle(potentialWords);

                String chosenWord = null;
                String chosenDefinition = "AI가 선택한 단어입니다."; // 기본 뜻

                // 3. [최적화] 모든 단어를 검증하지 않고, 유효한 첫 번째 단어를 찾으면 즉시 종료
                for (WordEntity entity : potentialWords) {
                    String wordCandidate = entity.getName();

                    // [중요] 외부 API(국어원) 호출 없이, 게임 룸 규칙(중복 등)만 검증하고 싶다면 별도 메서드가 필요하지만,
                    // 현재 구조상 validateWordSynchronously를 호출해야 한다면 'break'가 필수입니다.

                    // 여기서는 단순히 'validateWordSynchronously' 결과가 유효하면 바로 선택하고 반복문을 탈출합니다.
                    // 이렇게 하면 API 호출을 1회(성공 시)로 줄일 수 있습니다.
                    Map<String, Object> validationResult = gameRoomService.validateWordSynchronously(
                            event.getRoomId(), wordCandidate, nextPlayerUid);

                    boolean isValid = (Boolean) validationResult.getOrDefault("isValid", false);
                    if (isValid) {
                        chosenWord = wordCandidate;
                        chosenDefinition = (String) validationResult.get("definition");
                        break; // [핵심] 유효한 단어를 찾았으면 더 이상 검사하지 않음!
                    }
                }

                // 4. 결과 제출
                if (chosenWord != null) {
                    System.out.println("<<< AI BOT(" + nextPlayerUid + ") Submitting: [" + chosenWord + "]");
                    gameRoomService.handleWordSubmission(
                            event.getRoomId(),
                            chosenWord,
                            nextPlayerUid,
                            chosenDefinition
                    );
                } else {
                    System.out.println("!!! AI BOT(" + nextPlayerUid + ") No valid words found. Passing turn.");
                    gameRoomService.passTurn(event.getRoomId(), nextPlayerUid);
                }

            } catch (Exception e) {
                System.err.println("Error in AI Bot: " + e.getMessage());
                e.printStackTrace();
                // 에러 발생 시 턴 넘김으로 게임 멈춤 방지
                gameRoomService.passTurn(event.getRoomId(), nextPlayerUid);
            }
        }
    }
}