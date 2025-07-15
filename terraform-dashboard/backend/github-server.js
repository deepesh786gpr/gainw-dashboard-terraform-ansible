const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// GitHub user repositories endpoint
app.get('/api/github/user/repos', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log('🔍 Fetching user repositories...');

    const fetch = (await import('node-fetch')).default;
    const reposUrl = `https://api.github.com/user/repos?type=all&sort=updated&per_page=50`;

    const githubResponse = await fetch(reposUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ GitHub user repos failed:', githubResponse.status);
      const errorText = await githubResponse.text();
      return res.status(githubResponse.status).json({
        error: 'Failed to fetch user repositories',
        details: errorText
      });
    }

    const repositories = await githubResponse.json();
    console.log(`✅ Found ${repositories.length} user repositories`);

    // Return in the format expected by frontend
    res.json({
      repositories: repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        }
      })),
      total_count: repositories.length
    });

  } catch (error) {
    console.error('❌ GitHub user repos error:', error);
    res.status(500).json({ error: 'Failed to fetch user repositories' });
  }
});

// GitHub search repositories endpoint
app.get('/api/github/search', async (req, res) => {
  try {
    const { q, limit = 20, token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log('🔍 Searching GitHub repositories:', q);

    const fetch = (await import('node-fetch')).default;
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${limit}`;

    const githubResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ GitHub search failed:', githubResponse.status);
      const errorText = await githubResponse.text();
      return res.status(githubResponse.status).json({
        error: 'Failed to search GitHub repositories',
        details: errorText
      });
    }

    const searchResults = await githubResponse.json();
    console.log(`✅ Found ${searchResults.total_count} repositories`);

    res.json({
      repositories: searchResults.items.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        }
      })),
      total_count: searchResults.total_count
    });

  } catch (error) {
    console.error('❌ GitHub search error:', error);
    res.status(500).json({ error: 'Failed to search repositories' });
  }
});

// GitHub token validation endpoint
app.post('/api/github/validate-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log('🔍 Validating GitHub token...');

    const fetch = (await import('node-fetch')).default;
    const userUrl = 'https://api.github.com/user';

    const githubResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ GitHub token validation failed:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: 'Invalid GitHub token'
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
        total_private_repos: user.total_private_repos
      }
    });

  } catch (error) {
    console.error('❌ GitHub token validation error:', error);
    res.status(500).json({ error: 'Failed to validate GitHub token' });
  }
});

// Repository analysis endpoint (simplified)
app.post('/api/github/repos/:owner/:repo/analyze', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log(`🔍 Analyzing repository: ${owner}/${repo}`);

    const fetch = (await import('node-fetch')).default;
    const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;

    const githubResponse = await fetch(contentsUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ Repository analysis failed:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: 'Failed to analyze repository'
      });
    }

    const contents = await githubResponse.json();
    
    // Look for Terraform files
    const terraformFiles = contents.filter(file => 
      file.type === 'file' && (
        file.name.endsWith('.tf') ||
        file.name.endsWith('.tfvars')
      )
    );

    // Look for Ansible files
    const ansibleFiles = contents.filter(file =>
      file.type === 'file' && (
        file.name.endsWith('.yml') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.ansible') ||
        file.name === 'ansible.cfg' ||
        file.name === 'inventory' ||
        file.name === 'hosts'
      )
    );

    const hasTerraform = terraformFiles.length > 0;
    const hasAnsible = ansibleFiles.length > 0;

    if (!hasTerraform && !hasAnsible) {
      return res.json({
        hasTerraform: false,
        hasAnsible: false,
        message: 'No Terraform (.tf) or Ansible (.yml/.yaml) files found in the root directory of this repository.',
        suggestedName: '',
        mainFiles: []
      });
    }

    // Find main files
    const mainFiles = [];
    if (hasTerraform) {
      const tfMainFiles = terraformFiles
        .map(file => file.name)
        .filter(name =>
          name === 'main.tf' ||
          name === 'variables.tf' ||
          name === 'outputs.tf' ||
          name.includes('main')
        );
      mainFiles.push(...(tfMainFiles.length > 0 ? tfMainFiles : ['main.tf']));
    }

    if (hasAnsible) {
      const ansibleMainFiles = ansibleFiles
        .map(file => file.name)
        .filter(name =>
          name === 'playbook.yml' ||
          name === 'playbook.yaml' ||
          name === 'site.yml' ||
          name === 'site.yaml' ||
          name === 'main.yml' ||
          name === 'main.yaml'
        );
      mainFiles.push(...(ansibleMainFiles.length > 0 ? ansibleMainFiles : ansibleFiles.map(f => f.name)));
    }

    const suggestedName = repo.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    console.log(`✅ Repository analysis complete: ${terraformFiles.length} Terraform files, ${ansibleFiles.length} Ansible files found`);

    res.json({
      hasTerraform,
      hasAnsible,
      terraformFiles: terraformFiles.map(file => file.name),
      ansibleFiles: ansibleFiles.map(file => file.name),
      mainFiles,
      suggestedName,
      message: `Found ${terraformFiles.length} Terraform files${hasAnsible ? ` and ${ansibleFiles.length} Ansible files` : ''} in the repository.`,
      fileType: hasTerraform ? 'terraform' : 'ansible'
    });

  } catch (error) {
    console.error('❌ Repository analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze repository' });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 GitHub Integration Server running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   - GET  /api/github/user/repos?token=TOKEN`);
  console.log(`   - GET  /api/github/search?q=QUERY&token=TOKEN`);
  console.log(`   - POST /api/github/validate-token`);
  console.log(`   - POST /api/github/repos/:owner/:repo/analyze`);
});
