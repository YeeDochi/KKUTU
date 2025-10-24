package com.example.demo.Controller;
import com.example.demo.service.GameRoomService;
import lombok.Getter;
import lombok.Setter;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class GameRoomController {

    private final GameRoomService gameRoomService;

    @MessageMapping("/game/{roomId}/word")
    public void submitWord(@DestinationVariable String roomId, @Payload WordMessage message) {
        // gameRoomService의 메서드를 호출해 실제 로직 처리
        gameRoomService.handleWordSubmission(
                roomId,
                message.getWord(),
                message.getUserId()
        );
    }
    @MessageMapping("/game/{roomId}/join")
    public void joinRoom(@DestinationVariable String roomId, @Payload JoinMessage message) {

        // GameRoomService에 참가 로직 위임
        gameRoomService.addPlayerToRoom(roomId, message.getUserId());
    }

    // (메시지 DTO는 내부 클래스나 별도 파일로)
    @Getter
    @Setter
    private static class JoinMessage {
        private String userId;
    }
    // 클라이언트가 보낼 메시지의 형식을 정의하는 DTO (Data Transfer Object)
    // (이 클래스는 컨트롤러 파일 안에 private static class로 만들거나 별도 파일로 빼도 됩니다)
    private static class WordMessage {
        private String word;
        private String userId;

        // Getter
        public String getWord() { return word; }
        public String getUserId() { return userId; }

        // Setter (JSON 역직렬화를 위해 필요)
        public void setWord(String word) { this.word = word; }
        public void setUserId(String userId) { this.userId = userId; }
    }
}