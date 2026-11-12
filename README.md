# 잿빛 성벽: 최후의 수비 (Ashen Ramparts)

휴대폰 가로 화면용 **대규모 공성 방어 전략 게임**. 인간·드워프·엘프·오크·용족의 물결로부터 성을 지킵니다.
사기·부상·보급·공성병기가 살아 있는 전장에서 분대는 스스로 싸우고, 플레이어는 큰 결정을 내립니다.

- 완전 오프라인, 서버·계정·광고·분석 SDK 없음
- 무료 + 비소모성(복원 가능) 상품만 판매, 전투력 판매 없음
- 런타임 의존성 0개, 빌드 JS 약 70KB(gzip)

## 실행

```bash
npm ci
npm run dev        # 개발 서버 (휴대폰에서 같은 Wi-Fi로 접속 가능)
npm run build      # 타입 검사 + 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 미리보기
```

## 검증

```bash
npm test                                   # 단위 테스트 (시뮬레이션·저장·상점·시즌)
npm run e2e                                # 휴대폰 화면 E2E (Playwright 필요, build 후 실행)
npx tsx scripts/balance.ts 1 normal 30     # 봇이 캠페인 전체를 플레이하며 밸런스 측정
npx tsx scripts/diag.ts s4 7               # 한 전투의 시간대별 상황 출력
```

## 구조

| 경로 | 내용 |
|---|---|
| `src/sim` | 결정적 전투 시뮬레이션 (DOM 없음, Node에서 실행 가능) |
| `src/meta` | 저장·진행·상점·시즌 패스·결제 어댑터 |
| `src/render` | Canvas 렌더러·카메라 |
| `src/ui` | 화면·전투 HUD·터치 입력·효과음 |
| `docs/` | 설계서, 수익 모델, 플레이테스트 보고서, 출시 체크리스트 |

자세한 내용: [게임 설계](docs/GAME_DESIGN.md) · [수익 모델](docs/MONETIZATION.md) · [플레이테스트](docs/PLAYTEST_REPORT.md) · [출시 체크리스트](docs/RELEASE_CHECKLIST.md)
