import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as bcrypt from 'bcrypt';

let db: Database;

export async function initializeSimpleDatabase() {
  // Open database
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');

  // Create roles table first
  await db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT,
      is_system_role BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create users table
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role_id TEXT NOT NULL DEFAULT 'viewer',
      first_name TEXT,
      last_name TEXT,
      avatar_url TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      email_verified BOOLEAN DEFAULT FALSE,
      last_login DATETIME,
      login_count INTEGER DEFAULT 0,
      password_reset_token TEXT,
      password_reset_expires DATETIME,
      email_verification_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles (id)
    )
  `);

  // Create user_sessions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      refresh_token TEXT UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create user_tokens table
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_type TEXT NOT NULL,
      token_name TEXT,
      encrypted_token TEXT NOT NULL,
      token_metadata TEXT,
      expires_at DATETIME,
      last_used DATETIME,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create templates table
  await db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      terraform_code TEXT,
      variables TEXT,
      template_type TEXT DEFAULT 'terraform',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add template_type column if it doesn't exist
  try {
    await db.run(`ALTER TABLE templates ADD COLUMN template_type TEXT DEFAULT 'terraform'`);
    console.log('✅ Added template_type column to templates table');
  } catch (error) {
    // Column might already exist, which is fine
  }

  // Create deployments table
  await db.run(`
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template_id TEXT,
      user_id TEXT,
      status TEXT NOT NULL,
      environment TEXT,
      variables TEXT,
      terraform_state TEXT,
      logs TEXT,
      workspace_path TEXT,
      last_action TEXT,
      last_action_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates (id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (last_action_by) REFERENCES users (id)
    )
  `);

  // Create scheduled_actions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_actions (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('start', 'stop')),
      scheduled_time TEXT NOT NULL,
      recurring BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      last_executed TEXT,
      execution_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed default roles
  const defaultRoles = [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full access to all features and settings',
      permissions: JSON.stringify([
        'users:read', 'users:write', 'users:delete',
        'roles:read', 'roles:write', 'roles:delete',
        'templates:read', 'templates:write', 'templates:delete',
        'deployments:read', 'deployments:write', 'deployments:delete', 'deployments:execute',
        'instances:read', 'instances:write', 'instances:start', 'instances:stop', 'instances:terminate',
        'settings:read', 'settings:write',
        'audit:read',
        'github:read', 'github:write',
        'aws:read', 'aws:write'
      ]),
      is_system_role: true
    },
    {
      id: 'developer',
      name: 'Developer',
      description: 'Can create and manage deployments, view instances',
      permissions: JSON.stringify([
        'templates:read', 'templates:write',
        'deployments:read', 'deployments:write', 'deployments:execute',
        'instances:read', 'instances:start', 'instances:stop',
        'github:read', 'github:write',
        'aws:read'
      ]),
      is_system_role: true
    },
    {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to templates, deployments, and instances',
      permissions: JSON.stringify([
        'templates:read',
        'deployments:read',
        'instances:read'
      ]),
      is_system_role: true
    }
  ];

  for (const role of defaultRoles) {
    const existing = await db.get('SELECT id FROM roles WHERE id = ?', [role.id]);
    if (!existing) {
      await db.run(
        'INSERT INTO roles (id, name, description, permissions, is_system_role) VALUES (?, ?, ?, ?, ?)',
        [role.id, role.name, role.description, role.permissions, role.is_system_role]
      );
    }
  }

  // Create default admin user if no users exist
  const existingUsers = await db.get('SELECT COUNT(*) as count FROM users');
  if (existingUsers.count === 0) {
    const defaultAdminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);
    
    await db.run(
      `INSERT INTO users (id, username, email, password_hash, role_id, first_name, last_name, is_active, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'admin-user-001',
        'admin',
        'admin@terraform-dashboard.local',
        hashedPassword,
        'admin',
        'System',
        'Administrator',
        1,
        1
      ]
    );
    
    console.log('🔐 Default admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change the password after first login!');
  }

  console.log('✅ Database initialized successfully');
  return db;
}

export { db };
