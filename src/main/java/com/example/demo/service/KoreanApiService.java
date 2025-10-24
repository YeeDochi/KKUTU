package com.example.demo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import lombok.RequiredArgsConstructor;

@Service
//@RequiredArgsConstructor
public class KoreanApiService {

    private final WebClient koreanApiWebClient; // 2단계에서 만든 WebClient 주입
    private final ObjectMapper objectMapper;

    public KoreanApiService(WebClient koreanApiWebClient, ObjectMapper objectMapper) {
        this.koreanApiWebClient = koreanApiWebClient;
        this.objectMapper = objectMapper;
    }
    @Value("${api.key.korean}")
    private String apiKey;

    public boolean validateWord(String word) {
        try {
            // [수정] WebClient 체인을 원래대로 되돌리고, 응답을 String으로 받습니다.
            String rawResponse = koreanApiWebClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/search.do")
                            .queryParam("key", apiKey)
                            .queryParam("q", word)
                            .queryParam("req_type", "json")
                            .queryParam("method", "exact")
                            .build())
                    .retrieve()
                    .bodyToMono(String.class) // 응답을 String으로 받음
                    .block(); // 결과가 올 때까지 대기

            // [디버깅] API가 보낸 원본(Raw) 응답 문자열을 로그로 찍어봅니다.
            System.out.println("<<< API Raw Response: " + rawResponse);

            // String으로 받은 응답을 JsonNode로 직접 파싱합니다.
            JsonNode response = objectMapper.readTree(rawResponse);

            // 응답 구조를 파싱하여, 'total' 값이 0보다 큰지 확인
            if (response != null && response.has("channel") &&
                    response.get("channel").has("total") &&
                    response.get("channel").get("total").asInt() > 0) {

                return true; // 검색 결과가 있음 (표준어)
            }

            return false; // 검색 결과가 없음 (total: 0)

        } catch (Exception e) {
            // [중요] 어떤 에러가 발생했는지 로그를 찍습니다.
            System.err.println("!!! 국립국어원 API 호출 실패: " + e.getMessage());
            e.printStackTrace(); // 에러 상세 내용을 콘솔에 출력

            return false;
        }
    }
}