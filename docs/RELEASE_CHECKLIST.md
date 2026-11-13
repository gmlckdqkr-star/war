# 출시 체크리스트

## 상태 구분

| 항목 | 상태 | 근거 |
|---|---|---|
| 전투 시뮬레이션·AI·10개 성·일일·무한 모드 | **테스트됨** | `npm test` 136개 통과(`wp-gameplay`), 밸런스 봇 일반 자동·수동 12시드 전부 완주(수동 21.0전투, 자동 13.6). 어려움 수동은 4시드 중 1개가 9성에서 막힘 → [플레이테스트 보고서](PLAYTEST_REPORT.md) |
| 휴대폰 화면 UI·터치 조작 | **테스트됨 (헤드리스 Chromium, 844×390 터치)** | `npm run e2e` 79개 PASS, 약 60 fps, 병사 표시·터치 정밀도·작전 회의·이어하기 포함 |
| 저장·백업·손상 복구·저장 코드 | **테스트됨** | 단위 테스트 + E2E(손상 → 백업 복구) |
| 전투 이어하기(중단 전투 복원·포기) | **테스트됨 (웹)** | 단위 23개 + E2E. 15분 무한 전투 복원 4.1-7.7초. **Capacitor 일시정지 훅은 기기 미검증** |
| 가상 사용자 플레이테스트 (캐주얼·전략·QA) | **완료** | [PLAYTEST_REPORT.md](PLAYTEST_REPORT.md) — 지적 사항 대부분 수정·수치 확인, 남은 문제 목록 있음 |
| 웹 체험판 결제(테스트용 MockIAP) | **테스트됨** | E2E: 연대기·후원 구매 → 권한 부여 |
| 실제 스토어 결제 (`NativeIAP`, cordova-plugin-purchase v13) | **구현됨 · 미검증** | 스토어 계정·테스트 트랙이 있어야 검증 가능. 네이티브에서는 테스트 결제로 절대 대체되지 않음(플러그인 없으면 구매 비활성화), 플랫폼은 Capacitor로 판별(iPad 안전), 지난 시즌 패스 포함 전체 상품 등록·복원, 오프라인·취소·오류 한국어 안내 |
| 네이티브 보조 기능 (뒤로 가기, 글꼴 배율 고정, 저장 사본) | **구현됨 · 미검증** | `src/ui/native.ts`: 플러그인이 있을 때만 동작(기능 감지). 웹에서는 history 방식 뒤로 가기가 동작함(E2E) |
| Android/iOS 앱 포장 (Capacitor) | **설계됨** | `capacitor.config.json`만 준비. 클라우드 환경에 Android SDK 없음 |
| 실제 휴대폰 성능 | **미검증** | 데스크톱 Chromium: 시뮬 평균 0.13–0.25 ms/스텝(289유닛 최대 부하 0.64–0.67), E2E ~60 fps (휴대폰은 수 배 느림 추정) |

## 사용자가 직접 해야 하는 일 (대신 할 수 없음)

1. **개발자 계정**: Google Play Console(1회 등록비), Apple Developer Program(연회비).
2. **앱 ID 결정**: `capacitor.config.json`의 `appId`(현재 `com.example.ashenramparts`)를 본인 도메인 기반으로 변경.
3. **서명 키 생성·보관**: Android 업로드 키(keystore). 분실하면 업데이트 불가 → 안전한 곳에 백업.
4. **인앱 상품 등록** (모두 *비소모성*):
   - `supporter_small`, `supporter_large`, `bundle_castles`, `commander_kit`
   - `chronicle_s01` … `chronicle_s24` (시즌 프리미엄, 시즌 1 = 2026-12-01 시작, 6주 간격). 지난 시즌 상품도 **판매 중지만 하고 삭제하지 말 것**(구매 복원에 필요).
   - 상품 설명 예: "시즌 N 한정 외관 5종 영구 지급 + 시즌 훈장 보너스". 애플 심사 메모에 "구매한 외관은 영구 보유·복원 가능(비소모성)"이라고 적어 두면 기간제 상품 오해를 줄일 수 있음(추론).
5. **판매자 정보 입력**: `src/meta/legal.ts`의 `SELLER`(상호/이름, 문의 이메일, 해당 시 사업자·통신판매업 신고번호). 상점·설정 화면에 표시됨. 청약철회 제한 안내 문구는 이미 들어가 있음(법률 자문 아님, 추론).
6. **개인정보처리방침 URL**: 수집 항목 없음 문구로 충분 (아래 초안). 스토어 등록 시 필수.
7. **콘텐츠 등급 설문**: 판타지 전투 폭력(피 표현 있음, 도형 수준), 확률형 아이템 없음, 광고 없음.
8. **실기기 테스트**: 저가형 Android 1대 + iPhone 1대(+ 가능하면 iPad)에서 10분 플레이, 결제 테스트 트랙에서 구매→삭제→재설치→구매 복원, 비행기 모드에서 구매 복원(안내 문구 확인), 하드웨어 뒤로 가기, 시스템 글꼴 최대 크기.
   - 추가(플레이테스트에서 남은 항목): 전투 중 홈 버튼·앱 전환·강제 종료 후 "중단된 전투" 이어하기(Capacitor 일시정지 훅), 15분 이상 무한 전투 복원 시간, 터치 정밀도(깃발 14px 반경)와 전투 3배속 자동 가속 체감, 새 폰으로 기기 백업 이전.
9. **밸런스 재측정**: 시드를 늘려(6 → 20 이상) 일반·자동 곡선(s7 33%, s8 66%)과 어려움 s3·s8 튐이 잡음인지 확인. 수동 플레이 s4·s9는 `wp-gameplay`에서 처리(일반 수동 s4 첫 시도 58%, 막힘 0/12). 남은 것: 일반 수동 s6–s8, 어려움 s8(자동 평균 10회).
10. **판매자 정보·법적 고지 확인**: 한국 고지 문구는 들어가 있으나(QA 15번) 입력값과 문구의 법률 검토는 사용자 몫.
11. ~~**조사 점검**: '와/과' 쌍 매핑~~ — 고침, 단위 테스트로 확인됨.

## 앱으로 포장하기 (Android 기준, 개발 PC에서)

```bash
npm ci
npm run build
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android
npm i cordova-plugin-purchase @capacitor/app @capacitor/text-zoom @capacitor/preferences && npx cap sync android
# (@capacitor/app: 뒤로 가기 버튼, text-zoom: 시스템 글꼴 배율 무시, preferences: 저장 사본 → 기기 백업으로 새 폰에 이전)
# android/app/src/main/AndroidManifest.xml 의 MainActivity 에 가로 고정:
#   android:screenOrientation="sensorLandscape"
# android:allowBackup="true" 유지 (기기 백업으로 진행 상황 자동 이전)
npx cap open android   # Android Studio 에서 서명된 AAB 생성
```

iOS도 동일하게 `@capacitor/ios` → `npx cap add ios` → Xcode에서 가로 방향만 체크.

## 개인정보처리방침 초안

> 「잿빛 성벽」은 이용자의 개인정보를 수집·저장·전송하지 않습니다. 게임 진행 데이터는 이용자의 기기에만 저장되며,
> 광고·분석 도구를 사용하지 않습니다. 인앱 결제는 Google Play / App Store가 처리하며 개발자는 결제 정보를 받지 않습니다.
> 문의: (이메일 주소)

## 출시 후 운영

- 정기 작업 없음. 시즌·주간 진열·오늘의 공성은 날짜로 자동 회전.
- 2029년 하반기(시즌 24 종료) 이후 프리미엄 시즌을 계속하려면: 상품 ID 추가 등록 + `MAX_REGISTERED_SEASONS` 상향 업데이트 1회.
- 문의 대응 표준 답변: ① 상점/설정의 "구매 복원" ② 설정 → "저장 코드 복사/불러오기"(약 1,100자, 공유 버튼으로 나에게 보내기) ③ 설정 → "오류 기록 복사".
- 웹 버전을 공개 배포할 때 테스트 결제를 끄려면 `VITE_WEB_SHOP=off npm run build`.
