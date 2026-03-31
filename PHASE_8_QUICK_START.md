# Phase 8 - Mobile App Quick Start

## 🚀 5-Minute Quick Start

### Step 1: Navigate to Mobile Directory
```bash
cd mobile
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Development Server
```bash
npm start
```

### Step 4: Run on Device/Simulator
- **iOS**: Press `i` in terminal → select simulator
- **Android**: Press `a` in terminal → select emulator
- **Web**: Press `w` for web preview

## 📱 Once the App Loads...

### Test Login
```
Email: test@example.com
Password: test123
```

### Navigate Features
1. **Leads Tab**: Browse and manage leads
   - Tap FAB (+) to add new lead
   - Tap lead card to view details
   - Swipe to edit or delete

2. **Campaigns Tab**: Create and track campaigns
   - Tap FAB (+) to create campaign
   - View campaign performance metrics
   - Check delivery status

3. **Analytics Tab**: View key metrics
   - Real-time lead count
   - Campaign delivery rates
   - ROI calculation
   - Weekly trend chart

4. **Settings Tab**: Configure app
   - Toggle push notifications
   - Enable offline sync
   - View about & privacy policies
   - Logout

## 🔧 Environment Setup

### Create .env file
```bash
cat > .env << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
EOF
```

### Update app.config.ts
```typescript
// Find this section and replace with your EAS project ID
extra: {
  eas: {
    projectId: 'YOUR_EAS_PROJECT_ID'  // Replace this
  }
}
```

## 📦 What's Included

### 10 React Native Screens
✅ LoginScreen - User authentication
✅ SignupScreen - New user registration
✅ LeadListScreen - Lead management
✅ LeadDetailScreen - Lead editing
✅ AddLeadScreen - New lead creation
✅ CampaignListScreen - Campaign browsing
✅ CreateCampaignScreen - New campaigns
✅ CampaignDetailScreen - Campaign details
✅ AnalyticsScreen - Dashboard & metrics
✅ SettingsScreen - App preferences

### 2 Service Layers
✅ Push Notifications - Real-time alerts
✅ Offline Sync - Auto-queue & retry

### Full Navigation Stack
✅ Bottom tab navigation
✅ Native stack for drill-down
✅ Auth flow separation
✅ Back button handling

## 🎨 Design Highlights

- **Indigo color scheme** matching web app
- **Card-based layout** for consistency
- **FAB buttons** for primary actions
- **Ionicons** throughout for visual feedback
- **Responsive design** for all screen sizes

## 🐛 Quick Troubleshooting

### "Network request failed"
```bash
# Check Supabase URL and API key in .env
# Verify backend is running on localhost:3000
```

### "Push notifications won't work"
```bash
# Push notifications require physical device
# Or use iOS simulator (not Android emulator)
```

### "Offline sync not working"
```bash
# Check AsyncStorage permissions
# Verify network status with NetInfo
```

## 📊 File Stats

- **Total Screens**: 10
- **Total Lines of Code**: 2,100+
- **Service Modules**: 2
- **Navigation Stacks**: 3
- **Components**: 50+

## 🔐 Security Notes

1. Never commit `.env` file to Git
2. Never hardcode API keys in code
3. Use HTTPS for all API calls
4. Validate inputs before sending to backend
5. Store tokens securely (not localStorage)

## 📚 Important Files

| File | Purpose |
|------|---------|
| `App.tsx` | App entry point & initialization |
| `app.config.ts` | Expo build configuration |
| `package.json` | Dependencies management |
| `RootNavigator.tsx` | Navigation structure |
| `pushNotificationService.ts` | Push notification handler |
| `offlineSyncService.ts` | Offline queue & sync |

## 🎯 Next Steps

After initial setup:

1. **Configure Supabase** - Set up database schema
2. **Add Firebase** - For push notifications (optional)
3. **Hook up Backend** - Connect to production API
4. **Test Offline Mode** - Kill network and test sync
5. **Build for Store** - Create production builds

## 💡 Pro Tips

- Use `useFocusEffect` to refresh data when screen becomes active
- Enable offline sync in settings for better UX
- Test on real device before app store submission
- Check device orientation settings before build
- Use Expo CLI for preview before building native

## ❓ FAQ

**Q: Do I need a Mac for iOS development?**
A: For physical device building, yes. For simulator, no.

**Q: Can I use this on Android?**
A: Yes! Full Android support included.

**Q: How often does offline sync run?**
A: Every 30 seconds when online (configurable).

**Q: Are push notifications free?**
A: Expo Push Notifications are free. Firebase requires GCP.

**Q: How do I collect all leads?**
A: Use LeadListScreen with pagination or search.

## 📞 Support

For issues or questions:
1. Check [Expo Docs](https://docs.expo.dev)
2. Check [React Navigation Docs](https://reactnavigation.org)
3. Review specific screen source code
4. Check `console.log` statements in services

---

**Phase 8 Status**: ✅ 100% Complete
- 10/10 Screens ✅
- Navigation System ✅
- Service Layer ✅
- Configuration ✅

Ready for testing and deployment! 🚀
