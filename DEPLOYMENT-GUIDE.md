# 🚀 Terraform Dashboard - Complete Deployment Guide

## 📋 Prerequisites

- Ubuntu 20.04 LTS or 22.04 LTS
- Minimum 2GB RAM, 2 CPU cores
- 20GB disk space
- Internet connectivity
- SSH access (for remote deployment)

## 🎯 Quick Deployment Options

### Option 1: Fresh Server Deployment (Recommended)

```bash
# Download and run the deployment script
wget https://raw.githubusercontent.com/deepesh786gpr/new-dashboard/main/deploy-fresh-server.sh
chmod +x deploy-fresh-server.sh
./deploy-fresh-server.sh

# Or quick deployment (skip tests)
./deploy-fresh-server.sh --quick
```

### Option 2: EC2 Deployment (Your Server)

```bash
# Ensure you have the key file 'dasboard.io.pem' in current directory
chmod +x deploy-ec2.sh
./deploy-ec2.sh

# Command line options
./deploy-ec2.sh --deploy    # Fresh deployment
./deploy-ec2.sh --update    # Update existing
./deploy-ec2.sh --status    # Check status
./deploy-ec2.sh --test      # Run tests only
```

### Option 3: Docker Deployment

```bash
cd terraform-dashboard
docker-compose up -d
```

## 🔧 Manual Deployment Steps

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git unzip build-essential

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2 serve
```

### 2. Clone Repository

```bash
git clone https://github.com/deepesh786gpr/new-dashboard.git
cd new-dashboard/terraform-dashboard
```

### 3. Backend Setup

```bash
cd backend
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Test the backend
node test-server.js
```

### 4. Frontend Setup

```bash
cd ../frontend
npm install

# Create environment file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ANSIBLE_API_URL=http://localhost:5001
GENERATE_SOURCEMAP=false
TSC_COMPILE_ON_ERROR=true
ESLINT_NO_DEV_ERRORS=true
EOF

# Build for production
npm run build
```

### 5. Start Services with PM2

```bash
cd ..

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'terraform-dashboard-backend',
      script: './backend/test-server.js',
      cwd: './backend',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 5000 }
    },
    {
      name: 'terraform-dashboard-frontend',
      script: 'serve',
      args: '-s build -l 3000 -H 0.0.0.0',
      cwd: './frontend'
    }
  ]
};
EOF

# Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🧪 Testing Deployment

### Run Comprehensive Tests

```bash
cd backend
node test-all-apis.js
```

### Manual Testing

1. **Backend API**: `curl http://localhost:5000/health`
2. **Frontend**: Open `http://localhost:3000` in browser
3. **Login**: Use credentials `admin/admin123`

## 🔐 Login Credentials

| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| Admin | `admin` | `admin123` | Full access (21 permissions) |
| User | `user` | `user123` | Standard access (9 permissions) |
| Demo | `demo` | `demo123` | Read-only access (5 permissions) |

## 🌐 Application URLs

After deployment, access the application at:

- **Frontend**: `http://YOUR_SERVER_IP:3000`
- **Backend API**: `http://YOUR_SERVER_IP:5000`
- **Ansible API**: `http://YOUR_SERVER_IP:5001`

## 🔥 Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow required ports
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000  # Frontend
sudo ufw allow 5000  # Backend
sudo ufw allow 5001  # Ansible API
```

## 🛠️ Management Commands

### PM2 Commands

```bash
pm2 status          # Check service status
pm2 logs            # View logs
pm2 restart all     # Restart all services
pm2 stop all        # Stop all services
pm2 delete all      # Delete all services
```

### Update Deployment

```bash
cd /path/to/new-dashboard
git pull origin main

# Update backend
cd terraform-dashboard/backend
npm install
pm2 restart terraform-dashboard-backend

# Update frontend
cd ../frontend
npm install
npm run build
pm2 restart terraform-dashboard-frontend
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   sudo lsof -i :3000  # Check what's using port 3000
   sudo kill -9 PID    # Kill the process
   ```

2. **Permission Denied**
   ```bash
   sudo chown -R $USER:$USER /path/to/app
   ```

3. **Node.js Version Issues**
   ```bash
   node --version  # Should be v20.x
   npm --version   # Should be 10.x+
   ```

4. **Frontend Build Fails**
   ```bash
   # Increase Node.js memory
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

### Log Locations

- **PM2 Logs**: `~/.pm2/logs/`
- **Application Logs**: `./logs/` (if configured)
- **System Logs**: `/var/log/`

## 🔄 Backup and Recovery

### Backup

```bash
# Backup application data
tar -czf terraform-dashboard-backup-$(date +%Y%m%d).tar.gz \
  /path/to/new-dashboard \
  ~/.pm2

# Backup database (if using)
cp backend/data/terraform-dashboard.db backup/
```

### Recovery

```bash
# Restore from backup
tar -xzf terraform-dashboard-backup-YYYYMMDD.tar.gz
pm2 resurrect
```

## 📊 Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:5000/health

# Frontend health
curl http://localhost:3000

# Ansible API health
curl http://localhost:5001/health
```

### Performance Monitoring

```bash
# System resources
htop
df -h
free -h

# PM2 monitoring
pm2 monit
```

## 🔒 Security Considerations

1. **Change Default Passwords**: Update all default credentials
2. **Use HTTPS**: Configure SSL certificates for production
3. **Firewall**: Restrict access to necessary ports only
4. **Updates**: Keep system and dependencies updated
5. **Backup**: Regular backups of application data

## 📞 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review application logs
3. Run the test suite: `node test-all-apis.js`
4. Check GitHub issues: [Repository Issues](https://github.com/deepesh786gpr/new-dashboard/issues)

---

**Happy Deploying! 🚀**
