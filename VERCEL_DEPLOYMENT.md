# Vercel Deployment Guide for DieselTrack

This guide covers deploying your mobile-optimized PWA to Vercel with all production optimizations.

## 🚀 **Pre-Deployment Checklist**

### ✅ **Required Setup**
- [ ] Vercel account created
- [ ] Database configured for production
- [ ] Environment variables ready
- [ ] Domain configured (optional)

### ✅ **Code Requirements**
- [ ] All PWA files are in place (`manifest.json`, `sw.js`)
- [ ] Mobile components are implemented
- [ ] Service worker is properly configured
- [ ] Build script works locally

## 📋 **Step-by-Step Deployment**

### 1. **Prepare Environment Variables**

Create these environment variables in Vercel dashboard:

```bash
# Database
DATABASE_URL=your_production_database_url

# Security
SESSION_SECRET=your_strong_random_secret_here

# API Configuration
NODE_ENV=production
API_BASE_URL=https://your-app-name.vercel.app

# CORS
CORS_ORIGIN=https://your-app-name.vercel.app

# Security Headers
SECURE_COOKIES=true
HTTP_ONLY_COOKIES=true
```

### 2. **Deploy to Vercel**

#### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: GitHub Integration
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure build settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 3. **Configure Custom Domain (Optional)**

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update environment variables with new domain

## 🔧 **Production Optimizations**

### 1. **Database Setup**

For production, use a managed database service:

#### **Option A: Neon (Recommended)**
```bash
# Create Neon database
# Update DATABASE_URL in Vercel environment variables
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

#### **Option B: Supabase**
```bash
# Create Supabase project
# Use connection string from Supabase dashboard
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
```

### 2. **Performance Monitoring**

Add to your `package.json`:
```json
{
  "scripts": {
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "vercel-build": "npm run build"
  }
}
```

### 3. **PWA Verification**

After deployment, verify PWA features:

1. **Lighthouse Audit**: Run Lighthouse in Chrome DevTools
2. **Installation**: Test "Add to Home Screen" functionality
3. **Offline Mode**: Test offline functionality
4. **Service Worker**: Check service worker registration

## 🛠️ **Troubleshooting**

### Common Issues

#### **1. PWA Not Installing**
- ✅ Check HTTPS is enabled (Vercel provides this automatically)
- ✅ Verify `manifest.json` is accessible
- ✅ Check service worker registration
- ✅ Ensure all icons are properly configured

#### **2. Database Connection Issues**
- ✅ Verify `DATABASE_URL` is correct
- ✅ Check database is accessible from Vercel
- ✅ Ensure SSL is enabled for database connection

#### **3. Build Failures**
- ✅ Check all dependencies are in `package.json`
- ✅ Verify TypeScript compilation
- ✅ Check for missing environment variables

#### **4. Mobile Issues**
- ✅ Test on actual mobile devices
- ✅ Check viewport meta tag
- ✅ Verify touch targets are 48px minimum
- ✅ Test offline functionality

### **Debug Commands**

```bash
# Check build locally
npm run build

# Test production build
npm run start

# Check TypeScript
npm run check

# Test database connection
npm run db:push
```

## 📊 **Performance Monitoring**

### **Vercel Analytics**
1. Enable Vercel Analytics in dashboard
2. Monitor Core Web Vitals
3. Track PWA installation rates

### **Custom Monitoring**
Add to your app:
```typescript
// Track PWA installations
window.addEventListener('appinstalled', (event) => {
  // Send analytics event
  console.log('PWA installed');
});

// Track offline usage
window.addEventListener('offline', () => {
  console.log('App went offline');
});
```

## 🔒 **Security Checklist**

- [ ] Environment variables are set
- [ ] Database connection uses SSL
- [ ] Session secret is strong and unique
- [ ] CORS is properly configured
- [ ] Security headers are enabled
- [ ] HTTPS is enforced

## 📱 **Mobile Testing**

### **Test Devices**
- [ ] Android Chrome
- [ ] Android Samsung Internet
- [ ] iOS Safari
- [ ] Various screen sizes

### **Test Scenarios**
- [ ] PWA installation
- [ ] Offline functionality
- [ ] Touch interactions
- [ ] Performance on slow networks
- [ ] Battery usage

## 🚀 **Post-Deployment**

### **1. Verify Everything Works**
- [ ] PWA installation prompt appears
- [ ] App works offline
- [ ] Mobile navigation works
- [ ] All features function properly

### **2. Monitor Performance**
- [ ] Check Vercel Analytics
- [ ] Monitor error rates
- [ ] Track user engagement
- [ ] Monitor database performance

### **3. Set Up Monitoring**
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Configure performance alerts

## 📞 **Support**

If you encounter issues:

1. **Check Vercel Logs**: Dashboard → Functions → View Logs
2. **Test Locally**: `npm run build && npm run start`
3. **Verify Environment**: Check all variables are set
4. **Check Database**: Verify connection and permissions

## 🔄 **Updates and Maintenance**

### **Regular Updates**
- Keep dependencies updated
- Monitor security advisories
- Update PWA cache versions
- Review performance metrics

### **Backup Strategy**
- Regular database backups
- Version control for all changes
- Environment variable backups

---

Your DieselTrack application is now ready for production deployment on Vercel! 🎉 