// debug.js - 디버깅용 임시 파일
// 서버 시작 버튼 문제 진단을 위한 파일입니다.

document.addEventListener('DOMContentLoaded', () => {
    console.log('디버깅 스크립트 로드됨');
    
    // 필수 DOM 요소
    const startServerBtn = document.getElementById('start-server-btn');
    const serverToggle = document.getElementById('server-toggle');
    
    if (startServerBtn) {
        console.log('서버 시작 버튼이 존재함');
        
        // 이벤트 리스너 기존 것 제거 후 새로 추가
        const newStartBtn = startServerBtn.cloneNode(true);
        startServerBtn.parentNode.replaceChild(newStartBtn, startServerBtn);
        
        newStartBtn.addEventListener('click', () => {
            console.log('서버 시작 버튼 클릭 - 디버깅');
            
            try {
                if (window.electronAPI && window.electronAPI.send) {
                    console.log('electronAPI를 통해 start-server 이벤트 전송 시도');
                    window.electronAPI.send('start-server');
                    console.log('start-server 이벤트 전송 성공');
                    
                    // UI 업데이트
                    if (serverToggle) {
                        serverToggle.classList.add('active');
                    }
                    
                    // 토스트 메시지 표시
                    const toastContainer = document.getElementById('toast-container');
                    if (toastContainer) {
                        const toast = document.createElement('div');
                        toast.className = 'toast info';
                        toast.textContent = '서버를 시작합니다...';
                        toastContainer.appendChild(toast);
                        
                        setTimeout(() => {
                            toast.classList.add('fade-out');
                            setTimeout(() => {
                                toastContainer.removeChild(toast);
                            }, 300);
                        }, 3000);
                    }
                } else {
                    console.error('electronAPI가 없거나 send 메소드가 없음');
                    alert('ElectronAPI를 찾을 수 없습니다. 개발자 도구를 확인하세요.');
                }
            } catch (error) {
                console.error('서버 시작 버튼 이벤트 오류:', error);
                alert('서버 시작 중 오류: ' + error.message);
            }
        });
        
        console.log('서버 시작 버튼에 새 이벤트 리스너 추가 완료');
    } else {
        console.error('서버 시작 버튼을 찾을 수 없음!');
    }
    
    // API 확인
    console.log('electronAPI 존재 여부:', !!window.electronAPI);
    if (window.electronAPI) {
        console.log('electronAPI 메소드:', Object.keys(window.electronAPI));
    }
    
    // 서버 상태 이벤트 리스너 추가
    if (window.electronAPI && window.electronAPI.receive) {
        window.electronAPI.receive('server-status', (status) => {
            console.log('서버 상태 업데이트 수신:', status);
            
            // 서버 상태에 따른 UI 업데이트
            const serverToggle = document.getElementById('server-toggle');
            const startServerBtn = document.getElementById('start-server-btn');
            const stopServerBtn = document.getElementById('stop-server-btn');
            const serverStatusIcon = document.getElementById('server-status-icon');
            const serverStatusText = document.getElementById('server-status-text');
            
            if (status.running) {
                console.log('서버 실행 중 - UI 업데이트');
                if (serverToggle) serverToggle.classList.add('active');
                if (startServerBtn) startServerBtn.disabled = true;
                if (stopServerBtn) stopServerBtn.disabled = false;
                if (serverStatusIcon) {
                    serverStatusIcon.classList.remove('offline');
                    serverStatusIcon.classList.add('online');
                }
                if (serverStatusText) serverStatusText.textContent = '서버 중지';
            } else {
                console.log('서버 중지됨 - UI 업데이트');
                if (serverToggle) serverToggle.classList.remove('active');
                if (startServerBtn) startServerBtn.disabled = false;
                if (stopServerBtn) stopServerBtn.disabled = true;
                if (serverStatusIcon) {
                    serverStatusIcon.classList.remove('online');
                    serverStatusIcon.classList.add('offline');
                }
                if (serverStatusText) serverStatusText.textContent = '서버 시작';
            }
        });
        
        console.log('서버 상태 이벤트 리스너 등록 완료');
    }
});
