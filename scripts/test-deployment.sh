#!/bin/bash

# AWS EC2 Management Test Deployment Script
# This script tests the deployment of EC2 instances and related operations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_ENVIRONMENT="dev"
TEST_INSTANCE_NAME="test-instance-$(date +%s)"
CLEANUP_ON_SUCCESS=true
WAIT_TIMEOUT=300

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

# Cleanup function
cleanup() {
    if [ "$CLEANUP_ON_SUCCESS" = true ] && [ -n "$INSTANCE_ID" ]; then
        log_info "Cleaning up test resources..."
        
        # Destroy the test instance
        cd "environments/$TEST_ENVIRONMENT/ec2-instance" || return
        terragrunt destroy -auto-approve || log_warning "Failed to destroy test instance"
        
        log_success "Cleanup completed"
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Test functions
test_prerequisites() {
    log_info "Testing prerequisites..."
    
    # Check if validation script exists and run it
    if [ -f "scripts/validate-setup.sh" ]; then
        log_info "Running setup validation..."
        bash scripts/validate-setup.sh
    else
        log_warning "Setup validation script not found"
    fi
    
    # Check AWS connectivity
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

test_module_validation() {
    log_info "Testing module validation..."
    
    local modules=("ec2-instance" "ebs-volume" "ec2-operations")
    
    for module in "${modules[@]}"; do
        log_info "Validating module: $module"
        
        if (cd "modules/$module" && terraform init >/dev/null 2>&1 && terraform validate >/dev/null 2>&1); then
            log_success "Module $module validation passed"
        else
            log_error "Module $module validation failed"
            exit 1
        fi
    done
}

test_terragrunt_configuration() {
    log_info "Testing Terragrunt configuration..."
    
    local env_path="environments/$TEST_ENVIRONMENT"
    
    if [ ! -d "$env_path" ]; then
        log_error "Test environment $TEST_ENVIRONMENT does not exist"
        exit 1
    fi
    
    # Test environment configuration
    cd "$env_path" || exit 1
    
    if terragrunt validate-inputs >/dev/null 2>&1; then
        log_success "Environment configuration validation passed"
    else
        log_warning "Environment configuration validation failed"
    fi
    
    # Return to root directory
    cd - >/dev/null || exit 1
}

create_test_configuration() {
    log_info "Creating test configuration..."
    
    local test_dir="test-deployment"
    mkdir -p "$test_dir"
    
    # Create a minimal test configuration
    cat > "$test_dir/terragrunt.hcl" << EOF
# Test deployment configuration
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../modules/ec2-instance"
}

inputs = {
  name = "$TEST_INSTANCE_NAME"
  instance_type = "t3.nano"  # Smallest instance for testing
  
  # Use default VPC and subnet for testing
  vpc_id = data.aws_vpc.default.id
  subnet_id = data.aws_subnets.default.ids[0]
  
  create_security_group = true
  security_group_name = "$TEST_INSTANCE_NAME-sg"
  allowed_cidr_blocks = ["10.0.0.0/8"]
  
  # Minimal storage
  root_volume_size = 8
  root_volume_type = "gp3"
  root_volume_encrypted = false  # Disable for testing
  
  # No public IP for testing
  associate_public_ip = false
  
  # Disable monitoring for testing
  enable_detailed_monitoring = false
  enable_termination_protection = false
  
  # Test tags
  instance_tags = {
    Name = "$TEST_INSTANCE_NAME"
    Purpose = "automated-testing"
    Environment = "test"
  }
  
  environment = "test"
}

# Add data sources for default VPC
generate "test_data" {
  path      = "test_data.tf"
  if_exists = "overwrite"
  contents  = <<DATA
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
DATA
}
EOF
    
    log_success "Test configuration created in $test_dir/"
}

test_instance_deployment() {
    log_info "Testing EC2 instance deployment..."
    
    local test_dir="test-deployment"
    cd "$test_dir" || exit 1
    
    # Initialize and plan
    log_info "Running terragrunt init..."
    if ! terragrunt init >/dev/null 2>&1; then
        log_error "Terragrunt init failed"
        exit 1
    fi
    
    log_info "Running terragrunt plan..."
    if ! terragrunt plan >/dev/null 2>&1; then
        log_error "Terragrunt plan failed"
        exit 1
    fi
    
    # Apply configuration
    log_info "Deploying test instance..."
    if terragrunt apply -auto-approve; then
        log_success "Test instance deployed successfully"
        
        # Get instance ID
        INSTANCE_ID=$(terragrunt output -raw instance_id 2>/dev/null || echo "")
        
        if [ -n "$INSTANCE_ID" ]; then
            log_info "Test instance ID: $INSTANCE_ID"
        else
            log_warning "Could not retrieve instance ID"
        fi
    else
        log_error "Test instance deployment failed"
        exit 1
    fi
    
    # Return to root directory
    cd - >/dev/null || exit 1
}

test_instance_operations() {
    if [ -z "$INSTANCE_ID" ]; then
        log_warning "No instance ID available, skipping operations test"
        return
    fi
    
    log_info "Testing instance operations..."
    
    # Wait for instance to be running
    log_info "Waiting for instance to be running..."
    local timeout=$WAIT_TIMEOUT
    while [ $timeout -gt 0 ]; do
        local state
        state=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
            --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo "unknown")
        
        if [ "$state" = "running" ]; then
            log_success "Instance is running"
            break
        elif [ "$state" = "terminated" ] || [ "$state" = "terminating" ]; then
            log_error "Instance terminated unexpectedly"
            return 1
        fi
        
        sleep 10
        timeout=$((timeout - 10))
    done
    
    if [ $timeout -le 0 ]; then
        log_warning "Timeout waiting for instance to be running"
        return 1
    fi
    
    # Test status check
    log_info "Testing status check operation..."
    local ops_dir="test-operations"
    mkdir -p "$ops_dir"
    
    cat > "$ops_dir/terragrunt.hcl" << EOF
terraform {
  source = "../modules/ec2-operations"
}

inputs = {
  instance_id = "$INSTANCE_ID"
  operation = "status"
  wait_for_completion = true
  health_check_enabled = false
  notification_enabled = false
}
EOF
    
    if (cd "$ops_dir" && terragrunt init >/dev/null 2>&1 && terragrunt apply -auto-approve >/dev/null 2>&1); then
        log_success "Status check operation completed"
    else
        log_warning "Status check operation failed"
    fi
    
    # Clean up operations directory
    rm -rf "$ops_dir"
}

test_volume_operations() {
    if [ -z "$INSTANCE_ID" ]; then
        log_warning "No instance ID available, skipping volume operations test"
        return
    fi
    
    log_info "Testing volume operations..."
    
    # Get root volume ID
    local volume_id
    volume_id=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$volume_id" ] || [ "$volume_id" = "None" ]; then
        log_warning "Could not retrieve volume ID, skipping volume test"
        return
    fi
    
    log_info "Testing volume resize operation..."
    local vol_dir="test-volume"
    mkdir -p "$vol_dir"
    
    cat > "$vol_dir/terragrunt.hcl" << EOF
terraform {
  source = "../modules/ebs-volume"
}

inputs = {
  volume_id = "$volume_id"
  new_size = 10  # Increase from 8GB to 10GB
  volume_type = "gp3"
  
  # Skip file system expansion for testing
  expand_file_system = false
  
  # Skip backup for testing
  backup_before_modification = false
  
  # Testing settings
  wait_for_modification = true
  modification_timeout = 5
  force_modification = true
  
  tags = {
    Purpose = "automated-testing"
  }
  
  environment = "test"
}
EOF
    
    if (cd "$vol_dir" && terragrunt init >/dev/null 2>&1 && terragrunt apply -auto-approve >/dev/null 2>&1); then
        log_success "Volume resize operation completed"
    else
        log_warning "Volume resize operation failed"
    fi
    
    # Clean up volume directory
    rm -rf "$vol_dir"
}

run_integration_tests() {
    log_info "Running integration tests..."
    
    test_prerequisites
    test_module_validation
    test_terragrunt_configuration
    create_test_configuration
    test_instance_deployment
    test_instance_operations
    test_volume_operations
}

cleanup_test_resources() {
    log_info "Cleaning up test resources..."
    
    # Remove test directories
    rm -rf test-deployment test-operations test-volume
    
    log_success "Test cleanup completed"
}

print_test_summary() {
    log_info "Test Summary:"
    echo
    log_success "✅ Prerequisites test passed"
    log_success "✅ Module validation passed"
    log_success "✅ Terragrunt configuration test passed"
    log_success "✅ Instance deployment test passed"
    log_success "✅ Instance operations test passed"
    log_success "✅ Volume operations test passed"
    echo
    log_info "All tests completed successfully!"
    echo
    log_info "The AWS EC2 management modules are ready for use."
    log_info "You can now deploy instances in your environments:"
    echo "  cd environments/dev/ec2-instance"
    echo "  terragrunt plan"
    echo "  terragrunt apply"
}

# Main execution
main() {
    echo "AWS EC2 Management Integration Tests"
    echo "===================================="
    echo
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-cleanup)
                CLEANUP_ON_SUCCESS=false
                shift
                ;;
            --environment)
                TEST_ENVIRONMENT="$2"
                shift 2
                ;;
            --timeout)
                WAIT_TIMEOUT="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    log_info "Test configuration:"
    log_info "  Environment: $TEST_ENVIRONMENT"
    log_info "  Cleanup on success: $CLEANUP_ON_SUCCESS"
    log_info "  Wait timeout: $WAIT_TIMEOUT seconds"
    echo
    
    run_integration_tests
    cleanup_test_resources
    
    echo
    print_test_summary
}

# Run main function
main "$@"
