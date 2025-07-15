import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  theme: 'light' | 'dark' | 'auto';
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  loading: {
    global: boolean;
    components: Record<string, boolean>;
  };
  modals: {
    [key: string]: {
      open: boolean;
      data?: any;
    };
  };
  breadcrumbs: Array<{
    label: string;
    path?: string;
  }>;
  pageTitle: string;
  notifications: {
    panelOpen: boolean;
  };
  settings: {
    autoRefresh: boolean;
    refreshInterval: number;
    compactMode: boolean;
    showTooltips: boolean;
    animationsEnabled: boolean;
  };
  layout: {
    headerHeight: number;
    sidebarWidth: number;
    sidebarCollapsedWidth: number;
  };
  responsive: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };
}

const initialState: UIState = {
  theme: 'light',
  sidebarOpen: true,
  sidebarCollapsed: false,
  loading: {
    global: false,
    components: {},
  },
  modals: {},
  breadcrumbs: [],
  pageTitle: 'Dashboard',
  notifications: {
    panelOpen: false,
  },
  settings: {
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    compactMode: false,
    showTooltips: true,
    animationsEnabled: true,
  },
  layout: {
    headerHeight: 64,
    sidebarWidth: 280,
    sidebarCollapsedWidth: 64,
  },
  responsive: {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    breakpoint: 'lg',
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
    
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    
    setComponentLoading: (state, action: PayloadAction<{ component: string; loading: boolean }>) => {
      state.loading.components[action.payload.component] = action.payload.loading;
    },
    
    openModal: (state, action: PayloadAction<{ modal: string; data?: any }>) => {
      state.modals[action.payload.modal] = {
        open: true,
        data: action.payload.data,
      };
    },
    
    closeModal: (state, action: PayloadAction<string>) => {
      if (state.modals[action.payload]) {
        state.modals[action.payload].open = false;
        state.modals[action.payload].data = undefined;
      }
    },
    
    setBreadcrumbs: (state, action: PayloadAction<Array<{ label: string; path?: string }>>) => {
      state.breadcrumbs = action.payload;
    },
    
    setPageTitle: (state, action: PayloadAction<string>) => {
      state.pageTitle = action.payload;
      document.title = `${action.payload} - Terraform Dashboard`;
    },
    
    toggleNotificationsPanel: (state) => {
      state.notifications.panelOpen = !state.notifications.panelOpen;
    },
    
    setNotificationsPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.notifications.panelOpen = action.payload;
    },
    
    updateSettings: (state, action: PayloadAction<Partial<UIState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
      localStorage.setItem('uiSettings', JSON.stringify(state.settings));
    },
    
    updateResponsive: (state, action: PayloadAction<Partial<UIState['responsive']>>) => {
      state.responsive = { ...state.responsive, ...action.payload };
      
      // Auto-collapse sidebar on mobile
      if (action.payload.isMobile) {
        state.sidebarOpen = false;
      }
    },
    
    resetUI: (state) => {
      return {
        ...initialState,
        theme: state.theme, // Preserve theme
        settings: state.settings, // Preserve settings
      };
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  setGlobalLoading,
  setComponentLoading,
  openModal,
  closeModal,
  setBreadcrumbs,
  setPageTitle,
  toggleNotificationsPanel,
  setNotificationsPanelOpen,
  updateSettings,
  updateResponsive,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;
