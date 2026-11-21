import { useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { loadStudyReminder } from './notify';
import { pushActive, pushSupported, subscribePush } from './webPush';

/** Students who already allowed notifications get push on this device too, without asking again. */
export const useEnsurePush = () => {
  const { user, demo } = useAuth();
  const id = user?.id;
  useEffect(() => {
    if (!id || demo || !pushSupported() || pushActive() || Notification.permission !== 'granted') return;
    void subscribePush(loadStudyReminder());
  }, [id, demo]);
};
