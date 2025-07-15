const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Test GitHub user repositories endpoint
app.get('/api/github/user/repos', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log('🔍 Testing GitHub user repos with token:', token.substring(0, 10) + '...');

    // Test GitHub API call
    const fetch = (await import('node-fetch')).default;
    const reposUrl = `https://api.github.com/user/repos?type=all&sort=updated&per_page=20`;

    const githubResponse = await fetch(reposUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard-Test',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    console.log('GitHub API Response Status:', githubResponse.status);

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.log('❌ GitHub API Error:', errorText);
      return res.status(githubResponse.status).json({
        error: 'Failed to fetch user repositories',
        details: errorText
      });
    }

    const repositories = await githubResponse.json();
    console.log(`✅ Found ${repositories.length} repositories`);
    
    // Log first few repo names for debugging
    repositories.slice(0, 3).forEach(repo => {
      console.log(`  - ${repo.full_name} (${repo.private ? 'private' : 'public'})`);
    });

    res.json({
      repositories: repositories.map(repo => ({
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
      total_count: repositories.length
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Test GitHub search endpoint
app.get('/api/github/search', async (req, res) => {
  try {
    const { q, token } = req.query;
    
    if (!token || !q) {
      return res.status(400).json({ error: 'GitHub token and query are required' });
    }

    console.log('🔍 Testing GitHub search with query:', q);

    const fetch = (await import('node-fetch')).default;
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`;

    const githubResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard-Test',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    console.log('GitHub Search API Response Status:', githubResponse.status);

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.log('❌ GitHub Search API Error:', errorText);
      return res.status(githubResponse.status).json({
        error: 'Failed to search repositories',
        details: errorText
      });
    }

    const searchResults = await githubResponse.json();
    console.log(`✅ Found ${searchResults.total_count} repositories in search`);
    
    // Log first few repo names for debugging
    searchResults.items.slice(0, 3).forEach(repo => {
      console.log(`  - ${repo.full_name} (${repo.private ? 'private' : 'public'})`);
    });

    res.json({
      repositories: searchResults.items.map(repo => ({
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
      total_count: searchResults.total_count
    });

  } catch (error) {
    console.error('❌ Search Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Test token validation
app.post('/api/github/validate-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log('🔍 Testing GitHub token validation');

    const fetch = (await import('node-fetch')).default;
    const userUrl = 'https://api.github.com/user';

    const githubResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard-Test',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    console.log('GitHub User API Response Status:', githubResponse.status);

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.log('❌ GitHub User API Error:', errorText);
      return res.status(githubResponse.status).json({
        error: 'Invalid GitHub token',
        details: errorText
      });
    }

    const user = await githubResponse.json();
    console.log(`✅ Token valid for user: ${user.login}`);

    res.json({
      valid: true,
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        public_repos: user.public_repos,
        private_repos: user.total_private_repos
      }
    });

  } catch (error) {
    console.error('❌ Token validation error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`🧪 GitHub Test Server running on port ${PORT}`);
  console.log(`📊 Test URLs:`);
  console.log(`   - User repos: http://localhost:${PORT}/api/github/user/repos?token=YOUR_TOKEN`);
  console.log(`   - Search: http://localhost:${PORT}/api/github/search?q=terraform&token=YOUR_TOKEN`);
  console.log(`   - Validate: POST http://localhost:${PORT}/api/github/validate-token`);
});
