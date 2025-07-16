# 🚀 Simple Deployment Guide

## One-Command Quick Start

```bash
./quick-start.sh
```

This will automatically:
- ✅ Check prerequisites
- ✅ Install dependencies  
- ✅ Start the application in development mode
- ✅ Open on http://localhost:3000

## Alternative Deployment Options

### 1. Development Mode
```bash
./deploy.sh dev
```

### 2. Production Mode
```bash
./deploy.sh deploy
```

### 3. Docker Deployment
```bash
docker-compose -f docker-compose.simple.yml up -d
```

## 🔐 Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Change password after first login!**

## 🌐 Access URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## 🛠️ Management Commands

```bash
./deploy.sh status    # Check application status
./deploy.sh stop      # Stop the application
./deploy.sh restart   # Restart the application
./deploy.sh help      # Show all commands
```

## 📋 Prerequisites

- Node.js 18+
- npm
- Docker (for containerized deployment)

## 🔧 Troubleshooting

1. **Port conflicts**: Change ports in environment variables
2. **Permission errors**: Run `chmod +x *.sh`
3. **Dependencies**: Run `npm install` in root, backend, and frontend directories

For detailed deployment options, see [DEPLOYMENT.md](DEPLOYMENT.md)
