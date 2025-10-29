package com.example.demo.Controller;
import com.example.demo.WordsRepo.WordEntity; // WordEntity 경로 확인
import com.example.demo.WordsRepo.WordRepository; // WordRepository 경로 확인
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/test/db")
@RequiredArgsConstructor
public class DbTestController {

    private final WordRepository wordRepository;

    /**
     * 특정 글자로 시작하는 단어를 DB에서 직접 조회하는 테스트 API
     * 예: /api/test/db/과
     */
    @GetMapping("/{startLetter}")
    public List<String> findWordsStartingWith(@PathVariable String startLetter) {
        System.out.println("--- [API TEST] Received request for letter: [" + startLetter + "] ---");
        List<WordEntity> results = wordRepository.findTop5ByNameStartingWith(startLetter);
        System.out.println("--- [API TEST] JPA Result Count: " + results.size() + " ---");

        // 결과 리스트에서 단어 이름(String)만 추출하여 반환
        return results.stream()
                .map(WordEntity::getName)
                .collect(Collectors.toList());
    }
}