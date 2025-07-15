import React, { useEffect } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  IconButton,
  Slide,
  SlideProps,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../../store';
import { removeNotification, markAsRead } from '../../store/slices/notificationSlice';

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

const NotificationSystem: React.FC = () => {
  const dispatch = useAppDispatch();
  const { notifications, settings } = useAppSelector((state) => state.notifications);
  
  // Get unread notifications for display
  const activeNotifications = notifications.filter(n => !n.read && !n.persistent);
  const persistentNotifications = notifications.filter(n => !n.read && n.persistent);

  // Auto-hide notifications
  useEffect(() => {
    if (!settings.autoHide) return;

    const timers: NodeJS.Timeout[] = [];

    activeNotifications.forEach((notification) => {
      const timer = setTimeout(() => {
        dispatch(markAsRead(notification.id));
      }, settings.hideDelay);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [activeNotifications, settings.autoHide, settings.hideDelay, dispatch]);

  // Play sound for new notifications
  useEffect(() => {
    if (settings.enableSound && activeNotifications.length > 0) {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  }, [activeNotifications.length, settings.enableSound]);

  // Request desktop notification permission
  useEffect(() => {
    if (settings.enableDesktop && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [settings.enableDesktop]);

  // Show desktop notifications
  useEffect(() => {
    if (settings.enableDesktop && 'Notification' in window && Notification.permission === 'granted') {
      activeNotifications.forEach((notification) => {
        const desktopNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id,
        });

        desktopNotification.onclick = () => {
          window.focus();
          dispatch(markAsRead(notification.id));
          desktopNotification.close();
        };

        setTimeout(() => {
          desktopNotification.close();
        }, settings.hideDelay);
      });
    }
  }, [activeNotifications, settings.enableDesktop, settings.hideDelay, dispatch]);

  const handleClose = (notificationId: string) => {
    dispatch(removeNotification(notificationId));
  };

  const handleAction = (notificationId: string, actionType: string) => {
    // Handle notification actions
    switch (actionType) {
      case 'dismiss':
        dispatch(removeNotification(notificationId));
        break;
      case 'mark_read':
        dispatch(markAsRead(notificationId));
        break;
      default:
        // Custom actions can be handled here
        break;
    }
  };

  return (
    <>
      {/* Regular auto-hiding notifications */}
      {activeNotifications.slice(0, 3).map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          TransitionComponent={SlideTransition}
          sx={{
            mt: index * 8, // Stack notifications
          }}
        >
          <Alert
            severity={notification.type}
            variant="filled"
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => handleClose(notification.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ minWidth: 300, maxWidth: 500 }}
          >
            <AlertTitle>{notification.title}</AlertTitle>
            {notification.message}
            {notification.actions && (
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                {notification.actions.map((action, actionIndex) => (
                  <Button
                    key={actionIndex}
                    size="small"
                    variant={action.variant || 'text'}
                    color="inherit"
                    onClick={() => handleAction(notification.id, action.action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </Box>
            )}
          </Alert>
        </Snackbar>
      ))}

      {/* Persistent notifications */}
      {persistentNotifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            mb: index * 8, // Stack persistent notifications at bottom
          }}
        >
          <Alert
            severity={notification.type}
            variant="outlined"
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => handleClose(notification.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ minWidth: 300, maxWidth: 500 }}
          >
            <AlertTitle>{notification.title}</AlertTitle>
            {notification.message}
            {notification.actions && (
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                {notification.actions.map((action, actionIndex) => (
                  <Button
                    key={actionIndex}
                    size="small"
                    variant={action.variant || 'text'}
                    onClick={() => handleAction(notification.id, action.action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </Box>
            )}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default NotificationSystem;
