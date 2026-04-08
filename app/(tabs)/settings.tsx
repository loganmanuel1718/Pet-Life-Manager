import { useState, useCallback } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Share } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function SettingsTab() {
  const { session } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

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
    setLoading(false);
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
            [{ text: 'Awesome', onPress: () => router.replace('/') }]
         );
      }
    } catch(e: any) {
      setIsJoining(false);
      Alert.alert('Exception', e.message);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
         <View style={styles.headerBlock}>
            <View style={styles.iconCircle}>
               <FontAwesome5 name="home" size={20} color="#007AFF" />
            </View>
            <Text style={styles.cardTitle}>My Household</Text>
         </View>
         <Text style={styles.cardDesc}>
            Share your unique code with a partner or roommate to allow them to co-parent your pets. Your tasks, medical logs, and schedules will instantly sync across phones.
         </Text>

         <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
            <Text style={styles.codeValue}>{profile?.invite_code || '------'}</Text>
         </View>

         <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
            <Text style={styles.shareButtonText}>Share Code</Text>
         </TouchableOpacity>
      </View>

      <View style={styles.card}>
         <View style={styles.headerBlock}>
            <View style={[styles.iconCircle, { backgroundColor: '#F2E8FB' }]}>
               <FontAwesome5 name="users" size={18} color="#9C51E0" />
            </View>
            <Text style={styles.cardTitle}>Join a Household</Text>
         </View>
         <Text style={styles.cardDesc}>
            If your partner has already set up the pets on their phone, enter their 6-digit code here to link your accounts.
         </Text>

         <TextInput 
            style={styles.input} 
            placeholder="e.g. A7B9X2" 
            value={joinCode} 
            onChangeText={setJoinCode} 
            autoCapitalize="characters"
            maxLength={6}
         />

         <TouchableOpacity 
            style={[styles.joinButton, isJoining && { opacity: 0.7 }]} 
            onPress={handleJoinHousehold}
            disabled={isJoining}
         >
            {isJoining ? (
               <ActivityIndicator color="#fff" />
            ) : (
               <>
                  <FontAwesome5 name="link" size={14} color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.joinButtonText}>Connect Accounts</Text>
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
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
     width: 44,
     height: 44,
     borderRadius: 22,
     backgroundColor: '#E5F1FF',
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
