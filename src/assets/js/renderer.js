// 전역 변수 및 상태
let users = [];
let currentUserIndex = -1;
let isEditing = false;
let commandHistory = [];

// DOM 요소
document.addEventListener('DOMContentLoaded', () => {
  // 탭 전환 기능
  const tabLinks = document.querySelectorAll('nav a');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // 활성 탭 변경
      tabLinks.forEach(link => link.classList.remove('active'));
      e.target.classList.add('active');
      
      // 탭 콘텐츠 변경
      const tabId = e.target.getAttribute('data-tab');
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
    });
  });
  
  // 사용자 관련 기능
  const addUserBtn = document.getElementById('add-user-btn');
  const userModal = document.getElementById('user-modal');
  const userForm = document.getElementById('user-form');
  const closeBtn = document.querySelector('.close');
  const cancelBtn = document.querySelector('.btn.cancel');
  
  // 모달 열기
  addUserBtn.addEventListener('click', () => {
    document.getElementById('modal-title').textContent = '사용자 추가';
    document.getElementById('user-id').value = '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-id').disabled = false;
    isEditing = false;
    currentUserIndex = -1;
    userModal.style.display = 'block';
  });
  
  // 모달 닫기
  function closeModal() {
    userModal.style.display = 'none';
  }
  
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  window.addEventListener('click', (e) => {
    if (e.target === userModal) {
      closeModal();
    }
  });
  
  // 사용자 폼 제출
  userForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const userData = {
      id: document.getElementById('user-id').value,
      password: document.getElementById('user-password').value,
      createdAt: new Date().toISOString()
    };
    
    if (isEditing && currentUserIndex >= 0) {
      // 사용자 수정
      userData.createdAt = users[currentUserIndex].createdAt;
      window.electronAPI.updateUser(currentUserIndex, userData);
    } else {
      // 사용자 추가
      window.electronAPI.addUser(userData);
    }
    
    closeModal();
  });
  
  // 사용자 목록 불러오기
  window.electronAPI.getUsers();
  
  // 사용자 목록 이벤트 리스너
  window.electronAPI.onUsersData((data) => {
    users = data;
    renderUsersList();
  });
  
  // 클라이언트 업데이트 이벤트 리스너
  window.electronAPI.onClientsUpdate((clients) => {
    renderClientsList(clients);
  });
  
  // 명령 실행 이벤트 리스너
  window.electronAPI.onCommandExecuted((data) => {
    commandHistory.unshift(data);
    renderCommandsList();
  });
});

// 사용자 목록 렌더링
function renderUsersList() {
  const usersList = document.getElementById('users-list');
  usersList.innerHTML = '';
  
  users.forEach((user, index) => {
    const tr = document.createElement('tr');
    
    const tdId = document.createElement('td');
    tdId.textContent = user.id;
    
    const tdCreatedAt = document.createElement('td');
    tdCreatedAt.textContent = new Date(user.createdAt).toLocaleString();
    
    const tdActions = document.createElement('td');
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', () => editUser(index));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn danger';
    deleteBtn.textContent = '삭제';
    deleteBtn.style.marginLeft = '8px';
    deleteBtn.addEventListener('click', () => deleteUser(index));
    
    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);
    
    tr.appendChild(tdId);
    tr.appendChild(tdCreatedAt);
    tr.appendChild(tdActions);
    
    usersList.appendChild(tr);
  });
}

// 클라이언트 목록 렌더링
function renderClientsList(clients) {
  const clientsList = document.getElementById('clients-list');
  clientsList.innerHTML = '';
  
  clients.forEach(client => {
    const tr = document.createElement('tr');
    
    const tdId = document.createElement('td');
    tdId.textContent = client.username || '인증 안됨';
    
    const tdStatus = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${client.authenticated ? 'online' : 'idle'}`;
    statusBadge.textContent = client.authenticated ? '인증됨' : '인증 대기중';
    tdStatus.appendChild(statusBadge);
    
    const tdConnectTime = document.createElement('td');
    tdConnectTime.textContent = new Date(client.connectTime).toLocaleString();
    
    const tdLastCommand = document.createElement('td');
    // 해당 클라이언트의 가장 최근 명령 찾기
    const lastCommand = commandHistory.find(cmd => cmd.clientId === client.id);
    tdLastCommand.textContent = lastCommand ? lastCommand.command : '-';
    
    tr.appendChild(tdId);
    tr.appendChild(tdStatus);
    tr.appendChild(tdConnectTime);
    tr.appendChild(tdLastCommand);
    
    clientsList.appendChild(tr);
  });
}

// 명령 이력 렌더링
function renderCommandsList() {
  const commandsList = document.getElementById('commands-list');
  commandsList.innerHTML = '';
  
  commandHistory.forEach(cmd => {
    const li = document.createElement('li');
    
    const commandInfo = document.createElement('div');
    commandInfo.className = 'command-info';
    
    const commandUser = document.createElement('span');
    commandUser.className = 'command-user';
    commandUser.textContent = cmd.username;
    
    const commandTimestamp = document.createElement('span');
    commandTimestamp.className = 'command-timestamp';
    commandTimestamp.textContent = new Date(cmd.timestamp).toLocaleString();
    
    commandInfo.appendChild(commandUser);
    commandInfo.appendChild(commandTimestamp);
    
    const commandText = document.createElement('div');
    commandText.className = 'command-text';
    commandText.textContent = cmd.command;
    
    li.appendChild(commandInfo);
    li.appendChild(commandText);
    
    commandsList.appendChild(li);
  });
}

// 사용자 수정
function editUser(index) {
  const user = users[index];
  
  document.getElementById('modal-title').textContent = '사용자 수정';
  document.getElementById('user-id').value = user.id;
  document.getElementById('user-password').value = user.password;
  document.getElementById('user-id').disabled = true;
  
  isEditing = true;
  currentUserIndex = index;
  
  document.getElementById('user-modal').style.display = 'block';
}

// 사용자 삭제
function deleteUser(index) {
  if (confirm('정말로 이 사용자를 삭제하시겠습니까?')) {
    window.electronAPI.deleteUser(index);
  }
}
