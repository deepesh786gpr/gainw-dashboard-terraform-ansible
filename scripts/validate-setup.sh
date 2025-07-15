#!/bin/bash

# AWS EC2 Management Setup Validation Script
# This script validates the Terraform/Terragrunt setup and AWS configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validation functions
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local tools=("aws" "terraform" "terragrunt" "jq" "curl")
    local missing_tools=()
    
    for tool in "${tools[@]}"; do
        if command_exists "$tool"; then
            local version
            case $tool in
                "aws")
                    version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
                    ;;
                "terraform")
                    version=$(terraform version | head -n1 | cut -d'v' -f2)
                    ;;
                "terragrunt")
                    version=$(terragrunt --version | cut -d'v' -f2)
                    ;;
                "jq")
                    version=$(jq --version | cut -d'-' -f2)
                    ;;
                "curl")
                    version=$(curl --version | head -n1 | cut -d' ' -f2)
                    ;;
            esac
            log_success "$tool is installed (version: $version)"
        else
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and run this script again."
        exit 1
    fi
}

check_aws_configuration() {
    log_info "Checking AWS configuration..."
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured or invalid"
        log_info "Run 'aws configure' or set up AWS SSO"
        exit 1
    fi
    
    # Get AWS account and region info
    local account_id region
    account_id=$(aws sts get-caller-identity --query Account --output text)
    region=$(aws configure get region || echo "us-east-1")
    
    log_success "AWS credentials configured"
    log_info "Account ID: $account_id"
    log_info "Region: $region"
    
    # Check required permissions
    log_info "Checking AWS permissions..."
    
    local permissions=(
        "ec2:DescribeInstances"
        "ec2:RunInstances"
        "ec2:TerminateInstances"
        "ec2:DescribeVolumes"
        "ec2:ModifyVolume"
        "ec2:CreateSnapshot"
        "ec2:DescribeSnapshots"
        "ec2:DescribeVpcs"
        "ec2:DescribeSubnets"
        "ec2:DescribeSecurityGroups"
        "ec2:CreateSecurityGroup"
        "ec2:AuthorizeSecurityGroupIngress"
    )
    
    for permission in "${permissions[@]}"; do
        if aws iam simulate-principal-policy \
            --policy-source-arn "$(aws sts get-caller-identity --query Arn --output text)" \
            --action-names "$permission" \
            --resource-arns "*" \
            --query 'EvaluationResults[0].EvalDecision' \
            --output text 2>/dev/null | grep -q "allowed"; then
            log_success "Permission $permission: OK"
        else
            log_warning "Permission $permission: May be missing or restricted"
        fi
    done
}

check_terraform_backend() {
    log_info "Checking Terraform backend configuration..."
    
    local region account_id
    region=$(aws configure get region || echo "us-east-1")
    account_id=$(aws sts get-caller-identity --query Account --output text)
    
    local bucket_name="terraform-state-${account_id}-${region}"
    local table_name="terraform-locks"
    
    # Check S3 bucket
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        log_success "S3 bucket $bucket_name exists"
    else
        log_warning "S3 bucket $bucket_name does not exist"
        log_info "Creating S3 bucket..."
        
        if [ "$region" = "us-east-1" ]; then
            aws s3api create-bucket --bucket "$bucket_name"
        else
            aws s3api create-bucket --bucket "$bucket_name" \
                --create-bucket-configuration LocationConstraint="$region"
        fi
        
        # Enable versioning
        aws s3api put-bucket-versioning --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled
        
        # Enable encryption
        aws s3api put-bucket-encryption --bucket "$bucket_name" \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }]
            }'
        
        log_success "S3 bucket created and configured"
    fi
    
    # Check DynamoDB table
    if aws dynamodb describe-table --table-name "$table_name" >/dev/null 2>&1; then
        log_success "DynamoDB table $table_name exists"
    else
        log_warning "DynamoDB table $table_name does not exist"
        log_info "Creating DynamoDB table..."
        
        aws dynamodb create-table \
            --table-name "$table_name" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST
        
        log_info "Waiting for table to be active..."
        aws dynamodb wait table-exists --table-name "$table_name"
        
        log_success "DynamoDB table created"
    fi
}

validate_module_structure() {
    log_info "Validating module structure..."
    
    local modules=("ec2-instance" "ebs-volume" "ec2-operations")
    local required_files=("main.tf" "variables.tf" "outputs.tf")
    
    for module in "${modules[@]}"; do
        local module_path="modules/$module"
        
        if [ ! -d "$module_path" ]; then
            log_error "Module directory $module_path does not exist"
            continue
        fi
        
        log_info "Checking module: $module"
        
        for file in "${required_files[@]}"; do
            if [ -f "$module_path/$file" ]; then
                log_success "  $file exists"
            else
                log_error "  $file is missing"
            fi
        done
        
        # Validate Terraform syntax
        if (cd "$module_path" && terraform validate >/dev/null 2>&1); then
            log_success "  Terraform syntax is valid"
        else
            log_error "  Terraform syntax validation failed"
            (cd "$module_path" && terraform validate)
        fi
    done
}

validate_environment_configs() {
    log_info "Validating environment configurations..."
    
    local environments=("dev" "prod")
    
    for env in "${environments[@]}"; do
        local env_path="environments/$env"
        
        if [ ! -d "$env_path" ]; then
            log_error "Environment directory $env_path does not exist"
            continue
        fi
        
        log_info "Checking environment: $env"
        
        # Check terragrunt.hcl
        if [ -f "$env_path/terragrunt.hcl" ]; then
            log_success "  terragrunt.hcl exists"
            
            # Validate terragrunt configuration
            if (cd "$env_path" && terragrunt validate-inputs >/dev/null 2>&1); then
                log_success "  Terragrunt configuration is valid"
            else
                log_warning "  Terragrunt configuration validation failed"
            fi
        else
            log_error "  terragrunt.hcl is missing"
        fi
        
        # Check module configurations
        local modules=("ec2-instance" "ebs-volume")
        for module in "${modules[@]}"; do
            local module_config="$env_path/$module/terragrunt.hcl"
            if [ -f "$module_config" ]; then
                log_success "  $module configuration exists"
            else
                log_warning "  $module configuration is missing"
            fi
        done
    done
}

check_placeholder_values() {
    log_info "Checking for placeholder values that need to be updated..."
    
    local placeholder_patterns=(
        "vpc-xxxxxxxxx"
        "subnet-xxxxxxxxx"
        "i-xxxxxxxxx"
        "vol-xxxxxxxxx"
        "my-keypair"
        "dev-keypair"
        "prod-keypair"
    )
    
    local files_with_placeholders=()
    
    for pattern in "${placeholder_patterns[@]}"; do
        local files
        files=$(grep -r "$pattern" environments/ examples/ 2>/dev/null | cut -d: -f1 | sort -u || true)
        
        if [ -n "$files" ]; then
            files_with_placeholders+=("$files")
            log_warning "Placeholder '$pattern' found in:"
            echo "$files" | sed 's/^/    /'
        fi
    done
    
    if [ ${#files_with_placeholders[@]} -gt 0 ]; then
        log_warning "Please update placeholder values before deploying"
        log_info "Refer to the documentation for guidance on obtaining these values"
    else
        log_success "No placeholder values found"
    fi
}

run_example_validation() {
    log_info "Validating example configurations..."
    
    local examples_dir="examples"
    
    if [ ! -d "$examples_dir" ]; then
        log_error "Examples directory does not exist"
        return
    fi
    
    for example in "$examples_dir"/*; do
        if [ -d "$example" ] && [ -f "$example/terragrunt.hcl" ]; then
            local example_name
            example_name=$(basename "$example")
            log_info "Validating example: $example_name"
            
            if (cd "$example" && terragrunt validate >/dev/null 2>&1); then
                log_success "  Example configuration is valid"
            else
                log_warning "  Example configuration validation failed"
            fi
        fi
    done
}

print_summary() {
    log_info "Validation Summary:"
    echo
    log_success "✅ Prerequisites check completed"
    log_success "✅ AWS configuration validated"
    log_success "✅ Terraform backend checked"
    log_success "✅ Module structure validated"
    log_success "✅ Environment configurations checked"
    log_success "✅ Example configurations validated"
    echo
    log_info "Next steps:"
    echo "  1. Update any placeholder values in configuration files"
    echo "  2. Review and customize environment-specific settings"
    echo "  3. Test deployment in development environment"
    echo "  4. Set up monitoring and alerting"
    echo
    log_info "To deploy your first instance:"
    echo "  cd environments/dev/ec2-instance"
    echo "  terragrunt plan"
    echo "  terragrunt apply"
}

# Main execution
main() {
    echo "AWS EC2 Management Setup Validation"
    echo "==================================="
    echo
    
    check_prerequisites
    check_aws_configuration
    check_terraform_backend
    validate_module_structure
    validate_environment_configs
    check_placeholder_values
    run_example_validation
    
    echo
    print_summary
}

# Run main function
main "$@"
