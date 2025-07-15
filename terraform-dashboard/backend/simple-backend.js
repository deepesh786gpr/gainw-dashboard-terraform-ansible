// Simple backend server for Terraform Dashboard
const http = require('http');
const url = require('url');

// Simple CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Simple in-memory data store
const data = {
  templates: [
    {
      id: 'ec2-instance',
      name: 'EC2 Instance',
      description: 'Basic EC2 instance template',
      category: 'compute',
      template_type: 'terraform',
      variables: {
        name: { type: 'string', description: 'Instance name', required: true },
        instance_type: { type: 'string', description: 'Instance type', default: 't3.micro' },
        region: { type: 'string', description: 'AWS region', default: 'us-east-1' }
      },
      terraformCode: `
resource "aws_instance" "main" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  
  tags = {
    Name = var.name
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }
}

variable "name" {
  description = "Instance name"
  type        = string
}

variable "instance_type" {
  description = "Instance type"
  type        = string
  default     = "t3.micro"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}
`
    }
  ],
  instances: [
    {
      id: 'i-08df90f7e10264afc',
      name: 'terraform-demo-server',
      state: 'running',
      type: 't3.micro',
      region: 'us-east-1',
      managedBy: 'terraform',
      environment: 'dev'
    }
  ],
  deployments: []
};

// Simple request handler
function handleRequest(req, res) {
  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  try {
    // Health check
    if (path === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }));
      return;
    }

    // Login endpoint
    if (path === '/api/auth/login' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const { username, password } = JSON.parse(body);
        if (username === 'admin' && password === 'admin123') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            tokens: {
              accessToken: 'dummy-token-12345',
              refreshToken: 'dummy-refresh-token'
            },
            user: {
              id: 'admin-001',
              username: 'admin',
              email: 'admin@terraform-dashboard.local',
              emailVerified: true,
              role: {
                id: 'admin',
                name: 'Administrator',
                description: 'Full system access',
                permissions: [
                  'templates:read',
                  'templates:write',
                  'templates:delete',
                  'deployments:read',
                  'deployments:write',
                  'deployments:delete',
                  'instances:read',
                  'instances:write',
                  'instances:delete',
                  'github:read',
                  'github:write',
                  'users:read',
                  'users:write',
                  'admin:all'
                ]
              },
              lastLogin: new Date().toISOString(),
              loginCount: 1,
              createdAt: '2024-01-01T00:00:00Z'
            }
          }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      });
      return;
    }

    // Templates endpoint
    if (path === '/api/templates') {
      res.writeHead(200);
      res.end(JSON.stringify(data.templates));
      return;
    }

    // Instances endpoint
    if (path === '/api/instances') {
      res.writeHead(200);
      res.end(JSON.stringify(data.instances));
      return;
    }

    // Deployments endpoint
    if (path === '/api/deployments') {
      res.writeHead(200);
      res.end(JSON.stringify(data.deployments));
      return;
    }

    // GitHub token validation
    if (path === '/api/github/validate-token' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const { token } = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({
          valid: token && token.length > 10,
          user: {
            login: 'testuser',
            name: 'Test User',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif',
            public_repos: 10
          }
        }));
      });
      return;
    }

    // GitHub user repos
    if (path === '/api/github/user/repos') {
      const mockRepos = [
        {
          id: 1,
          name: 'terraform-aws-vpc',
          full_name: 'testuser/terraform-aws-vpc',
          description: 'Terraform module for AWS VPC',
          private: false,
          html_url: 'https://github.com/testuser/terraform-aws-vpc',
          language: 'HCL',
          stargazers_count: 15,
          updated_at: '2024-01-15T10:00:00Z',
          owner: {
            login: 'testuser',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif'
          }
        },
        {
          id: 2,
          name: 'private-terraform-modules',
          full_name: 'testuser/private-terraform-modules',
          description: 'Private Terraform modules collection',
          private: true,
          html_url: 'https://github.com/testuser/private-terraform-modules',
          language: 'HCL',
          stargazers_count: 0,
          updated_at: '2024-01-14T15:30:00Z',
          owner: {
            login: 'testuser',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif'
          }
        }
      ];

      res.writeHead(200);
      res.end(JSON.stringify({
        repositories: mockRepos,
        total_count: mockRepos.length
      }));
      return;
    }

    // GitHub search
    if (path.startsWith('/api/github/search')) {
      const mockResults = [
        {
          id: 3,
          name: 'terraform-provider-aws',
          full_name: 'hashicorp/terraform-provider-aws',
          description: 'Terraform AWS provider',
          private: false,
          html_url: 'https://github.com/hashicorp/terraform-provider-aws',
          language: 'Go',
          stargazers_count: 8500,
          updated_at: '2024-01-15T12:00:00Z',
          owner: {
            login: 'hashicorp',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif'
          }
        }
      ];

      res.writeHead(200);
      res.end(JSON.stringify({
        repositories: mockResults,
        total_count: mockResults.length
      }));
      return;
    }

    // Default 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// Create and start server
const server = http.createServer(handleRequest);
const PORT = 5000;

server.listen(PORT, () => {
  console.log(`🚀 Terraform Dashboard Backend running on port ${PORT}`);
  console.log(`📊 Dashboard URL: http://localhost:3000`);
  console.log(`🌐 Network URL: http://192.168.31.94:3000`);
  console.log(`🔐 Default admin credentials: admin / admin123`);
  console.log(`🔗 Login URL: http://192.168.31.94:3000/login`);
  console.log(`✅ Backend API: http://192.168.31.94:${PORT}/api/health`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
