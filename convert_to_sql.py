# convert_to_sql.py (INSERT IGNORE 버전)

import csv
import re

# --- 설정 ---
input_filename = "korean_words.csv"
output_filename = "db-init/words.sql"
table_name = "dictionary"
column_name = "name"
target_pos = '명'
batch_size = 1000
# ------------

values = []
word_set = set()

print(f"'{input_filename}' CSV 파일을 읽어 '{output_filename}' 파일로 변환을 시작합니다...")

try:
    with open(input_filename, 'r', encoding='utf-8') as infile, \
            open(output_filename, 'w', encoding='utf-8') as outfile:

        reader = csv.reader(infile)
        next(reader) # 헤더 건너뛰기

        # CREATE TABLE 구문 추가
        outfile.write(f"""CREATE TABLE IF NOT EXISTS {table_name} (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    {column_name} VARCHAR(100) NOT NULL UNIQUE,
    INDEX idx_name ({column_name})
);\n""")

        for row in reader:
            try:
                word_raw = row[1].strip()
                pos = row[2].strip()

                if target_pos and pos != target_pos:
                    continue

                word_cleaned = re.sub(r'\d+$', '', word_raw)
                word_lower = word_cleaned.lower().strip()

                if not word_lower or len(word_lower) > 100 or word_lower in word_set:
                    continue

                word_set.add(word_lower)
                word_escaped = word_cleaned.replace("'", "''")
                values.append(f"('{word_escaped}')")

                if len(values) >= batch_size:
                    # [!!! 여기가 수정되었습니다 !!!]
                    outfile.write(f"INSERT IGNORE INTO {table_name} ({column_name}) VALUES {','.join(values)};\n")
                    values = []

            except IndexError:
                pass

        # 남은 단어들 처리
        if values:
            # [!!! 여기도 수정되었습니다 !!!]
            outfile.write(f"INSERT IGNORE INTO {table_name} ({column_name}) VALUES {','.join(values)};\n")

    print(f"변환 완료! (총 {len(word_set)}개의 고유한 '{target_pos}' 단어) '{output_filename}' 파일이 생성되었습니다.")
    print("이 파일을 'db-init' 폴더로 옮기고 도커를 재시작하세요.")

except FileNotFoundError:
    print(f"오류: '{input_filename}' 파일을 찾을 수 없습니다.")
except Exception as e:
    print(f"오류 발생: {e}")