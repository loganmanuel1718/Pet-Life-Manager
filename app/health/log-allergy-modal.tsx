import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, Platform } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeContext } from '../../contexts/ThemeContext';
import Colors from '../../constants/Colors';

const SEVERITY_LEVELS = [
  { level: 0, label: 'None', color: '#34C759', description: 'No signs of itching or redness.' },
  { level: 1, label: 'Mild', color: '#FFCC00', description: 'Occasional scratching.' },
  { level: 2, label: 'Moderate', color: '#FF9500', description: 'Frequent itching, chewing or redness.' },
  { level: 3, label: 'Severe', color: '#FF3B30', description: 'Constant scratching, hair loss, or raw skin.' },
];

export default function LogAllergyModalScreen() {
  const { pet_id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { colorScheme } = useThemeContext();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [severity, setSeverity] = useState(0);
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSaveAllergy = async () => {
    try {
      if (!pet_id) {
        Alert.alert('Error', 'No pet selected');
        return;
      }
      
      setLoading(true);

      const dateString = date.toISOString();

      const payload = {
        pet_id,
        user_id: session?.user?.id,
        severity,
        symptoms: symptoms.trim(),
        notes: notes.trim(),
        date: dateString
      };

      const { error } = await supabase.from('pet_allergy_logs').insert([payload]);

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
      <Text style={[styles.title, { color: colors.text }]}>Daily Allergy Log</Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>Severity Level</Text>
        <View style={styles.severityGrid}>
          {SEVERITY_LEVELS.map(item => {
            const isSelected = severity === item.level;
            return (
              <TouchableOpacity 
                key={item.level} 
                style={[
                  styles.severityCard, 
                  { backgroundColor: colors.highlight, borderColor: colors.border },
                  isSelected && { borderColor: item.color, backgroundColor: `${item.color}15` }
                ]}
                onPress={() => setSeverity(item.level)}
              >
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <Text style={[styles.severityLabel, { color: colors.mutedText }, isSelected && { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <Text style={[styles.hintText, { color: colors.mutedText }]}>{SEVERITY_LEVELS[severity].description}</Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>Date of Reading</Text>
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
        <Text style={[styles.label, { color: colors.text }]}>Specific Symptoms (Optional)</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.highlight, color: colors.text, borderColor: colors.border }]} 
          placeholder="e.g. Itchy paws, ear scratching" 
          placeholderTextColor={colors.mutedText}
          value={symptoms} 
          onChangeText={setSymptoms} 
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.text }]}>Treatment or Notes (Optional)</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.highlight, color: colors.text, borderColor: colors.border }]} 
          placeholder="e.g. Gave Apoquel pill" 
          placeholderTextColor={colors.mutedText}
          value={notes} 
          onChangeText={setNotes} 
        />
      </View>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.text }, loading && styles.buttonDisabled]} 
        onPress={handleSaveAllergy}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: colors.background }]}>
          {loading ? 'Logging...' : 'Save Reading'}
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
    paddingBottom: 40,
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
    marginBottom: 12,
    fontWeight: '600',
  },
  severityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  severityCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  severityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  hintText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: 16,
    fontSize: 16, // Better numeric sizing format
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
