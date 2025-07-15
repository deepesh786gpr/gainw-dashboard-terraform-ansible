# Getting Started with AWS EC2 Management

This guide will help you get up and running with the AWS EC2 management modules using Terraform and Terragrunt.

## Quick Start (5 minutes)

### 1. Prerequisites Check
```bash
# Run the validation script
./scripts/validate-setup.sh
```

### 2. Update Configuration
Edit the configuration files to match your AWS environment:

**For Development:**
```bash
# Edit environments/dev/ec2-instance/terragrunt.hcl
# Update these values:
vpc_id = "vpc-your-vpc-id"
subnet_id = "subnet-your-subnet-id"
key_pair_name = "your-keypair-name"
```

### 3. Deploy Your First Instance
```bash
cd environments/dev/ec2-instance
terragrunt plan
terragrunt apply
```

### 4. Get Connection Details
```bash
terragrunt output
```

## Detailed Setup Guide

### Step 1: Environment Setup

1. **Install Required Tools:**
   ```bash
   # Install Terraform
   curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
   sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
   sudo apt-get update && sudo apt-get install terraform
   
   # Install Terragrunt
   curl -Lo terragrunt https://github.com/gruntwork-io/terragrunt/releases/latest/download/terragrunt_linux_amd64
   chmod +x terragrunt
   sudo mv terragrunt /usr/local/bin/
   
   # Configure AWS CLI
   aws configure
   ```

2. **Set Environment Variables:**
   ```bash
   export AWS_REGION=us-east-1
   export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   ```

### Step 2: AWS Infrastructure Preparation

1. **Create or Identify VPC:**
   ```bash
   # List available VPCs
   aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock,IsDefault]' --output table
   
   # List subnets in a VPC
   aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-12345678" \
     --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone]' --output table
   ```

2. **Create EC2 Key Pair:**
   ```bash
   # Create new key pair
   aws ec2 create-key-pair --key-name my-keypair --query 'KeyMaterial' --output text > ~/.ssh/my-keypair.pem
   chmod 400 ~/.ssh/my-keypair.pem
   ```

3. **Set Up Terraform Backend:**
   ```bash
   # The validation script will create these automatically, or create manually:
   
   # Create S3 bucket for state
   aws s3 mb s3://terraform-state-${AWS_ACCOUNT_ID}-${AWS_REGION}
   
   # Create DynamoDB table for locking
   aws dynamodb create-table \
     --table-name terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

### Step 3: Configuration Customization

1. **Update Environment Configurations:**

   **Development Environment (`environments/dev/terragrunt.hcl`):**
   ```hcl
   inputs = {
     # Update these values
     vpc_id = "vpc-your-dev-vpc-id"
     subnet_ids = ["subnet-dev-1", "subnet-dev-2"]
     key_pair_name = "dev-keypair"
     allowed_cidr_blocks = ["10.0.0.0/8"]
   }
   ```

   **Production Environment (`environments/prod/terragrunt.hcl`):**
   ```hcl
   inputs = {
     # Update these values
     vpc_id = "vpc-your-prod-vpc-id"
     subnet_ids = ["subnet-prod-1", "subnet-prod-2"]
     key_pair_name = "prod-keypair"
     allowed_cidr_blocks = ["10.0.0.0/16"]  # More restrictive
   }
   ```

2. **Update Module Configurations:**

   **EC2 Instance (`environments/dev/ec2-instance/terragrunt.hcl`):**
   ```hcl
   inputs = {
     name = "my-web-server"
     instance_type = "t3.micro"
     vpc_id = "vpc-your-vpc-id"
     subnet_id = "subnet-your-subnet-id"
     key_pair_name = "your-keypair"
   }
   ```

### Step 4: Deployment

1. **Validate Configuration:**
   ```bash
   cd environments/dev/ec2-instance
   terragrunt validate
   ```

2. **Plan Deployment:**
   ```bash
   terragrunt plan
   ```

3. **Deploy Infrastructure:**
   ```bash
   terragrunt apply
   ```

4. **Verify Deployment:**
   ```bash
   # Get instance information
   terragrunt output
   
   # Check instance status
   aws ec2 describe-instances --instance-ids $(terragrunt output -raw instance_id)
   ```

### Step 5: Testing and Validation

1. **Run Integration Tests:**
   ```bash
   # Return to project root
   cd ../../..
   
   # Run comprehensive tests
   ./scripts/test-deployment.sh
   ```

2. **Test SSH Connectivity:**
   ```bash
   # Get connection command from output
   ssh -i ~/.ssh/your-keypair.pem ec2-user@$(terragrunt output -raw private_ip)
   ```

## Common Use Cases

### Use Case 1: Web Server Deployment

```bash
# Deploy web server
cd environments/dev/ec2-instance
terragrunt apply -var="instance_type=t3.small" \
  -var="additional_ports=[{port=80,protocol=\"tcp\",cidr_blocks=[\"0.0.0.0/0\"],description=\"HTTP\"}]"

# Get web server URL
echo "Web server: http://$(terragrunt output -raw public_ip)"
```

### Use Case 2: Volume Management

```bash
# Increase volume size
cd ../ebs-volume
terragrunt apply -var="new_size=50"

# Check volume status
aws ec2 describe-volumes-modifications --volume-id $(terragrunt output -raw volume_id)
```

### Use Case 3: Instance Operations

```bash
# Restart instance
mkdir -p temp/restart-operation
cd temp/restart-operation

cat > terragrunt.hcl << EOF
terraform {
  source = "../../modules/ec2-operations"
}
inputs = {
  instance_id = "i-your-instance-id"
  operation = "restart"
  health_check_enabled = true
}
EOF

terragrunt apply
```

## Troubleshooting

### Common Issues

1. **Permission Denied:**
   ```bash
   # Check AWS credentials
   aws sts get-caller-identity
   
   # Check IAM permissions
   aws iam simulate-principal-policy \
     --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
     --action-names ec2:DescribeInstances \
     --resource-arns "*"
   ```

2. **Resource Not Found:**
   ```bash
   # Verify VPC exists
   aws ec2 describe-vpcs --vpc-ids vpc-12345678
   
   # Check subnet availability
   aws ec2 describe-subnets --subnet-ids subnet-12345678
   ```

3. **State Lock Issues:**
   ```bash
   # Check lock table
   aws dynamodb scan --table-name terraform-locks
   
   # Force unlock (use carefully)
   terragrunt force-unlock LOCK_ID
   ```

### Getting Help

1. **Check Documentation:**
   - [Usage Guide](docs/usage-guide.md)
   - [Module Documentation](docs/modules.md)
   - [Troubleshooting Guide](docs/troubleshooting.md)

2. **Run Validation:**
   ```bash
   ./scripts/validate-setup.sh
   ```

3. **Enable Debug Logging:**
   ```bash
   export TERRAGRUNT_LOG_LEVEL=debug
   terragrunt plan
   ```

## Next Steps

1. **Set Up Monitoring:**
   - Configure CloudWatch alarms
   - Set up log aggregation
   - Implement health checks

2. **Implement Backup Strategy:**
   - Schedule EBS snapshots
   - Test restore procedures
   - Document recovery processes

3. **Security Hardening:**
   - Review security groups
   - Enable VPC Flow Logs
   - Implement least privilege access

4. **Automation:**
   - Set up CI/CD pipelines
   - Implement GitOps workflows
   - Schedule maintenance operations

5. **Cost Optimization:**
   - Right-size instances
   - Implement auto-scaling
   - Schedule non-production resources

## Support and Contributing

- **Issues:** Create GitHub issues for bugs or feature requests
- **Documentation:** Contribute to documentation improvements
- **Examples:** Share additional use cases and examples
- **Testing:** Help improve test coverage and validation

Happy deploying! 🚀
