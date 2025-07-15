# EBS Volume Management Module Main Configuration

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
  }
}

# Data source for volume information
data "aws_ebs_volume" "target" {
  filter {
    name   = "volume-id"
    values = [var.volume_id]
  }
}

# Data source for instance information (if provided)
data "aws_instance" "target" {
  count       = var.instance_id != "" ? 1 : 0
  instance_id = var.instance_id
}

# Local values for computed configurations
locals {
  current_size = data.aws_ebs_volume.target.size
  size_increase = var.new_size - local.current_size

  # Determine if modification is needed
  needs_modification = var.new_size > local.current_size

  # Instance connection details
  instance_ip = var.instance_id != "" ? (
    data.aws_instance.target[0].public_ip != "" ?
    data.aws_instance.target[0].public_ip :
    data.aws_instance.target[0].private_ip
  ) : ""

  # File system expansion command based on type
  fs_expand_command = var.file_system_type == "ext4" ? "resize2fs" : "xfs_growfs"

  # Handle null values for IOPS and throughput
  iops_value = var.iops != null ? tostring(var.iops) : ""
  throughput_value = var.throughput != null ? tostring(var.throughput) : ""

  # Common tags
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
      Module      = "ebs-volume"
      VolumeId    = var.volume_id
    }
  )
}

# Validation checks
resource "null_resource" "validation" {
  count = 1
  
  lifecycle {
    precondition {
      condition     = local.needs_modification || var.new_size == local.current_size
      error_message = "New size (${var.new_size}GB) must be greater than or equal to current size (${local.current_size}GB)."
    }
    
    precondition {
      condition = !local.needs_modification || var.force_modification || local.size_increase <= 1000
      error_message = "Size increase of ${local.size_increase}GB is large. Set force_modification=true to proceed."
    }
  }
}

# Create snapshot before modification (if enabled)
resource "aws_ebs_snapshot" "backup" {
  count       = var.backup_before_modification && local.needs_modification ? 1 : 0
  volume_id   = var.volume_id
  description = var.snapshot_description
  
  tags = merge(
    local.common_tags,
    {
      Name        = "backup-${var.volume_id}-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
      Purpose     = "pre-modification-backup"
      VolumeSize  = "${local.current_size}GB"
    }
  )
  
  depends_on = [null_resource.validation]
}

# EBS Volume Modification using AWS CLI
resource "null_resource" "volume_modification" {
  count = local.needs_modification ? 1 : 0

  provisioner "local-exec" {
    command = <<-EOT
      echo "Modifying EBS volume ${var.volume_id}..."

      # Build the modify-volume command
      MODIFY_CMD="aws ec2 modify-volume --volume-id ${var.volume_id} --size ${var.new_size}"

      # Add volume type if specified
      if [ "${var.volume_type}" != "" ]; then
        MODIFY_CMD="$MODIFY_CMD --volume-type ${var.volume_type}"
      fi

      # Add IOPS if specified
      if [ "${local.iops_value}" != "" ]; then
        MODIFY_CMD="$MODIFY_CMD --iops ${local.iops_value}"
      fi

      # Add throughput if specified
      if [ "${local.throughput_value}" != "" ]; then
        MODIFY_CMD="$MODIFY_CMD --throughput ${local.throughput_value}"
      fi

      # Execute the modification
      echo "Executing: $MODIFY_CMD"
      eval $MODIFY_CMD

      echo "Volume modification initiated successfully"
    EOT
  }

  depends_on = [aws_ebs_snapshot.backup]
}

# Wait for volume modification to complete
resource "null_resource" "wait_for_modification" {
  count = var.wait_for_modification && local.needs_modification ? 1 : 0
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Waiting for volume modification to complete..."
      timeout ${var.modification_timeout * 60} bash -c '
        while true; do
          state=$(aws ec2 describe-volumes-modifications \
            --volume-id ${var.volume_id} \
            --query "VolumesModifications[0].ModificationState" \
            --output text 2>/dev/null || echo "failed")
          
          echo "Volume modification state: $state"
          
          if [ "$state" = "completed" ]; then
            echo "Volume modification completed successfully"
            break
          elif [ "$state" = "failed" ]; then
            echo "Volume modification failed"
            exit 1
          elif [ "$state" = "None" ] || [ "$state" = "failed" ]; then
            echo "No modification found or failed"
            exit 1
          fi
          
          sleep 10
        done
      '
    EOT
  }
  
  depends_on = [null_resource.volume_modification]
}

# File system expansion (if instance is provided)
resource "null_resource" "expand_filesystem" {
  count = var.expand_file_system && var.instance_id != "" && local.needs_modification ? 1 : 0
  
  # Connection configuration
  connection {
    type        = "ssh"
    host        = local.instance_ip
    user        = var.ssh_user
    private_key = var.ssh_key_path != "" ? file(var.ssh_key_path) : null
    port        = var.ssh_port
    timeout     = "${var.connection_timeout}s"
  }
  
  # Wait for volume modification and then expand filesystem
  provisioner "remote-exec" {
    inline = [
      "echo 'Starting file system expansion...'",
      
      # Wait for the new size to be recognized
      "echo 'Waiting for kernel to recognize new volume size...'",
      "for i in {1..30}; do",
      "  if lsblk | grep -q '${var.new_size}G\\|${var.new_size}.0G'; then",
      "    echo 'New volume size recognized'",
      "    break",
      "  fi",
      "  echo 'Waiting for volume size update... attempt $i'",
      "  sleep 10",
      "done",
      
      # Detect the actual device name
      "echo 'Detecting device name...'",
      "DEVICE=$(lsblk -no NAME,MOUNTPOINT | grep '/$' | head -1 | awk '{print $1}')",
      "if [ -z \"$DEVICE\" ]; then",
      "  echo 'Could not detect root device, using provided device name'",
      "  DEVICE='${var.device_name}'",
      "else",
      "  DEVICE=\"/dev/$DEVICE\"",
      "fi",
      "echo \"Using device: $DEVICE\"",
      
      # Expand the file system based on type
      "echo 'Expanding file system...'",
      "if [ '${var.file_system_type}' = 'ext4' ]; then",
      "  sudo resize2fs $DEVICE",
      "elif [ '${var.file_system_type}' = 'xfs' ]; then",
      "  sudo xfs_growfs /",
      "else",
      "  echo 'Unsupported file system type: ${var.file_system_type}'",
      "  exit 1",
      "fi",
      
      # Verify the expansion
      "echo 'Verifying file system expansion...'",
      "df -h /",
      "echo 'File system expansion completed successfully'"
    ]
  }
  
  depends_on = [null_resource.wait_for_modification]
}

# Retry mechanism for file system expansion
resource "null_resource" "retry_expand_filesystem" {
  count = var.expand_file_system && var.instance_id != "" && local.needs_modification && var.retry_attempts > 1 ? 1 : 0
  
  # This resource will only be created if the main expansion fails
  provisioner "local-exec" {
    command = <<-EOT
      echo "Setting up retry mechanism for file system expansion..."
      for attempt in $(seq 2 ${var.retry_attempts}); do
        echo "Retry attempt $attempt of ${var.retry_attempts}"
        sleep ${var.retry_delay}
        
        # Check if expansion is needed by connecting and checking disk space
        if ssh -o ConnectTimeout=30 -o StrictHostKeyChecking=no \
           ${var.ssh_key_path != "" ? "-i ${var.ssh_key_path}" : ""} \
           ${var.ssh_user}@${local.instance_ip} \
           "df -h / | tail -1 | awk '{print \$2}' | grep -q '${var.new_size}G'"; then
          echo "File system expansion successful on retry attempt $attempt"
          break
        else
          echo "File system expansion still needed, retrying..."
          ssh -o ConnectTimeout=30 -o StrictHostKeyChecking=no \
              ${var.ssh_key_path != "" ? "-i ${var.ssh_key_path}" : ""} \
              ${var.ssh_user}@${local.instance_ip} \
              "sudo ${local.fs_expand_command} ${var.device_name}" || true
        fi
      done
    EOT
    
    on_failure = continue
  }
  
  depends_on = [null_resource.expand_filesystem]
}

# Clean up backup snapshot (if requested)
resource "null_resource" "cleanup_snapshot" {
  count = var.delete_snapshot_after_success && var.backup_before_modification && local.needs_modification ? 1 : 0
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Cleaning up backup snapshot..."
      if [ "${aws_ebs_snapshot.backup[0].id}" != "" ]; then
        aws ec2 delete-snapshot --snapshot-id ${aws_ebs_snapshot.backup[0].id}
        echo "Backup snapshot ${aws_ebs_snapshot.backup[0].id} deleted"
      fi
    EOT
    
    on_failure = continue
  }
  
  depends_on = [null_resource.expand_filesystem, null_resource.retry_expand_filesystem]
}
