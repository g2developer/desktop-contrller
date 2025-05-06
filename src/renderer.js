// renderer.js
// Electron과 통신하기 위한 IPC 모듈 가져오기
const { ipcRenderer } = require('electron');

// 한글 처리를 위한 인코딩 설정
document.characterSet = 'UTF-8';

// DOM이 로드되었을 때 초기화 함수 실행
document.addEventListener('DOMContentLoaded', () => {
  // 초기화 함수들 호출
  initTabs();
  initModals();
  initServerControls();
  initUserManagement();
  initSettingsForm();
  initCaptureControls();
  initCommandHistory();
  
  // 서버 정보 요청
  requestServerInfo();
  
  // 주기적으로 연결된 클라이언트 정보 업데이트
  setInterval(updateClientsInfo, 5000);
  
  // 활동 로그 업데이트
  updateActivityLog();
  
  // 서버 상태 업데이트 구독
  subscribeToServerStatus();
});

// 탭 전환 기능 초기화
function initTabs() {
  const navLinks = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.querySelector('.page-title');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // 활성 탭 클래스 제거
      navLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));
      
      // 클릭된 탭 활성화
      link.classList.add('active');
      const tabId = link.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // 페이지 제목 업데이트
      pageTitle.textContent = link.textContent.trim();
    });
  });
}

// 모달 창 제어 초기화
function initModals() {
  // 사용자 추가/수정 모달
  const userModal = document.getElementById('user-modal');
  const addUserBtn = document.getElementById('add-user-btn');
  const saveUserBtn = document.getElementById('save-user');
  const cancelUserBtn = document.getElementById('cancel-user');
  const closeUserModalBtn = userModal.querySelector('.modal-close');
  
  // 모달 열기 - 사용자 추가
  addUserBtn.addEventListener('click', () => {
    // 모달 제목 설정
    document.getElementById('modal-title').textContent = '사용자 추가';
    // 폼 초기화
    document.getElementById('user-form').reset();
    // ID 입력란 활성화 (새 사용자)
    document.getElementById('user-id').disabled = false;
    // 모달 표시
    userModal.classList.add('show');
  });
  
  // 모달 닫기 버튼들
  [closeUserModalBtn, cancelUserBtn].forEach(btn => {
    btn.addEventListener('click', () => {
      userModal.classList.remove('show');
    });
  });
  
  // 사용자 저장 버튼
  saveUserBtn.addEventListener('click', () => {
    const userId = document.getElementById('user-id').value;
    const userName = document.getElementById('user-name').value;
    const userPassword = document.getElementById('user-password').value;
    const userPasswordConfirm = document.getElementById('user-password-confirm').value;
    
    // 입력 검증
    if (!userId || !userName) {
      alert('아이디와 이름을 입력해주세요.');
      return;
    }
    
    // 비밀번호 입력 시에만 일치 여부 확인
    if (userPassword && userPassword !== userPasswordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    // 사용자 데이터 생성
    const userData = {
      id: userId,
      name: userName
    };
    
    // 비밀번호가 입력된 경우에만 추가
    if (userPassword) {
      userData.password = userPassword;
    }
    
    // 모달 제목으로 추가 또는 수정 구분
    const isEdit = document.getElementById('modal-title').textContent.includes('수정');
    
    // IPC를 통해 메인 프로세스로 데이터 전송
    if (isEdit) {
      // 수정 시에는 userID와 userData를 분리하여 전송
      ipcRenderer.send('update-user', { id: userId, userData });
    } else {
      ipcRenderer.send('add-user', userData);
    }
    
    // 모달 닫기
    userModal.classList.remove('show');
    console.log('사용자 저장 요청 전송:', isEdit ? '수정' : '추가', userData);
  });
  
  // 명령 결과 모달
  const resultModal = document.getElementById('command-result-modal');
  const closeResultModalBtn = resultModal.querySelector('.modal-close');
  
  closeResultModalBtn.addEventListener('click', () => {
    resultModal.classList.remove('show');
  });
}

// 서버 제어 초기화
function initServerControls() {
  const startServerBtn = document.getElementById('start-server-btn');
  const serverActionText = document.getElementById('server-action-text');
  const refreshBtn = document.getElementById('refresh-btn');
  
  // 서버 시작/종료 버튼
  startServerBtn.addEventListener('click', () => {
    const isRunning = startServerBtn.getAttribute('data-running') === 'true';
    
    if (isRunning) {
      // 서버 종료 요청
      ipcRenderer.send('stop-server');
      startServerBtn.setAttribute('data-running', 'false');
      serverActionText.textContent = '서버 시작';
    } else {
      // 서버 시작 요청
      ipcRenderer.send('start-server');
      startServerBtn.setAttribute('data-running', 'true');
      serverActionText.textContent = '서버 종료';
    }
  });
  
  // 새로고침 버튼
  refreshBtn.addEventListener('click', () => {
    updateClientsInfo();
    updateActivityLog();
  });
  
  // 서버 포트 복사 버튼
  const copyUrlBtn = document.getElementById('copy-url-btn');
  copyUrlBtn.addEventListener('click', () => {
    const connectionUrl = document.getElementById('connection-url').value;
    navigator.clipboard.writeText(connectionUrl).then(() => {
      // 복사 성공 표시
      copyUrlBtn.textContent = '복사됨';
      setTimeout(() => {
        copyUrlBtn.textContent = '복사';
      }, 2000);
    });
  });
}

// 사용자 관리 초기화
function initUserManagement() {
  // 사용자 리스트 업데이트
  function updateUsersList() {
    // 사용자 목록 요청
    ipcRenderer.send('get-users');
  }
  
  // 사용자 목록 받기
  ipcRenderer.on('users-list', (event, users) => {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';
    
    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.name}</td>
        <td>${user.lastLogin || '-'}</td>
        <td><span class="table-status ${user.active ? 'status-online' : 'status-offline'}">${user.active ? '활성' : '비활성'}</span></td>
        <td>
          <button class="btn btn-outline btn-sm edit-user" data-id="${user.id}">수정</button>
          <button class="btn btn-outline btn-sm delete-user" data-id="${user.id}">삭제</button>
        </td>
      `;
      
      usersList.appendChild(row);
    });
    
    // 사용자 수정 버튼 이벤트 추가
    document.querySelectorAll('.edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-id');
        editUser(userId);
      });
    });
    
    // 사용자 삭제 버튼 이벤트 추가
    document.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-id');
        deleteUser(userId);
      });
    });
  });
  
  // 사용자 수정 함수
  function editUser(userId) {
    // 해당 사용자 정보 요청
    ipcRenderer.send('get-user', userId);
    
    // 사용자 정보 수신
    ipcRenderer.once(`user-data-${userId}`, (event, userData) => {
      const userModal = document.getElementById('user-modal');
      document.getElementById('modal-title').textContent = '사용자 수정';
      
      // 폼에 사용자 정보 채우기
      document.getElementById('user-id').value = userData.id;
      document.getElementById('user-id').disabled = true; // ID는 수정 불가
      document.getElementById('user-name').value = userData.name;
      document.getElementById('user-password').value = ''; // 비밀번호는 표시하지 않음
      document.getElementById('user-password-confirm').value = '';
      
      // 모달 표시
      userModal.classList.add('show');
    });
  }
  
  // 사용자 삭제 함수
  function deleteUser(userId) {
    if (confirm(`사용자 '${userId}'를 삭제하시겠습니까?`)) {
      ipcRenderer.send('delete-user', userId);
    }
  }
  
  // 페이지 로드 시 사용자 목록 업데이트
  updateUsersList();
  
  // 사용자 변경 후 목록 업데이트
  ipcRenderer.on('user-updated', updateUsersList);
  ipcRenderer.on('user-added', updateUsersList);
  ipcRenderer.on('user-deleted', updateUsersList);
}

// 설정 폼 초기화
function initSettingsForm() {
  const saveSettingsBtn = document.getElementById('save-settings');
  const resetSettingsBtn = document.getElementById('reset-settings');
  const browseBtn = document.getElementById('browse-btn');
  
  // 설정 저장 버튼
  saveSettingsBtn.addEventListener('click', () => {
    // 서버 설정
    const serverSettings = {
      port: parseInt(document.getElementById('server-port-input').value),
      timeout: parseInt(document.getElementById('timeout').value),
      autoStart: document.getElementById('auto-start').checked
    };
    
    // 클로드 앱 설정
    const claudeSettings = {
      path: document.getElementById('claude-path').value,
      autoLaunch: document.getElementById('auto-launch').checked,
      autoCaptureAfter: document.getElementById('auto-capture-after').checked,
      captureDelay: parseInt(document.getElementById('capture-delay').value)
    };
    
    // 보안 설정
    const securitySettings = {
      sessionTimeout: parseInt(document.getElementById('session-timeout').value),
      passwordPolicy: {
        minLength: document.getElementById('pwd-length').checked,
        requireNumbers: document.getElementById('pwd-numbers').checked,
        requireSpecial: document.getElementById('pwd-special').checked
      },
      loginAttempts: parseInt(document.getElementById('login-attempts').value)
    };
    
    // 설정 저장 요청
    ipcRenderer.send('save-settings', {
      server: serverSettings,
      claude: claudeSettings,
      security: securitySettings
    });
    
    // 저장 완료 메시지
    alert('설정이 저장되었습니다.');
  });
  
  // 설정 초기화 버튼
  resetSettingsBtn.addEventListener('click', () => {
    if (confirm('설정을 초기값으로 되돌리시겠습니까?')) {
      ipcRenderer.send('reset-settings');
    }
  });
  
  // 클로드 앱 경로 찾기 버튼
  browseBtn.addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
  });
  
  // 파일 경로 선택 결과 처리
  ipcRenderer.on('selected-file', (event, path) => {
    document.getElementById('claude-path').value = path;
  });
  
  // 설정 로드 요청
  ipcRenderer.send('get-settings');
  
  // 설정 데이터 수신
  ipcRenderer.on('settings-data', (event, settings) => {
    // 서버 설정
    document.getElementById('server-port-input').value = settings.server.port || 8000;
    document.getElementById('timeout').value = settings.server.timeout || 30;
    document.getElementById('auto-start').checked = settings.server.autoStart !== false;
    
    // 클로드 앱 설정
    document.getElementById('claude-path').value = settings.claude.path || '';
    document.getElementById('auto-launch').checked = settings.claude.autoLaunch !== false;
    document.getElementById('auto-capture-after').checked = settings.claude.autoCaptureAfter !== false;
    document.getElementById('capture-delay').value = settings.claude.captureDelay || 2;
    
    // 보안 설정
    document.getElementById('session-timeout').value = settings.security.sessionTimeout || 30;
    document.getElementById('pwd-length').checked = settings.security.passwordPolicy?.minLength !== false;
    document.getElementById('pwd-numbers').checked = settings.security.passwordPolicy?.requireNumbers !== false;
    document.getElementById('pwd-special').checked = settings.security.passwordPolicy?.requireSpecial === true;
    document.getElementById('login-attempts').value = settings.security.loginAttempts || 5;
    
    // 서버 포트 표시 업데이트
    document.getElementById('server-port').textContent = settings.server.port || 8000;
    
    // 연결 URL 업데이트
    updateConnectionUrl(settings.server.port || 8000);
  });
}

// 화면 캡처 컨트롤 초기화
function initCaptureControls() {
  const selectAreaBtn = document.getElementById('select-area-btn');
  const testCaptureBtn = document.getElementById('test-capture-btn');
  const imageQualitySelect = document.getElementById('image-quality');
  const autoCaptureCheckbox = document.getElementById('auto-capture');
  const autoSendCheckbox = document.getElementById('auto-send');
  
  // 캡처 영역 선택 버튼
  selectAreaBtn.addEventListener('click', () => {
    ipcRenderer.send('select-capture-area');
  });
  
  // 테스트 캡처 버튼
  testCaptureBtn.addEventListener('click', () => {
    ipcRenderer.send('test-capture');
  });
  
  // 캡처 설정 변경 시 저장
  [imageQualitySelect, autoCaptureCheckbox, autoSendCheckbox].forEach(elem => {
    elem.addEventListener('change', () => {
      const captureSettings = {
        quality: imageQualitySelect.value,
        autoCapture: autoCaptureCheckbox.checked,
        autoSend: autoSendCheckbox.checked
      };
      
      ipcRenderer.send('save-capture-settings', captureSettings);
    });
  });
  
  // 테스트 캡처 결과 처리
  ipcRenderer.on('test-capture-result', (event, imgData) => {
    const previewImg = document.getElementById('capture-preview-img');
    const placeholder = document.getElementById('capture-placeholder');
    
    if (imgData) {
      previewImg.src = `data:image/jpeg;base64,${imgData}`;
      previewImg.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      previewImg.style.display = 'none';
      placeholder.style.display = 'flex';
      alert('화면 캡처에 실패했습니다. 캡처 영역을 다시 설정해주세요.');
    }
  });
  
  // 캡처 설정 로드
  ipcRenderer.send('get-capture-settings');
  
  // 캡처 설정 데이터 수신
  ipcRenderer.on('capture-settings-data', (event, settings) => {
    imageQualitySelect.value = settings.quality || 'medium';
    autoCaptureCheckbox.checked = settings.autoCapture !== false;
    autoSendCheckbox.checked = settings.autoSend !== false;
  });
  
  // 캡처 목록 업데이트
  function updateCapturesList() {
    ipcRenderer.send('get-captures');
  }
  
  // 캡처 목록 데이터 수신
  ipcRenderer.on('captures-list', (event, captures) => {
    const capturesList = document.getElementById('captures-list');
    capturesList.innerHTML = '';
    
    captures.forEach(capture => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatDateTime(capture.timestamp)}</td>
        <td>${capture.command || '-'}</td>
        <td>${formatFileSize(capture.size)}</td>
        <td><span class="${capture.sent ? 'status-online' : 'status-offline'}">${capture.sent ? '전송됨' : '대기중'}</span></td>
        <td>
          <button class="btn btn-outline btn-sm view-capture" data-id="${capture.id}">보기</button>
          <button class="btn btn-outline btn-sm resend-capture" data-id="${capture.id}">재전송</button>
        </td>
      `;
      
      capturesList.appendChild(row);
    });
    
    // 보기 버튼 이벤트
    document.querySelectorAll('.view-capture').forEach(btn => {
      btn.addEventListener('click', () => {
        const captureId = btn.getAttribute('data-id');
        viewCapture(captureId);
      });
    });
    
    // 재전송 버튼 이벤트
    document.querySelectorAll('.resend-capture').forEach(btn => {
      btn.addEventListener('click', () => {
        const captureId = btn.getAttribute('data-id');
        resendCapture(captureId);
      });
    });
  });
  
  // 캡처 보기 함수
  function viewCapture(captureId) {
    ipcRenderer.send('view-capture', captureId);
  }
  
  // 캡처 재전송 함수
  function resendCapture(captureId) {
    ipcRenderer.send('resend-capture', captureId);
  }
  
  // 초기 캡처 목록 업데이트
  updateCapturesList();
  
  // 새 캡처 시 목록 업데이트
  ipcRenderer.on('capture-added', updateCapturesList);
  ipcRenderer.on('capture-sent', updateCapturesList);
}

// 명령 이력 초기화
function initCommandHistory() {
  const searchBtn = document.getElementById('search-btn');
  const clearCommandsBtn = document.getElementById('clear-commands-btn');
  const commandSearch = document.getElementById('command-search');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  
  let currentPage = 1;
  let totalPages = 1;
  
  // 명령 목록 업데이트
  function updateCommandsList(page = 1, searchTerm = '') {
    ipcRenderer.send('get-commands', { page, searchTerm });
  }
  
  // 검색 버튼
  searchBtn.addEventListener('click', () => {
    const searchTerm = commandSearch.value;
    currentPage = 1;
    updateCommandsList(currentPage, searchTerm);
  });
  
  // 검색 입력란 엔터 키
  commandSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const searchTerm = commandSearch.value;
      currentPage = 1;
      updateCommandsList(currentPage, searchTerm);
    }
  });
  
  // 기록 삭제 버튼
  clearCommandsBtn.addEventListener('click', () => {
    if (confirm('모든 명령 이력을 삭제하시겠습니까?')) {
      ipcRenderer.send('clear-commands');
    }
  });
  
  // 페이지 이동 버튼
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      updateCommandsList(currentPage, commandSearch.value);
    }
  });
  
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      updateCommandsList(currentPage, commandSearch.value);
    }
  });
  
  // 명령 목록 데이터 수신
  ipcRenderer.on('commands-list', (event, { commands, page, totalPages: total }) => {
    const commandsList = document.getElementById('commands-list');
    commandsList.innerHTML = '';
    
    currentPage = page;
    totalPages = total;
    
    // 페이지 정보 업데이트
    document.querySelector('.page-info').textContent = `${page} / ${total} 페이지`;
    
    // 페이지 버튼 활성화/비활성화
    prevPageBtn.disabled = page <= 1;
    nextPageBtn.disabled = page >= total;
    
    commands.forEach(cmd => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatDateTime(cmd.timestamp)}</td>
        <td>${cmd.user || '-'}</td>
        <td>${cmd.command}</td>
        <td><span class="${getStatusClass(cmd.status)}">${getStatusText(cmd.status)}</span></td>
        <td>${cmd.responseTime ? `${cmd.responseTime}ms` : '-'}</td>
        <td>
          <button class="btn btn-outline btn-sm view-result" data-id="${cmd.id}">결과 보기</button>
        </td>
      `;
      
      commandsList.appendChild(row);
    });
    
    // 결과 보기 버튼 이벤트
    document.querySelectorAll('.view-result').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmdId = btn.getAttribute('data-id');
        viewCommandResult(cmdId);
      });
    });
  });
  
  // 명령 결과 보기 함수
  function viewCommandResult(cmdId) {
    ipcRenderer.send('get-command-result', cmdId);
    
    // 결과 데이터 수신
    ipcRenderer.once(`command-result-${cmdId}`, (event, result) => {
      const resultModal = document.getElementById('command-result-modal');
      document.getElementById('result-command').textContent = result.command;
      document.getElementById('result-response').innerHTML = result.response || '(응답 없음)';
      
      // 결과 이미지가 있으면 표시
      if (result.imageData) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${result.imageData}`;
        img.style.maxWidth = '100%';
        document.getElementById('result-response').appendChild(img);
      }
      
      // 모달 표시
      resultModal.classList.add('show');
      
      // 복사 버튼 이벤트
      document.getElementById('copy-result').onclick = () => {
        navigator.clipboard.writeText(result.response || '');
        alert('응답이 클립보드에 복사되었습니다.');
      };
      
      // 다운로드 버튼 이벤트
      document.getElementById('download-result').onclick = () => {
        ipcRenderer.send('download-command-result', cmdId);
      };
      
      // 재전송 버튼 이벤트
      document.getElementById('resend-result').onclick = () => {
        ipcRenderer.send('resend-command', cmdId);
        resultModal.classList.remove('show');
      };
    });
  }
  
  // 초기 명령 목록 업데이트
  updateCommandsList();
  
  // 새 명령 추가 시 목록 업데이트
  ipcRenderer.on('command-added', () => updateCommandsList(currentPage, commandSearch.value));
  ipcRenderer.on('commands-cleared', () => updateCommandsList(1, ''));
}

// 서버 정보 요청
function requestServerInfo() {
  ipcRenderer.send('get-server-info');
  
  // 서버 정보 수신
  ipcRenderer.on('server-info', (event, info) => {
    document.getElementById('server-ip').textContent = info.ip || '127.0.0.1';
    document.getElementById('server-port').textContent = info.port || '8000';
    
    // 연결 URL 업데이트
    updateConnectionUrl(info.port || 8000, info.ip);
    
    // 서버 상태에 따라 버튼 상태 업데이트
    const startServerBtn = document.getElementById('start-server-btn');
    const serverActionText = document.getElementById('server-action-text');
    
    if (info.running) {
      startServerBtn.setAttribute('data-running', 'true');
      serverActionText.textContent = '서버 종료';
    } else {
      startServerBtn.setAttribute('data-running', 'false');
      serverActionText.textContent = '서버 시작';
    }
  });
}

// 연결된 클라이언트 정보 업데이트
function updateClientsInfo() {
  ipcRenderer.send('get-clients');
  
  // 클라이언트 목록 수신
  ipcRenderer.on('clients-list', (event, clients) => {
    const clientsList = document.getElementById('clients-list');
    clientsList.innerHTML = '';
    
    clients.forEach(client => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${client.user || '익명'}</td>
        <td>${client.device || '알 수 없음'}</td>
        <td>${client.ip}</td>
        <td><span class="table-status status-online">연결됨</span></td>
        <td>${formatElapsedTime(client.connectedAt)}</td>
        <td>
          <button class="btn btn-outline btn-sm disconnect-client" data-id="${client.id}">연결 해제</button>
        </td>
      `;
      
      clientsList.appendChild(row);
    });
    
    // 연결 해제 버튼 이벤트
    document.querySelectorAll('.disconnect-client').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientId = btn.getAttribute('data-id');
        disconnectClient(clientId);
      });
    });
    
    // 연결된 클라이언트 수 업데이트
    document.getElementById('client-count').textContent = clients.length;
  });
}

// 클라이언트 연결 해제 함수
function disconnectClient(clientId) {
  if (confirm('이 클라이언트의 연결을 해제하시겠습니까?')) {
    ipcRenderer.send('disconnect-client', clientId);
  }
}

// 활동 로그 업데이트
function updateActivityLog() {
  ipcRenderer.send('get-activity-log');
  
  // 활동 로그 수신
  ipcRenderer.on('activity-log', (event, activities) => {
    const activityLog = document.getElementById('activity-log');
    activityLog.innerHTML = '';
    
    activities.forEach(activity => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      
      item.innerHTML = `
        <div class="activity-icon">${getActivityIcon(activity.type)}</div>
        <div class="activity-content">
          <div class="activity-title">${activity.message}</div>
          <div class="activity-time">${formatDateTime(activity.timestamp)}</div>
        </div>
      `;
      
      activityLog.appendChild(item);
    });
  });
}

// 서버 상태 변경 구독
function subscribeToServerStatus() {
  ipcRenderer.on('server-status', (event, status) => {
    const statusBadge = document.querySelector('.server-status .status-badge');
    const statusText = document.querySelector('.server-status .status-text');
    const startServerBtn = document.getElementById('start-server-btn');
    const serverActionText = document.getElementById('server-action-text');
    
    if (status.running) {
      statusBadge.className = 'status-badge online';
      statusText.textContent = '실행 중';
      startServerBtn.setAttribute('data-running', 'true');
      serverActionText.textContent = '서버 종료';
    } else {
      statusBadge.className = 'status-badge offline';
      statusText.textContent = '중지됨';
      startServerBtn.setAttribute('data-running', 'false');
      serverActionText.textContent = '서버 시작';
    }
    
    // 서버 정보 업데이트
    document.getElementById('server-port').textContent = status.port || '8000';
    
    // 연결 URL 업데이트
    updateConnectionUrl(status.port || 8000, status.ip);
    
    // 연결된 클라이언트 수 업데이트
    document.getElementById('client-count').textContent = status.clientCount || 0;
    
    // 명령 수 업데이트
    document.getElementById('command-count').textContent = status.commandCount || 0;
    
    // 활성 사용자 수 업데이트
    document.getElementById('active-users').textContent = status.activeUsers || 0;
    
    // 가동 시간 업데이트
    document.getElementById('uptime').textContent = status.uptime || '00:00:00';
  });
}

// 연결 URL 업데이트
function updateConnectionUrl(port, ip = 'localhost') {
  const connectionUrl = document.getElementById('connection-url');
  connectionUrl.value = `http://${ip}:${port}`;
}

// 유틸리티 함수들
// 날짜 시간 포맷팅
function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

// 숫자 앞에 0 채우기
function padZero(num) {
  return num.toString().padStart(2, '0');
}

// 경과 시간 포맷팅
function formatElapsedTime(timestamp) {
  if (!timestamp) return '-';
  
  const now = new Date();
  const date = new Date(timestamp);
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) {
    return `${diff}초 전`;
  } else if (diff < 3600) {
    return `${Math.floor(diff / 60)}분 전`;
  } else if (diff < 86400) {
    return `${Math.floor(diff / 3600)}시간 전`;
  } else {
    return `${Math.floor(diff / 86400)}일 전`;
  }
}

// 파일 크기 포맷팅
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  
  return `${bytes.toFixed(2)} ${units[i]}`;
}

// 명령 상태에 따른 클래스명
function getStatusClass(status) {
  switch (status) {
    case 'completed':
      return 'status-online';
    case 'error':
      return 'status-offline';
    case 'processing':
      return 'status-processing';
    default:
      return '';
  }
}

// 명령 상태 텍스트
function getStatusText(status) {
  switch (status) {
    case 'completed':
      return '완료';
    case 'error':
      return '오류';
    case 'processing':
      return '처리 중';
    default:
      return '알 수 없음';
  }
}

// 활동 타입에 따른 아이콘
function getActivityIcon(type) {
  switch (type) {
    case 'login':
      return '🔑';
    case 'command':
      return '💬';
    case 'capture':
      return '📷';
    case 'error':
      return '⚠️';
    case 'server':
      return '🖥️';
    default:
      return '📝';
  }
}