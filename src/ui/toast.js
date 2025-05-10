/**
 * toast.js
 * 토스트 메시지 관련 기능
 */

/**
 * 토스트 메시지 표시
 * @param {string} message 토스트 메시지
 * @param {string} type 토스트 유형 (info, success, error, warning)
 */
function showToast(message, type = 'info') {
  // 토스트 컨테이너 확인
  const toastContainer = document.getElementById('toast-container');
  
  // 토스트 아이템 생성
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // 토스트 내용
  const toastContent = document.createElement('div');
  toastContent.className = 'toast-content';
  toastContent.textContent = message;
  
  // 토스트 닫기 버튼
  const toastClose = document.createElement('button');
  toastClose.className = 'toast-close';
  toastClose.innerHTML = '&times;';
  toastClose.addEventListener('click', () => {
    toast.remove();
  });
  
  toast.appendChild(toastContent);
  toast.appendChild(toastClose);
  
  // 토스트 컨테이너에 추가
  toastContainer.appendChild(toast);
  
  // 토스트 자동 제거 (3초 후)
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

module.exports = {
  showToast
};
