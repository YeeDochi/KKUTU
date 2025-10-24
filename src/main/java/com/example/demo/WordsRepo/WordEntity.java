package com.example.demo.WordsRepo;

import jakarta.persistence.*; // [주의] javax.persistence가 아닐 수 있습니다.
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "dictionary", indexes = @Index(name = "idx_name", columnList = "name"))
public class WordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 단어 ID

    @Column(nullable = false, unique = true, length = 100)
    private String name; // 단어 (예: "사과")

}