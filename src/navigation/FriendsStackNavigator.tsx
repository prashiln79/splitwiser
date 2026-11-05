import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FriendsScreen from '../screens/FriendsScreen';
import FriendDetailsScreen from '../screens/FriendDetailsScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import GroupDetailsScreen from '../screens/GroupDetailsScreen';

const Stack = createNativeStackNavigator();

const FriendsStackNavigator = () => {
  return (
    // @ts-ignore react-navigation v7 id prop
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="FriendsHome" component={FriendsScreen} />
      <Stack.Screen name="FriendDetails" component={FriendDetailsScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
    </Stack.Navigator>
  );
};

export default FriendsStackNavigator;

