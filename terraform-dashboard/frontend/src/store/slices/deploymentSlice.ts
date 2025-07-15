import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface Deployment {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  environment: string;
  status: 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'destroying' | 'destroyed' | 'error';
  variables: Record<string, any>;
  logs: string[];
  createdAt: string;
  updatedAt: string;
  planOutput?: string;
  applyOutput?: string;
  resources?: TerraformResource[];
}

export interface TerraformResource {
  address: string;
  type: string;
  name: string;
  provider: string;
  instances: any[];
}

export interface DeploymentOperation {
  id: string;
  deploymentId: string;
  type: 'plan' | 'apply' | 'destroy';
  status: 'pending' | 'running' | 'success' | 'error';
  logs: string[];
  startTime: string;
  endTime?: string;
  exitCode?: number;
}

export interface DeploymentState {
  deployments: Deployment[];
  currentDeployment: Deployment | null;
  operations: DeploymentOperation[];
  currentOperation: DeploymentOperation | null;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  error: string | null;
  filters: {
    environment: string;
    status: string;
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const initialState: DeploymentState = {
  deployments: [],
  currentDeployment: null,
  operations: [],
  currentOperation: null,
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  error: null,
  filters: {
    environment: '',
    status: '',
    search: '',
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },
};

// Async thunks
export const fetchDeployments = createAsyncThunk(
  'deployments/fetchDeployments',
  async (params: { page?: number; limit?: number; filters?: any } = {}, { rejectWithValue }) => {
    try {
      const response = await deploymentAPI.getDeployments(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch deployments');
    }
  }
);

export const fetchDeployment = createAsyncThunk(
  'deployments/fetchDeployment',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await deploymentAPI.getDeployment(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch deployment');
    }
  }
);

export const createDeployment = createAsyncThunk(
  'deployments/createDeployment',
  async (deploymentData: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt' | 'status'>, { rejectWithValue }) => {
    try {
      const response = await deploymentAPI.createDeployment(deploymentData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create deployment');
    }
  }
);

export const planDeployment = createAsyncThunk(
  'deployments/planDeployment',
  async (deploymentData: any, { rejectWithValue }) => {
    try {
      const response = await deploymentAPI.planDeployment(deploymentData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to plan deployment');
    }
  }
);

export const applyDeployment = createAsyncThunk(
  'deployments/applyDeployment',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await deploymentAPI.applyDeployment(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to apply deployment');
    }
  }
);

export const destroyDeployment = createAsyncThunk(
  'deployments/destroyDeployment',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await deploymentAPI.destroyDeployment(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to destroy deployment');
    }
  }
);

export const fetchOperation = createAsyncThunk(
  'deployments/fetchOperation',
  async (operationId: string, { rejectWithValue }) => {
    try {
      const response = await deploymentAPI.getOperation(operationId);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch operation');
    }
  }
);

const deploymentSlice = createSlice({
  name: 'deployments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentDeployment: (state, action: PayloadAction<Deployment | null>) => {
      state.currentDeployment = action.payload;
    },
    setCurrentOperation: (state, action: PayloadAction<DeploymentOperation | null>) => {
      state.currentOperation = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<typeof initialState.filters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    updatePagination: (state, action: PayloadAction<Partial<typeof initialState.pagination>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    updateDeploymentStatus: (state, action: PayloadAction<{ id: string; status: Deployment['status'] }>) => {
      const deployment = state.deployments.find(d => d.id === action.payload.id);
      if (deployment) {
        deployment.status = action.payload.status;
        deployment.updatedAt = new Date().toISOString();
      }
      if (state.currentDeployment?.id === action.payload.id) {
        state.currentDeployment.status = action.payload.status;
        state.currentDeployment.updatedAt = new Date().toISOString();
      }
    },
    addOperationLog: (state, action: PayloadAction<{ operationId: string; log: string }>) => {
      const operation = state.operations.find(op => op.id === action.payload.operationId);
      if (operation) {
        operation.logs.push(action.payload.log);
      }
      if (state.currentOperation?.id === action.payload.operationId) {
        state.currentOperation.logs.push(action.payload.log);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch deployments
      .addCase(fetchDeployments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDeployments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.deployments = action.payload.deployments;
        state.pagination.total = action.payload.total;
      })
      .addCase(fetchDeployments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch deployment
      .addCase(fetchDeployment.fulfilled, (state, action) => {
        state.currentDeployment = action.payload;
      })
      // Create deployment
      .addCase(createDeployment.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createDeployment.fulfilled, (state, action) => {
        state.isCreating = false;
        state.deployments.unshift(action.payload);
      })
      .addCase(createDeployment.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      })
      // Plan deployment
      .addCase(planDeployment.fulfilled, (state, action) => {
        state.currentOperation = action.payload;
        state.operations.unshift(action.payload);
      })
      // Apply deployment
      .addCase(applyDeployment.fulfilled, (state, action) => {
        state.currentOperation = action.payload;
        state.operations.unshift(action.payload);
      })
      // Destroy deployment
      .addCase(destroyDeployment.pending, (state) => {
        state.isDeleting = true;
      })
      .addCase(destroyDeployment.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.currentOperation = action.payload;
        state.operations.unshift(action.payload);
      })
      .addCase(destroyDeployment.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      })
      // Fetch operation
      .addCase(fetchOperation.fulfilled, (state, action) => {
        const existingIndex = state.operations.findIndex(op => op.id === action.payload.id);
        if (existingIndex >= 0) {
          state.operations[existingIndex] = action.payload;
        } else {
          state.operations.unshift(action.payload);
        }
        if (state.currentOperation?.id === action.payload.id) {
          state.currentOperation = action.payload;
        }
      });
  },
});

export const {
  clearError,
  setCurrentDeployment,
  setCurrentOperation,
  updateFilters,
  updatePagination,
  updateDeploymentStatus,
  addOperationLog,
} = deploymentSlice.actions;

export default deploymentSlice.reducer;
