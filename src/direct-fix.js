// direct-fix.js
// 서버 중지 버튼 문제 해결을 위한 직접 패치 스크립트

// 페이지 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('서버 중지 버튼 문제 해결 스크립트 로드');
  
  // 메인 패치 함수 정의
  function patchStopServerButton() {
    const stopServerBtn = document.getElementById('stop-server-btn');
    if (!stopServerBtn) {
      console.error('서버 중지 버튼을 찾을 수 없습니다');
      
      // 1초 후 다시 시도 (DOM이 아직 완전히 로드되지 않았을 수 있음)
      setTimeout(patchStopServerButton, 1000);
      return;
    }
    
    console.log('서버 중지 버튼을 찾았습니다. 이벤트 리스너 추가 중...');
    
    // 기존 이벤트 리스너 제거 (모든 이벤트)
    const newButton = stopServerBtn.cloneNode(true);
    stopServerBtn.parentNode.replaceChild(newButton, stopServerBtn);
    
    // 새 버튼에 이벤트 리스너 추가
    newButton.addEventListener('click', function(event) {
      console.log('서버 중지 버튼 클릭됨 (direct-fix.js)');
      
      try {
        // 방법 1: window.electronAPI 사용
        if (window.electronAPI) {
          if (typeof window.electronAPI.directStopServer === 'function') {
            console.log('electronAPI.directStopServer() 호출');
            window.electronAPI.directStopServer();
          } else if (typeof window.electronAPI.send === 'function') {
            console.log('electronAPI.send("stop-server") 호출');
            window.electronAPI.send('stop-server', { source: 'direct_fix' });
          } else if (typeof window.electronAPI.stopServer === 'function') {
            console.log('electronAPI.stopServer() 호출');
            window.electronAPI.stopServer();
          } else {
            console.error('적절한 electronAPI 메소드를 찾을 수 없습니다');
          }
        } 
        // 방법 2: Electron IPC Renderer 직접 사용 시도
        else if (window.ipcRenderer && typeof window.ipcRenderer.send === 'function') {
          console.log('window.ipcRenderer.send("stop-server") 호출');
          window.ipcRenderer.send('stop-server');
        }
        // 방법 3: DOM 이벤트 사용
        else {
          console.log('CustomEvent 사용 시도');
          const event = new CustomEvent('server-stop-request');
          document.dispatchEvent(event);
        }
        
        // 사용자에게 피드백 - showToast 함수가 있으면 사용
        if (window.showToast) {
          window.showToast('서버 중지 요청 전송됨', 'info');
        } else if (window.electronAPI && typeof window.electronAPI.showToast === 'function') {
          window.electronAPI.showToast('서버 중지 요청 전송됨', 'info');
        }
      } catch (error) {
        console.error('서버 중지 요청 중 오류 발생:', error);
        alert('서버 중지 요청 중 오류가 발생했습니다: ' + error.message);
      }
      
      // 이벤트 버블링 방지
      event.preventDefault();
      event.stopPropagation();
    });
    
    console.log('서버 중지 버튼 패치 완료');
    
    // 서버 중지 버튼 글자색을 변경하여 패치 적용 확인
    newButton.style.color = '#ff5722';
    setTimeout(() => {
      newButton.style.color = '';
    }, 2000);
  }
  
  // 즉시 실행 및 약간의 지연 후 다시 실행 (DOM이 완전히 로드되지 않았을 가능성 대비)
  patchStopServerButton();
  setTimeout(patchStopServerButton, 1500);
});

// HTML에 스크립트 삽입 (index.html에 직접 스크립트 추가가 어려운 경우)
function injectScript() {
  try {
    console.log('스크립트 삽입 시도');
    const script = document.createElement('script');
    script.textContent = `
      // 인라인 스크립트
      (function() {
        console.log('서버 중지 인라인 패치 로드');
        document.getElementById('stop-server-btn')?.addEventListener('click', function() {
          console.log('서버 중지 버튼 인라인 클릭 핸들러');
          if (window.electronAPI) {
            window.electronAPI.send('stop-server', {source: 'inline'});
          }
        });
      })();
    `;
    document.head.appendChild(script);
    console.log('스크립트 삽입 완료');
  } catch (error) {
    console.error('스크립트 삽입 실패:', error);
  }
}

// 페이지 준비 완료 시 실행
if (document.readyState === 'complete') {
  injectScript();
} else {
  window.addEventListener('load', injectScript);
}
