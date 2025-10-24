package com.example.demo.Controller;


import com.example.demo.DTO.CreateRoomRequest;
import com.example.demo.DTO.GameRoom;
import com.example.demo.service.GameRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map; // [추가]

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms") // API 경로는 /api/ 로 시작하는 것을 권장
public class RoomApiController {

    private final GameRoomService gameRoomService;

    /**
     * 새 게임방을 생성합니다.
     * @param request (roomName, maxPlayers, botCount)
     * @return 생성된 방의 ID (roomId)
     */
    @PostMapping
    public Map<String, String> createRoom(@RequestBody CreateRoomRequest request) {
        // GameRoomService에 방 생성을 위임
        GameRoom newRoom = gameRoomService.createRoom(
                request.getRoomName(),
                request.getMaxPlayers(),
                request.getBotCount()
        );

        // 클라이언트에게는 방 ID만 돌려주면 됨
        return Map.of("roomId", newRoom.getRoomId());
    }

    // (향후 /api/rooms (GET)으로 전체 방 목록을 조회하는 기능도 추가 가능)
}