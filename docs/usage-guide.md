# AWS EC2 Management - Usage Guide

This guide provides detailed instructions for using the AWS EC2 management modules with Terraform and Terragrunt.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Deploying EC2 Instances](#deploying-ec2-instances)
4. [Managing EBS Volumes](#managing-ebs-volumes)
5. [Instance Operations](#instance-operations)
6. [Environment Management](#environment-management)
7. [Best Practices](#best-practices)

## Prerequisites

### Required Tools
- **AWS CLI** (v2.0+) - configured with appropriate credentials
- **Terraform** (v1.0+)
- **Terragrunt** (v0.35+)
- **SSH client** for instance connectivity

### AWS Permissions
Your AWS credentials must have the following permissions:
- EC2 full access (or specific permissions for instances, volumes, snapshots)
- VPC read access
- IAM read access (for roles and policies)
- CloudWatch logs access
- SNS publish (if notifications are enabled)

### Environment Variables
Set the following environment variables:
```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=123456789012
```

## Initial Setup

### 1. Configure AWS Credentials
```bash
aws configure
# or use AWS SSO
aws sso login --profile your-profile
```

### 2. Initialize Terragrunt Backend
```bash
# Create S3 bucket for state (if not exists)
aws s3 mb s3://terraform-state-${AWS_ACCOUNT_ID}-${AWS_REGION}

# Create DynamoDB table for locking (if not exists)
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### 3. Update Configuration Files
Before deploying, update the following in your environment configurations:

**VPC and Networking:**
- Replace `vpc-xxxxxxxxx` with your actual VPC ID
- Replace `subnet-xxxxxxxxx` with your actual subnet IDs
- Update CIDR blocks to match your network configuration

**Key Pairs:**
- Replace `dev-keypair` and `prod-keypair` with your actual key pair names
- Ensure the corresponding private keys are available locally

## Deploying EC2 Instances

### Development Environment

1. **Navigate to the development EC2 configuration:**
   ```bash
   cd environments/dev/ec2-instance
   ```

2. **Review the configuration:**
   ```bash
   terragrunt plan
   ```

3. **Deploy the instance:**
   ```bash
   terragrunt apply
   ```

4. **View outputs:**
   ```bash
   terragrunt output
   ```

### Production Environment

1. **Navigate to the production EC2 configuration:**
   ```bash
   cd environments/prod/ec2-instance
   ```

2. **Review the configuration:**
   ```bash
   terragrunt plan
   ```

3. **Deploy the instance (with confirmation):**
   ```bash
   terragrunt apply
   ```

### Custom Instance Configuration

To deploy with custom parameters:

```bash
# Override specific variables
terragrunt apply -var="instance_type=t3.medium" -var="root_volume_size=100"

# Use a custom tfvars file
terragrunt apply -var-file="custom.tfvars"
```

## Managing EBS Volumes

### Increasing Volume Size

1. **Get the volume ID from your EC2 instance:**
   ```bash
   cd environments/dev/ec2-instance
   VOLUME_ID=$(terragrunt output -raw root_block_device | jq -r '.volume_id')
   echo "Volume ID: $VOLUME_ID"
   ```

2. **Update the EBS volume configuration:**
   ```bash
   cd ../ebs-volume
   # Edit terragrunt.hcl and update volume_id and new_size
   ```

3. **Plan the volume modification:**
   ```bash
   terragrunt plan
   ```

4. **Apply the changes:**
   ```bash
   terragrunt apply
   ```

### Manual Volume Operations

For one-off volume operations, you can use the module directly:

```bash
# Create a temporary configuration
cat > volume-resize.hcl << EOF
terraform {
  source = "../../modules/ebs-volume"
}

inputs = {
  volume_id = "vol-1234567890abcdef0"
  new_size = 50
  instance_id = "i-1234567890abcdef0"
  expand_file_system = true
  ssh_key_path = "~/.ssh/my-key.pem"
}
EOF

# Apply the configuration
terragrunt apply -terragrunt-config volume-resize.hcl
```

## Instance Operations

### Using the EC2 Operations Module

1. **Navigate to a temporary directory:**
   ```bash
   mkdir -p temp/ec2-operations
   cd temp/ec2-operations
   ```

2. **Create an operations configuration:**
   ```bash
   cat > terragrunt.hcl << EOF
   terraform {
     source = "../../modules/ec2-operations"
   }
   
   inputs = {
     instance_id = "i-1234567890abcdef0"
     operation = "restart"
     wait_for_completion = true
     health_check_enabled = true
   }
   EOF
   ```

3. **Execute the operation:**
   ```bash
   terragrunt apply
   ```

### Common Operations

**Check instance status:**
```bash
terragrunt apply -var="operation=status"
```

**Restart an instance:**
```bash
terragrunt apply -var="operation=restart"
```

**Stop an instance:**
```bash
terragrunt apply -var="operation=stop"
```

**Start an instance:**
```bash
terragrunt apply -var="operation=start"
```

**Perform health check:**
```bash
terragrunt apply -var="operation=health_check"
```

## Environment Management

### Deploying Multiple Environments

1. **Deploy all development resources:**
   ```bash
   cd environments/dev
   terragrunt run-all plan
   terragrunt run-all apply
   ```

2. **Deploy all production resources:**
   ```bash
   cd environments/prod
   terragrunt run-all plan
   terragrunt run-all apply
   ```

### Environment-Specific Operations

**Development (faster, less safe):**
- Backups disabled by default
- Smaller instances
- More permissive operations
- Shorter log retention

**Production (safer, more robust):**
- Backups enabled by default
- Larger instances
- Strict validation
- Longer log retention
- Maintenance windows

## Best Practices

### Security
1. **Use least privilege IAM policies**
2. **Enable encryption for all EBS volumes**
3. **Use private subnets for instances**
4. **Regularly rotate SSH keys**
5. **Enable VPC Flow Logs**

### Operations
1. **Always plan before apply**
2. **Use maintenance windows for production changes**
3. **Test changes in development first**
4. **Monitor CloudWatch logs and metrics**
5. **Keep Terraform state secure**

### Cost Optimization
1. **Use appropriate instance types**
2. **Enable detailed monitoring only when needed**
3. **Clean up unused snapshots**
4. **Use gp3 volumes for better price/performance**
5. **Schedule instances to stop during off-hours**

### Backup and Recovery
1. **Enable automated backups**
2. **Test restore procedures**
3. **Document recovery processes**
4. **Use cross-region replication for critical data**
5. **Implement backup retention policies**

## Troubleshooting

For troubleshooting common issues, see [troubleshooting.md](troubleshooting.md).

## Next Steps

- Review the [module documentation](modules.md)
- Check the [examples directory](../examples/) for more use cases
- Set up monitoring and alerting
- Implement backup strategies
- Configure CI/CD pipelines
