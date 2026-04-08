import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { useThemeContext } from '../../contexts/ThemeContext';
import Colors from '../../constants/Colors';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { colorScheme } = useThemeContext();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Function to load the pet data
  const fetchPet = async () => {
    if (!id || !session?.user?.id) return;
    
    const { data, error } = await supabase
      .from('pets')
      .select('*, feeding_schedules(*), medicine_schedules(*), grooming_schedules(*)')
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

  const handleDeleteGrooming = (scheduleId: string) => {
    Alert.alert(
      "Remove Routine",
      "Remove this grooming routine?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            const { error } = await supabase.from('grooming_schedules').delete().eq('id', scheduleId);
            if (error) Alert.alert('Error', error.message);
            else fetchPet();
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
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
        
        {/* Avatar Hero Header */}
        <View style={styles.heroContainer}>
          {pet.avatar_url ? (
            <Image source={{ uri: pet.avatar_url }} style={[styles.heroImage, { borderColor: colors.background }]} />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: colors.pillPrimary, borderColor: colors.background }]}>
              <FontAwesome5 name="paw" size={60} color={colors.mutedText} />
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          <Text style={[styles.name, { color: colors.text }]}>{pet.name}</Text>
          <Text style={[styles.speciesInfo, { color: colors.mutedText }]}>
            {pet.species || 'Unknown Species'} {pet.breed ? `• ${pet.breed}` : ''}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text }]}>Birthdate</Text>
            <Text style={[styles.value, { color: colors.mutedText }]}>{pet.birthdate || 'Not specified'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text }]}>Adoption Date</Text>
            <Text style={[styles.value, { color: colors.mutedText }]}>{pet.adoption_date || 'Not specified'}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Vaccines</Text>
            {pet.vaccines && pet.vaccines.length > 0 ? (
              <View style={styles.tagContainer}>
                {pet.vaccines.map((vacStr: string, idx: number) => {
                  const hasDate = vacStr.includes('|');
                  const vacName = hasDate ? vacStr.split('|')[0] : vacStr;
                  const vacDate = hasDate ? vacStr.split('|')[1] : '';

                  return (
                    <View key={idx} style={[styles.tag, { backgroundColor: colors.highlight }]}>
                      <Text style={[styles.tagText, { color: colors.tint }]}>
                         {vacName}{vacDate ? ` • ${vacDate}` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.value, { color: colors.mutedText }]}>No vaccines logged</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Allergies</Text>
            <Text style={[styles.value, { color: colors.mutedText }]}>{pet.allergies || 'None recorded'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
            <Text style={[styles.value, { color: colors.mutedText }]}>{pet.notes || 'No extra notes'}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          <View style={[styles.infoRow, { alignItems: 'center' }]}>
            <Text style={[styles.title, { marginBottom: 0, color: colors.text }]}>Feeding Schedules</Text>
            <TouchableOpacity onPress={() => router.push(`/feeding-modal?pet_id=${pet.id}`)}>
              <Text style={[styles.addText, { color: colors.tint }]}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 16 }} />
          
          {pet.feeding_schedules && pet.feeding_schedules.length > 0 ? (
            pet.feeding_schedules.sort((a: any, b: any) => a.time.localeCompare(b.time)).map((sched: any) => (
              <View key={sched.id} style={[styles.scheduleRow, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.scheduleTime, { color: colors.text }]}>
                    {formatTime(sched.time)}
                  </Text>
                  <Text style={[styles.scheduleDetails, { color: colors.mutedText }]}>{sched.amount} • {sched.food_type}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteSchedule(sched.id)}>
                   <FontAwesome5 name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={[styles.value, { color: colors.mutedText }]}>No schedules set yet.</Text>
          )}
        </View>

        {/* Medicine Schedules Block */}
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          <View style={[styles.infoRow, { alignItems: 'center' }]}>
            <Text style={[styles.title, { marginBottom: 0, color: colors.text }]}>Medications</Text>
            <TouchableOpacity onPress={() => router.push(`/medicine-modal?pet_id=${pet.id}`)}>
              <Text style={[styles.addText, { color: colors.tint }]}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 16 }} />
          
          {pet.medicine_schedules && pet.medicine_schedules.length > 0 ? (
            pet.medicine_schedules.sort((a: any, b: any) => a.time.localeCompare(b.time)).map((med: any) => (
              <View key={med.id} style={[styles.scheduleRow, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <FontAwesome5 name="pills" size={12} color="#007AFF" />
                  </View>
                  <View>
                    <Text style={[styles.scheduleTime, { color: colors.text }]}>
                      {formatTime(med.time)}
                    </Text>
                    <Text style={[styles.scheduleDetails, { color: colors.mutedText }]}>{med.dosage} • {med.medicine_name}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteMedicine(med.id)}>
                   <FontAwesome5 name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={[styles.value, { color: colors.mutedText }]}>No medicines scheduled.</Text>
          )}
        </View>

        {/* GROOMING SCHEDULES */}
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          <Text style={[styles.title, { color: colors.text }]}>Daily Grooming</Text>
          
          {pet.grooming_schedules && pet.grooming_schedules.length > 0 ? (
            pet.grooming_schedules.map((schedule: any) => (
              <View key={schedule.id} style={[styles.scheduleRow, { borderBottomColor: colors.border }]}>
                <View style={styles.scheduleMeta}>
                  <View style={[styles.taskIconCircle, { backgroundColor: '#E5FAEE' }]}>
                    <FontAwesome5 name="bath" size={14} color="#34C759" />
                  </View>
                  <View>
                    <Text style={[styles.scheduleTime, { color: colors.text }]}>{formatTime(schedule.time)}</Text>
                    <Text style={[styles.scheduleType, { color: colors.mutedText }]}>{schedule.activity}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteGrooming(schedule.id)}>
                  <FontAwesome5 name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>No grooming routines added yet.</Text>
          )}

          <Link href={`/grooming-modal?pet_id=${id}`} asChild>
            <TouchableOpacity style={{ marginTop: 12 }}>
              <Text style={[styles.addText, { color: colors.tint }]}>+ Add Routine</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.healthButton, { backgroundColor: colors.highlight, borderColor: colors.border }]}
            onPress={() => router.push(`/health/${pet.id}`)}
          >
            <FontAwesome5 name="heartbeat" size={16} color={colors.tint} style={{marginRight: 8}} />
            <Text style={[styles.buttonText, styles.healthButtonText, { color: colors.tint }]}>Health Hub</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.editButton, { backgroundColor: colors.text }]} 
            onPress={() => router.push(`/modal?id=${pet.id}`)}
          >
            <Text style={[styles.buttonText, styles.editButtonText, { color: colors.background }]}>Edit Profile</Text>
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
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  healthButton: {
    backgroundColor: '#E5F1FF', // Soft hospital blue
    borderWidth: 1,
    borderColor: '#CCE4FF',
  },
  healthButtonText: {
    color: '#007AFF', // Rich blue to pop
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
    borderBottomColor: '#f0f0f0',
    width: '100%',
  },
  scheduleTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  scheduleType: {
    fontSize: 14,
    color: '#666',
  },
  scheduleDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  scheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
