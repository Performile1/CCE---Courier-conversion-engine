import React, { useState } from 'react';
import { Smartphone, Copy, CheckCircle, AlertCircle, Code2 } from 'lucide-react';

/**
 * Phase 8: Mobile App Setup Guide
 * Provides React Native project initialization for iOS/Android
 */
export const MobileAppSetup: React.FC = () => {
  const [copied, setCopied] = useState('');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const commands = [
    {
      id: 'init',
      label: 'Initialize React Native Project',
      command: 'npx react-native init CCEMobileApp --template react-native-template-typescript',
    },
    {
      id: 'install',
      label: 'Install Required Dependencies',
      command: 'npm install @supabase/supabase-js @react-navigation/native @react-navigation/bottom-tabs @react-native-async-storage/async-storage @react-native-community/hooks react-native-gesture-handler react-native-push-notification react-native-screens',
    },
    {
      id: 'setup-nav',
      label: 'Setup Navigation',
      command: 'npm install @react-navigation/native-stack',
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Smartphone className="w-6 h-6 text-indigo-600" />
        Phase 8: Mobile App Setup
      </h2>

      {/* Quick Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          📱 <strong>Phase 8 brings CCE to iOS & Android</strong> with React Native. Users can browse leads, manage campaigns, and receive push notifications on their phones.
        </p>
      </div>

      {/* Architecture */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">Mobile Architecture</h3>
        <div className="space-y-3 text-sm">
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">📲</span>
            <span><strong>Frontend:</strong> React Native (iOS + Android shared codebase)</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">🔐</span>
            <span><strong>Auth:</strong> Supabase Auth with biometric login (Face ID, Touch ID)</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">📡</span>
            <span><strong>Real-time:</strong> Supabase subscriptions for instant lead updates</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">🔔</span>
            <span><strong>Notifications:</strong> Push notifications for campaigns, leads, alerts</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">💾</span>
            <span><strong>Offline:</strong> Local storage with sync queue for offline-first</span>
          </p>
        </div>
      </div>

      {/* Setup Steps */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900">Setup Instructions</h3>

        {commands.map((cmd, idx) => (
          <div key={cmd.id} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-slate-900">Step {idx + 1}: {cmd.label}</p>
              </div>
              <button
                onClick={() => copyToClipboard(cmd.command, cmd.id)}
                className="text-indigo-600 hover:text-indigo-700"
              >
                {copied === cmd.id ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            <code className="block bg-slate-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
              {cmd.command}
            </code>
          </div>
        ))}
      </div>

      {/* File Structure */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">Project Structure</h3>
        <code className="block bg-slate-50 p-4 rounded font-mono text-sm overflow-x-auto">
          {`CCEMobileApp/
├── src/
│   ├── navigation/
│   │   ├── MainNavigator.tsx
│   │   └── AuthNavigator.tsx
│   ├── screens/
│   │   ├── leads/
│   │   │   ├── LeadListScreen.tsx
│   │   │   ├── LeadDetailScreen.tsx
│   │   │   └── AddLeadScreen.tsx
│   │   ├── campaigns/
│   │   │   ├── CampaignListScreen.tsx
│   │   │   ├── CreateCampaignScreen.tsx
│   │   │   └── CampaignDetailScreen.tsx
│   │   ├── analytics/
│   │   │   └── AnalyticsScreen.tsx
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── SignupScreen.tsx
│   │   └── settings/
│   │       └── SettingsScreen.tsx
│   ├── services/
│   │   ├── supabaseClient.ts
│   │   ├── notificationService.ts
│   │   └── syncService.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useLeads.ts
│   │   └── useCampaigns.ts
│   ├── state/
│   │   └── redux/ (Redux store for state)
│   └── utils/
│       ├── formatters.ts
│       └── validators.ts
├── app.json
├── package.json
└── tsconfig.json`}
        </code>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="font-bold text-slate-900 mb-3">📱 Mobile Features</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>✅ Lead browsing with swipe filters</li>
            <li>✅ Real-time push notifications</li>
            <li>✅ Biometric authentication</li>
            <li>✅ Offline mode with sync queue</li>
            <li>✅ Campaign management on-the-go</li>
            <li>✅ Analytics dashboard</li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="font-bold text-slate-900 mb-3">🔧 Tech Stack</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>✅ React Native 0.72+</li>
            <li>✅ TypeScript</li>
            <li>✅ Supabase SDK</li>
            <li>✅ React Navigation</li>
            <li>✅ Redux Toolkit</li>
            <li>✅ Firebase Cloud Messaging</li>
          </ul>
        </div>
      </div>

      {/* Environment Variables */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-600" />
          Mobile Environment (.env)
        </h3>
        <code className="block bg-slate-50 p-4 rounded font-mono text-sm overflow-x-auto">
          {`REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
REACT_APP_API_BASE_URL=https://your-app.vercel.app
FIREBASE_PROJECT_ID=your-firebase-project
FCM_SENDER_ID=your-fcm-sender-id`}
        </code>
      </div>

      {/* Next Steps */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-900">
          ✅ <strong>Next Steps:</strong>
        </p>
        <ul className="text-sm text-green-800 mt-2 space-y-1 ml-4">
          <li>1. Run initialization commands above</li>
          <li>2. Create auth screens with Supabase</li>
          <li>3. Build lead list & detail screens</li>
          <li>4. Setup push notifications</li>
          <li>5. Configure offline data sync</li>
          <li>6. Build & test on iOS/Android</li>
        </ul>
      </div>

      {/* Estimation */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900">
          ⏱️ <strong>Estimated Timeline:</strong> 4-6 weeks for full mobile app (2 weeks core, 2-4 weeks polish + testing)
        </p>
      </div>
    </div>
  );
};

export default MobileAppSetup;
