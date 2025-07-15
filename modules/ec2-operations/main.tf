# EC2 Operations Module Main Configuration

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0"
    }
    local = {
      source  = "hashicorp/local"
      version = ">= 2.0"
    }
  }
}

# Data source for instance information
data "aws_instance" "target" {
  instance_id = var.instance_id
}

# Local values for computed configurations
locals {
  timestamp = formatdate("YYYY-MM-DD-hhmm", timestamp())
  
  # Instance connection details
  instance_ip = data.aws_instance.target.public_ip != "" ? data.aws_instance.target.public_ip : data.aws_instance.target.private_ip
  
  # Health check URL
  health_check_url = var.health_check_url != "" ? var.health_check_url : "http://${local.instance_ip}:${var.health_check_port}${var.health_check_path}"
  
  # Operation validation
  destructive_operations = ["terminate", "force_stop"]
  is_destructive = contains(local.destructive_operations, var.operation)
  
  # Common tags
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
      Module      = "ec2-operations"
      InstanceId  = var.instance_id
      Operation   = var.operation
      Timestamp   = local.timestamp
    }
  )
}

# CloudWatch Log Group for operations
resource "aws_cloudwatch_log_group" "operations" {
  count             = var.monitoring_enabled ? 1 : 0
  name              = "/aws/ec2/operations/${var.instance_id}"
  retention_in_days = var.log_retention_days
  
  tags = local.common_tags
}

# Pre-operation validation
resource "null_resource" "pre_operation_validation" {
  count = var.pre_operation_checks ? 1 : 0
  
  lifecycle {
    precondition {
      condition     = !local.is_destructive || var.force_operation
      error_message = "Destructive operation requires force_operation=true."
    }
    
    precondition {
      condition     = !var.dry_run || var.operation == "status"
      error_message = "Dry run is only supported for status operations."
    }
  }
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Pre-operation validation passed for instance ${var.instance_id}"
      echo "Operation: ${var.operation}"
      echo "Timestamp: ${local.timestamp}"
      echo "Reason: ${var.operation_reason}"
    EOT
  }
}

# Instance status check
resource "null_resource" "status_check" {
  count = var.operation == "status" ? 1 : 0
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Checking status of instance ${var.instance_id}..."
      
      # Get instance state
      STATE=$(aws ec2 describe-instances \
        --instance-ids ${var.instance_id} \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
      
      echo "Instance state: $STATE"
      
      # Get instance status checks
      STATUS=$(aws ec2 describe-instance-status \
        --instance-ids ${var.instance_id} \
        --query 'InstanceStatuses[0].InstanceStatus.Status' \
        --output text 2>/dev/null || echo "not-available")
      
      echo "Instance status: $STATUS"
      
      # Get system status checks
      SYSTEM_STATUS=$(aws ec2 describe-instance-status \
        --instance-ids ${var.instance_id} \
        --query 'InstanceStatuses[0].SystemStatus.Status' \
        --output text 2>/dev/null || echo "not-available")
      
      echo "System status: $SYSTEM_STATUS"
      
      # Output summary
      echo "=== Instance Status Summary ==="
      echo "Instance ID: ${var.instance_id}"
      echo "State: $STATE"
      echo "Instance Status: $STATUS"
      echo "System Status: $SYSTEM_STATUS"
      echo "Public IP: ${data.aws_instance.target.public_ip}"
      echo "Private IP: ${data.aws_instance.target.private_ip}"
      echo "Instance Type: ${data.aws_instance.target.instance_type}"
      echo "Availability Zone: ${data.aws_instance.target.availability_zone}"
    EOT
  }
  
  depends_on = [null_resource.pre_operation_validation]
}

# Instance start operation
resource "null_resource" "start_instance" {
  count = var.operation == "start" ? 1 : 0
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Starting instance ${var.instance_id}..."
      
      # Check current state
      CURRENT_STATE=$(aws ec2 describe-instances \
        --instance-ids ${var.instance_id} \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
      
      if [ "$CURRENT_STATE" = "running" ]; then
        echo "Instance is already running"
        exit 0
      fi
      
      # Start the instance
      aws ec2 start-instances --instance-ids ${var.instance_id}
      
      # Wait for running state if requested
      if [ "${var.wait_for_completion}" = "true" ]; then
        echo "Waiting for instance to reach running state..."
        aws ec2 wait instance-running --instance-ids ${var.instance_id}
        echo "Instance is now running"
      fi
    EOT
  }
  
  depends_on = [null_resource.pre_operation_validation]
}

# Instance stop operation
resource "null_resource" "stop_instance" {
  count = var.operation == "stop" ? 1 : 0
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Stopping instance ${var.instance_id}..."
      
      # Check current state
      CURRENT_STATE=$(aws ec2 describe-instances \
        --instance-ids ${var.instance_id} \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
      
      if [ "$CURRENT_STATE" = "stopped" ]; then
        echo "Instance is already stopped"
        exit 0
      fi
      
      # Stop the instance
      aws ec2 stop-instances --instance-ids ${var.instance_id}
      
      # Wait for stopped state if requested
      if [ "${var.wait_for_completion}" = "true" ]; then
        echo "Waiting for instance to reach stopped state..."
        aws ec2 wait instance-stopped --instance-ids ${var.instance_id}
        echo "Instance is now stopped"
      fi
    EOT
  }
  
  depends_on = [null_resource.pre_operation_validation]
}

# Instance restart/reboot operation
resource "null_resource" "restart_instance" {
  count = contains(["restart", "reboot"], var.operation) ? 1 : 0
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Restarting instance ${var.instance_id}..."
      
      # Check current state
      CURRENT_STATE=$(aws ec2 describe-instances \
        --instance-ids ${var.instance_id} \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
      
      if [ "$CURRENT_STATE" != "running" ]; then
        echo "Instance must be running to restart. Current state: $CURRENT_STATE"
        exit 1
      fi
      
      # Reboot the instance
      aws ec2 reboot-instances --instance-ids ${var.instance_id}
      
      # Wait for running state if requested
      if [ "${var.wait_for_completion}" = "true" ]; then
        echo "Waiting for instance to complete reboot..."
        sleep 30  # Give some time for reboot to initiate
        aws ec2 wait instance-running --instance-ids ${var.instance_id}
        echo "Instance reboot completed"
      fi
    EOT
  }
  
  depends_on = [null_resource.pre_operation_validation]
}

# Wait for running state
resource "null_resource" "wait_for_running" {
  count = var.operation == "wait_for_running" ? 1 : 0
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Waiting for instance ${var.instance_id} to reach running state..."
      timeout ${var.timeout_minutes * 60} aws ec2 wait instance-running --instance-ids ${var.instance_id}
      echo "Instance is now running"
    EOT
  }
  
  depends_on = [null_resource.pre_operation_validation]
}

# Wait for stopped state
resource "null_resource" "wait_for_stopped" {
  count = var.operation == "wait_for_stopped" ? 1 : 0

  provisioner "local-exec" {
    command = <<-EOT
      echo "Waiting for instance ${var.instance_id} to reach stopped state..."
      timeout ${var.timeout_minutes * 60} aws ec2 wait instance-stopped --instance-ids ${var.instance_id}
      echo "Instance is now stopped"
    EOT
  }

  depends_on = [null_resource.pre_operation_validation]
}

# Health check operation
resource "null_resource" "health_check" {
  count = var.operation == "health_check" || var.health_check_enabled ? 1 : 0

  provisioner "local-exec" {
    command = <<-EOT
      echo "Performing health check on instance ${var.instance_id}..."

      # Check instance state first
      STATE=$(aws ec2 describe-instances \
        --instance-ids ${var.instance_id} \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)

      if [ "$STATE" != "running" ]; then
        echo "Instance is not running (state: $STATE)"
        exit 1
      fi

      # HTTP health check if URL is provided
      if [ "${var.health_check_url}" != "" ] || [ "${local.health_check_url}" != "" ]; then
        echo "Performing HTTP health check..."
        URL="${var.health_check_url != "" ? var.health_check_url : local.health_check_url}"

        for i in $(seq 1 ${var.health_check_retries}); do
          echo "Health check attempt $i of ${var.health_check_retries}"

          if curl -f -s --max-time ${var.health_check_timeout} "$URL" > /dev/null; then
            echo "HTTP health check passed"
            break
          else
            if [ $i -eq ${var.health_check_retries} ]; then
              echo "HTTP health check failed after ${var.health_check_retries} attempts"
              exit 1
            fi
            sleep 10
          fi
        done
      fi

      # SSH connectivity check if enabled
      if [ "${var.ssh_enabled}" = "true" ]; then
        echo "Performing SSH connectivity check..."

        for i in $(seq 1 ${var.health_check_retries}); do
          echo "SSH check attempt $i of ${var.health_check_retries}"

          if timeout ${var.health_check_timeout} ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
             ${var.ssh_key_path != "" ? "-i ${var.ssh_key_path}" : ""} \
             ${var.ssh_user}@${local.instance_ip} \
             -p ${var.ssh_port} "echo 'SSH connection successful'" 2>/dev/null; then
            echo "SSH connectivity check passed"
            break
          else
            if [ $i -eq ${var.health_check_retries} ]; then
              echo "SSH connectivity check failed after ${var.health_check_retries} attempts"
              exit 1
            fi
            sleep 10
          fi
        done
      fi

      echo "All health checks passed"
    EOT
  }

  depends_on = [
    null_resource.start_instance,
    null_resource.restart_instance,
    null_resource.wait_for_running
  ]
}

# Post-operation checks
resource "null_resource" "post_operation_checks" {
  count = var.post_operation_checks && var.operation != "status" ? 1 : 0

  provisioner "local-exec" {
    command = <<-EOT
      echo "Performing post-operation checks for ${var.operation}..."

      # Verify expected state based on operation
      case "${var.operation}" in
        "start"|"restart"|"reboot"|"wait_for_running")
          EXPECTED_STATE="running"
          ;;
        "stop"|"wait_for_stopped")
          EXPECTED_STATE="stopped"
          ;;
        "terminate")
          EXPECTED_STATE="terminated"
          ;;
        *)
          echo "No specific state check for operation: ${var.operation}"
          exit 0
          ;;
      esac

      # Check actual state
      ACTUAL_STATE=$(aws ec2 describe-instances \
        --instance-ids ${var.instance_id} \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)

      echo "Expected state: $EXPECTED_STATE"
      echo "Actual state: $ACTUAL_STATE"

      if [ "$ACTUAL_STATE" = "$EXPECTED_STATE" ]; then
        echo "Post-operation check passed"
      else
        echo "Post-operation check failed: instance not in expected state"
        exit 1
      fi
    EOT
  }

  depends_on = [
    null_resource.start_instance,
    null_resource.stop_instance,
    null_resource.restart_instance,
    null_resource.wait_for_running,
    null_resource.wait_for_stopped
  ]
}

# Notification resource
resource "null_resource" "notification" {
  count = var.notification_enabled ? 1 : 0

  provisioner "local-exec" {
    command = <<-EOT
      echo "Sending notification for operation ${var.operation} on instance ${var.instance_id}..."

      # Prepare notification message
      MESSAGE="EC2 Operation Completed
      Instance: ${var.instance_id}
      Operation: ${var.operation}
      Environment: ${var.environment}
      Timestamp: ${local.timestamp}
      Reason: ${var.operation_reason}"

      # Send SNS notification if configured
      if [ "${var.sns_topic_arn}" != "" ]; then
        aws sns publish \
          --topic-arn "${var.sns_topic_arn}" \
          --message "$MESSAGE" \
          --subject "EC2 Operation: ${var.operation}"
      fi

      # Send Slack notification if configured
      if [ "${var.slack_webhook_url}" != "" ]; then
        curl -X POST -H 'Content-type: application/json' \
          --data "{\"text\":\"$MESSAGE\"}" \
          "${var.slack_webhook_url}"
      fi
    EOT
  }

  depends_on = [null_resource.post_operation_checks]
}
