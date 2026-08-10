'use client';

import { useEffect, useState } from 'react';
import {
  initPwaInstallCapture,
  isIOSSafari,
  isPwaInstallable,
  isPwaInstalled,
  promptPwaInstall,
  subscribePwaInstall,
} from './pwaInstall';

export function usePwaInstall() {
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    initPwaInstallCapture();
    setInstallable(isPwaInstallable());
    setInstalled(isPwaInstalled());
    setIsIOS(isIOSSafari());
    return subscribePwaInstall(() => {
      setInstallable(isPwaInstallable());
      setInstalled(isPwaInstalled());
    });
  }, []);

  return { installable, installed, isIOS, promptInstall: promptPwaInstall };
}
