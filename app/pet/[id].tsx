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
      .select('*, feeding_schedules(*), medicine_schedules(*)')
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

  const handleDeleteMedicine = (medicineId: string) => {
    Alert.alert(
      "Remove Medication",
      "Remove this daily medication schedule?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            const { error } = await supabase.from('medicine_schedules').delete().eq('id', medicineId);
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

        {/* Medicine Schedules Block */}
        <View style={styles.card}>
          <View style={[styles.infoRow, { alignItems: 'center' }]}>
            <Text style={[styles.title, { marginBottom: 0 }]}>Medications</Text>
            <TouchableOpacity onPress={() => router.push(`/medicine-modal?pet_id=${pet.id}`)}>
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 16 }} />
          
          {pet.medicine_schedules && pet.medicine_schedules.length > 0 ? (
            pet.medicine_schedules.sort((a: any, b: any) => a.time.localeCompare(b.time)).map((med: any) => (
              <View key={med.id} style={styles.scheduleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <FontAwesome5 name="pills" size={12} color="#007AFF" />
                  </View>
                  <View>
                    <Text style={styles.scheduleTime}>
                      {formatTime(med.time)}
                    </Text>
                    <Text style={styles.scheduleDetails}>{med.dosage} • {med.medicine_name}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteMedicine(med.id)}>
                   <FontAwesome5 name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.value}>No medicines scheduled.</Text>
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
    backgroundColor: '#F9F9FB', // soft Apple background
    flexGrow: 1,
    paddingBottom: 40,
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
    borderWidth: 6, // thicker border
    borderColor: '#F9F9FB', // blends perfectly into background
  },
  heroPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: '#F9F9FB',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24, // High capsule shape
    padding: 24,
    paddingTop: 56, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, // very soft
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 24,
    alignItems: 'center', 
  },
  name: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
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
    padding: 18,
    borderRadius: 24, // heavily rounded
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  editButton: {
    backgroundColor: '#111', // Stark black Apple aesthetic
  },
  editButtonText: {
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#FFE5E5', // Soft pastel red
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  addText: {
    color: '#007AFF',
    fontWeight: '700',
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
