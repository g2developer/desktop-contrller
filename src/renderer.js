// URL 해시 변경 처리
function handleHashChange() {
  // URL에서 해시 값 추출 (예: #dashboard, #capture 등)
  const hash = window.location.hash.substring(1) || 'dashboard'; // 기본값은 dashboard
  console.log(`URL 해시 변경 감지: ${hash}`);
  
  // 해당 탭 찾기
  const tabLink = document.querySelector(`.nav-link[data-tab="${hash}"]`);
  if (tabLink) {
    console.log(`해시에 맞는 탭 찾음: ${hash}`);
    tabLink.click();
  } else {
    console.log(`해시에 맞는 탭을 찾을 수 없음. 기본 탭 사용: ${hash}`);
    // 기본 탭 선택
    const defaultTab = document.querySelector('.nav-link[data-tab="dashboard"]');
    if (defaultTab) {
      defaultTab.click();
    }
  }
}

// 애플리케이션 초기화
// DOM 요소가 로드되었을 때 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('문서 로드 완료 - renderer.js');
  
  // 탭 전환 기능
  initTabs();
  
  // 서버 상태 관리
  initServerStatus();
  
  // 모달 관리
  initModals();
  
  // 화면 캡처 기능
  initCaptureFeature();
  
  // 데모 데이터 로드 (실제 데이터로 교체 필요)
  loadDemoData();
  
  // 복사 버튼 기능
  initCopyButton();
  
  // 설정 저장 기능
  initSettingsForm();
  
  // 탭 주소창 URL 변경 이벤트 처리 추가
  window.addEventListener('hashchange', handleHashChange);
  
  // 초기 URL 해시 처리
  handleHashChange();
});

// 탭 전환 기능 초기화
function initTabs() {
  console.log('탭 초기화 시작');
  const tabLinks = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.querySelector('.page-title');
  
  console.log(`탭 링크 수: ${tabLinks.length}, 탭 컨텐츠 수: ${tabContents.length}`);
  
  // 탭 링크 클릭 이벤트 처리
  tabLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const tabId = this.getAttribute('data-tab');
      console.log(`탭 클릭 발생: ${tabId}`);
      
      // 기존 활성화된 탭 비활성화
      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // 클릭한 탭 활성화
      this.classList.add('active');
      
      // 해당 컨텐츠 활성화
      const targetContent = document.getElementById(tabId);
      if (targetContent) {
        targetContent.classList.add('active');
        console.log(`탭 컨텐츠 활성화: ${tabId}`);
      } else {
        console.error(`일치하는 탭 컨텐츠를 찾을 수 없음: ${tabId}`);
      }
      
      // 페이지 제목 업데이트
      if (pageTitle) {
        pageTitle.textContent = this.textContent.trim();
      }
      
      // URL 해시 업데이트 - 해시체인지 이벤트 루프 방지
      if (window.location.hash !== `#${tabId}`) {
        window.location.hash = tabId;
      }
    });
  });
  
  // 첫 실행시 기본 탭 선택
  setTimeout(() => {
    const activeLink = document.querySelector('.nav-link.active');
    if (!activeLink && tabLinks.length > 0) {
      // 활성화된 탭이 없으면 첫번째 탭 자동 선택
      console.log('활성화된 탭이 없음, 첫번째 탭 클릭 시도');
      tabLinks[0].click();
    } else if (activeLink) {
      // 이미 활성화된 탭이 있으면 해당 탭 내용이 아직 표시되지 않았는지 확인
      const tabId = activeLink.getAttribute('data-tab');
      const activeContent = document.querySelector(`#${tabId}.tab-content.active`);
      if (!activeContent) {
        console.log(`활성화된 탭은 있지만 컨텐츠가 표시되지 않음. 탭 재활성화: ${tabId}`);
        // 탭 콘텐츠 직접 활성화
        const targetContent = document.getElementById(tabId);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      }
    }
  }, 200);
  
  console.log('탭 초기화 완료');
}

// 서버 상태 관리 초기화
function initServerStatus() {
  const startServerBtn = document.getElementById('start-server-btn');
  const serverActionText = document.getElementById('server-action-text');
  const serverStatus = document.querySelector('.server-status .status-badge');
  const serverStatusText = document.querySelector('.server-status .status-text');
  let isServerRunning = true; // 초기 상태를 활성화로 설정 (실제로는 window.electronAPI로 상태 확인 필요)
  
  startServerBtn.addEventListener('click', () => {
    if (isServerRunning) {
      // 서버 중지
      // window.electronAPI.stopServer();
      console.log('서버 중지');
      isServerRunning = false;
      serverStatus.classList.remove('online');
      serverStatus.classList.add('offline');
      serverStatusText.textContent = '중지됨';
      serverActionText.textContent = '서버 시작';
    } else {
      // 서버 시작
      // window.electronAPI.startServer();
      console.log('서버 시작');
      isServerRunning = true;
      serverStatus.classList.remove('offline');
      serverStatus.classList.add('online');
      serverStatusText.textContent = '실행 중';
      serverActionText.textContent = '서버 중지';
    }
  });
  
  // 새로고침 버튼
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('새로고침');
      // 현재 데이터 리로드
      loadDemoData();
    });
  }
}

// 모달 초기화
function initModals() {
  // 사용자 추가 모달
  const userModal = document.getElementById('user-modal');
  const addUserBtn = document.getElementById('add-user-btn');
  const saveUserBtn = document.getElementById('save-user');
  const cancelUserBtn = document.getElementById('cancel-user');
  const closeUserBtn = userModal.querySelector('.modal-close');
  
  addUserBtn.addEventListener('click', () => {
    document.getElementById('modal-title').textContent = '사용자 추가';
    document.getElementById('user-form').reset();
    userModal.classList.add('show');
  });
  
  saveUserBtn.addEventListener('click', () => {
    // 폼 유효성 검사 및 저장 로직
    const userId = document.getElementById('user-id').value;
    const userName = document.getElementById('user-name').value;
    const userPassword = document.getElementById('user-password').value;
    const userPasswordConfirm = document.getElementById('user-password-confirm').value;
    
    if (!userId || !userName || !userPassword) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    if (userPassword !== userPasswordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    // 실제 저장 로직 구현 필요
    console.log('사용자 저장:', { userId, userName, userPassword });
    
    // 모달 닫기
    userModal.classList.remove('show');
    
    // 사용자 목록 업데이트
    updateUsersList();
  });
  
  cancelUserBtn.addEventListener('click', () => {
    userModal.classList.remove('show');
  });
  
  closeUserBtn.addEventListener('click', () => {
    userModal.classList.remove('show');
  });
  
  // 명령 결과 모달
  const commandResultModal = document.getElementById('command-result-modal');
  if (commandResultModal) {
    const closeResultBtn = commandResultModal.querySelector('.modal-close');
    closeResultBtn.addEventListener('click', () => {
      commandResultModal.classList.remove('show');
    });
  }
  
  // 모달 외부 클릭 시 닫기
  window.addEventListener('click', (e) => {
    if (e.target === userModal) {
      userModal.classList.remove('show');
    }
    if (commandResultModal && e.target === commandResultModal) {
      commandResultModal.classList.remove('show');
    }
  });
}



// 화면 캡처 기능 초기화
function initCaptureFeature() {
  const testCaptureBtn = document.getElementById('test-capture-btn');
  const capturePreviewImg = document.getElementById('capture-preview-img');
  const capturePlaceholder = document.getElementById('capture-placeholder');
  const selectAreaBtn = document.getElementById('select-area-btn');
  
  if (testCaptureBtn) {
    testCaptureBtn.addEventListener('click', () => {
      // 테스트 캡처 실행 (실제로는 window.electronAPI 사용)
      console.log('테스트 캡처 실행');
      
      // 데모용 이미지 표시
      capturePreviewImg.src = 'https://via.placeholder.com/800x600?text=AI+Response+Capture';
      capturePreviewImg.style.display = 'block';
      capturePlaceholder.style.display = 'none';
    });
  }
  
  if (selectAreaBtn) {
    selectAreaBtn.addEventListener('click', () => {
      // 영역 선택 모드 실행 (실제로는 window.electronAPI 사용)
      console.log('영역 선택 모드 실행');
      // window.electronAPI.selectCaptureArea();
    });
  }
}

// 복사 버튼 기능 초기화
function initCopyButton() {
  const copyUrlBtn = document.getElementById('copy-url-btn');
  const connectionUrl = document.getElementById('connection-url');
  
  if (copyUrlBtn && connectionUrl) {
    copyUrlBtn.addEventListener('click', () => {
      // 클립보드에 복사 (실제로는 navigator.clipboard 사용)
      console.log('URL 복사:', connectionUrl.value);
      
      // 복사 피드백
      copyUrlBtn.textContent = '복사됨!';
      setTimeout(() => {
        copyUrlBtn.textContent = '복사';
      }, 1500);
    });
  }
}

// 설정 저장 기능 초기화
function initSettingsForm() {
  const saveSettingsBtn = document.getElementById('save-settings');
  const resetSettingsBtn = document.getElementById('reset-settings');
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // 서버 설정
      const serverPort = document.getElementById('server-port-input').value;
      const timeout = document.getElementById('timeout').value;
      const autoStart = document.getElementById('auto-start').checked;
      
      // 클로드 앱 설정
      const claudePath = document.getElementById('claude-path').value;
      const autoLaunch = document.getElementById('auto-launch').checked;
      const autoCaptureAfter = document.getElementById('auto-capture-after').checked;
      const captureDelay = document.getElementById('capture-delay').value;
      
      // 보안 설정
      const sessionTimeout = document.getElementById('session-timeout').value;
      const pwdLength = document.getElementById('pwd-length').checked;
      const pwdNumbers = document.getElementById('pwd-numbers').checked;
      const pwdSpecial = document.getElementById('pwd-special').checked;
      const loginAttempts = document.getElementById('login-attempts').value;
      
      // 설정 저장 (실제로는 window.electronAPI 사용)
      const settings = {
        server: { port: serverPort, timeout, autoStart },
        claude: { path: claudePath, autoLaunch, autoCaptureAfter, captureDelay },
        security: { 
          sessionTimeout, 
          passwordPolicy: { minLength: pwdLength, requireNumbers: pwdNumbers, requireSpecial: pwdSpecial },
          loginAttempts 
        }
      };
      
      console.log('설정 저장:', settings);
      // window.electronAPI.saveSettings(settings);
      
      // 저장 피드백
      alert('설정이 저장되었습니다.');
    });
  }
  
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      // 설정 초기화
      document.getElementById('server-settings-form').reset();
      document.getElementById('claude-settings-form').reset();
      document.getElementById('security-settings-form').reset();
      
      // 기본 사용자 설정 폼은 리셋하지 않음 (중요 정보이므로)
      
      alert('설정이 초기화되었습니다.');
    });
  }
}

// 데모 데이터 로드 (실제 데이터로 교체 필요)
function loadDemoData() {
  // 연결된 클라이언트 데이터
  const clients = [
    { id: '1', name: 'user1', device: 'iPhone 13', ip: '192.168.0.101', status: 'online', connectedTime: '13:45:12' },
    { id: '2', name: 'user2', device: 'Galaxy S21', ip: '192.168.0.102', status: 'online', connectedTime: '14:22:05' },
    { id: '3', name: 'user3', device: 'iPad Pro', ip: '192.168.0.103', status: 'online', connectedTime: '15:10:33' }
  ];
  
  // 활동 로그 데이터
  const activities = [
    { icon: '🔌', title: 'user3(iPad Pro)가 연결되었습니다.', time: '15:10:33' },
    { icon: '💬', title: 'user2가 "날씨 정보 요청해줘"라는 명령을 전송했습니다.', time: '15:05:21' },
    { icon: '🖼️', title: 'AI 응답 화면이 user2에게 전송되었습니다.', time: '15:05:45' },
    { icon: '🔌', title: 'user2(Galaxy S21)가 연결되었습니다.', time: '14:22:05' },
    { icon: '🔌', title: 'user1(iPhone 13)가 연결되었습니다.', time: '13:45:12' }
  ];
  
  // 사용자 목록 데이터
  const users = [
    { id: 'user1', name: '사용자 1', lastLogin: '2024-05-06 13:45:12', status: 'online' },
    { id: 'user2', name: '사용자 2', lastLogin: '2024-05-06 14:22:05', status: 'online' },
    { id: 'user3', name: '사용자 3', lastLogin: '2024-05-06 15:10:33', status: 'online' },
    { id: 'user4', name: '사용자 4', lastLogin: '2024-05-05 18:22:45', status: 'offline' },
    { id: 'user5', name: '사용자 5', lastLogin: '2024-05-05 16:11:32', status: 'offline' }
  ];
  
  // 명령 이력 데이터
  const commands = [
    { time: '15:05:21', user: 'user2', command: '날씨 정보 요청해줘', status: 'completed', responseTime: '24초' },
    { time: '14:52:30', user: 'user2', command: '오늘의 뉴스 알려줘', status: 'completed', responseTime: '42초' },
    { time: '14:30:12', user: 'user1', command: '내일 일정 알려줘', status: 'completed', responseTime: '18초' },
    { time: '14:15:55', user: 'user3', command: '이메일 작성해줘', status: 'completed', responseTime: '35초' },
    { time: '13:58:22', user: 'user1', command: '엑셀 함수 설명해줘', status: 'completed', responseTime: '28초' }
  ];
  
  // 캡처 이력 데이터
  const captures = [
    { time: '15:05:45', command: '날씨 정보 요청해줘', size: '245 KB', status: 'sent' },
    { time: '14:52:30', command: '오늘의 뉴스 알려줘', size: '302 KB', status: 'sent' },
    { time: '14:30:12', command: '내일 일정 알려줘', size: '198 KB', status: 'sent' }
  ];
  
  // 통계 데이터 설정
  document.getElementById('client-count').textContent = clients.length;
  document.getElementById('command-count').textContent = commands.length;
  document.getElementById('active-users').textContent = users.filter(u => u.status === 'online').length;
  
  // 임의의 가동 시간 설정
  document.getElementById('uptime').textContent = '02:34:56';
  
  // 연결된 클라이언트 목록 업데이트
  updateClientsList(clients);
  
  // 활동 로그 업데이트
  updateActivityLog(activities);
  
  // 사용자 목록 업데이트
  updateUsersList(users);
  
  // 명령 이력 업데이트
  updateCommandsList(commands);
  
  // 캡처 이력 업데이트
  updateCapturesList(captures);
  
  // IP 및 연결 URL 업데이트
  const serverIp = document.getElementById('server-ip');
  const connectionUrl = document.getElementById('connection-url');
  if (serverIp && connectionUrl) {
    serverIp.textContent = '192.168.0.10';
    connectionUrl.value = 'http://192.168.0.10:3000';
  }
}

// 연결된 클라이언트 목록 업데이트
function updateClientsList(clients) {
  const clientsList = document.getElementById('clients-list');
  
  if (!clientsList) return;
  
  clientsList.innerHTML = '';
  
  if (clients.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">연결된 디바이스가 없습니다.</td>';
    clientsList.appendChild(emptyRow);
    return;
  }
  
  clients.forEach(client => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${client.name}</td>
      <td>${client.device}</td>
      <td>${client.ip}</td>
      <td><span class="table-status status-${client.status}">${client.status === 'online' ? '온라인' : '오프라인'}</span></td>
      <td>${client.connectedTime}</td>
      <td>
        <button class="btn btn-outline btn-sm" data-client="${client.id}">연결 해제</button>
      </td>
    `;
    
    clientsList.appendChild(row);
  });
  
  // 연결 해제 버튼에 이벤트 리스너 추가
  const disconnectButtons = clientsList.querySelectorAll('.btn[data-client]');
  disconnectButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const clientId = btn.getAttribute('data-client');
      console.log('클라이언트 연결 해제:', clientId);
      // 실제 연결 해제 로직 구현 필요
      // window.electronAPI.disconnectClient(clientId);
    });
  });
}

// 활동 로그 업데이트
function updateActivityLog(activities) {
  const activityLog = document.getElementById('activity-log');
  
  if (!activityLog) return;
  
  activityLog.innerHTML = '';
  
  if (activities.length === 0) {
    activityLog.innerHTML = '<p style="text-align: center;">활동 기록이 없습니다.</p>';
    return;
  }
  
  activities.forEach(activity => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    
    item.innerHTML = `
      <div class="activity-icon">${activity.icon}</div>
      <div class="activity-content">
        <div class="activity-title">${activity.title}</div>
        <div class="activity-time">${activity.time}</div>
      </div>
    `;
    
    activityLog.appendChild(item);
  });
}

// 사용자 목록 업데이트
function updateUsersList(users) {
  const usersList = document.getElementById('users-list');
  
  if (!usersList) return;
  
  usersList.innerHTML = '';
  
  if (!users || users.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="5" style="text-align: center;">등록된 사용자가 없습니다.</td>';
    usersList.appendChild(emptyRow);
    return;
  }
  
  users.forEach(user => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.name}</td>
      <td>${user.lastLogin}</td>
      <td><span class="table-status status-${user.status}">${user.status === 'online' ? '접속 중' : '오프라인'}</span></td>
      <td>
        <button class="btn btn-outline btn-sm edit-user-btn" data-userid="${user.id}">수정</button>
        <button class="btn btn-outline btn-sm delete-user-btn" data-userid="${user.id}">삭제</button>
      </td>
    `;
    
    usersList.appendChild(row);
  });
  
  // 사용자 수정 버튼에 이벤트 리스너 추가
  const editButtons = usersList.querySelectorAll('.edit-user-btn');
  editButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-userid');
      editUser(userId);
    });
  });
  
  // 사용자 삭제 버튼에 이벤트 리스너 추가
  const deleteButtons = usersList.querySelectorAll('.delete-user-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-userid');
      deleteUser(userId);
    });
  });
}

// 사용자 수정 함수
function editUser(userId) {
  console.log('사용자 수정:', userId);
  
  // 실제로는
  //  서버에서 사용자 정보를 가져와야 함
  // window.electronAPI.getUserInfo(userId).then(userInfo => { ... });
  
  // 데모용 사용자 정보
  const userInfo = {
    id: userId,
    name: `사용자 ${userId.replace('user', '')}`,
    password: '********'
  };
  
  // 사용자 수정 모달 표시
  const userModal = document.getElementById('user-modal');
  const modalTitle = document.getElementById('modal-title');
  const userIdInput = document.getElementById('user-id');
  const userNameInput = document.getElementById('user-name');
  
  modalTitle.textContent = '사용자 수정';
  userIdInput.value = userInfo.id;
  userIdInput.disabled = true; // 아이디는 수정 불가
  userNameInput.value = userInfo.name;
  
  // 모달 표시
  userModal.classList.add('show');
}

// 사용자 삭제 함수
function deleteUser(userId) {
  if (confirm(`정말로 사용자 '${userId}'를 삭제하시겠습니까?`)) {
    console.log('사용자 삭제:', userId);
    // 실제 사용자 삭제 로직 구현 필요
    // window.electronAPI.deleteUser(userId);
    
    // 사용자 목록 업데이트 (실제로는 서버에서 최신 목록을 가져와야 함)
    const usersList = document.getElementById('users-list');
    const userRow = usersList.querySelector(`tr button[data-userid="${userId}"]`).closest('tr');
    userRow.remove();
  }
}

// 명령 이력 업데이트
function updateCommandsList(commands) {
  const commandsList = document.getElementById('commands-list');
  
  if (!commandsList) return;
  
  commandsList.innerHTML = '';
  
  if (commands.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">명령 이력이 없습니다.</td>';
    commandsList.appendChild(emptyRow);
    return;
  }
  
  commands.forEach(cmd => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${cmd.time}</td>
      <td>${cmd.user}</td>
      <td>${cmd.command}</td>
      <td><span class="table-status status-${cmd.status === 'completed' ? 'online' : 'offline'}">${cmd.status === 'completed' ? '완료' : '처리 중'}</span></td>
      <td>${cmd.responseTime}</td>
      <td>
        <button class="btn btn-outline btn-sm view-result-btn" data-command="${cmd.command}" data-time="${cmd.time}">
          결과 보기
        </button>
      </td>
    `;
    
    commandsList.appendChild(row);
  });
  
  // 결과 보기 버튼에 이벤트 리스너 추가
  const viewResultButtons = commandsList.querySelectorAll('.view-result-btn');
  viewResultButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.getAttribute('data-command');
      const time = btn.getAttribute('data-time');
      showCommandResult(command, time);
    });
  });
}

// 명령 결과 표시 함수
function showCommandResult(command, time) {
  console.log('명령 결과 표시:', command, time);
  
  // 실제로는 서버에서 결과를 가져와야 함
  // window.electronAPI.getCommandResult(command, time).then(result => { ... });
  
  // 데모용 결과 데이터
  let resultHtml = '';
  
  if (command === '날씨 정보 요청해줘') {
    resultHtml = `
      현재 서울의 날씨는 맑고 기온은 22°C입니다. 습도는 45%이며, 풍속은 3m/s입니다.<br><br>
      
      오늘의 날씨 예보:<br>
      - 오전: 맑음, 18-20°C<br>
      - 오후: 맑음, 20-23°C<br>
      - 저녁: 구름 조금, 17-19°C<br>
      
      내일은 흐리고 비가 올 가능성이 있으니 외출 시 우산을 챙기시는 것이 좋겠습니다.
    `;
  } else if (command === '오늘의 뉴스 알려줘') {
    resultHtml = `
      오늘의 주요 뉴스입니다:<br><br>
      
      1. 정부, 신재생 에너지 투자 확대 계획 발표<br>
      2. 코로나19 신규 확진자 300명대로 감소<br>
      3. 국내 주요 기업 실적 발표, 예상보다 호조<br>
      4. 국제 유가 상승세 지속, 에너지 가격 인상 우려<br>
      5. 주요 도시 미세먼지 농도 '보통' 수준 유지
    `;
  } else {
    resultHtml = `${command}에 대한 AI 응답 결과입니다.`;
  }
  
  // 결과 모달에 데이터 설정
  const resultCommandElement = document.getElementById('result-command');
  const resultResponseElement = document.getElementById('result-response');
  
  if (resultCommandElement && resultResponseElement) {
    resultCommandElement.textContent = command;
    resultResponseElement.innerHTML = resultHtml;
    
    // 모달 표시
    const commandResultModal = document.getElementById('command-result-modal');
    commandResultModal.classList.add('show');
  }
}

// 캡처 이력 업데이트
function updateCapturesList(captures) {
  const capturesList = document.getElementById('captures-list');
  
  if (!capturesList) return;
  
  capturesList.innerHTML = '';
  
  if (captures.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="5" style="text-align: center;">캡처 이력이 없습니다.</td>';
    capturesList.appendChild(emptyRow);
    return;
  }
  
  captures.forEach(capture => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${capture.time}</td>
      <td>${capture.command}</td>
      <td>${capture.size}</td>
      <td><span class="table-status status-online">전송 완료</span></td>
      <td>
        <button class="btn btn-outline btn-sm view-capture-btn" data-time="${capture.time}">
          보기
        </button>
        <button class="btn btn-outline btn-sm resend-capture-btn" data-time="${capture.time}">
          재전송
        </button>
      </td>
    `;
    
    capturesList.appendChild(row);
  });
  
  // 보기 버튼에 이벤트 리스너 추가
  const viewCaptureButtons = capturesList.querySelectorAll('.view-capture-btn');
  viewCaptureButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const captureTime = btn.getAttribute('data-time');
      viewCapture(captureTime);
    });
  });
  
  // 재전송 버튼에 이벤트 리스너 추가
  const resendCaptureButtons = capturesList.querySelectorAll('.resend-capture-btn');
  resendCaptureButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const captureTime = btn.getAttribute('data-time');
      resendCapture(captureTime);
    });
  });
}

// 캡처 보기 함수
function viewCapture(captureTime) {
  console.log('캡처 보기:', captureTime);
  
  // 실제로는 서버에서 캡처 이미지를 가져와야 함
  // window.electronAPI.getCapture(captureTime).then(imageData => { ... });
  
  // 데모용 이미지 표시
  const capturePreviewImg = document.getElementById('capture-preview-img');
  const capturePlaceholder = document.getElementById('capture-placeholder');
  
  if (capturePreviewImg && capturePlaceholder) {
    capturePreviewImg.src = 'https://via.placeholder.com/800x600?text=AI+Response+Capture';
    capturePreviewImg.style.display = 'block';
    capturePlaceholder.style.display = 'none';
    
    // 캡처 탭으로 전환
    const captureTabLink = document.querySelector('.nav-link[data-tab="capture"]');
    if (captureTabLink) {
      captureTabLink.click();
    }
  }
}

// 캡처 재전송 함수
function resendCapture(captureTime) {
  console.log('캡처 재전송:', captureTime);
  
  // 실제로는 서버에 재전송 요청을 보내야 함
  // window.electronAPI.resendCapture(captureTime);
  
  // 재전송 피드백
  alert(`캡처 이미지가 재전송되었습니다. (${captureTime})`);
}

// 서버 IP 주소 가져오기 함수 (실제로는 window.electronAPI를 통해 구현)
function getServerIpAddress() {
  // 실제로는 시스템의 IP 주소를 가져와야 함
  // return window.electronAPI.getIPAddress();
  
  // 데모용 IP 주소
  return '192.168.0.10';
}

// QR 코드 생성 함수 (실제로는 QR 코드 라이브러리를 사용하여 구현)
function generateQRCode(url) {
  console.log('QR 코드 생성:', url);
  
  // 실제로는 QR 코드 라이브러리를 사용하여 QR 코드를 생성해야 함
  // 예: QRCode.toCanvas(document.getElementById('qrcode'), url);
  
  // 데모용 QR 코드 메시지
  const qrcodeElement = document.getElementById('qrcode');
  if (qrcodeElement) {
    qrcodeElement.textContent = 'QR 코드 영역';
  }
}