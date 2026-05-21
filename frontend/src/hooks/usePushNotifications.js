import { useState } from 'react';
import api from '../utils/api';

export const usePushNotifications = () => {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [subscription, setSubscription] = useState(null);

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push not supported');
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);

    if (perm !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;

    if (!vapidKey) {
      console.warn('REACT_APP_VAPID_PUBLIC_KEY not set — push subscription skipped');
      return;
    }

    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    await api.post('/notifications/subscribe', { subscription: sub });
    setSubscription(sub);
  };

  const unsubscribe = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      await api.delete('/notifications/subscribe');
      setSubscription(null);
    }
  };

  return { permission, subscription, subscribe, unsubscribe };
};
