package com.example.demo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker // <-- [핵심] 이 어노테이션이 SimpMessagingTemplate 빈을 생성시킵니다.
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 1. 메시지 브로커가 /topic 으로 시작하는 주제(topic)를 구독한 클라이언트들에게 메시지 전파
        registry.enableSimpleBroker("/topic");

        // 2. 클라이언트가 서버로 메시지를 보낼 때 사용할 접두사(prefix)
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 3. 클라이언트가 WebSocket에 처음 연결할 때 사용할 엔드포인트
        registry.addEndpoint("/ws") // 예: http://localhost:8080/ws
                .withSockJS(); // SockJS는 WebSocket을 지원하지 않는 브라우저에서도 작동하도록 도와줌
    }
}