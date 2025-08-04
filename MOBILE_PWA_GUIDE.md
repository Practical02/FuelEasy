# Mobile PWA Guide for DieselTrack

This guide explains the mobile-optimized features and PWA capabilities of DieselTrack for Android devices.

## 🚀 PWA Features

### Installation
- **Automatic Prompt**: The app will show an installation prompt after 3 seconds on compatible devices
- **Manual Installation**: Users can install via browser menu (Chrome: "Add to Home Screen")
- **App-like Experience**: Once installed, the app runs in standalone mode without browser UI

### Offline Support
- **Cached Resources**: Core app files are cached for offline access
- **API Caching**: Recent API responses are cached for offline viewing
- **Offline Indicator**: Shows when device is offline
- **Background Sync**: Syncs offline actions when connection is restored

### Mobile Optimizations

#### Touch-Friendly Interface
- **48px Touch Targets**: All interactive elements meet minimum touch target size
- **Haptic Feedback**: Vibration feedback on Android devices for interactions
- **Swipe Gestures**: Support for swipe-to-dismiss and other touch gestures

#### Responsive Design
- **Mobile-First**: Optimized for mobile screens with desktop fallbacks
- **Adaptive Layouts**: Components automatically adjust to screen size
- **Safe Areas**: Respects device notches and system UI

#### Performance
- **Lazy Loading**: Components load only when needed
- **Optimized Images**: SVG icons and optimized image formats
- **Smooth Animations**: 60fps animations with hardware acceleration

## 📱 Mobile Components

### Mobile Navigation
```tsx
import MobileNav from "@/components/layout/mobile-nav";

// Automatically shows on mobile devices
<MobileNav />
```

### Mobile Data Table
```tsx
import { MobileDataTable } from "@/components/ui/mobile-data-table";

const columns = [
  { key: "name", header: "Name", mobilePriority: true },
  { key: "amount", header: "Amount", mobilePriority: true },
  { key: "date", header: "Date", mobilePriority: false }, // Hidden on mobile
];

<MobileDataTable
  data={data}
  columns={columns}
  onSearch={handleSearch}
  onRowClick={handleRowClick}
  loading={isLoading}
/>
```

### Mobile Modal
```tsx
import { MobileModal } from "@/components/ui/mobile-modal";

<MobileModal
  isOpen={isOpen}
  onClose={onClose}
  title="Edit Item"
  showDragHandle={true}
>
  <div>Modal content here</div>
</MobileModal>
```

### Mobile Form
```tsx
import { MobileForm } from "@/components/ui/mobile-form";

const fields = [
  {
    name: "name",
    label: "Name",
    type: "text",
    required: true,
    validation: { minLength: 2 }
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    required: true
  }
];

<MobileForm
  fields={fields}
  onSubmit={handleSubmit}
  submitLabel="Save"
  loading={isLoading}
/>
```

## 🔧 Mobile Hooks

### Device Detection
```tsx
import { 
  useIsMobile, 
  useIsTablet, 
  useIsDesktop,
  useTouchDevice 
} from "@/hooks/use-mobile";

const isMobile = useIsMobile(); // < 768px
const isTablet = useIsTablet(); // 768px - 1024px
const isDesktop = useIsDesktop(); // > 1024px
const isTouch = useTouchDevice(); // Touch-capable device
```

### PWA Features
```tsx
import { usePWA, useOnlineStatus } from "@/hooks/use-mobile";

const { isPWA, isStandalone, canInstall } = usePWA();
const isOnline = useOnlineStatus();
```

### Device Features
```tsx
import { 
  useVibration, 
  useOrientation, 
  useKeyboard,
  useScrollDirection 
} from "@/hooks/use-mobile";

const vibrate = useVibration();
const orientation = useOrientation(); // 'portrait' | 'landscape'
const isKeyboardOpen = useKeyboard();
const { scrollDirection, scrollY } = useScrollDirection();

// Provide haptic feedback
vibrate(50);
```

## 🎨 Mobile CSS Classes

### Layout
- `.mobile-only` - Show only on mobile
- `.desktop-only` - Show only on desktop
- `.mobile-p-4` - Mobile-specific padding
- `.mobile-gap-4` - Mobile-specific gaps

### Components
- `.mobile-card` - Mobile-optimized card
- `.mobile-list` - Mobile list layout
- `.mobile-form` - Mobile form layout
- `.mobile-btn-primary` - Mobile primary button
- `.mobile-modal` - Mobile modal container

### States
- `.mobile-loading` - Loading state
- `.mobile-empty` - Empty state
- `.mobile-status-success` - Success status
- `.mobile-status-error` - Error status

## 📋 Best Practices

### Performance
1. **Use Mobile Components**: Always use mobile-optimized components when available
2. **Lazy Load**: Load heavy components only when needed
3. **Optimize Images**: Use appropriate image sizes for mobile
4. **Minimize Re-renders**: Use React.memo and useMemo for expensive operations

### UX
1. **Touch Targets**: Ensure all interactive elements are at least 48px
2. **Loading States**: Always show loading indicators
3. **Error Handling**: Provide clear error messages
4. **Offline Support**: Handle offline scenarios gracefully

### Accessibility
1. **Focus Management**: Ensure proper focus handling in modals
2. **Screen Readers**: Use proper ARIA labels
3. **Color Contrast**: Maintain good contrast ratios
4. **Keyboard Navigation**: Support keyboard-only navigation

## 🔍 Testing

### Device Testing
- Test on actual Android devices
- Test different screen sizes (320px - 768px)
- Test in different orientations
- Test with slow network connections

### PWA Testing
- Test installation flow
- Test offline functionality
- Test background sync
- Test app updates

### Performance Testing
- Use Chrome DevTools Performance tab
- Monitor Core Web Vitals
- Test on low-end devices
- Monitor memory usage

## 🚀 Deployment

### Build Optimization
```bash
# Build for production
npm run build

# The build includes:
# - Service worker for offline support
# - Optimized assets for mobile
# - PWA manifest
# - Mobile-optimized components
```

### HTTPS Required
- PWA features require HTTPS
- Service worker only works on secure origins
- Use environment variables for API endpoints

### Caching Strategy
- Static assets: Cache-first
- API responses: Network-first with cache fallback
- Images: Cache with versioning

## 📱 Android-Specific Features

### Chrome Integration
- **Add to Home Screen**: Automatic prompt
- **App Shortcuts**: Quick access to common actions
- **Background Sync**: Sync when connection restored
- **Push Notifications**: Real-time updates

### Device Features
- **Haptic Feedback**: Vibration on interactions
- **Safe Areas**: Respect system UI
- **Orientation**: Support for portrait/landscape
- **Keyboard**: Handle virtual keyboard

### Performance
- **Hardware Acceleration**: Smooth animations
- **Memory Management**: Efficient resource usage
- **Battery Optimization**: Minimize background activity

## 🔧 Troubleshooting

### Common Issues
1. **PWA not installing**: Check HTTPS and manifest
2. **Offline not working**: Verify service worker registration
3. **Touch not responsive**: Check touch target sizes
4. **Performance issues**: Monitor bundle size and lazy loading

### Debug Tools
- Chrome DevTools PWA tab
- Lighthouse PWA audit
- Network tab for caching
- Performance tab for metrics

## 📚 Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Mobile Web Best Practices](https://developers.google.com/web/fundamentals/design-and-ux/principles)
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

For more information or support, please refer to the main documentation or contact the development team. 