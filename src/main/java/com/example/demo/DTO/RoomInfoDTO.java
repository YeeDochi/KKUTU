package com.example.demo.DTO; // 패키지 확인

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoomInfoDTO {
    private String roomId;
    private String roomName;
    private int currentPlayerCount; // 현재 인원수
    private int maxPlayers;
    private int botCount;

    // GameRoom 객체로부터 DTO를 생성하는 생성자 (편의용)
    public RoomInfoDTO(String roomId, String roomName, int currentPlayerCount, int maxPlayers, int botCount) {
        this.roomId = roomId;
        this.roomName = roomName;
        this.currentPlayerCount = currentPlayerCount;
        this.maxPlayers = maxPlayers;
        this.botCount = botCount;
    }
}