import { useState, useCallback } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Share } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useThemeContext } from '../../contexts/ThemeContext';
import Colors from '../../constants/Colors';
import * as Crypto from 'expo-crypto';

export default function SettingsTab() {
  const { session } = useAuth();
  const router = useRouter();
  const { themeMode, setThemeMode, colorScheme } = useThemeContext();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const fetchOrGenerateProfile = async () => {
    if (!session?.user?.id) return;
    
    // Check if profile exists
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    // Generate random 6-character alphanum code if missing
    if (!data) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const payload = {
         user_id: session.user.id,
         invite_code: code
         // household_id automatically generates via UUID DEFAULT gen_random_uuid() on the table
      };
      const { data: newProfile, error: creationError } = await supabase.from('profiles').insert([payload]).select().single();
      if (!creationError && newProfile) data = newProfile;
    }

    setProfile(data);
    if (data?.display_name) setDisplayName(data.display_name);
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    if (!session?.user?.id) return;
    setIsSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('user_id', session.user.id);
      
    setIsSavingProfile(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Profile updated!');
      fetchOrGenerateProfile();
    }
  };

  useFocusEffect(useCallback(() => { fetchOrGenerateProfile(); }, [session]));

  const handleShareCode = async () => {
    if (!profile?.invite_code) return;
    try {
      await Share.share({
        message: `Join my Pet Life Manager household! My invite code is: ${profile.invite_code}`
      });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleJoinHousehold = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
       Alert.alert('Wait', 'Please enter a valid 6-character invite code.');
       return;
    }
    if (code === profile?.invite_code) {
       Alert.alert('Error', 'You cannot join your own household.');
       return;
    }

    setIsJoining(true);

    try {
      // Find the target household by the invite code
      const { data: targetProfile, error: searchError } = await supabase
         .from('profiles')
         .select('household_id')
         .eq('invite_code', code)
         .single();
         
      if (searchError || !targetProfile) {
         setIsJoining(false);
         Alert.alert('Not Found', 'No household exists with this invite code. Please double-check it.');
         return;
      }

      // --- PET DEDUPLICATION LOGIC ---
      // 1. Fetch current user's pets
      const { data: myPets } = await supabase.from('pets').select('*').eq('user_id', session!.user.id);
      
      // 2. Fetch target household's pets
      const { data: householdMembers } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('household_id', targetProfile.household_id);
        
      const memberIds = householdMembers?.map(m => m.user_id) || [];

      const { data: householdPets } = await supabase
        .from('pets')
        .select('*')
        .in('user_id', memberIds);

      if (myPets && householdPets) {
        for (const myPet of myPets) {
          const match = householdPets.find(hp => hp.name.toLowerCase().trim() === myPet.name.toLowerCase().trim());
          if (match) {
            // Found a duplicate pet name! Re-link all child data to the target pet ID
            const relatedTables = [
              'feeding_schedules', 'feeding_logs',
              'medicine_schedules', 'medicine_logs',
              'grooming_schedules', 'grooming_logs',
              'quick_tasks', 'pet_weight_logs', 'pet_allergy_logs'
            ];

            for (const table of relatedTables) {
              await supabase.from(table).update({ pet_id: match.id }).eq('pet_id', myPet.id);
            }
            
            // Delete the redundant local pet record
            await supabase.from('pets').delete().eq('id', myPet.id);
          }
        }
      }

      // Update current user's household_id to match the target's household_id
      const { error: mergeError } = await supabase
         .from('profiles')
         .update({ household_id: targetProfile.household_id })
         .eq('user_id', session!.user.id);
         
      setIsJoining(false);

      if (mergeError) {
         Alert.alert('Error', mergeError.message);
      } else {
         Alert.alert(
            'Household Merged!', 
            'You are now sharing pets and tasks with your partner!',
            [{ text: 'Awesome', onPress: () => { fetchOrGenerateProfile(); router.replace('/'); } }]
         );
      }
    } catch(e: any) {
      setIsJoining(false);
      Alert.alert('Exception', e.message);
    }
  };

  const handleLeaveHousehold = () => {
    Alert.alert(
      "Leave Household",
      "Are you sure you want to leave your current household? You will lose access to shared pets until you join a new one.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Leave", 
          style: "destructive", 
          onPress: async () => {
            setLoading(true);
            const newHouseholdId = Crypto.randomUUID();
            const { error: resetError } = await supabase
               .from('profiles')
               .update({ household_id: newHouseholdId })
               .eq('user_id', session!.user.id);
            
            if (resetError) {
               Alert.alert("Error", resetError.message);
               setLoading(false);
            } else {
               fetchOrGenerateProfile();
               Alert.alert("Household Left", "You are now managing a private household schedule.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      {/* Profile Section */}
      <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
         <View style={styles.headerBlock}>
            <View style={[styles.iconCircle, { backgroundColor: colors.pillPrimary }]}>
               <FontAwesome5 name="user-alt" size={20} color={colors.tint} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>My Profile</Text>
         </View>
         <Text style={styles.cardDesc}>
            Set your display name so your household members know who is completing tasks.
         </Text>

         <TextInput 
            style={[styles.input, { backgroundColor: colors.highlight, borderColor: colors.border, color: colors.text, marginBottom: 16 }]} 
            placeholder="Your Name" 
            placeholderTextColor={colors.mutedText}
            value={displayName} 
            onChangeText={setDisplayName} 
         />

         <TouchableOpacity 
            style={[styles.joinButton, { backgroundColor: colors.tint, opacity: isSavingProfile ? 0.7 : 1 }]} 
            onPress={handleUpdateProfile}
            disabled={isSavingProfile}
         >
            {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinButtonText}>Save Details</Text>}
         </TouchableOpacity>
      </View>

      {/* Theme Toggle Module */}
      <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
         <View style={styles.headerBlock}>
            <View style={[styles.iconCircle, { backgroundColor: colors.pillPrimary }]}>
               <FontAwesome5 name="moon" size={20} color={colors.tint} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Display Theme</Text>
         </View>
         <Text style={styles.cardDesc}>
            Choose between Light Mode, Dark Mode, or having Pet Life match your phone's system settings automatically.
         </Text>

         <View style={styles.themeToggleRow}>
            {(['system', 'light', 'dark'] as const).map(mode => {
               const isActive = themeMode === mode;
               return (
                 <TouchableOpacity 
                   key={mode} 
                   onPress={() => setThemeMode(mode)}
                   style={[
                     styles.themeSegment, 
                     isActive ? { backgroundColor: colors.tint } : { backgroundColor: colors.highlight }
                   ]}
                 >
                   <Text style={[
                     styles.themeSegmentText,
                     isActive ? { color: '#fff' } : { color: colors.text }
                   ]}>
                     {mode.charAt(0).toUpperCase() + mode.slice(1)}
                   </Text>
                 </TouchableOpacity>
               );
            })}
         </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
         <View style={styles.headerBlock}>
            <View style={[styles.iconCircle, { backgroundColor: colors.pillPrimary }]}>
               <FontAwesome5 name="home" size={20} color={colors.tint} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>My Household</Text>
         </View>
         <Text style={styles.cardDesc}>
            Share your unique code with a partner or roommate to allow them to co-parent your pets. Your tasks, medical logs, and schedules will instantly sync across phones.
         </Text>

         <View style={[styles.codeContainer, { backgroundColor: colors.highlight, borderColor: colors.border }]}>
            <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
            <Text style={[styles.codeValue, { color: colors.text }]}>{profile?.invite_code || '------'}</Text>
         </View>

         <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.tint }]} onPress={handleShareCode}>
            <Text style={styles.shareButtonText}>Share Code</Text>
         </TouchableOpacity>

         <TouchableOpacity onPress={handleLeaveHousehold} style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: '700' }}>Leave Household</Text>
         </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
         <View style={styles.headerBlock}>
            <View style={[styles.iconCircle, { backgroundColor: colorScheme === 'dark' ? '#3B2A56' : '#F2E8FB' }]}>
               <FontAwesome5 name="users" size={18} color="#9C51E0" />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Join a Household</Text>
         </View>
         <Text style={styles.cardDesc}>
            If your partner has already set up the pets on their phone, enter their 6-digit code here to link your accounts.
         </Text>

         <TextInput 
            style={[styles.input, { backgroundColor: colors.highlight, borderColor: colors.border, color: colors.text }]} 
            placeholder="e.g. A7B9X2" 
            placeholderTextColor={colors.mutedText}
            value={joinCode} 
            onChangeText={setJoinCode} 
            autoCapitalize="characters"
            maxLength={6}
         />

         <TouchableOpacity 
            style={[styles.joinButton, { backgroundColor: colors.text }, isJoining && { opacity: 0.7 }]} 
            onPress={handleJoinHousehold}
            disabled={isJoining}
         >
            {isJoining ? (
               <ActivityIndicator color={colors.surface} />
            ) : (
               <>
                  <FontAwesome5 name="link" size={14} color={colors.surface} style={{marginRight: 8}} />
                  <Text style={[styles.joinButtonText, { color: colors.surface }]}>Connect Accounts</Text>
               </>
            )}
         </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
         <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>

      <View style={styles.footerSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#F9F9FB', // soft Apple background
    flexGrow: 1,
    paddingTop: 65,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -1,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 24,
  },
  themeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  themeSegment: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    alignItems: 'center',
  },
  themeSegmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
     width: 44,
     height: 44,
     borderRadius: 22,
     justifyContent: 'center',
     alignItems: 'center',
     marginRight: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    letterSpacing: -0.5,
  },
  cardDesc: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  codeContainer: {
     backgroundColor: '#F9F9F9',
     borderRadius: 16,
     padding: 20,
     alignItems: 'center',
     borderWidth: 1,
     borderColor: '#EAEAEA',
     borderStyle: 'dashed',
     marginBottom: 16,
  },
  codeLabel: {
     fontSize: 12,
     fontWeight: '700',
     color: '#999',
     letterSpacing: 1.5,
     marginBottom: 6,
  },
  codeValue: {
     fontSize: 38,
     fontWeight: '800',
     color: '#111',
     letterSpacing: 8,
  },
  shareButton: {
     backgroundColor: '#007AFF', // Standard iOS blue
     padding: 16,
     borderRadius: 20,
     alignItems: 'center',
  },
  shareButtonText: {
     color: '#fff',
     fontSize: 16,
     fontWeight: '700',
  },
  input: {
     borderWidth: 1,
     borderColor: '#EAEAEA',
     backgroundColor: '#FAFAFA',
     borderRadius: 16,
     padding: 18,
     fontSize: 20,
     fontWeight: '600',
     textAlign: 'center',
     letterSpacing: 4,
     marginBottom: 16,
  },
  joinButton: {
     backgroundColor: '#111',
     padding: 18,
     borderRadius: 20,
     alignItems: 'center',
     justifyContent: 'center',
     flexDirection: 'row',
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.1,
     shadowRadius: 10,
  },
  joinButtonText: {
     color: '#fff',
     fontSize: 16,
     fontWeight: '700',
  },
  logoutButton: {
     marginTop: 12,
     padding: 16,
     alignItems: 'center',
  },
  logoutButtonText: {
     color: '#FF3B30',
     fontSize: 16,
     fontWeight: '700',
  },
  footerSpacer: {
     height: 100,
  }
});
