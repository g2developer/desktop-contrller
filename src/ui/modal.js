/**
 * modal.js
 * 모달 관련 기능
 */

const { showToast } = require('./toast');

// DOM 요소
let modalContainer, modalTitle, modalBody, modalFooter, modalCancelBtn, modalConfirmBtn, modalCloseBtn;

/**
 * 모달 DOM 요소 초기화
 */
function initModalElements() {
  modalContainer = document.getElementById('modal-container');
  modalTitle = document.getElementById('modal-title');
  modalBody = document.getElementById('modal-body');
  modalFooter = document.getElementById('modal-footer');
  modalCancelBtn = document.getElementById('modal-cancel-btn');
  modalConfirmBtn = document.getElementById('modal-confirm-btn');
  modalCloseBtn = document.querySelector('.modal-close-btn');
  
  // 모달 닫기 버튼 이벤트 리스너
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
}

/**
 * 모달 표시
 */
function showModal() {
  modalContainer.classList.add('active');
  
  // 취소 버튼 표시 및 이벤트 초기화
  modalCancelBtn.style.display = 'block';
  modalCancelBtn.onclick = closeModal;
  
  // 확인 버튼 스타일 초기화
  modalConfirmBtn.className = 'btn primary';
  modalConfirmBtn.style.backgroundColor = '';
}

/**
 * 모달 닫기
 */
function closeModal() {
  modalContainer.classList.remove('active');
}

/**
 * 확인 모달 표시
 * @param {string} title 모달 제목
 * @param {string} message 모달 메시지
 * @param {Function} onConfirm 확인 버튼 클릭 시 실행할 함수
 */
function showConfirmModal(title, message, onConfirm) {
  // 모달 제목 설정
  modalTitle.textContent = title;
  
  // 모달 내용 생성
  const content = `<p>${message}</p>`;
  
  // 모달 내용 설정
  modalBody.innerHTML = content;
  
  // 모달 푸터 버튼 이벤트 설정
  modalConfirmBtn.textContent = '확인';
  modalConfirmBtn.onclick = () => {
    closeModal();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  };
  
  // 모달 표시
  showModal();
}

module.exports = {
  initModalElements,
  showModal,
  closeModal,
  showConfirmModal
};
