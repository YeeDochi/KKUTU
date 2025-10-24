package com.example.demo.DTO;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
public class GameRoom {
    private String roomId;
    private String roomName;
    private int currentTurnIndex; // 현재 턴인 플레이어의 인덱스
    private String lastWord;      // 마지막으로 성공한 단어
    private List<String> players = new ArrayList<>();
    private Set<String> usedWords = new HashSet<>();
    private int maxPlayers; // 최대 허용 인원
    private int botCount;   // 포함된 봇의 수
    // (생성자, Getter, Setter...)
    public GameRoom(String roomId, String roomName, int maxPlayers, int botCount) {
        this.roomId = roomId;
        this.roomName = roomName;
        this.maxPlayers = maxPlayers;
        this.botCount = botCount;

        // 봇을 플레이어 목록에 미리 추가
        for (int i = 0; i < botCount; i++) {
            this.players.add("AI_BOT_" + (i + 1));
        }

        this.currentTurnIndex = 0; // 첫 번째 플레이어(봇 또는 사람)부터 시작
    }
    public boolean addPlayer(String userId) {
        if (players.size() >= maxPlayers) {
            return false; // 방이 꽉 참
        }
        if (players.size() == this.botCount) {
            this.currentTurnIndex = players.size(); // (현재 봇 수 = 이 플레이어의 인덱스)
        }

        players.add(userId);
        return true;
    }
    // 턴을 넘기는 헬퍼 메서드
    public String getNextPlayer() {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % players.size();
        return players.get(this.currentTurnIndex);
    }

    public String getCurrentPlayer() {
        if (players.isEmpty()) return null;
        return players.get(this.currentTurnIndex);
    }
}