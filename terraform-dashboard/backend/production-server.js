const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Basic middleware
app.use(cors());
app.use(express.json());

// Mock users database (in production, use real database)
const users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@terraform-dashboard.com',
    password: 'admin123', // In production, hash passwords!
    role: 'admin'
  },
  {
    id: 2,
    username: 'user',
    email: 'user@terraform-dashboard.com',
    password: 'user123',
    role: 'user'
  },
  {
    id: 3,
    username: 'demo',
    email: 'demo@terraform-dashboard.com',
    password: 'demo123',
    role: 'user'
  }
];

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Health checks
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Terraform Dashboard Production Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Production API is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/auth/login',
      '/api/auth/register',
      '/api/instances',
      '/api/vpc-resources',
      '/api/deployments',
      '/api/templates'
    ]
  });
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user (in production, hash and compare passwords)
    const user = users.find(u => 
      (u.username === username || u.email === username) && u.password === password
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user info and token
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    });

    console.log(`✅ User ${username} logged in successfully`);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create new user
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password, // In production, hash this!
      role: 'user'
    };

    users.push(newUser);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        username: newUser.username, 
        email: newUser.email, 
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      },
      token
    });

    console.log(`✅ New user ${username} registered successfully`);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// Logout endpoint (client-side token removal)
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// Mock API endpoints for basic functionality
app.get('/api/instances', authenticateToken, (req, res) => {
  res.json([
    {
      id: 'i-1234567890abcdef0',
      name: 'Web Server 1',
      state: 'running',
      type: 't3.micro',
      publicIp: '54.123.45.67',
      privateIp: '10.0.1.10',
      launchTime: '2024-01-15T10:30:00Z',
      region: 'us-east-1',
      availabilityZone: 'us-east-1a'
    },
    {
      id: 'i-0987654321fedcba0',
      name: 'Database Server',
      state: 'stopped',
      type: 't3.small',
      publicIp: null,
      privateIp: '10.0.1.20',
      launchTime: '2024-01-14T15:45:00Z',
      region: 'us-east-1',
      availabilityZone: 'us-east-1b'
    },
    {
      id: 'i-abcdef1234567890',
      name: 'Load Balancer',
      state: 'running',
      type: 't3.medium',
      publicIp: '54.123.45.68',
      privateIp: '10.0.1.30',
      launchTime: '2024-01-16T08:15:00Z',
      region: 'us-east-1',
      availabilityZone: 'us-east-1c'
    }
  ]);
});

app.get('/api/vpc-resources', authenticateToken, (req, res) => {
  res.json([
    {
      id: 'vpc-12345678',
      name: 'Main VPC',
      cidrBlock: '10.0.0.0/16',
      state: 'available',
      isDefault: false,
      resources: {
        subnets: [
          {
            id: 'subnet-12345678',
            name: 'Public Subnet 1',
            cidrBlock: '10.0.1.0/24',
            availabilityZone: 'us-east-1a',
            availableIpAddressCount: 250,
            state: 'available',
            isPublic: true,
            tags: []
          },
          {
            id: 'subnet-87654321',
            name: 'Private Subnet 1',
            cidrBlock: '10.0.2.0/24',
            availabilityZone: 'us-east-1b',
            availableIpAddressCount: 245,
            state: 'available',
            isPublic: false,
            tags: []
          }
        ],
        routeTables: [
          {
            id: 'rtb-12345678',
            name: 'Main Route Table',
            routes: [
              {
                destinationCidrBlock: '10.0.0.0/16',
                gatewayId: 'local',
                state: 'active'
              }
            ],
            associations: [
              {
                subnetId: 'subnet-12345678',
                main: false
              }
            ],
            tags: []
          }
        ],
        internetGateways: [
          {
            id: 'igw-12345678',
            name: 'Main Internet Gateway',
            state: 'attached',
            attachments: [
              {
                State: 'attached',
                VpcId: 'vpc-12345678'
              }
            ],
            tags: []
          }
        ],
        natGateways: [],
        securityGroups: [
          {
            id: 'sg-12345678',
            name: 'default',
            description: 'Default security group',
            inboundRules: 1,
            outboundRules: 1,
            tags: []
          }
        ],
        networkAcls: [
          {
            id: 'acl-12345678',
            name: 'Default Network ACL',
            isDefault: true,
            entries: 4,
            associations: 2,
            tags: []
          }
        ],
        vpcEndpoints: []
      },
      tags: [
        {
          Key: 'Name',
          Value: 'Main VPC'
        },
        {
          Key: 'Environment',
          Value: 'Production'
        }
      ]
    }
  ]);
});

app.get('/api/deployments', authenticateToken, (req, res) => {
  res.json([
    {
      id: 'deploy-123',
      name: 'Web Application Deployment',
      status: 'completed',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:15:00Z',
      template: 'EC2 Basic Template',
      region: 'us-east-1'
    },
    {
      id: 'deploy-124',
      name: 'Database Setup',
      status: 'in-progress',
      createdAt: '2024-01-16T09:30:00Z',
      updatedAt: '2024-01-16T09:45:00Z',
      template: 'RDS Template',
      region: 'us-east-1'
    }
  ]);
});

app.get('/api/templates', authenticateToken, (req, res) => {
  res.json([
    {
      id: 'template-1',
      name: 'EC2 Basic Template',
      description: 'Basic EC2 instance template with security group',
      type: 'ec2',
      createdAt: '2024-01-10T09:00:00Z',
      variables: ['instance_type', 'ami_id', 'key_name']
    },
    {
      id: 'template-2',
      name: 'RDS MySQL Template',
      description: 'MySQL RDS instance with backup configuration',
      type: 'rds',
      createdAt: '2024-01-12T14:30:00Z',
      variables: ['db_instance_class', 'db_name', 'username']
    },
    {
      id: 'template-3',
      name: 'VPC Network Template',
      description: 'Complete VPC setup with public and private subnets',
      type: 'vpc',
      createdAt: '2024-01-14T11:15:00Z',
      variables: ['vpc_cidr', 'availability_zones', 'enable_nat_gateway']
    }
  ]);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Terraform Dashboard Production Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 API Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Demo credentials:`);
  console.log(`   👑 Admin: username=admin, password=admin123`);
  console.log(`   👤 User: username=user, password=user123`);
  console.log(`   🎭 Demo: username=demo, password=demo123`);
  console.log(`🚀 Server ready for production deployment!`);
});
