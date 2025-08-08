# 🔐 Authentication Setup Guide

This application now includes secure authentication with session-based login.

## 🚀 Quick Setup

### 1. Set Environment Variables

Create a `.env` file in your project root with:

```env
DATABASE_URL=your-database-url
SESSION_SECRET=your-super-secret-session-key-32-chars-minimum
ADMIN_PASSWORD=your-secure-admin-password
NODE_ENV=development
```

### 2. Create Admin User

Run the seed script to create the admin user:

```bash
npm run seed:admin
```

This will create an admin user with:
- **Username**: `admin`
- **Password**: The value from your `ADMIN_PASSWORD` environment variable

### 3. Login

Navigate to `/login` and use the admin credentials to access the system.

## 🔒 Security Features

- **Session-based authentication** with secure HTTP-only cookies
- **Password hashing** using bcrypt with salt rounds
- **Protected routes** - all API endpoints and pages require authentication
- **Automatic logout** on session expiry
- **Environment-based secrets** - no hardcoded passwords

## 🚀 Production Deployment

### Vercel Environment Variables

Set these in your Vercel project settings:

1. `DATABASE_URL` - Your PostgreSQL connection string
2. `SESSION_SECRET` - A secure random string (32+ characters)
3. `ADMIN_PASSWORD` - A strong password for the admin account
4. `NODE_ENV=production`

### Creating Admin User in Production

After deploying, you can create the admin user by running:

```bash
vercel env pull .env.local
npm run seed:admin
```

Or set up a one-time deployment script that runs the seed command.

## 🔄 Changing Admin Password

To change the admin password:

1. Update the `ADMIN_PASSWORD` environment variable
2. Delete the existing admin user from the database
3. Run `npm run seed:admin` again

## 🛡️ Security Best Practices

- Use a strong, unique password for the admin account
- Keep your `SESSION_SECRET` secure and never commit it to version control
- Regularly rotate your secrets
- Monitor login attempts and sessions
- Consider implementing rate limiting for login attempts

## 🔧 Troubleshooting

### "ADMIN_PASSWORD environment variable is required"
Make sure you've set the `ADMIN_PASSWORD` in your `.env` file or environment variables.

### "Authentication required" errors
Check that your session is valid and you're logged in. Sessions expire after 24 hours by default.

### Login page not accessible
Ensure the `/login` route is properly configured and not protected by authentication middleware.