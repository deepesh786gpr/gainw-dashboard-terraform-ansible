import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  persistent?: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
}

export interface NotificationAction {
  label: string;
  action: string;
  variant?: 'text' | 'outlined' | 'contained';
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  settings: {
    enableSound: boolean;
    enableDesktop: boolean;
    enableEmail: boolean;
    autoHide: boolean;
    hideDelay: number;
  };
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  settings: {
    enableSound: true,
    enableDesktop: true,
    enableEmail: false,
    autoHide: true,
    hideDelay: 5000,
  },
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      state.notifications.unshift(notification);
      state.unreadCount += 1;
      
      // Limit to 100 notifications
      if (state.notifications.length > 100) {
        const removed = state.notifications.splice(100);
        state.unreadCount -= removed.filter(n => !n.read).length;
      }
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index >= 0) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount -= 1;
        }
        state.notifications.splice(index, 1);
      }
    },
    
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount -= 1;
      }
    },
    
    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
      state.unreadCount = 0;
    },
    
    clearAllNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    
    clearReadNotifications: (state) => {
      state.notifications = state.notifications.filter(n => !n.read);
    },
    
    updateSettings: (state, action: PayloadAction<Partial<NotificationState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
  },
});

export const {
  addNotification,
  removeNotification,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  clearReadNotifications,
  updateSettings,
} = notificationSlice.actions;

// Helper action creators
export const showSuccessNotification = (title: string, message: string, persistent = false) =>
  addNotification({ type: 'success', title, message, persistent });

export const showErrorNotification = (title: string, message: string, persistent = true) =>
  addNotification({ type: 'error', title, message, persistent });

export const showWarningNotification = (title: string, message: string, persistent = false) =>
  addNotification({ type: 'warning', title, message, persistent });

export const showInfoNotification = (title: string, message: string, persistent = false) =>
  addNotification({ type: 'info', title, message, persistent });

export default notificationSlice.reducer;
