package com.example.demo.Controller;


import com.example.demo.DTO.CreateRoomRequest;
import com.example.demo.DTO.GameRoom;
import com.example.demo.DTO.RoomInfoDTO;
import com.example.demo.service.GameRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms") // API 경로는 /api/ 로 시작하는 것을 권장
public class RoomApiController {

    private final GameRoomService gameRoomService;

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

    @GetMapping
    public List<RoomInfoDTO> getActiveRooms() {
        // GameRoomService에서 활성 방 목록 가져오기 (GameRoom 객체 맵)
        Map<String, GameRoom> activeRooms = gameRoomService.getActiveGameRooms(); // getActiveGameRooms 메소드 필요 (아래 참고)

        // GameRoom 객체들을 RoomInfoDTO 객체 리스트로 변환하여 반환
        return activeRooms.values().stream()
                .map(room -> new RoomInfoDTO(
                        room.getRoomId(),
                        room.getRoomName(),
                        room.getPlayers().size(), // 현재 플레이어 수 계산
                        room.getMaxPlayers(),
                        room.getBotCount()
                ))
                .collect(Collectors.toList());
    }
}