# 🐯 호구컷 (HoguCut) v2.2

> **국내 쇼핑몰 바가지 방지! 네이버·쿠팡 상품 링크나 캡처 사진만 올리면 알리익스프레스 실시간 직구가와 1초 만에 1:1 비교해 드립니다.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Version](https://img.shields.io/badge/Version-2.2-emerald.svg)](https://github.com)

---

## ✨ 핵심 기능

1. **1초 만에 국내가 vs 알리 직구가 1:1 비교**
   - 네이버 스마트스토어, 쿠팡, W컨셉 등 상품 링크 또는 캡처 사진 붙여넣기 지원
   - 알리익스프레스(AliExpress) 동일·유사 상품을 실시간 정밀 매칭

2. **직구 이득 지수 & AI 판정 소견서**
   - 직구 시 얼마를 아낄 수 있는지 직관적인 '이득 지수(%)' 및 절약 금액 산출
   - 단순 국내 사입인지, 중국 공장 출하 원형 제품의 '택갈이(상표갈이)' 의심 상품인지 판정

3. **알리 공식스토어 1:1 직결 & 최저가 낚시 옵션 원천 필터링**
   - 케이블만 포함된 저가 미끼 옵션이나 부속품 낚시를 알고리즘으로 자동 배제
   - 11.11 광군제 등 실시간 프로모션 행사가가 적용된 공식 플래그십 스토어 실구매가 직결

4. **앱 안의 인터넷 브라우저 (인앱 익스플로러)**
   - 평소처럼 네이버나 쿠팡에서 쇼핑하다가 [호구검사] 버튼만 누르면 화면 전환 없이 즉시 검사

5. **카카오톡 & SNS 원클릭 절약 공유**
   - 내가 아낀 금액과 직구 최저가 링크를 친구/가족에게 1초 만에 공유

6. **PWA (Progressive Web App) 완벽 지원**
   - 모바일 크롬/사파리에서 [홈 화면에 추가]로 네이티브 앱처럼 설치 가능
   - 구글 플레이스토어 / 원스토어 TWA(Trusted Web Activity) 출시 규격 준수

---

## 🛠️ 기술 스택 (Tech Stack)

* **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+), Tailwind CSS (CDN), FontAwesome
* **App Architecture**: Progressive Web App (PWA), Service Worker (`sw.js` v5.8)
* **Backend / Proxy**: Python 3.11 (`app_server.py`) & Vercel Edge Serverless Function (`api/fetch.js`)
* **Store Packaging**: Google TWA, Digital Asset Links (`.well-known/assetlinks.json`)

---

## 🚀 빠른 시작 가이드 (로컬 실행)

1. 저장소를 클론하거나 다운로드합니다.
2. `호구컷_실행하기.bat` 파일을 더블클릭합니다.
3. 브라우저에서 `http://localhost:8080` (PC) 또는 안내되는 `http://[내_IP]:8080` (스마트폰)으로 접속합니다.

---

## 📱 스토어 배포 안내

* 구글 플레이스토어 및 원스토어 등록용 상세 가이드와 개인정보처리방침은 [`store_release/`](store_release/) 디렉터리에서 확인하실 수 있습니다.

---

## 📄 라이선스

본 프로젝트는 [MIT License](LICENSE)에 따라 자유롭게 사용 및 배포할 수 있습니다.
