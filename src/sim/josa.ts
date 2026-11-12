/**
 * Korean particles (조사) chosen by the final consonant of the preceding word,
 * so messages read "징집병 무리가", "장궁대가", "드워프 방패병이" instead of "무리이(가)".
 */
export type JosaPair = '이/가' | '을/를' | '은/는' | '와/과' | '으로/로' | '이에요/예요';

/** true = ends with a final consonant (받침), false = vowel, null = unknown script. */
export function hasFinal(word: string): boolean | null {
  const ch = word.trim().replace(/[)\]」』"'”’.!?\s]+$/u, '').slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // digits read in Sino-Korean: 영 일 이 삼 사 오 육 칠 팔 구
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  if (/[a-z]/i.test(ch)) return /[lmnr]/i.test(ch);
  return null;
}

function finalIsRieul(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 8;
  return '178'.includes(ch) || /l/i.test(ch);
}

/** Return just the particle for `word`. */
export function particle(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = pair.split('/');
  const f = hasFinal(word);
  if (pair === '으로/로') return f && !finalIsRieul(word) ? '으로' : '로';
  if (f === null) return withoutFinal; // best effort for unknown scripts
  return f ? withFinal : withoutFinal;
}

/** Word followed by the right particle, e.g. josa('장궁대', '이/가') === '장궁대가'. */
export function josa(word: string, pair: JosaPair): string {
  return word + particle(word, pair);
}
