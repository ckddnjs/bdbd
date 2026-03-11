# 🎲 보드게임 동호회 웹사이트

GitHub + Vercel + Supabase 기반 보드게임 동호회 전용 웹사이트입니다.

---

## 📁 프로젝트 구조

```
boardgame-club/
├── src/
│   └── index.html          # 메인 앱 (단일 파일)
├── supabase/
│   └── schema.sql          # DB 스키마 + 샘플 데이터
└── README.md
```

---

## 🚀 셋업 순서

### 1. Supabase 프로젝트 생성

1. https://supabase.com 접속 → 새 프로젝트 생성
2. 프로젝트 생성 후 **Settings → API** 에서 아래 두 값 복사:
   - `Project URL` → `SUPABASE_URL`
   - `anon / public` key → `SUPABASE_KEY`

### 2. 데이터베이스 스키마 적용

1. Supabase 대시보드 → **SQL Editor** 클릭
2. `supabase/schema.sql` 파일 내용 전체 복사 후 붙여넣기
3. **Run** 클릭 → 테이블, 뷰, 샘플 데이터 자동 생성

### 3. index.html 설정 수정

`src/index.html` 파일에서 아래 부분을 수정합니다:

```javascript
// ⚙️  Supabase 설정 — 여기에 본인 값 입력
const SUPABASE_URL = 'YOUR_SUPABASE_URL';      // ← 실제 URL로 교체
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY'; // ← 실제 키로 교체

// 🔑 코드 설정
const MEMBER_CODE = 'bdbd';      // 일반 회원 입장 코드
const ADMIN_CODE  = 'admin1234'; // 관리자 코드 (반드시 변경!)
```

### 4. GitHub에 올리기

```bash
git init
git add .
git commit -m "init: 보드게임 동호회 웹사이트"
git remote add origin https://github.com/YOUR_USERNAME/boardgame-club.git
git push -u origin main
```

### 5. Vercel 배포

1. https://vercel.com → New Project
2. GitHub 레포 연결
3. **Root Directory**: `src` 로 설정
4. **Framework Preset**: Other
5. Deploy 클릭 → 자동 배포 완료!

---


---

## ✨ 주요 기능

### 🎲 게임 목록
- 게임 이미지, 이름, 인원, 시간, 장르, 난이도, 설명, 유튜브 링크, 대여여부, 등록일자
- **필터**: 장르 / 인원 / 난이도 / 대여가능 여부
- **정렬**: 최신순 / 인기순 / 인원 적은순 / 시간 짧은순 / 난이도 낮은순
- 카드 클릭 → 상세 모달 (한줄평 + 추천 버튼 포함)

### 📦 대여 서비스
- 이름 / 게임 선택 / 기간 입력 → 신청
- 대여 현황 테이블 실시간 표시
- 관리자: 반납 처리 버튼

### 📢 공지사항
- 중요 / 이벤트 / 일반 카테고리 구분

### ⚙️ 관리자 패널 (admin 코드 전용)
- 새 보드게임 등록 (이미지 URL 미리보기, 별점 난이도 선택)
- 공지사항 등록 / 삭제

---

## 🗄️ DB 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `games` | 보드게임 정보 |
| `reviews` | 한줄평 |
| `recommendations` | 추천(중복 방지) |
| `rentals` | 대여 기록 |
| `notices` | 공지사항 |
| `games_with_stats` | 게임 + 추천수 + 한줄평수 (뷰) |
