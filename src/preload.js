const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

// 시스템 IP 주소 가져오기
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const iface = interfaces[interfaceName];
    for (let i = 0; i < iface.length; i++) {
      const { address, family, internal } = iface[i];
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return 'localhost';
}

// 메인 프로세스와 렌더러 프로세스 간의 통신 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 시스템 정보
  getSystemInfo: () => {
    return {
      platform: os.platform(),
      hostname: os.hostname(),
      ipAddress: getLocalIpAddress()
    };
  },
  
  // 메인 프로세스에 메시지 전송
  sendMessage: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  
  // 메인 프로세스로부터 메시지 수신
  receiveMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});