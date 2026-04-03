import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import all screens
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { LeadListScreen } from '../screens/LeadListScreen';
import { LeadDetailScreen } from '../screens/LeadDetailScreen';
import { AddLeadScreen } from '../screens/AddLeadScreen';
import { CampaignListScreen } from '../screens/CampaignListScreen';
import { CreateCampaignScreen } from '../screens/CreateCampaignScreen';
import { CampaignDetailScreen } from '../screens/CampaignDetailScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

// Type definitions
export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  LeadDetail: { leadId: string };
  AddLead: undefined;
  CampaignDetail: { campaignId: string };
  CreateCampaign: undefined;
};

export type TabParamList = {
  Leads: undefined;
  Campaigns: undefined;
  Analytics: undefined;
  Settings: undefined;
};

export type LeadsStackParamList = {
  LeadList: undefined;
  LeadDetail: { leadId: string };
  AddLead: undefined;
};

export type CampaignsStackParamList = {
  CampaignList: undefined;
  CampaignDetail: { campaignId: string };
  CreateCampaign: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const LeadsStack = createNativeStackNavigator<LeadsStackParamList>();
const CampaignsStack = createNativeStackNavigator<CampaignsStackParamList>();

const screenOptions = {
  headerStyle: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTintColor: '#4f46e5',
  headerTitleStyle: {
    fontWeight: '600',
    fontSize: 16,
  },
  headerShadowVisible: false,
};

function LeadsNavigator() {
  return (
    <LeadsStack.Navigator screenOptions={screenOptions}>
      <LeadsStack.Screen
        name="LeadList"
        component={LeadListScreen}
        options={{
          headerTitle: 'Leads',
          headerShown: false,
        }}
      />
      <LeadsStack.Screen
        name="LeadDetail"
        component={LeadDetailScreen}
        options={{
          headerTitle: 'Lead Details',
          headerBackTitle: 'Back',
        }}
      />
      <LeadsStack.Screen
        name="AddLead"
        component={AddLeadScreen}
        options={{
          headerTitle: 'New Lead',
          headerBackTitle: 'Back',
        }}
      />
    </LeadsStack.Navigator>
  );
}

function CampaignsNavigator() {
  return (
    <CampaignsStack.Navigator screenOptions={screenOptions}>
      <CampaignsStack.Screen
        name="CampaignList"
        component={CampaignListScreen}
        options={{
          headerTitle: 'Campaigns',
          headerShown: false,
        }}
      />
      <CampaignsStack.Screen
        name="CampaignDetail"
        component={CampaignDetailScreen}
        options={{
          headerTitle: 'Campaign Details',
          headerBackTitle: 'Back',
        }}
      />
      <CampaignsStack.Screen
        name="CreateCampaign"
        component={CreateCampaignScreen}
        options={{
          headerTitle: 'New Campaign',
          headerBackTitle: 'Back',
        }}
      />
    </CampaignsStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Leads') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Campaigns') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Analytics') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Leads"
        component={LeadsNavigator}
        options={{
          tabBarLabel: 'Leads',
        }}
      />
      <Tab.Screen
        name="Campaigns"
        component={CampaignsNavigator}
        options={{
          tabBarLabel: 'Campaigns',
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate checking authentication status
    // In a real app, this would check AsyncStorage or Redux state
    const checkAuth = async () => {
      try {
        // TODO: Replace with actual auth check
        // const token = await AsyncStorage.getItem('authToken');
        // setIsAuthenticated(!!token);
        setIsAuthenticated(false);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen
            name="Home"
            component={TabNavigator}
            options={{
              animationEnabled: false,
            }}
          />
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{
              animationEnabled: false,
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
