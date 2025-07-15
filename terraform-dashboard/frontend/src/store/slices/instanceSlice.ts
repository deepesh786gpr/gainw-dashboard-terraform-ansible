import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface Instance {
  id: string;
  name: string;
  type: string;
  state: 'pending' | 'running' | 'stopping' | 'stopped' | 'terminated';
  publicIp?: string;
  privateIp: string;
  availabilityZone: string;
  environment: string;
  tags: Record<string, string>;
  launchTime: string;
  monitoring: boolean;
  securityGroups: string[];
  keyName?: string;
  platform?: string;
  architecture?: string;
}

export interface InstanceAction {
  id: string;
  instanceId: string;
  action: 'start' | 'stop' | 'restart' | 'terminate';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
}

export interface InstanceState {
  instances: Instance[];
  selectedInstances: string[];
  actions: InstanceAction[];
  isLoading: boolean;
  isPerformingAction: boolean;
  error: string | null;
  filters: {
    state: string;
    environment: string;
    type: string;
    search: string;
  };
  stats: {
    total: number;
    running: number;
    stopped: number;
    pending: number;
  };
}

const initialState: InstanceState = {
  instances: [],
  selectedInstances: [],
  actions: [],
  isLoading: false,
  isPerformingAction: false,
  error: null,
  filters: {
    state: '',
    environment: '',
    type: '',
    search: '',
  },
  stats: {
    total: 0,
    running: 0,
    stopped: 0,
    pending: 0,
  },
};

// Mock API calls - replace with actual API
const mockAPI = {
  getInstances: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: 'i-0e43e6683baf16e35',
            name: 'web-server-prod',
            type: 't3.small',
            state: 'running',
            publicIp: '54.123.45.67',
            privateIp: '10.0.1.100',
            availabilityZone: 'us-east-1a',
            environment: 'production',
            tags: { Environment: 'production', Project: 'web-app' },
            launchTime: '2024-01-15T10:30:00Z',
            monitoring: true,
            securityGroups: ['sg-12345678'],
          },
          {
            id: 'i-0f44f7794caf27f46',
            name: 'database-dev',
            type: 't3.micro',
            state: 'stopped',
            privateIp: '10.0.2.50',
            availabilityZone: 'us-east-1b',
            environment: 'development',
            tags: { Environment: 'development', Project: 'web-app' },
            launchTime: '2024-01-14T15:20:00Z',
            monitoring: false,
            securityGroups: ['sg-87654321'],
          },
        ]);
      }, 1000);
    });
  },
  performAction: async (instanceId: string, action: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: `action_${Date.now()}`,
          instanceId,
          action,
          status: 'completed',
          timestamp: new Date().toISOString(),
        });
      }, 2000);
    });
  },
};

// Async thunks
export const fetchInstances = createAsyncThunk(
  'instances/fetchInstances',
  async (_, { rejectWithValue }) => {
    try {
      const response = await mockAPI.getInstances();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch instances');
    }
  }
);

export const startInstance = createAsyncThunk(
  'instances/startInstance',
  async (instanceId: string, { rejectWithValue }) => {
    try {
      const response = await mockAPI.performAction(instanceId, 'start');
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to start instance');
    }
  }
);

export const stopInstance = createAsyncThunk(
  'instances/stopInstance',
  async (instanceId: string, { rejectWithValue }) => {
    try {
      const response = await mockAPI.performAction(instanceId, 'stop');
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to stop instance');
    }
  }
);

export const restartInstance = createAsyncThunk(
  'instances/restartInstance',
  async (instanceId: string, { rejectWithValue }) => {
    try {
      const response = await mockAPI.performAction(instanceId, 'restart');
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to restart instance');
    }
  }
);

export const terminateInstance = createAsyncThunk(
  'instances/terminateInstance',
  async (instanceId: string, { rejectWithValue }) => {
    try {
      const response = await mockAPI.performAction(instanceId, 'terminate');
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to terminate instance');
    }
  }
);

const instanceSlice = createSlice({
  name: 'instances',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    selectInstance: (state, action: PayloadAction<string>) => {
      if (!state.selectedInstances.includes(action.payload)) {
        state.selectedInstances.push(action.payload);
      }
    },
    deselectInstance: (state, action: PayloadAction<string>) => {
      state.selectedInstances = state.selectedInstances.filter(id => id !== action.payload);
    },
    selectAllInstances: (state) => {
      state.selectedInstances = state.instances.map(instance => instance.id);
    },
    deselectAllInstances: (state) => {
      state.selectedInstances = [];
    },
    updateFilters: (state, action: PayloadAction<Partial<typeof initialState.filters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    updateInstanceState: (state, action: PayloadAction<{ id: string; newState: Instance['state'] }>) => {
      const instance = state.instances.find(i => i.id === action.payload.id);
      if (instance) {
        instance.state = action.payload.newState;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch instances
      .addCase(fetchInstances.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInstances.fulfilled, (state, action) => {
        state.isLoading = false;
        state.instances = action.payload as Instance[];
        
        // Update stats
        state.stats.total = state.instances.length;
        state.stats.running = state.instances.filter(i => i.state === 'running').length;
        state.stats.stopped = state.instances.filter(i => i.state === 'stopped').length;
        state.stats.pending = state.instances.filter(i => i.state === 'pending').length;
      })
      .addCase(fetchInstances.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Instance actions
      .addCase(startInstance.pending, (state) => {
        state.isPerformingAction = true;
      })
      .addCase(startInstance.fulfilled, (state, action) => {
        state.isPerformingAction = false;
        state.actions.unshift(action.payload as InstanceAction);
        // Update instance state
        const instance = state.instances.find(i => i.id === (action.payload as InstanceAction).instanceId);
        if (instance) {
          instance.state = 'running';
        }
      })
      .addCase(startInstance.rejected, (state, action) => {
        state.isPerformingAction = false;
        state.error = action.payload as string;
      })
      // Similar patterns for stop, restart, terminate
      .addCase(stopInstance.fulfilled, (state, action) => {
        state.isPerformingAction = false;
        state.actions.unshift(action.payload as InstanceAction);
        const instance = state.instances.find(i => i.id === (action.payload as InstanceAction).instanceId);
        if (instance) {
          instance.state = 'stopped';
        }
      })
      .addCase(restartInstance.fulfilled, (state, action) => {
        state.isPerformingAction = false;
        state.actions.unshift(action.payload as InstanceAction);
      })
      .addCase(terminateInstance.fulfilled, (state, action) => {
        state.isPerformingAction = false;
        state.actions.unshift(action.payload as InstanceAction);
        const instance = state.instances.find(i => i.id === (action.payload as InstanceAction).instanceId);
        if (instance) {
          instance.state = 'terminated';
        }
      });
  },
});

export const {
  clearError,
  selectInstance,
  deselectInstance,
  selectAllInstances,
  deselectAllInstances,
  updateFilters,
  updateInstanceState,
} = instanceSlice.actions;

export default instanceSlice.reducer;
