# 🎯 스마트 OMR 채점기 (newomr)

이미지에서 OMR 마커와 답안 버블을 분석하는 **브라우저 기반 채점 도구**입니다. React·TypeScript UI와 HTML Canvas 기반 자체 영상 처리 코드를 사용하며, 마커 탐색과 답안 판독에 OpenCV를 사용하지 않습니다.

**[웹 데모](https://autoomr.mcv.kr/)**

## 주요 기능

- **마커 탐색:** 이미지의 TL(좌상), TR(우상), BR(우하), BL(좌하) 영역에서 흑백 이진화와 BFS 연결요소 탐색으로 후보를 구합니다.
- **3점 기반 정렬:** TL·TR·BR 마커가 검출되면 회전각과 수평·수직 길이를 계산해 **1414×1000px** 정규화 캔버스에 그립니다.
- **방향 보정 재시도:** 일부 마커가 빠진 경우 인식된 마커 배치에 따라 이미지를 회전한 후 다시 탐색합니다.
- **노이즈 필터링:** 연결요소 크기, 밀도(solidity), 가로세로 비율로 마커 후보를 평가합니다.
- **버블 판독:** 문항별 지정된 원 영역의 이진화 후 검은 픽셀 비율을 계산해 마킹을 판정합니다.
- **템플릿 편집:** Canvas 기반 답안 좌표 지정 및 편집, 결과 화면과 디버그 마커 표시를 제공합니다.

## 실제 정렬 방식과 제한

이 구현은 일반적인 **투영 변환(Homography)이나 사다리꼴 원근 보정이 아닙니다.** `src/utils/omrEngine.ts`의 `warpImage()`는 3개 기준점에서 구한 회전각과 축별 길이에 따라 캔버스를 변환합니다. 기울기와 크기 차이는 보정하지만, 비스듬한 촬영에서 발생하는 원근 왜곡을 항상 해결하지는 못합니다. 마커를 찾지 못하면 입력 이미지를 그대로 반환할 수 있으므로 **디버그 화면에서 정렬 상태를 확인**해야 합니다.

'Red Dropout'처럼 색상을 선택적으로 제거한다는 기존 설명은 검증 가능한 전용 색 분리 로직이 없어 제거했습니다. 현재 코드는 주로 밝기 임계값을 적용합니다.

## 실행 방법

Node.js와 npm이 설치된 환경에서:

```bash
npm install
npm run dev
```

프로덕션 빌드 및 정적 코드 검사:

```bash
npm run build
npm run lint
```

이 명령어는 저장소에 정의된 실행 방법이며, 이 문서 정리 작업에서 실제 실행한 테스트 결과를 뜻하지 않습니다.

## 주요 코드

| 파일 | 역할 |
|---|---|
| [`src/utils/omrEngine.ts`](src/utils/omrEngine.ts) | 임계값 처리, 마커 탐색, 3점 정렬, 버블 채점 |
| [`src/components/MappingCanvas.tsx`](src/components/MappingCanvas.tsx) | 템플릿 좌표 편집 |
| [`src/components/AlignmentEditor.tsx`](src/components/AlignmentEditor.tsx) | 정렬·배치 편집 UI |
| [`src/components/ResultsView.tsx`](src/components/ResultsView.tsx) | 채점 결과 화면 |
| [`src/App.tsx`](src/App.tsx) | 앱 상태와 화면 흐름 |

## 기술 스택

React 19 · TypeScript · Vite · Tailwind CSS · HTML Canvas API

## 후속 개선 후보

- 실제 카메라 촬영본의 원근 왜곡에 대한 **4점 Homography** 지원
- 마커 누락, 조명 변화, 다중 마킹 및 빈칸 사례를 포함하는 회귀 테스트
- 정렬 실패 시 원본 이미지로 계속 채점하지 않도록 명시적 오류 처리

이 저장소는 [autoomr](https://github.com/Transient-Onlooker/autoomr) 이후 개발한 버전입니다.
