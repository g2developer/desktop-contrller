/**
 * users.js
 * 사용자 관리 관련 기능
 */

const { ipcRenderer } = require('electron');
const { showToast } = require('../ui/toast');
const { showModal, closeModal, showConfirmModal } = require('../ui/modal');

// DOM 요소
let userList, addUserBtn;
let modalTitle, modalBody, modalConfirmBtn;

// 상태 변수
let currentUsers = [];

/**
 * 사용자 관련 DOM 요소 초기화
 */
function initUserElements() {
  userList = document.getElementById('user-list');
  addUserBtn = document.getElementById('add-user-btn');
  modalTitle = document.getElementById('modal-title');
  modalBody = document.getElementById('modal-body');
  modalConfirmBtn = document.getElementById('modal-confirm-btn');
  
  // 이벤트 리스너 설정
  addUserBtn.addEventListener('click', showAddUserModal);
}

/**
 * 사용자 목록 로드
 */
function loadUsers() {
  ipcRenderer.send('get-users');
  
  // 사용자 리스트가 로드되기 전 로딩 메시지 표시
  userList.innerHTML = '<div class="empty-list-message">사용자 데이터를 불러오는 중...</div>';
}

/**
 * 사용자 목록 업데이트
 * @param {Array} users 사용자 목록
 */
function updateUserList(users) {
  // 사용자 데이터 업데이트
  currentUsers = users;
  
  // 사용자 목록 UI 업데이트
  userList.innerHTML = '';
  
  if (users.length === 0) {
    // 사용자가 없는 경우
    userList.innerHTML = '<div class="empty-list-message">등록된 사용자가 없습니다</div>';
  } else {
    // 사용자 목록 생성
    users.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      
      const idCol = document.createElement('div');
      idCol.className = 'user-col id';
      idCol.textContent = user.id;
      
      const nameCol = document.createElement('div');
      nameCol.className = 'user-col name';
      nameCol.textContent = user.name;
      
      const roleCol = document.createElement('div');
      roleCol.className = 'user-col role';
      
      const roleSpan = document.createElement('span');
      roleSpan.className = `role-badge ${user.role}`;
      roleSpan.textContent = user.role === 'admin' ? '관리자' : '일반 사용자';
      
      roleCol.appendChild(roleSpan);
      
      const statusCol = document.createElement('div');
      statusCol.className = 'user-col status';
      
      const statusSpan = document.createElement('span');
      statusSpan.className = `status-badge ${user.active ? 'active' : 'inactive'}`;
      statusSpan.textContent = user.active ? '활성' : '비활성';
      
      statusCol.appendChild(statusSpan);
      
      const actionsCol = document.createElement('div');
      actionsCol.className = 'user-col actions';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon';
      editBtn.title = '수정';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
      editBtn.addEventListener('click', () => {
        editUser(user);
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon';
      deleteBtn.title = '삭제';
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      deleteBtn.addEventListener('click', () => {
        deleteUser(user.id);
      });
      
      actionsCol.appendChild(editBtn);
      actionsCol.appendChild(deleteBtn);
      
      userItem.appendChild(idCol);
      userItem.appendChild(nameCol);
      userItem.appendChild(roleCol);
      userItem.appendChild(statusCol);
      userItem.appendChild(actionsCol);
      
      userList.appendChild(userItem);
    });
  }
}

/**
 * 사용자 모달 표시
 */
function showAddUserModal() {
  // 모달 제목 설정
  modalTitle.textContent = '사용자 추가';
  
  // 모달 내용 생성
  const content = `
    <div class="form-group">
      <label for="user-id">아이디</label>
      <input type="text" id="user-id" class="form-control" placeholder="사용자 아이디">
    </div>
    <div class="form-group">
      <label for="user-name">이름</label>
      <input type="text" id="user-name" class="form-control" placeholder="사용자 이름">
    </div>
    <div class="form-group">
      <label for="user-password">비밀번호</label>
      <input type="password" id="user-password" class="form-control" placeholder="비밀번호">
    </div>
    <div class="form-group">
      <label for="user-role">권한</label>
      <select id="user-role" class="form-control">
        <option value="admin">관리자</option>
        <option value="user" selected>일반 사용자</option>
      </select>
    </div>
  `;
  
  // 모달 내용 설정
  modalBody.innerHTML = content;
  
  // 모달 푸터 버튼 이벤트 설정
  modalConfirmBtn.textContent = '추가';
  modalConfirmBtn.onclick = () => {
    // 사용자 정보 가져오기
    const userId = document.getElementById('user-id').value;
    const userName = document.getElementById('user-name').value;
    const userPassword = document.getElementById('user-password').value;
    const userRole = document.getElementById('user-role').value;
    
    // 필수 입력 확인
    if (!userId || !userName || !userPassword) {
      showToast('모든 필수 항목을 입력해 주세요.', 'error');
      return;
    }
    
    // 사용자 추가 요청
    ipcRenderer.send('add-user', {
      id: userId,
      name: userName,
      password: userPassword,
      role: userRole
    });
    
    // 모달 닫기
    closeModal();
    
    // 토스트 메시지 표시
    showToast('사용자 추가 요청 중...', 'info');
  };
  
  // 모달 표시
  showModal();
}

/**
 * 사용자 수정
 * @param {Object} user 사용자 정보
 */
function editUser(user) {
  // 모달 제목 설정
  modalTitle.textContent = '사용자 수정';
  
  // 모달 내용 생성
  const content = `
    <div class="form-group">
      <label for="user-id">아이디</label>
      <input type="text" id="user-id" class="form-control" value="${user.id}" readonly>
    </div>
    <div class="form-group">
      <label for="user-name">이름</label>
      <input type="text" id="user-name" class="form-control" value="${user.name}">
    </div>
    <div class="form-group">
      <label for="user-password">비밀번호 (변경 시에만 입력)</label>
      <input type="password" id="user-password" class="form-control" placeholder="비밀번호">
    </div>
    <div class="form-group">
      <label for="user-role">권한</label>
      <select id="user-role" class="form-control">
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>관리자</option>
        <option value="user" ${user.role === 'user' ? 'selected' : ''}>일반 사용자</option>
      </select>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="user-active" ${user.active ? 'checked' : ''}>
        <span>활성화</span>
      </label>
    </div>
  `;
  
  // 모달 내용 설정
  modalBody.innerHTML = content;
  
  // 모달 푸터 버튼 이벤트 설정
  modalConfirmBtn.textContent = '저장';
  modalConfirmBtn.onclick = () => {
    // 사용자 정보 가져오기
    const userId = document.getElementById('user-id').value;
    const userName = document.getElementById('user-name').value;
    const userPassword = document.getElementById('user-password').value;
    const userRole = document.getElementById('user-role').value;
    const userActive = document.getElementById('user-active').checked;
    
    // 필수 입력 확인
    if (!userName) {
      showToast('이름을 입력해 주세요.', 'error');
      return;
    }
    
    // 수정할 사용자 정보
    const userData = {
      name: userName,
      role: userRole,
      active: userActive
    };
    
    // 비밀번호가 입력된 경우에만 추가
    if (userPassword) {
      userData.password = userPassword;
    }
    
    // 사용자 수정 요청
    ipcRenderer.send('update-user', { userId, userData });
    
    // 모달 닫기
    closeModal();
    
    // 토스트 메시지 표시
    showToast('사용자 정보 업데이트 중...', 'info');
  };
  
  // 모달 표시
  showModal();
}

/**
 * 사용자 삭제
 * @param {string} userId 사용자 ID
 */
function deleteUser(userId) {
  // 사용자 삭제 전 확인
  showConfirmModal(
    '사용자 삭제',
    `사용자 ID: ${userId}를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`,
    () => {
      ipcRenderer.send('delete-user', userId);
      showToast('사용자 삭제 중...', 'info');
    }
  );
}

module.exports = {
  initUserElements,
  loadUsers,
  updateUserList,
  showAddUserModal,
  editUser,
  deleteUser
};
