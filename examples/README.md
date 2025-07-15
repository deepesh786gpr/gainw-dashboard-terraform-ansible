# Examples

This directory contains practical examples demonstrating how to use the AWS EC2 management modules.

## Available Examples

### 1. Basic Web Server (`basic-web-server/`)

A simple example that deploys an EC2 instance with Apache web server.

**Features:**
- Single EC2 instance with Amazon Linux 2
- Apache web server with custom HTML page
- Security group with HTTP/HTTPS access
- User data script for automated setup
- Health check endpoint

**Usage:**
```bash
cd examples/basic-web-server
# Update VPC ID, subnet ID, and key pair name in terragrunt.hcl
terragrunt plan
terragrunt apply
```

**Outputs:**
- Web server URL
- SSH connection command
- Health check endpoint

### 2. Volume Management Example

**File:** `volume-management-example.hcl`

Demonstrates EBS volume operations including:
- Volume size increase
- File system expansion
- Backup creation
- Retry mechanisms

**Usage:**
```bash
# Copy the example configuration
cp examples/volume-management-example.hcl temp-volume-config.hcl

# Update instance and volume IDs
# Edit temp-volume-config.hcl

# Apply the configuration
terragrunt apply -terragrunt-config temp-volume-config.hcl
```

### 3. Instance Operations Example

**File:** `instance-operations-example.hcl`

Shows various instance management operations:
- Instance restart
- Health checks
- Status monitoring
- Notification setup

**Usage:**
```bash
# Copy the example configuration
cp examples/instance-operations-example.hcl temp-ops-config.hcl

# Update instance ID and operation type
# Edit temp-ops-config.hcl

# Execute the operation
terragrunt apply -terragrunt-config temp-ops-config.hcl
```

## Quick Start Guide

### Prerequisites

1. **AWS CLI configured:**
   ```bash
   aws configure
   ```

2. **Required tools installed:**
   - Terraform (>= 1.0)
   - Terragrunt (>= 0.35)

3. **AWS resources available:**
   - VPC with public/private subnets
   - EC2 key pair
   - Appropriate IAM permissions

### Running Examples

1. **Choose an example:**
   ```bash
   cd examples/basic-web-server
   ```

2. **Update configuration:**
   Edit `terragrunt.hcl` and replace placeholder values:
   - `vpc_id`: Your VPC ID
   - `subnet_id`: Your subnet ID
   - `key_pair_name`: Your EC2 key pair name

3. **Plan and apply:**
   ```bash
   terragrunt plan
   terragrunt apply
   ```

4. **Access outputs:**
   ```bash
   terragrunt output
   ```

5. **Clean up:**
   ```bash
   terragrunt destroy
   ```

## Example Configurations

### Minimal EC2 Instance

```hcl
terraform {
  source = "../../modules/ec2-instance"
}

inputs = {
  name = "minimal-instance"
  instance_type = "t3.micro"
  vpc_id = "vpc-12345678"
  subnet_id = "subnet-12345678"
  key_pair_name = "my-keypair"
  
  create_security_group = true
  allowed_cidr_blocks = ["10.0.0.0/8"]
  
  instance_tags = {
    Purpose = "testing"
  }
}
```

### Volume Resize Operation

```hcl
terraform {
  source = "../../modules/ebs-volume"
}

inputs = {
  volume_id = "vol-12345678"
  new_size = 50
  instance_id = "i-12345678"
  expand_file_system = true
  ssh_key_path = "~/.ssh/my-key.pem"
}
```

### Instance Restart with Health Check

```hcl
terraform {
  source = "../../modules/ec2-operations"
}

inputs = {
  instance_id = "i-12345678"
  operation = "restart"
  wait_for_completion = true
  health_check_enabled = true
  health_check_url = "http://10.0.1.100/health"
}
```

## Customization Tips

### Security Groups

Add custom ports to security groups:

```hcl
additional_ports = [
  {
    port        = 8080
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "Application port"
  },
  {
    port        = 3306
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"]
    description = "MySQL access from app subnet"
  }
]
```

### User Data Scripts

Customize instance initialization:

```hcl
user_data = base64encode(<<-EOF
  #!/bin/bash
  yum update -y
  yum install -y docker
  systemctl start docker
  systemctl enable docker
  
  # Pull and run your application
  docker run -d -p 80:8080 your-app:latest
EOF
)
```

### Multiple EBS Volumes

Add additional storage:

```hcl
additional_ebs_volumes = [
  {
    device_name = "/dev/sdf"
    size        = 100
    type        = "gp3"
    encrypted   = true
    kms_key_id  = ""
  },
  {
    device_name = "/dev/sdg"
    size        = 50
    type        = "io1"
    encrypted   = true
    kms_key_id  = "alias/my-key"
  }
]
```

## Best Practices for Examples

1. **Always use placeholder values** for sensitive information
2. **Include comprehensive comments** explaining each configuration
3. **Provide cleanup instructions** to avoid unnecessary costs
4. **Test examples** in a development environment first
5. **Document prerequisites** and expected outcomes
6. **Use realistic but minimal** resource configurations

## Contributing Examples

To contribute new examples:

1. Create a new directory under `examples/`
2. Include a `terragrunt.hcl` configuration file
3. Add a `README.md` explaining the example
4. Test the example thoroughly
5. Update this main README with the new example

## Support

If you encounter issues with examples:

1. Check the [troubleshooting guide](../docs/troubleshooting.md)
2. Verify your AWS configuration and permissions
3. Ensure all placeholder values are updated
4. Review the module documentation
5. Check AWS service limits and quotas

## Next Steps

After running examples:

1. **Explore module documentation** in `docs/`
2. **Set up environment-specific configurations** in `environments/`
3. **Implement monitoring and alerting**
4. **Configure backup strategies**
5. **Integrate with CI/CD pipelines**
