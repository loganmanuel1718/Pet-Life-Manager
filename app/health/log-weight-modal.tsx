import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, Platform } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeContext } from '../../contexts/ThemeContext';
import Colors from '../../constants/Colors';

export default function LogWeightModalScreen() {
  const { pet_id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { colorScheme } = useThemeContext();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveWeight = async () => {
    try {
      if (!pet_id) {
        Alert.alert('Error', 'No pet selected');
        return;
      }
      
      const parsedWeight = parseFloat(weight);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        Alert.alert('Required', 'Please enter a valid numeric weight (e.g., 20.5).');
        return;
      }
      
      setLoading(true);

      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const payload = {
        pet_id,
        user_id: session?.user?.id,
        weight: parsedWeight,
        date: dateString,
        notes: notes.trim()
      };

      const { error } = await supabase.from('pet_weight_logs').insert([payload]);

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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>Log Weight</Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>Weight (kg)</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.highlight, color: colors.text, borderColor: colors.border }]} 
          placeholder="e.g. 14.5" 
          placeholderTextColor={colors.mutedText}
          value={weight} 
          onChangeText={setWeight} 
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>Date of Weigh-In</Text>
        <TouchableOpacity style={[styles.dateInput, { backgroundColor: colors.highlight, borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.dateText, { color: colors.text }]}>
            {date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}
        {Platform.OS === 'ios' && showDatePicker && (
           <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
             <Text style={[styles.doneBtnText, { color: colors.tint }]}>Done</Text>
           </TouchableOpacity>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>Notes (Optional)</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.highlight, color: colors.text, borderColor: colors.border }]} 
          placeholder="e.g. Vet checkup, changed diet" 
          placeholderTextColor={colors.mutedText}
          value={notes} 
          onChangeText={setNotes} 
        />
      </View>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.text }, loading && styles.buttonDisabled]} 
        onPress={handleSaveWeight}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: colors.background }]}>
          {loading ? 'Logging...' : 'Save Record'}
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
    fontSize: 18,
    backgroundColor: '#FAFAFA',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    height: 58,
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
    marginTop: 12,
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
});
