import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastActivity: Date.now(),
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(credentials);
      localStorage.setItem('token', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData: { username: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authAPI.register(userData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Registration failed');
    }
  }
);

export const verifyToken = createAsyncThunk(
  'auth/verifyToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.verifyToken();
      return response;
    } catch (error: any) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return rejectWithValue(error.response?.data?.error || 'Token verification failed');
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const refreshToken = state.auth.refreshToken;
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authAPI.refreshToken(refreshToken);
      localStorage.setItem('token', response.accessToken);
      return response;
    } catch (error: any) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return rejectWithValue(error.response?.data?.error || 'Token refresh failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (state.auth.token) {
        await authAPI.logout();
      }
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      localStorage.setItem('token', action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.lastActivity = Date.now();
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
      })
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
        // Don't auto-login after registration
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Verify token
      .addCase(verifyToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(verifyToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.lastActivity = Date.now();
      })
      .addCase(verifyToken.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
      })
      // Refresh token
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.token = action.payload.accessToken;
        state.lastActivity = Date.now();
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.error = null;
      });
  },
});

export const { clearError, updateLastActivity, setToken } = authSlice.actions;
export default authSlice.reducer;
