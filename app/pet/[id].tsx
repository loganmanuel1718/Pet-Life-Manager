import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesome5 } from '@expo/vector-icons';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  
  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Function to load the pet data
  const fetchPet = async () => {
    if (!id || !session?.user?.id) return;
    
    const { data, error } = await supabase
      .from('pets')
      .select('*, feeding_schedules(*)')
      .eq('id', id)
      .single();

    if (error) {
      Alert.alert('Error loading pet', error.message);
      router.back();
    } else {
      setPet(data);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchPet();
    }, [id])
  );

  const handleDelete = () => {
    Alert.alert(
      "Delete Pet",
      "Are you sure you want to delete this pet? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            const { error } = await supabase.from('pets').delete().eq('id', id);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              router.back();
            }
          }
        }
      ]
    );
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    Alert.alert(
      "Remove Meal",
      "Remove this daily feeding schedule?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            const { error } = await supabase.from('feeding_schedules').delete().eq('id', scheduleId);
            if (error) Alert.alert('Error', error.message);
            else fetchPet();
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!pet) {
    return null;
  }

  const formatTime = (timeString: string) => {
    const [h, m] = timeString.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${m} ${ampm}`;
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: pet.name,
          headerBackTitle: 'Back',
        }} 
      />
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Avatar Hero Header */}
        <View style={styles.heroContainer}>
          {pet.avatar_url ? (
            <Image source={{ uri: pet.avatar_url }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <FontAwesome5 name="paw" size={60} color="#999" />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.name}>{pet.name}</Text>
          <Text style={styles.speciesInfo}>
            {pet.species || 'Unknown Species'} {pet.breed ? `• ${pet.breed}` : ''}
          </Text>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Birthdate</Text>
            <Text style={styles.value}>{pet.birthdate || 'Not specified'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Adoption Date</Text>
            <Text style={styles.value}>{pet.adoption_date || 'Not specified'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.label}>Vaccines</Text>
            {pet.vaccines && pet.vaccines.length > 0 ? (
              <View style={styles.tagContainer}>
                {pet.vaccines.map((vac: string, idx: number) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{vac}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.value}>No vaccines logged</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Allergies</Text>
            <Text style={styles.value}>{pet.allergies || 'None recorded'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{pet.notes || 'No extra notes'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.infoRow, { alignItems: 'center' }]}>
            <Text style={[styles.title, { marginBottom: 0 }]}>Feeding Schedules</Text>
            <TouchableOpacity onPress={() => router.push(`/feeding-modal?pet_id=${pet.id}`)}>
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 16 }} />
          
          {pet.feeding_schedules && pet.feeding_schedules.length > 0 ? (
            pet.feeding_schedules.sort((a: any, b: any) => a.time.localeCompare(b.time)).map((sched: any) => (
              <View key={sched.id} style={styles.scheduleRow}>
                <View>
                  <Text style={styles.scheduleTime}>
                    {formatTime(sched.time)}
                  </Text>
                  <Text style={styles.scheduleDetails}>{sched.amount} • {sched.food_type}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteSchedule(sched.id)}>
                   <FontAwesome5 name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.value}>No schedules set yet.</Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.editButton]} 
            onPress={() => router.push(`/modal?id=${pet.id}`)}
          >
            <Text style={[styles.buttonText, styles.editButtonText]}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.deleteButton]} 
            onPress={handleDelete}
          >
            <Text style={styles.buttonText}>Delete Pet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FAFAFA',
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: -40,
    zIndex: 10,
  },
  heroImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#FAFAFA',
  },
  heroPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FAFAFA',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    paddingTop: 56, // Padding to avoid clipping the floating hero avatar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
    alignItems: 'center', 
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  speciesInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginVertical: 16,
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: '#666',
  },
  section: {
    paddingVertical: 8,
    width: '100%',
    alignItems: 'flex-start'
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#E5F1FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  editButtonText: {
    color: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  addText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    width: '100%',
  },
  scheduleTime: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  scheduleDetails: {
    fontSize: 14,
    color: '#666',
  },
});
