# 🚀 FuelFlow Deployment Guide - Vercel

This guide will help you deploy your FuelFlow application to Vercel with a production-ready setup.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Neon Database**: Set up a PostgreSQL database on [neon.tech](https://neon.tech)

## 🗄️ Database Setup (Neon)

1. **Create Neon Account**:
   - Go to [neon.tech](https://neon.tech)
   - Sign up and create a new project
   - Choose a region close to your users

2. **Get Database URL**:
   - Copy the connection string from your Neon dashboard
   - Format: `postgresql://username:password@host/database`

3. **Run Migrations**:
   ```bash
   npm run db:push
   ```

## 🔧 Environment Variables

Set these environment variables in your Vercel project:

### Required Variables:
```env
DATABASE_URL=postgresql://username:password@host/database
JWT_SECRET=your-super-secret-jwt-key-32-chars-minimum
NODE_ENV=production
```

### Optional Variables:
```env
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

## 🚀 Deployment Steps

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Method 2: GitHub Integration

1. **Connect Repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**:
   - Framework Preset: `Other`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all required variables

4. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

## 📁 Project Structure for Vercel

```
fuelflow/
├── vercel.json          # Vercel configuration
├── package.json         # Build scripts
├── server/
│   ├── index.ts         # Express app (exported)
│   ├── vercel.ts        # Serverless handler
│   └── ...
├── client/
│   ├── src/
│   └── ...
└── shared/
    └── schema.ts        # Database schema
```

## 🔍 Configuration Files

### vercel.json
```json
{
  "version": 2,
  "name": "fuelflow",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "builds": [
    {
      "src": "server/vercel.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/vercel.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "server/vercel.ts": {
      "maxDuration": 30
    }
  }
}
```

### Project Structure
```
fuelflow/
├── vercel.json          # Vercel configuration
├── package.json         # Build scripts
├── server/
│   ├── index.ts         # Express app (exported)
│   ├── vercel.ts        # Serverless handler
│   └── routes.ts        # API routes
├── client/
│   ├── src/
│   └── ...
└── shared/
    └── schema.ts        # Database schema
```

## 🛠️ Build Process

The build process:
1. **Frontend**: Vite builds the React app to `dist/`
2. **Backend**: ESBuild bundles the server code
3. **Vercel**: Deploys both as serverless functions

## 🔒 Security Considerations

1. **Environment Variables**: Never commit secrets to Git
2. **CORS**: Configure `CORS_ORIGIN` for production
3. **JWT Secret**: Use a strong, unique secret
4. **Database**: Use Neon's connection pooling

## 📊 Monitoring & Analytics

1. **Vercel Analytics**: Enable in project settings
2. **Error Tracking**: Consider Sentry integration
3. **Performance**: Monitor function execution times

## 🔄 Continuous Deployment

1. **Automatic Deploys**: Enabled by default with GitHub
2. **Preview Deployments**: Created for each PR
3. **Production Deployments**: Triggered on main branch

## 🚨 Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are in `package.json`

2. **Database Connection**:
   - Verify `DATABASE_URL` is correct
   - Check Neon connection limits

3. **API Routes Not Working**:
   - Ensure routes are prefixed with `/api`
   - Check serverless function logs

4. **Environment Variables**:
   - Verify all required variables are set
   - Check variable names match code

### Debug Commands:
```bash
# Local testing
npm run dev

# Build testing
npm run build

# Check TypeScript
npm run check
```

## 📈 Performance Optimization

1. **Database**: Neon provides automatic connection pooling
2. **CDN**: Vercel provides global CDN
3. **Images**: Use Vercel Image Optimization
4. **Caching**: Vercel Edge Functions for caching

## 🔄 Updates & Maintenance

1. **Regular Updates**: Keep dependencies updated
2. **Security Patches**: Monitor for vulnerabilities
3. **Database Backups**: Neon provides automatic backups
4. **Monitoring**: Set up alerts for errors

## 📞 Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Neon Docs**: [neon.tech/docs](https://neon.tech/docs)
- **Drizzle Docs**: [orm.drizzle.team](https://orm.drizzle.team)

## ✅ Deployment Checklist

- [ ] Database setup (Neon)
- [ ] Environment variables configured
- [ ] Build script working locally
- [ ] API routes tested
- [ ] Frontend builds successfully
- [ ] Database migrations run
- [ ] SSL certificate (automatic with Vercel)
- [ ] Domain configured (optional)
- [ ] Monitoring setup
- [ ] Error tracking configured

---

**🎉 Your FuelFlow application is now ready for production deployment on Vercel!** 