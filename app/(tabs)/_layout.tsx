import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useThemeContext } from '../../contexts/ThemeContext';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const { colorScheme } = useThemeContext();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarShowLabel: false,
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: {
          position: 'absolute',
          bottom: 30, // floats off the bottom edge
          left: 20,
          right: 20, // restricts width creating a pill
          elevation: 0,
          backgroundColor: colors.surface,
          borderRadius: 40,
          height: 70, // taller touch target
          shadowColor: colorScheme === 'dark' ? '#fff' : '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: colorScheme === 'dark' ? 0.04 : 0.08,
          shadowRadius: 20,
          borderTopWidth: 0, // removes standard rn border
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pets',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="paw" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="check-square-o" color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Wallet',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="pie-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
