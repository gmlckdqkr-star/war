# 디자인 자료 (게임 빌드에는 들어가지 않음)

- `DESIGN_BIBLE.md` — 최종 방향 '잿빛 연대기 — 살아 있는 판화'(연대기 + 축경·잿불 장점 접목)의 세계, 캠페인, 반응형 이야기, 맵 10곳, 전투 유형 10종, 아트 규격, 품질 기준.
- `ROADMAP.md` — P0–P7 작업 단위(WP), 담당 파일, 합격 기준, 일정.
- `research/quality_bar.md` — 참고 수준 품질 기준 조사. `tech/envelope.md` — 폰 성능 예산 실측.
- `chronicle/`, `diorama/`, `ember/` — 아트 방향 시안 3종의 코드 프로토타입. `proto.html`을 브라우저로 열면 바로 돌아간다.
  `chronicle/build.cjs`는 `src/*`로 `proto.html`을 다시 만든다(고운바탕 원본 TTF가 `chronicle/font/`에 있어야 하며, 저장소에는 SIL OFL 1.1 부분 집합 woff2만 둔다).
- `shots/` — 시안 화면 (실제 폰 가로 화면 기준, 축소본).
- `rev2/` — 팔레트 색차(ΔE2000) 검사 스크립트.

모든 그림은 코드로 그린 것이며 외부 이미지·글꼴은 OFL 글꼴 외에 없다.
