/**
 * Purchase notices shown in the shop, the chronicle and settings.
 * SELLER must be filled in by the publisher before store release (see docs/RELEASE_CHECKLIST.md).
 * Empty fields are simply not shown.
 */
export const SELLER = {
  /** 상호 또는 개발자 이름 */
  name: '',
  /** 문의 이메일 */
  contact: '',
  /** 사업자등록번호 / 통신판매업 신고번호 (해당 시) */
  bizNo: '',
};

export const REFUND_NOTICE =
  '모든 상품은 구매 즉시 지급되는 디지털 콘텐츠로, 지급 후에는 청약철회가 제한될 수 있습니다. 결제와 환불은 각 앱 스토어(Google Play·App Store)의 정책에 따릅니다. 미성년자가 법정대리인의 동의 없이 결제한 경우 취소를 요청할 수 있습니다. 확률형 상품은 없습니다.';

export function sellerLine(): string {
  const parts = [SELLER.name && `판매자: ${SELLER.name}`, SELLER.bizNo, SELLER.contact && `문의: ${SELLER.contact}`].filter(Boolean);
  return parts.join(' · ');
}
