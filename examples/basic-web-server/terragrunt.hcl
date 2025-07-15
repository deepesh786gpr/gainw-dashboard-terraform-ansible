# Basic Web Server Example
# This example demonstrates deploying a simple web server using the EC2 instance module

# Include the root terragrunt configuration
include "root" {
  path = find_in_parent_folders()
}

# Terraform module source
terraform {
  source = "../../modules/ec2-instance"
}

# Local values for this example
locals {
  name_prefix = "example-web-server"
  environment = "example"
}

# Example inputs for a basic web server
inputs = {
  # Instance configuration
  name = "${local.name_prefix}-01"
  instance_type = "t3.micro"
  
  # Use latest Amazon Linux 2 AMI
  ami_id = ""  # Will use data source to find latest
  ami_name_filter = "amzn2-ami-hvm-*-x86_64-gp2"
  ami_owner = "amazon"
  
  # Networking - REPLACE THESE WITH YOUR ACTUAL VALUES
  vpc_id = "vpc-12345678"  # Replace with your VPC ID
  subnet_id = "subnet-12345678"  # Replace with your subnet ID
  
  # Security configuration
  create_security_group = true
  security_group_name = "${local.name_prefix}-sg"
  allowed_cidr_blocks = ["0.0.0.0/0"]  # WARNING: This allows access from anywhere
  ssh_port = 22
  
  # Web server ports
  additional_ports = [
    {
      port        = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP access"
    },
    {
      port        = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS access"
    }
  ]
  
  # Key pair - REPLACE WITH YOUR KEY PAIR NAME
  key_pair_name = "my-keypair"  # Replace with your key pair name
  
  # Storage
  root_volume_size = 20
  root_volume_type = "gp3"
  root_volume_encrypted = true
  
  # User data script to set up a basic web server
  user_data = base64encode(<<-EOF
    #!/bin/bash
    
    # Update system
    yum update -y
    
    # Install Apache web server
    yum install -y httpd
    
    # Start and enable Apache
    systemctl start httpd
    systemctl enable httpd
    
    # Create a simple web page
    cat > /var/www/html/index.html << 'HTML'
    <!DOCTYPE html>
    <html>
    <head>
        <title>Example Web Server</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .info { background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .success { color: #28a745; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="success">🎉 Web Server Successfully Deployed!</h1>
            <p>This is a basic web server deployed using Terraform and Terragrunt.</p>
            
            <div class="info">
                <h3>Instance Information:</h3>
                <p><strong>Instance ID:</strong> <span id="instance-id">Loading...</span></p>
                <p><strong>Availability Zone:</strong> <span id="az">Loading...</span></p>
                <p><strong>Instance Type:</strong> <span id="instance-type">Loading...</span></p>
                <p><strong>Local Time:</strong> <span id="local-time"></span></p>
            </div>
            
            <div class="info">
                <h3>Features Demonstrated:</h3>
                <ul>
                    <li>✅ EC2 instance deployment</li>
                    <li>✅ Security group configuration</li>
                    <li>✅ User data script execution</li>
                    <li>✅ Web server installation</li>
                    <li>✅ Basic HTML page serving</li>
                </ul>
            </div>
            
            <div class="info">
                <h3>Next Steps:</h3>
                <ul>
                    <li>SSH into the instance: <code>ssh -i your-key.pem ec2-user@INSTANCE_IP</code></li>
                    <li>Check Apache logs: <code>sudo tail -f /var/log/httpd/access_log</code></li>
                    <li>Customize this page by editing <code>/var/www/html/index.html</code></li>
                    <li>Add SSL certificate for HTTPS</li>
                    <li>Set up monitoring and logging</li>
                </ul>
            </div>
        </div>
        
        <script>
            // Fetch instance metadata
            function updateInstanceInfo() {
                document.getElementById('local-time').textContent = new Date().toLocaleString();
                
                // Note: In a real deployment, you might want to fetch this server-side
                // This is just for demonstration
                fetch('http://169.254.169.254/latest/meta-data/instance-id')
                    .then(response => response.text())
                    .then(data => document.getElementById('instance-id').textContent = data)
                    .catch(() => document.getElementById('instance-id').textContent = 'Not available');
                
                fetch('http://169.254.169.254/latest/meta-data/placement/availability-zone')
                    .then(response => response.text())
                    .then(data => document.getElementById('az').textContent = data)
                    .catch(() => document.getElementById('az').textContent = 'Not available');
                
                fetch('http://169.254.169.254/latest/meta-data/instance-type')
                    .then(response => response.text())
                    .then(data => document.getElementById('instance-type').textContent = data)
                    .catch(() => document.getElementById('instance-type').textContent = 'Not available');
            }
            
            // Update info on page load and every 30 seconds
            updateInstanceInfo();
            setInterval(updateInstanceInfo, 30000);
        </script>
    </body>
    </html>
    HTML
    
    # Create a health check endpoint
    cat > /var/www/html/health << 'HEALTH'
    OK
    HEALTH
    
    # Set proper permissions
    chown -R apache:apache /var/www/html
    chmod -R 644 /var/www/html
    
    # Configure firewall (if needed)
    # systemctl start firewalld
    # firewall-cmd --permanent --add-service=http
    # firewall-cmd --permanent --add-service=https
    # firewall-cmd --reload
    
    # Log completion
    echo "Web server setup completed at $(date)" >> /var/log/user-data.log
  EOF
  )
  
  user_data_base64 = true
  
  # Networking
  associate_public_ip = true  # Enable public IP for web access
  
  # Monitoring
  enable_detailed_monitoring = false
  enable_termination_protection = false
  
  # Tags
  instance_tags = {
    Name        = "${local.name_prefix}-01"
    Purpose     = "example-web-server"
    Application = "demo"
    Owner       = "example-user"
  }
  
  volume_tags = {
    Name        = "${local.name_prefix}-volume"
    Purpose     = "example-web-server"
  }
  
  environment = local.environment
}

# Generate example-specific outputs
generate "example_outputs" {
  path      = "example_outputs.tf"
  if_exists = "overwrite"
  contents  = <<EOF
# Example-specific outputs

output "web_server_url" {
  description = "URL to access the web server"
  value       = "http://$${aws_instance.main.public_ip}"
}

output "health_check_url" {
  description = "Health check endpoint"
  value       = "http://$${aws_instance.main.public_ip}/health"
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@$${aws_instance.main.public_ip}"
}

output "instance_info" {
  description = "Basic instance information"
  value = {
    id          = aws_instance.main.id
    public_ip   = aws_instance.main.public_ip
    private_ip  = aws_instance.main.private_ip
    state       = aws_instance.main.instance_state
  }
}
EOF
}
