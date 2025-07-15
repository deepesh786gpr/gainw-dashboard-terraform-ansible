# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the AWS EC2 management modules.

## Table of Contents

1. [Common Issues](#common-issues)
2. [EC2 Instance Issues](#ec2-instance-issues)
3. [EBS Volume Issues](#ebs-volume-issues)
4. [Instance Operations Issues](#instance-operations-issues)
5. [Terragrunt Issues](#terragrunt-issues)
6. [Networking Issues](#networking-issues)
7. [Debugging Tools](#debugging-tools)

## Common Issues

### Issue: "Access Denied" Errors

**Symptoms:**
- AWS API calls fail with access denied
- Terraform plan/apply fails with permission errors

**Solutions:**
1. **Check AWS credentials:**
   ```bash
   aws sts get-caller-identity
   ```

2. **Verify IAM permissions:**
   ```bash
   aws iam simulate-principal-policy \
     --policy-source-arn arn:aws:iam::ACCOUNT:user/USERNAME \
     --action-names ec2:DescribeInstances \
     --resource-arns "*"
   ```

3. **Check AWS CLI configuration:**
   ```bash
   aws configure list
   ```

### Issue: "Resource Not Found" Errors

**Symptoms:**
- References to VPC, subnet, or other resources fail
- Data sources return empty results

**Solutions:**
1. **Verify resource IDs in configuration files**
2. **Check AWS region settings**
3. **Ensure resources exist in the target account/region**

### Issue: State Lock Errors

**Symptoms:**
- "Error acquiring the state lock" messages
- Multiple users trying to apply simultaneously

**Solutions:**
1. **Check DynamoDB lock table:**
   ```bash
   aws dynamodb scan --table-name terraform-locks
   ```

2. **Force unlock (use carefully):**
   ```bash
   terragrunt force-unlock LOCK_ID
   ```

3. **Wait for other operations to complete**

## EC2 Instance Issues

### Issue: Instance Launch Failures

**Symptoms:**
- Instance fails to launch
- Instance launches but immediately terminates

**Debugging Steps:**
1. **Check instance logs:**
   ```bash
   aws ec2 get-console-output --instance-id i-1234567890abcdef0
   ```

2. **Verify AMI availability:**
   ```bash
   aws ec2 describe-images --image-ids ami-1234567890abcdef0
   ```

3. **Check subnet capacity:**
   ```bash
   aws ec2 describe-subnets --subnet-ids subnet-1234567890abcdef0
   ```

4. **Verify security group rules:**
   ```bash
   aws ec2 describe-security-groups --group-ids sg-1234567890abcdef0
   ```

### Issue: SSH Connection Failures

**Symptoms:**
- Cannot connect to instance via SSH
- Connection timeouts or refused connections

**Solutions:**
1. **Check instance state:**
   ```bash
   aws ec2 describe-instances --instance-ids i-1234567890abcdef0 \
     --query 'Reservations[0].Instances[0].State.Name'
   ```

2. **Verify security group rules:**
   ```bash
   aws ec2 describe-security-groups --group-ids sg-1234567890abcdef0 \
     --query 'SecurityGroups[0].IpPermissions[?FromPort==`22`]'
   ```

3. **Check network ACLs:**
   ```bash
   aws ec2 describe-network-acls --filters "Name=association.subnet-id,Values=subnet-1234567890abcdef0"
   ```

4. **Test connectivity:**
   ```bash
   # Test port connectivity
   telnet INSTANCE_IP 22
   
   # Test with verbose SSH
   ssh -v -i ~/.ssh/key.pem ec2-user@INSTANCE_IP
   ```

### Issue: User Data Script Failures

**Symptoms:**
- Instance launches but applications don't start
- Expected software not installed

**Debugging Steps:**
1. **Check cloud-init logs:**
   ```bash
   ssh -i ~/.ssh/key.pem ec2-user@INSTANCE_IP
   sudo cat /var/log/cloud-init.log
   sudo cat /var/log/cloud-init-output.log
   ```

2. **Verify user data script:**
   ```bash
   curl http://169.254.169.254/latest/user-data
   ```

3. **Check system logs:**
   ```bash
   sudo journalctl -u cloud-init
   sudo tail -f /var/log/messages
   ```

## EBS Volume Issues

### Issue: Volume Modification Failures

**Symptoms:**
- Volume modification gets stuck
- File system expansion fails

**Debugging Steps:**
1. **Check modification status:**
   ```bash
   aws ec2 describe-volumes-modifications --volume-id vol-1234567890abcdef0
   ```

2. **Verify volume state:**
   ```bash
   aws ec2 describe-volumes --volume-ids vol-1234567890abcdef0 \
     --query 'Volumes[0].State'
   ```

3. **Check instance attachment:**
   ```bash
   aws ec2 describe-volumes --volume-ids vol-1234567890abcdef0 \
     --query 'Volumes[0].Attachments'
   ```

### Issue: File System Expansion Failures

**Symptoms:**
- Volume size increased but file system not expanded
- "No space left on device" errors persist

**Solutions:**
1. **Check current disk usage:**
   ```bash
   df -h
   lsblk
   ```

2. **Manual file system expansion:**
   ```bash
   # For ext4 file systems
   sudo resize2fs /dev/xvda1
   
   # For XFS file systems
   sudo xfs_growfs /
   ```

3. **Verify partition table:**
   ```bash
   sudo fdisk -l
   sudo parted /dev/xvda print
   ```

4. **Check for partition expansion:**
   ```bash
   # If using partitions, you may need to expand the partition first
   sudo growpart /dev/xvda 1
   sudo resize2fs /dev/xvda1
   ```

### Issue: Snapshot Creation Failures

**Symptoms:**
- Backup snapshots fail to create
- Snapshot creation times out

**Solutions:**
1. **Check snapshot status:**
   ```bash
   aws ec2 describe-snapshots --snapshot-ids snap-1234567890abcdef0
   ```

2. **Verify permissions:**
   ```bash
   aws iam simulate-principal-policy \
     --policy-source-arn arn:aws:iam::ACCOUNT:user/USERNAME \
     --action-names ec2:CreateSnapshot \
     --resource-arns "*"
   ```

3. **Check volume activity:**
   ```bash
   # High I/O can slow snapshot creation
   iostat -x 1 5
   ```

## Instance Operations Issues

### Issue: Operation Timeouts

**Symptoms:**
- Instance operations hang or timeout
- Health checks fail repeatedly

**Solutions:**
1. **Increase timeout values:**
   ```hcl
   timeout_minutes = 20
   health_check_timeout = 60
   ```

2. **Check instance responsiveness:**
   ```bash
   aws ec2 describe-instance-status --instance-ids i-1234567890abcdef0
   ```

3. **Verify network connectivity:**
   ```bash
   ping INSTANCE_IP
   curl -I http://INSTANCE_IP
   ```

### Issue: Health Check Failures

**Symptoms:**
- HTTP health checks consistently fail
- SSH connectivity checks fail

**Debugging Steps:**
1. **Test health check URL manually:**
   ```bash
   curl -v http://INSTANCE_IP:PORT/PATH
   ```

2. **Check application logs:**
   ```bash
   ssh -i ~/.ssh/key.pem ec2-user@INSTANCE_IP
   sudo tail -f /var/log/httpd/error_log
   ```

3. **Verify service status:**
   ```bash
   sudo systemctl status httpd
   sudo netstat -tlnp | grep :80
   ```

## Terragrunt Issues

### Issue: Module Source Errors

**Symptoms:**
- "Module not found" errors
- Git clone failures for remote modules

**Solutions:**
1. **Verify module source path:**
   ```bash
   ls -la ../../../modules/ec2-instance
   ```

2. **Check Git credentials (for remote sources):**
   ```bash
   git ls-remote https://github.com/user/repo.git
   ```

3. **Clear Terragrunt cache:**
   ```bash
   rm -rf .terragrunt-cache
   terragrunt init
   ```

### Issue: Variable Resolution Errors

**Symptoms:**
- Variables not found or incorrect values
- Include path resolution failures

**Solutions:**
1. **Check include paths:**
   ```bash
   find . -name "terragrunt.hcl" -exec echo {} \; -exec head -5 {} \;
   ```

2. **Verify variable precedence:**
   ```bash
   terragrunt run-all output
   ```

3. **Debug variable resolution:**
   ```bash
   terragrunt plan --terragrunt-log-level debug
   ```

## Networking Issues

### Issue: Connectivity Problems

**Symptoms:**
- Cannot reach instances from internet
- Inter-instance communication fails

**Debugging Steps:**
1. **Check route tables:**
   ```bash
   aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=subnet-1234567890abcdef0"
   ```

2. **Verify internet gateway:**
   ```bash
   aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=vpc-1234567890abcdef0"
   ```

3. **Check NAT gateway (for private subnets):**
   ```bash
   aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=vpc-1234567890abcdef0"
   ```

4. **Test network path:**
   ```bash
   traceroute INSTANCE_IP
   mtr INSTANCE_IP
   ```

## Debugging Tools

### AWS CLI Commands

**Instance information:**
```bash
# Comprehensive instance details
aws ec2 describe-instances --instance-ids i-1234567890abcdef0

# Instance status checks
aws ec2 describe-instance-status --instance-ids i-1234567890abcdef0

# Console output
aws ec2 get-console-output --instance-id i-1234567890abcdef0
```

**Volume information:**
```bash
# Volume details
aws ec2 describe-volumes --volume-ids vol-1234567890abcdef0

# Volume modifications
aws ec2 describe-volumes-modifications --volume-id vol-1234567890abcdef0

# Snapshots
aws ec2 describe-snapshots --owner-ids self --filters "Name=volume-id,Values=vol-1234567890abcdef0"
```

### Terragrunt Debugging

**Enable debug logging:**
```bash
export TERRAGRUNT_LOG_LEVEL=debug
terragrunt plan
```

**Show configuration:**
```bash
terragrunt show-config
```

**Validate configuration:**
```bash
terragrunt validate
```

### System-Level Debugging

**On the instance:**
```bash
# System logs
sudo journalctl -f

# Disk usage
df -h
lsblk

# Network connectivity
ss -tlnp
netstat -rn

# Process monitoring
top
htop
```

## Getting Help

If you continue to experience issues:

1. **Check AWS Service Health Dashboard**
2. **Review AWS CloudTrail logs for API calls**
3. **Enable VPC Flow Logs for network debugging**
4. **Use AWS Support (if available)**
5. **Consult AWS documentation and forums**

## Prevention

To avoid common issues:

1. **Use consistent naming conventions**
2. **Implement proper tagging strategies**
3. **Regular backup and testing procedures**
4. **Monitor resource limits and quotas**
5. **Keep Terraform and Terragrunt updated**
6. **Use version pinning for modules**
7. **Implement proper CI/CD practices**
