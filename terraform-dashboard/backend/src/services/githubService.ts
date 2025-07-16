import axios from 'axios';

// Interfaces
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string;
  updated_at: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  download_url?: string;
  content?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface GitHubToken {
  id: string;
  token: string;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at?: string;
}

// Simple GitHub API client without Octokit to avoid ES module issues
class SimpleGitHubClient {
  private token: string;
  private baseURL = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: any = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Terraform-Dashboard',
      ...options.headers
    };

    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        headers,
        data: options.data,
        params: options.params,
        timeout: 30000
      });

      return response.data;
    } catch (error: any) {
      console.error(`GitHub API request failed: ${endpoint}`, error.response?.data || error.message);
      throw new Error(`GitHub API request failed: ${error.response?.status || error.message}`);
    }
  }

  async searchRepos(query: string, options: any = {}) {
    return this.request('/search/repositories', {
      params: {
        q: query,
        sort: options.sort || 'updated',
        order: options.order || 'desc',
        per_page: options.per_page || 20
      }
    });
  }

  async getRepo(owner: string, repo: string) {
    return this.request(`/repos/${owner}/${repo}`);
  }

  async getRepoContents(owner: string, repo: string, path: string = '') {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`);
  }

  async getUserRepos(options: any = {}) {
    return this.request('/user/repos', {
      params: {
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30
      }
    });
  }

  async getUser() {
    return this.request('/user');
  }
}

export class GitHubService {
  private client: SimpleGitHubClient;
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    if (!this.token) {
      console.warn('GitHub token not provided. Some features may not work.');
    }
    this.client = new SimpleGitHubClient(this.token);
  }

  // Search for repositories containing Terraform files
  async searchTerraformRepos(query: string = 'terraform', limit: number = 20): Promise<GitHubRepo[]> {
    try {
      if (!this.token) {
        throw new Error('GitHub token is required for searching repositories');
      }

      const response = await this.client.searchRepos(`${query} language:HCL extension:tf`, {
        sort: 'updated',
        order: 'desc',
        per_page: limit,
      });

      return response.items.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        language: repo.language || 'HCL',
        updated_at: repo.updated_at,
      }));
    } catch (error) {
      console.error('Error searching GitHub repositories:', error);
      throw new Error('Failed to search GitHub repositories');
    }
  }

  // Get user's repositories
  async getUserRepos(limit: number = 30): Promise<GitHubRepo[]> {
    try {
      if (!this.token) {
        throw new Error('GitHub token is required for accessing user repositories');
      }

      const repos = await this.client.getUserRepos({
        sort: 'updated',
        direction: 'desc',
        per_page: limit
      });

      return repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        language: repo.language || 'Unknown',
        updated_at: repo.updated_at,
      }));
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      throw new Error('Failed to fetch user repositories');
    }
  }

  // Get repository details
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    try {
      if (!this.token) {
        throw new Error('GitHub token is required for accessing repository details');
      }

      const repository = await this.client.getRepo(owner, repo);

      return {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        description: repository.description || '',
        html_url: repository.html_url,
        clone_url: repository.clone_url,
        default_branch: repository.default_branch,
        language: repository.language || 'Unknown',
        updated_at: repository.updated_at,
      };
    } catch (error) {
      console.error('Error fetching repository details:', error);
      throw new Error('Failed to fetch repository details');
    }
  }

  // Get repository contents
  async getRepositoryContents(owner: string, repo: string, path: string = ''): Promise<GitHubFile[]> {
    try {
      if (!this.token) {
        throw new Error('GitHub token is required for accessing repository contents');
      }

      const contents = await this.client.getRepoContents(owner, repo, path);
      const files = Array.isArray(contents) ? contents : [contents];

      return files.map((file: any) => ({
        name: file.name,
        path: file.path,
        type: file.type as 'file' | 'dir',
        size: file.size,
        download_url: file.download_url,
      }));
    } catch (error) {
      console.error('Error fetching repository contents:', error);
      throw new Error('Failed to fetch repository contents');
    }
  }

  // Get file content
  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    try {
      if (!this.token) {
        throw new Error('GitHub token is required for accessing file content');
      }

      const file = await this.client.getRepoContents(owner, repo, path);
      
      if (file.type !== 'file' || !file.content) {
        throw new Error('Invalid file or content not available');
      }

      // Decode base64 content
      return Buffer.from(file.content, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw new Error('Failed to fetch file content');
    }
  }

  // Get authenticated user
  async getAuthenticatedUser(): Promise<GitHubUser> {
    try {
      if (!this.token) {
        throw new Error('GitHub token is required for accessing user information');
      }

      const user = await this.client.getUser();

      return {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        email: user.email || '',
        avatar_url: user.avatar_url,
      };
    } catch (error) {
      console.error('Error fetching authenticated user:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  // Validate token
  async validateToken(): Promise<boolean> {
    try {
      if (!this.token) {
        return false;
      }

      await this.client.getUser();
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  // Mock methods for compatibility (these would need actual implementation)
  async createWebhook(owner: string, repo: string, config: any): Promise<any> {
    console.warn('createWebhook not implemented in simple GitHub service');
    return { id: 'mock-webhook' };
  }

  async deleteWebhook(owner: string, repo: string, hookId: string): Promise<void> {
    console.warn('deleteWebhook not implemented in simple GitHub service');
  }

  async getWebhooks(owner: string, repo: string): Promise<any[]> {
    console.warn('getWebhooks not implemented in simple GitHub service');
    return [];
  }
}
