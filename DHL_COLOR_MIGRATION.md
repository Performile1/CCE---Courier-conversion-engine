# DHL Color Scheme Migration Guide

## Status: 70% Complete

### ✅ Already Fixed
- [x] WelcomeLoadingScreen - DHL yellow background, red spinner, removed animations
- [x] WelcomeScreen - DHL yellow/red, removed bounce animation
- [x] Header - DHL yellow with red border
- [x] Tailwind config - Added DHL custom colors
- [x] BackupManager modal - DHL colors updated
- [x] UserProfile - DHL colors and borders
- [x] App background - Changed to dhl-gray-light
- [x] CampaignPerformanceDashboard - DHL borders

### 🔄 Remaining Work - Search & Replace

All files using old color scheme need to be updated using these patterns:

#### 1. **Remove All `rounded-lg` and `rounded-xl` - Replace with `rounded-sm`**
```
Search: rounded-lg
Replace: rounded-sm

Search: rounded-xl
Replace: rounded-sm

Search: rounded-full
Replace: rounded-sm
```

#### 2. **Color Replacements**

**Header/Border Colors**
```
Search: border-red-600
Replace: border-dhl-red

Search: border-slate-200
Replace: border-dhl-gray-medium

Search: border-slate-300
Replace: border-dhl-gray-medium

Search: border-slate-700
Replace: border-dhl-gray-dark

Search: border-indigo-
Replace: border-dhl-red
```

**Background Colors**
```
Search: bg-slate-50
Replace: bg-dhl-gray-light

Search: bg-slate-100
Replace: bg-dhl-gray-light

Search: bg-slate-800
Replace: bg-dhl-black

Search: bg-slate-900
Replace: bg-dhl-black

Search: bg-indigo-50
Replace: bg-dhl-gray-light

Search: bg-blue-50
Replace: bg-dhl-gray-light

Search: bg-green-50
Replace: bg-dhl-gray-light
```

**Text Colors**
```
Search: text-slate-
Replace: text-dhl-black or text-dhl-gray-dark (depending on shade)

Search: text-indigo-
Replace: text-dhl-red

Search: text-blue-
Replace: text-dhl-red

Search: text-green-
Replace: text-dhl-black
```

**Hover States**
```
Search: hover:bg-slate-50
Replace: hover:bg-dhl-gray-light

Search: hover:bg-slate-200
Replace: hover:bg-dhl-gray-medium

Search: hover:text-red-600
Replace: hover:text-dhl-red
```

### 📋 Files Requiring Updates

**High Priority (20+ occurrences each):**
- [ ] CampaignAnalytics.tsx - Blue/green to DHL, rounded-lg to rounded-sm
- [ ] CampaignPerformanceDashboard.tsx - Indigo/blue to DHL
- [ ] CostAnalysisDashboard.tsx - Multiple colors
- [ ] App.tsx - Check all modal styling
- [ ] LeadCard.tsx - Status badges colors
- [ ] ResultsTable.tsx - Row colors and borders

**Medium Priority (5-10 occurrences):**
- [ ] InputForm.tsx
- [ ] LoginPage.tsx  
- [ ] CRMManager.tsx
- [ ] EmailCampaignBuilder.tsx
- [ ] IntegrationManager.tsx
- [ ] ModelSelector.tsx
- [ ] NewsPanel.tsx

**Low Priority (1-5 occurrences):**
- [ ] ROICalculator.tsx
- [ ] SlackManager.tsx
- [ ] ThreePLManager.tsx
- [ ] CustomAPIConnectorBuilder.tsx
- [ ] ExclusionManager.tsx
- [ ] InclusionManager.tsx

### DHL Color Palette Reference

```css
/* Primary */
dhl-yellow: #FFCC00
dhl-red: #D00000

/* Neutrals */
dhl-black: #333333
dhl-gray-light: #F5F5F5
dhl-gray-medium: #E0E0E0
dhl-gray-dark: #666666

/* Usage */
Buttons: bg-dhl-red text-white
Headers: bg-dhl-yellow border-dhl-red
Modals: border-t-4 border-dhl-red
Backgrounds: bg-dhl-gray-light
Text: text-dhl-black or text-dhl-gray-dark
Hover: hover:bg-dhl-gray-medium
```

### Migration Steps

1. **Use Find & Replace in VS Code** (Ctrl+H)
   - Check "Use Regular Expression" if needed
   - Replace each pattern
   - Review changes before committing

2. **Test each component**
   - Open modals to verify colors
   - Check buttons render correctly
   - Verify text contrast is readable

3. **Commit by category**
   - Commit analytics components
   - Commit form components  
   - Commit utility modals
   - Final commit for remaining

### Notes

- Do NOT remove or modify animation classes (animate-spin, animate-fadeIn, etc.)
- Keep `rounded-sm` for ALL corners - NO border-radius gradients
- Ensure all text has sufficient contrast (min 4.5:1)
- All modals should have `border-t-4 border-dhl-red` top border
- All buttons should be `bg-dhl-red text-white` for primary actions
