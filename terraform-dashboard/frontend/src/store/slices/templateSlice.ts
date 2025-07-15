import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'list' | 'map';
  description: string;
  required: boolean;
  default?: any;
  options?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  terraformCode: string;
  variables: TemplateVariable[];
  tags: string[];
  version: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  isPublic: boolean;
  rating: number;
  reviews: number;
}

export interface TemplateState {
  templates: Template[];
  currentTemplate: Template | null;
  categories: string[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  filters: {
    category: string;
    search: string;
    author: string;
    tags: string[];
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const initialState: TemplateState = {
  templates: [],
  currentTemplate: null,
  categories: ['Compute', 'Storage', 'Network', 'Database', 'Security', 'Monitoring'],
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  filters: {
    category: '',
    search: '',
    author: '',
    tags: [],
  },
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
  },
};

// Mock API
const mockAPI = {
  getTemplates: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            name: 'EC2 Instance',
            description: 'Deploy a single EC2 instance with security group',
            category: 'Compute',
            terraformCode: `resource "aws_instance" "main" {
  ami           = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name
  
  vpc_security_group_ids = [aws_security_group.main.id]
  
  tags = {
    Name = var.instance_name
    Environment = var.environment
  }
}

resource "aws_security_group" "main" {
  name_prefix = "\${var.instance_name}-"
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`,
            variables: [
              {
                name: 'instance_name',
                type: 'string',
                description: 'Name for the EC2 instance',
                required: true,
              },
              {
                name: 'instance_type',
                type: 'string',
                description: 'EC2 instance type',
                required: true,
                default: 't3.micro',
                options: ['t3.micro', 't3.small', 't3.medium', 't3.large'],
              },
              {
                name: 'ami_id',
                type: 'string',
                description: 'AMI ID for the instance',
                required: true,
                default: 'ami-0c02fb55956c7d316',
              },
              {
                name: 'key_name',
                type: 'string',
                description: 'EC2 Key Pair name',
                required: false,
              },
              {
                name: 'environment',
                type: 'string',
                description: 'Environment tag',
                required: true,
                options: ['development', 'staging', 'production'],
              },
            ],
            tags: ['aws', 'ec2', 'compute'],
            version: '1.0.0',
            author: 'System',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            usageCount: 25,
            isPublic: true,
            rating: 4.5,
            reviews: 12,
          },
          {
            id: '2',
            name: 'RDS Database',
            description: 'Deploy an RDS database instance with subnet group',
            category: 'Database',
            terraformCode: `resource "aws_db_instance" "main" {
  identifier = var.db_identifier
  engine     = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class
  allocated_storage = var.allocated_storage
  
  db_name  = var.database_name
  username = var.username
  password = var.password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window
  
  skip_final_snapshot = true
  
  tags = {
    Name = var.db_identifier
    Environment = var.environment
  }
}`,
            variables: [
              {
                name: 'db_identifier',
                type: 'string',
                description: 'Database identifier',
                required: true,
              },
              {
                name: 'engine',
                type: 'string',
                description: 'Database engine',
                required: true,
                default: 'mysql',
                options: ['mysql', 'postgres', 'mariadb'],
              },
              {
                name: 'instance_class',
                type: 'string',
                description: 'RDS instance class',
                required: true,
                default: 'db.t3.micro',
              },
            ],
            tags: ['aws', 'rds', 'database'],
            version: '1.0.0',
            author: 'System',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            usageCount: 18,
            isPublic: true,
            rating: 4.2,
            reviews: 8,
          },
        ]);
      }, 800);
    });
  },
  createTemplate: async (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ...template,
          id: `template_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }, 1500);
    });
  },
};

// Async thunks
export const fetchTemplates = createAsyncThunk(
  'templates/fetchTemplates',
  async (params: { page?: number; limit?: number; filters?: any } = {}, { rejectWithValue }) => {
    try {
      const response = await mockAPI.getTemplates();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch templates');
    }
  }
);

export const createTemplate = createAsyncThunk(
  'templates/createTemplate',
  async (templateData: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      const response = await mockAPI.createTemplate(templateData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create template');
    }
  }
);

const templateSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentTemplate: (state, action: PayloadAction<Template | null>) => {
      state.currentTemplate = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<typeof initialState.filters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    updatePagination: (state, action: PayloadAction<Partial<typeof initialState.pagination>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    incrementUsageCount: (state, action: PayloadAction<string>) => {
      const template = state.templates.find(t => t.id === action.payload);
      if (template) {
        template.usageCount += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch templates
      .addCase(fetchTemplates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.isLoading = false;
        state.templates = action.payload as Template[];
        state.pagination.total = (action.payload as Template[]).length;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create template
      .addCase(createTemplate.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.isCreating = false;
        state.templates.unshift(action.payload as Template);
      })
      .addCase(createTemplate.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  setCurrentTemplate,
  updateFilters,
  updatePagination,
  incrementUsageCount,
} = templateSlice.actions;

export default templateSlice.reducer;
