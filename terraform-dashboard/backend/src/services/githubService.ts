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

export interface AnsibleFile {
  path: string;
  name: string;
  content: string;
  type: 'playbook' | 'role' | 'inventory' | 'config';
  tasks: string[];
  variables: AnsibleVariable[];
}

export interface AnsibleVariable {
  name: string;
  description: string;
  default?: any;
  required: boolean;
}

export interface TerraformModule {
  name: string;
  path: string;
  description: string;
  terraformCode: string;
  variables: TerraformVariable[];
  resources: string[];
  category: string;
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

  // Detect and analyze Terraform modules in repository
  async detectTerraformModules(owner: string, repo: string): Promise<TerraformModule[]> {
    try {
      const modules: TerraformModule[] = [];
      const rootContents = await this.getRepoContents(owner, repo);

      // Check for modules directory
      const modulesDir = rootContents.find(item => item.type === 'dir' && item.name === 'modules');
      if (modulesDir) {
        const moduleContents = await this.getRepoContents(owner, repo, 'modules');

        for (const moduleDir of moduleContents) {
          if (moduleDir.type === 'dir') {
            const module = await this.analyzeModule(owner, repo, `modules/${moduleDir.name}`, moduleDir.name);
            if (module) {
              modules.push(module);
            }
          }
        }
      }

      // Also check root level for modules (common pattern)
      const potentialModules = ['ec2', 'vpc', 'rds', 's3', 'lambda', 'iam', 'security-group', 'load-balancer'];
      for (const moduleName of potentialModules) {
        const moduleDir = rootContents.find(item => item.type === 'dir' && item.name === moduleName);
        if (moduleDir) {
          const module = await this.analyzeModule(owner, repo, moduleName, moduleName);
          if (module) {
            modules.push(module);
          }
        }
      }

      return modules;
    } catch (error) {
      console.error('Error detecting Terraform modules:', error);
      throw new Error('Failed to detect Terraform modules');
    }
  }

  // Analyze individual module
  private async analyzeModule(owner: string, repo: string, modulePath: string, moduleName: string): Promise<TerraformModule | null> {
    try {
      const moduleContents = await this.getRepoContents(owner, repo, modulePath);
      const terraformFiles = moduleContents.filter(item =>
        item.type === 'file' && (item.name.endsWith('.tf') || item.name.endsWith('.hcl'))
      );

      if (terraformFiles.length === 0) {
        return null;
      }

      let combinedContent = '';
      const allVariables: TerraformVariable[] = [];
      const allResources: string[] = [];

      for (const file of terraformFiles) {
        const content = await this.getFileContent(owner, repo, file.path);
        combinedContent += `\n# ${file.name}\n${content}\n`;

        const variables = this.extractTerraformVariables(content);
        const resources = this.extractTerraformResources(content);

        allVariables.push(...variables);
        allResources.push(...resources);
      }

      return {
        name: moduleName,
        path: modulePath,
        description: `Terraform module for ${moduleName}`,
        terraformCode: combinedContent.trim(),
        variables: this.deduplicateVariables(allVariables),
        resources: [...new Set(allResources)],
        category: this.categorizeModule(moduleName),
      };
    } catch (error) {
      console.error(`Error analyzing module ${moduleName}:`, error);
      return null;
    }
  }

  // Deduplicate variables by name
  private deduplicateVariables(variables: TerraformVariable[]): TerraformVariable[] {
    const seen = new Set<string>();
    return variables.filter(variable => {
      if (seen.has(variable.name)) {
        return false;
      }
      seen.add(variable.name);
      return true;
    });
  }

  // Categorize module based on name
  private categorizeModule(moduleName: string): string {
    const categories: Record<string, string> = {
      'ec2': 'Compute',
      'vpc': 'Networking',
      'rds': 'Database',
      's3': 'Storage',
      'lambda': 'Serverless',
      'iam': 'Security',
      'security-group': 'Security',
      'load-balancer': 'Networking',
      'alb': 'Networking',
      'nlb': 'Networking',
      'eks': 'Container',
      'ecs': 'Container',
    };

    return categories[moduleName.toLowerCase()] || 'Infrastructure';
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

  // Get Ansible files from repository
  async getAnsibleFiles(owner: string, repo: string, path: string = ''): Promise<AnsibleFile[]> {
    try {
      const files = await this.getRepoContents(owner, repo, path);
      const ansibleFiles: AnsibleFile[] = [];

      for (const file of files) {
        if (file.type === 'file' && this.isAnsibleFile(file.name)) {
          const content = await this.getFileContent(owner, repo, file.path);
          const parsedFile = this.parseAnsibleFile(file.path, file.name, content);
          ansibleFiles.push(parsedFile);
        } else if (file.type === 'dir') {
          // Recursively search subdirectories
          const subFiles = await this.getAnsibleFiles(owner, repo, file.path);
          ansibleFiles.push(...subFiles);
        }
      }

      return ansibleFiles;
    } catch (error) {
      console.error('Error getting Ansible files:', error);
      throw new Error('Failed to get Ansible files from repository');
    }
  }

  // Check if file is an Ansible file
  private isAnsibleFile(filename: string): boolean {
    const ansibleExtensions = ['.yml', '.yaml'];
    const ansiblePatterns = [
      'playbook', 'site', 'main', 'tasks', 'handlers', 'vars', 'defaults',
      'inventory', 'hosts', 'group_vars', 'host_vars'
    ];

    const hasAnsibleExtension = ansibleExtensions.some(ext => filename.endsWith(ext));
    const hasAnsiblePattern = ansiblePatterns.some(pattern =>
      filename.toLowerCase().includes(pattern)
    );

    return hasAnsibleExtension && (hasAnsiblePattern || filename.includes('ansible'));
  }

  // Parse Ansible file content
  private parseAnsibleFile(path: string, name: string, content: string): AnsibleFile {
    const tasks: string[] = [];
    const variables: AnsibleVariable[] = [];

    // Determine file type
    let type: 'playbook' | 'role' | 'inventory' | 'config' = 'config';
    if (content.includes('- hosts:') || content.includes('- name:')) {
      type = 'playbook';
    } else if (path.includes('roles/')) {
      type = 'role';
    } else if (name.includes('inventory') || name.includes('hosts')) {
      type = 'inventory';
    }

    // Extract tasks (simplified parsing)
    const taskMatches = content.match(/- name:\s*(.+)/g);
    if (taskMatches) {
      tasks.push(...taskMatches.map(match => match.replace(/- name:\s*/, '')));
    }

    // Extract variables (simplified parsing)
    const varMatches = content.match(/(\w+):\s*"?([^"\n]+)"?/g);
    if (varMatches) {
      varMatches.forEach(match => {
        const [, name, defaultValue] = match.match(/(\w+):\s*"?([^"\n]+)"?/) || [];
        if (name && !name.startsWith('-') && !['hosts', 'tasks', 'name', 'become'].includes(name)) {
          variables.push({
            name,
            description: `Variable from ${path}`,
            default: defaultValue,
            required: false
          });
        }
      });
    }

    return {
      path,
      name,
      content,
      type,
      tasks,
      variables
    };
  }

  // Create Ansible template from repository
  async createAnsibleTemplateFromRepo(
    owner: string,
    repo: string,
    templateName: string,
    description?: string,
    mainFile?: string
  ): Promise<any> {
    try {
      const ansibleFiles = await this.getAnsibleFiles(owner, repo);

      if (ansibleFiles.length === 0) {
        throw new Error('No Ansible files found in repository');
      }

      // Collect all unique variables
      const allVariables: AnsibleVariable[] = [];
      const variableNames = new Set<string>();

      ansibleFiles.forEach(file => {
        file.variables.forEach(variable => {
          if (!variableNames.has(variable.name)) {
            variableNames.add(variable.name);
            allVariables.push(variable);
          }
        });
      });

      // Combine all Ansible content
      const combinedContent = ansibleFiles
        .map(file => `# ${file.path}\n${file.content}`)
        .join('\n\n');

      return {
        name: templateName,
        description: description || `Ansible template imported from ${owner}/${repo}`,
        ansibleContent: combinedContent,
        variables: allVariables,
        category: 'Ansible',
        template_type: 'ansible',
        files: ansibleFiles.map(f => ({
          name: f.name,
          path: f.path,
          type: f.type,
          taskCount: f.tasks.length
        }))
      };
    } catch (error) {
      console.error('Error creating Ansible template from repository:', error);
      throw new Error('Failed to create Ansible template from repository');
    }
  }
}
