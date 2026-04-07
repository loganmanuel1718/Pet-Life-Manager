import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, Platform, Image } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';

export default function QuickTaskModalScreen() {
  const router = useRouter();
  const { session } = useAuth();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Misc'); // 'Grooming', 'Medical', 'Misc'
  const [recurrence, setRecurrence] = useState('none'); // 'none', 'daily', 'weekly', 'monthly'
  const [datetime, setDatetime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);

  useEffect(() => {
    fetchPets();
  }, [session]);

  const fetchPets = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('pets').select('id, name, avatar_url');
    if (data) {
      setPets(data);
      if (data.length === 1) setSelectedPet(data[0].id); // Auto-select if only 1 pet
    }
  };

  const handleSaveTask = async () => {
    try {
      if (!title.trim()) {
        Alert.alert('Required', 'Please enter a task description.');
        return;
      }
      
      setLoading(true);

      const hours = datetime.getHours().toString().padStart(2, '0');
      const minutes = datetime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      const dateString = `${datetime.getFullYear()}-${String(datetime.getMonth() + 1).padStart(2, '0')}-${String(datetime.getDate()).padStart(2, '0')}`;

      const payload = {
        pet_id: selectedPet, // can be null if it's a global household task
        user_id: session?.user?.id,
        title: title.trim(),
        category,
        due_date: dateString,
        due_time: timeString,
        recurrence
      };

      const { error } = await supabase.from('quick_tasks').insert([payload]);

      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        router.back();
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Exception', err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New Quick Task</Text>

      {/* Pet Selector (Optional) */}
      {pets.length > 0 && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Who is this for? (Optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petSelector}>
             <TouchableOpacity 
               style={[styles.petBubble, !selectedPet && styles.petBubbleActive]}
               onPress={() => setSelectedPet(null)}
             >
                <View style={styles.fallbackAvatar}>
                   <FontAwesome5 name="home" size={16} color={!selectedPet ? '#007AFF' : '#999'} />
                </View>
                <Text style={styles.petBubbleText}>House</Text>
             </TouchableOpacity>

             {pets.map(pet => (
                <TouchableOpacity 
                  key={pet.id} 
                  style={[styles.petBubble, selectedPet === pet.id && styles.petBubbleActive]}
                  onPress={() => setSelectedPet(pet.id)}
                >
                  {pet.avatar_url ? (
                    <Image source={{ uri: pet.avatar_url }} style={styles.petAvatar} />
                  ) : (
                    <View style={styles.fallbackAvatar}>
                       <FontAwesome5 name="paw" size={16} color={selectedPet === pet.id ? '#007AFF' : '#999'} />
                    </View>
                  )}
                  <Text style={styles.petBubbleText} numberOfLines={1}>{pet.name}</Text>
                </TouchableOpacity>
             ))}
          </ScrollView>
        </View>
      )}

      {/* Category Pills */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
            {['Misc', 'Grooming', 'Medical'].map(cat => (
               <TouchableOpacity 
                 key={cat} 
                 style={[styles.catPill, category === cat && styles.catPillActive]}
                 onPress={() => setCategory(cat)}
               >
                 <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>{cat}</Text>
               </TouchableOpacity>
            ))}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.categoryRow}>
            {['none', 'daily', 'weekly', 'monthly'].map(rec => (
               <TouchableOpacity 
                 key={rec} 
                 style={[styles.catPill, recurrence === rec && styles.catPillActive]}
                 onPress={() => setRecurrence(rec)}
               >
                 <Text style={[styles.catPillText, recurrence === rec && styles.catPillTextActive]}>
                   {rec.charAt(0).toUpperCase() + rec.slice(1)}
                 </Text>
               </TouchableOpacity>
            ))}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Task Description</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Vet Appointment, Buy Kibble, Bath Day" 
          value={title} 
          onChangeText={setTitle} 
        />
      </View>

      <View style={styles.timeRow}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateText}>
              {datetime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Time</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.dateText}>
              {datetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date & Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={datetime}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) setDatetime(selectedDate);
          }}
        />
      )}
      {Platform.OS === 'ios' && showDatePicker && (
         <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
           <Text style={styles.doneBtnText}>Done Date</Text>
         </TouchableOpacity>
      )}

      {showTimePicker && (
        <DateTimePicker
          value={datetime}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(Platform.OS === 'ios');
            if (selectedTime) setDatetime(selectedTime);
          }}
        />
      )}
      {Platform.OS === 'ios' && showTimePicker && (
         <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTimePicker(false)}>
           <Text style={styles.doneBtnText}>Done Time</Text>
         </TouchableOpacity>
      )}


      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSaveTask}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Committing...' : 'Add Quick Task'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 32,
    color: '#111',
    letterSpacing: -0.5,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  timeRow: {
    flexDirection: 'row',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    height: 54,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  doneBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  doneBtnText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#111',
    padding: 18,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Pet Selector
  petSelector: {
    flexDirection: 'row',
  },
  petBubble: {
    alignItems: 'center',
    marginRight: 16,
    opacity: 0.5,
  },
  petBubbleActive: {
    opacity: 1,
  },
  fallbackAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  petAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 4,
  },
  petBubbleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    maxWidth: 60,
  },
  
  // Category Pills
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  catPillActive: {
    backgroundColor: '#111',
  },
  catPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  catPillTextActive: {
    color: '#fff',
  }
});
