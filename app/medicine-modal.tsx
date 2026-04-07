import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, Platform } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function MedicineModalScreen() {
  const { pet_id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  
  const [time, setTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveSchedule = async () => {
    try {
      if (!pet_id) {
        Alert.alert('Error', 'No pet selected');
        return;
      }
      if (!medicineName.trim() || !dosage.trim()) {
        Alert.alert('Required', 'Please specify both medicine name and dosage amount');
        return;
      }
      
      setLoading(true);
      
      // format time to HH:MM
      const hours = time.getHours().toString().padStart(2, '0');
      const minutes = time.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      const payload = {
        pet_id,
        user_id: session?.user?.id,
        time: timeString,
        medicine_name: medicineName.trim(),
        dosage: dosage.trim(),
      };

      const { error } = await supabase.from('medicine_schedules').insert([payload]);

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
      <Text style={styles.title}>Add Medication Task</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Scheduled Time</Text>
        <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.dateText}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>
        
        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display="default"
            onChange={(event, selectedTime) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (selectedTime) setTime(selectedTime);
            }}
          />
        )}
        {Platform.OS === 'ios' && showTimePicker && (
           <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTimePicker(false)}>
             <Text style={styles.doneBtnText}>Done</Text>
           </TouchableOpacity>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Medicine Name</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Heartgard, Insulin, Prednisone" 
          value={medicineName} 
          onChangeText={setMedicineName} 
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Dosage</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. 1 Tablet, 5mg, 2 Drops" 
          value={dosage} 
          onChangeText={setDosage} 
        />
      </View>

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSaveSchedule}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Medication'}
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 32,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    height: 54,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
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
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
