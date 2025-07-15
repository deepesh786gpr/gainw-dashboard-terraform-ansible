const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('database.sqlite');

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    role_id TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    terraform_code TEXT,
    variables TEXT,
    template_type TEXT DEFAULT 'terraform',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default admin user
  db.run(`INSERT OR IGNORE INTO users (id, username, password, email, role_id) 
          VALUES ('admin-user-001', 'admin', 'admin123', 'admin@terraform-dashboard.local', 'admin')`);
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign(
      { 
        userId: 'admin-user-001',
        username: 'admin',
        email: 'admin@terraform-dashboard.local',
        roleId: 'admin'
      },
      'default-secret',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      tokens: {
        accessToken: token,
        refreshToken: token
      },
      user: {
        id: 'admin-user-001',
        username: 'admin',
        email: 'admin@terraform-dashboard.local',
        roleId: 'admin'
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Templates endpoint
app.get('/api/templates', (req, res) => {
  db.all('SELECT * FROM templates ORDER BY category, name', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.json([]);
    }

    const templates = rows.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      variables: JSON.parse(template.variables || '{}'),
      terraformCode: template.terraform_code,
      template_type: template.template_type || 'terraform',
      createdAt: template.created_at,
      updatedAt: template.updated_at
    }));

    res.json(templates);
  });
});

// GitHub token validation
app.post('/api/github/validate-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard'
      }
    });

    if (response.ok) {
      const user = await response.json();
      res.json({
        valid: true,
        user: {
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url,
          public_repos: user.public_repos
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid GitHub token' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// GitHub user repositories
app.get('/api/github/user/repos', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.github.com/user/repos?type=all&sort=updated&per_page=50', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard'
      }
    });

    if (response.ok) {
      const repos = await response.json();
      res.json({
        repositories: repos.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          updated_at: repo.updated_at,
          owner: {
            login: repo.owner.login,
            avatar_url: repo.owner.avatar_url
          }
        })),
        total_count: repos.length
      });
    } else {
      res.status(response.status).json({ error: 'Failed to fetch repositories' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// GitHub search
app.get('/api/github/search', async (req, res) => {
  try {
    const { q, token } = req.query;
    
    if (!token || !q) {
      return res.status(400).json({ error: 'GitHub token and query are required' });
    }

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=20`, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard'
      }
    });

    if (response.ok) {
      const results = await response.json();
      res.json({
        repositories: results.items.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          updated_at: repo.updated_at,
          owner: {
            login: repo.owner.login,
            avatar_url: repo.owner.avatar_url
          }
        })),
        total_count: results.total_count
      });
    } else {
      res.status(response.status).json({ error: 'Failed to search repositories' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to search repositories' });
  }
});

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`🚀 Terraform Dashboard Backend running on port ${PORT}`);
  console.log(`📊 Dashboard URL: http://localhost:3000`);
  console.log(`🌐 Network URL: http://192.168.31.94:3000`);
  console.log(`🔐 Default admin credentials: admin / admin123`);
  console.log(`🔗 Login URL: http://192.168.31.94:3000/login`);
});
