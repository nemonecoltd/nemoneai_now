import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nemoneai.now',
  appName: 'NEMONE PACE',
  webDir: 'public', // 우리는 URL을 직접 띄울 것이므로 껍데기 폴더만 지정합니다.
  server: {
    url: 'https://now.nemoneai.com', // 웹사이트 주소를 직접 띄워 실시간 업데이트 적용!
    cleartext: true
  }
};

export default config;
