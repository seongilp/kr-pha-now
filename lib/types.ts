/** 약국 한 곳. 빌드 타임에 구운 타일 파일에 이 형태로 들어간다.
 *
 * 키를 한 글자로 줄인 것은 취향이 아니라 용량 때문이다 — 전국 25,415곳을
 * 타일로 나눠 클라이언트에 그대로 내려보내므로, 키 이름이 레코드마다 반복된다.
 */
export interface Pharmacy {
  /** hpid. 국립중앙의료원이 부여한 기관 식별자. */
  i: string;
  /** 약국명 */
  n: string;
  /** 주소 */
  a: string;
  /** 대표전화 */
  t: string;
  /** 위도 (WGS84) */
  y: number;
  /** 경도 (WGS84) */
  x: number;
  /**
   * 요일별 운영시간. 인덱스 0..7 = 월화수목금토일공휴일.
   * 각 칸은 [시작, 종료] 을 분 단위로 담거나, 정보가 없으면 null.
   *
   * 종료가 시작보다 작으면 자정을 넘긴다 (예: 0900~0100).
   */
  h: (readonly [number, number] | null)[];
}

/** 영업 판정. "모름"을 "닫힘"과 절대 합치지 않는다. */
export type OpenStatus = 'open' | 'closed' | 'unknown';
