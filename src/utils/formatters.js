/**
 * formatters.js
 * 날짜, 시간 등의 포맷 관련 유틸리티 함수
 */

/**
 * 날짜/시간 포맷
 * @param {string} dateTimeStr 날짜/시간 문자열
 * @returns {string} 포맷된 날짜/시간 문자열
 */
function formatDateTime(dateTimeStr) {
  try {
    const date = new Date(dateTimeStr);
    
    // 날짜가 유효하지 않은 경우
    if (isNaN(date.getTime())) {
      return dateTimeStr;
    }
    
    // 날짜 포맷
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (err) {
    console.error('날짜/시간 포맷 오류:', err);
    return dateTimeStr;
  }
}

module.exports = {
  formatDateTime
};
