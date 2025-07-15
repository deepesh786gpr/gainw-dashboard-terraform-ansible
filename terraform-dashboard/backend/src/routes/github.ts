import express from 'express';
import { GitHubService } from '../services/githubService';
import { createError } from '../middleware/errorHandler';
import { db } from '../database/database';

const router = express.Router();

// Search GitHub repositories for Terraform code
router.get('/search', async (req, res, next) => {
  try {
    const { q = 'terraform', limit = 20, token } = req.query;
    
    const githubService = new GitHubService(token as string);
    const repos = await githubService.searchTerraformRepos(q as string, parseInt(limit as string));
    
    res.json(repos);
  } catch (error) {
    next(error);
  }
});

// Get repository contents
router.get('/repos/:owner/:repo/contents', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { path = '', token } = req.query;
    
    const githubService = new GitHubService(token as string);
    const contents = await githubService.getRepoContents(owner, repo, path as string);
    
    res.json(contents);
  } catch (error) {
    next(error);
  }
});

// Get Terraform files from repository
router.get('/repos/:owner/:repo/terraform', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { path = '', token } = req.query;
    
    const githubService = new GitHubService(token as string);
    const terraformFiles = await githubService.getTerraformFiles(owner, repo, path as string);
    
    res.json(terraformFiles);
  } catch (error) {
    next(error);
  }
});

// Get specific file content
router.post('/repos/:owner/:repo/file-content', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { path, token } = req.body;

    if (!path) {
      throw createError('File path is required', 400);
    }

    const githubService = new GitHubService(token);
    const content = await githubService.getFileContent(owner, repo, path);

    res.json({ content, path });
  } catch (error) {
    next(error);
  }
});

// Create template from GitHub repository
router.post('/repos/:owner/:repo/create-template', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { templateName, description, mainFile, token } = req.body;
    
    if (!templateName) {
      throw createError('Template name is required', 400);
    }
    
    const githubService = new GitHubService(token);
    const templateData = await githubService.createTemplateFromRepo(
      owner, 
      repo, 
      templateName, 
      description, 
      mainFile
    );
    
    // Save template to database
    const templateId = `github-${Date.now()}`;
    await db.run(`
      INSERT INTO templates (id, name, description, category, terraform_code, variables)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      templateId,
      templateData.name,
      templateData.description,
      templateData.category,
      templateData.terraformCode,
      JSON.stringify(templateData.variables)
    ]);
    
    // Get the created template
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [templateId]);
    
    res.status(201).json({
      ...template,
      variables: JSON.parse(template.variables || '[]'),
      source: {
        type: 'github',
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`
      }
    });
  } catch (error) {
    next(error);
  }
});

// Validate GitHub token
router.post('/validate-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw createError('Token is required', 400);
    }
    
    const githubService = new GitHubService(token);
    const isValid = await githubService.validateToken();
    
    if (isValid) {
      const userInfo = await githubService.getUserInfo();
      res.json({
        valid: true,
        user: {
          login: userInfo.login,
          name: userInfo.name,
          avatar_url: userInfo.avatar_url,
          public_repos: userInfo.public_repos
        }
      });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    next(error);
  }
});

// Get user's repositories
router.get('/user/repos', async (req, res, next) => {
  try {
    const { token, type = 'owner', sort = 'updated' } = req.query;
    
    if (!token) {
      throw createError('Token is required', 401);
    }
    
    const githubService = new GitHubService(token as string);
    
    // Use Octokit directly for user repos
    const response = await (githubService as any).octokit.rest.repos.listForAuthenticatedUser({
      type: type as string,
      sort: sort as string,
      per_page: 50
    });
    
    const repos = response.data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || '',
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      default_branch: repo.default_branch,
      language: repo.language,
      updated_at: repo.updated_at,
      private: repo.private
    }));
    
    res.json(repos);
  } catch (error) {
    next(error);
  }
});

// Quick import - analyze repository and suggest template creation
router.post('/repos/:owner/:repo/analyze', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { token } = req.body;
    
    const githubService = new GitHubService(token);
    const terraformFiles = await githubService.getTerraformFiles(owner, repo);
    
    if (terraformFiles.length === 0) {
      return res.json({
        hasTerraform: false,
        message: 'No Terraform files found in this repository'
      });
    }
    
    // Analyze the files
    const analysis = {
      hasTerraform: true,
      fileCount: terraformFiles.length,
      files: terraformFiles.map(f => ({
        name: f.name,
        path: f.path,
        variableCount: f.variables.length,
        resourceCount: f.resources.length
      })),
      totalVariables: terraformFiles.reduce((sum, f) => sum + f.variables.length, 0),
      totalResources: terraformFiles.reduce((sum, f) => sum + f.resources.length, 0),
      suggestedName: `${repo}-template`,
      mainFiles: terraformFiles.filter(f => 
        f.name === 'main.tf' || 
        f.name === 'terraform.tf' || 
        f.name.includes('main')
      ).map(f => f.name)
    };
    
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

export default router;
