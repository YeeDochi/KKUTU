package com.example.demo.Event;


import lombok.Getter;
import lombok.Setter;
import org.springframework.context.ApplicationEvent;
@Getter
@Setter
public class TurnSuccessEvent extends ApplicationEvent {
    private final String roomId;
    private final String nextPlayerId;
    private final String lastword;

    public TurnSuccessEvent(Object source, String roomId, String userId, String word) {
        super(source);
        this.roomId = roomId;
        this.nextPlayerId = userId;
        this.lastword = word;
    }


}
