package com.example.demo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig{

    @Bean
    public WebClient koreanApiWebClient() {
        return WebClient.builder()
                .baseUrl("https://stdict.korean.go.kr/api") // 국립국어원 API 기본 URL
                .build();
    }
}