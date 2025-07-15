# Backend Dockerfile
FROM node:18-alpine

# Install Terraform and Terragrunt
RUN apk add --no-cache wget unzip

# Install Terraform
RUN wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip && \
    unzip terraform_1.6.6_linux_amd64.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform_1.6.6_linux_amd64.zip

# Install Terragrunt
RUN wget https://github.com/gruntwork-io/terragrunt/releases/download/v0.54.8/terragrunt_linux_amd64 && \
    mv terragrunt_linux_amd64 /usr/local/bin/terragrunt && \
    chmod +x /usr/local/bin/terragrunt

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Create necessary directories
RUN mkdir -p data terraform-workspace logs

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
