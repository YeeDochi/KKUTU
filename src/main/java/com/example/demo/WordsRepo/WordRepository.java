package com.example.demo.WordsRepo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface WordRepository extends JpaRepository<WordEntity, Long> {


    boolean existsByName(String name);
    @Query(value = "SELECT * FROM dictionary WHERE name LIKE :prefix% ORDER BY RAND() LIMIT 1",
            nativeQuery = true)
    Optional<WordEntity> findRandomWordStartingWith(@Param("prefix") String prefix);

}