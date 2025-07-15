import { Octokit } from '@octokit/rest';
import axios from 'axios';

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
  size: number;
  download_url: string | null;
  content?: string;
}

export interface TerraformFile {
  path: string;
  name: string;
  content: string;
  variables: TerraformVariable[];
  resources: string[];
}

export interface TerraformVariable {
  name: string;
  type: string;
  description: string;
  default?: any;
  required: boolean;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  // Search for repositories containing Terraform files
  async searchTerraformRepos(query: string = 'terraform', limit: number = 20): Promise<GitHubRepo[]> {
    try {
      const response = await this.octokit.rest.search.repos({
        q: `${query} language:HCL extension:tf`,
        sort: 'updated',
        order: 'desc',
        per_page: limit,
      });

      return response.data.items.map(repo => ({
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

  // Get repository contents
  async getRepoContents(owner: string, repo: string, path: string = ''): Promise<GitHubFile[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      const contents = Array.isArray(response.data) ? response.data : [response.data];
      
      return contents.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir',
        size: item.size || 0,
        download_url: item.download_url,
      }));
    } catch (error) {
      console.error('Error getting repository contents:', error);
      throw new Error('Failed to get repository contents');
    }
  }

  // Get Terraform files from repository
  async getTerraformFiles(owner: string, repo: string, path: string = ''): Promise<TerraformFile[]> {
    try {
      const contents = await this.getRepoContents(owner, repo, path);
      const terraformFiles: TerraformFile[] = [];

      for (const item of contents) {
        if (item.type === 'file' && (item.name.endsWith('.tf') || item.name.endsWith('.hcl'))) {
          const fileContent = await this.getFileContent(owner, repo, item.path);
          const variables = this.extractTerraformVariables(fileContent);
          const resources = this.extractTerraformResources(fileContent);

          terraformFiles.push({
            path: item.path,
            name: item.name,
            content: fileContent,
            variables,
            resources,
          });
        } else if (item.type === 'dir') {
          // Recursively get Terraform files from subdirectories
          const subFiles = await this.getTerraformFiles(owner, repo, item.path);
          terraformFiles.push(...subFiles);
        }
      }

      return terraformFiles;
    } catch (error) {
      console.error('Error getting Terraform files:', error);
      throw new Error('Failed to get Terraform files');
    }
  }

  // Get file content
  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(response.data)) {
        throw new Error('Expected file, got directory');
      }

      if (response.data.type !== 'file') {
        throw new Error('Not a file');
      }

      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return content;
    } catch (error) {
      console.error('Error getting file content:', error);
      throw new Error('Failed to get file content');
    }
  }

  // Extract Terraform variables from content
  private extractTerraformVariables(content: string): TerraformVariable[] {
    const variables: TerraformVariable[] = [];
    const variableRegex = /variable\s+"([^"]+)"\s*\{([^}]*)\}/g;
    
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      const name = match[1];
      const block = match[2];
      
      const typeMatch = block.match(/type\s*=\s*([^\n]+)/);
      const descriptionMatch = block.match(/description\s*=\s*"([^"]+)"/);
      const defaultMatch = block.match(/default\s*=\s*([^\n]+)/);
      
      variables.push({
        name,
        type: typeMatch ? typeMatch[1].trim() : 'string',
        description: descriptionMatch ? descriptionMatch[1] : '',
        default: defaultMatch ? defaultMatch[1].trim() : undefined,
        required: !defaultMatch,
      });
    }
    
    return variables;
  }

  // Extract Terraform resources from content
  private extractTerraformResources(content: string): string[] {
    const resources: string[] = [];
    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"/g;
    
    let match;
    while ((match = resourceRegex.exec(content)) !== null) {
      resources.push(`${match[1]}.${match[2]}`);
    }
    
    return resources;
  }

  // Create template from GitHub Terraform files
  async createTemplateFromRepo(
    owner: string, 
    repo: string, 
    templateName: string,
    description: string = '',
    mainFile: string = 'main.tf'
  ): Promise<{
    name: string;
    description: string;
    terraformCode: string;
    variables: TerraformVariable[];
    category: string;
  }> {
    try {
      const terraformFiles = await this.getTerraformFiles(owner, repo);
      
      if (terraformFiles.length === 0) {
        throw new Error('No Terraform files found in repository');
      }

      // Find main file or use the first .tf file
      let mainTerraformFile = terraformFiles.find(f => f.name === mainFile);
      if (!mainTerraformFile) {
        mainTerraformFile = terraformFiles.find(f => f.name.endsWith('.tf'));
      }
      
      if (!mainTerraformFile) {
        throw new Error('No suitable Terraform file found');
      }

      // Combine all variables from all files
      const allVariables: TerraformVariable[] = [];
      const variableNames = new Set<string>();
      
      terraformFiles.forEach(file => {
        file.variables.forEach(variable => {
          if (!variableNames.has(variable.name)) {
            variableNames.add(variable.name);
            allVariables.push(variable);
          }
        });
      });

      // Combine all Terraform code
      const combinedCode = terraformFiles
        .map(file => `# ${file.path}\n${file.content}`)
        .join('\n\n');

      return {
        name: templateName,
        description: description || `Template imported from ${owner}/${repo}`,
        terraformCode: combinedCode,
        variables: allVariables,
        category: 'GitHub Import',
      };
    } catch (error) {
      console.error('Error creating template from repository:', error);
      throw new Error('Failed to create template from repository');
    }
  }

  // Validate GitHub token
  async validateToken(): Promise<boolean> {
    try {
      await this.octokit.rest.users.getAuthenticated();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get authenticated user info
  async getUserInfo(): Promise<any> {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return response.data;
    } catch (error) {
      console.error('Error getting user info:', error);
      throw new Error('Failed to get user info');
    }
  }
}
