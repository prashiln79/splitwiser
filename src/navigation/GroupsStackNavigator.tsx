import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import GroupDetailsScreen from '../screens/GroupDetailsScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import GroupSettingsScreen from '../screens/GroupSettingsScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';

const Stack = createNativeStackNavigator();

const GroupsStackNavigator = () => {
  return (
    // @ts-ignore react-navigation v7 id prop
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
    </Stack.Navigator>
  );
};

export default GroupsStackNavigator;
