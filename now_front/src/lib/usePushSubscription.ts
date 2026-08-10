'use client';

import { useEffect, useState } from 'react';
import {
  getCurrentSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from './pushSubscription';

export function usePushSubscription() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    getCurrentSubscription()
      .then((sub) => setSubscribed(!!sub))
      .finally(() => setLoading(false));
  }, []);

  const subscribe = async (regionPref?: string | null) => {
    setLoading(true);
    const ok = await subscribeToPush(regionPref);
    setSubscribed(ok);
    setLoading(false);
    return ok;
  };

  const unsubscribe = async () => {
    setLoading(true);
    const ok = await unsubscribeFromPush();
    if (ok) setSubscribed(false);
    setLoading(false);
    return ok;
  };

  return { supported, subscribed, loading, subscribe, unsubscribe };
}
