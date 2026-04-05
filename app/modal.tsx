import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, Platform } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

const ALL_VACCINES = [
  'Rabies',
  'Distemper',
  'Parvovirus',
  'Adenovirus',
  'Bordetella',
  'Lyme',
  'Feline Herpesvirus',
  'Feline Calicivirus',
  'Feline Leukemia'
];

export default function ModalScreen() {
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [adoptionDate, setAdoptionDate] = useState<Date | null>(null);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
  const [showAdoptionPicker, setShowAdoptionPicker] = useState(false);
  
  const [selectedVaccines, setSelectedVaccines] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isEditing) {
      const fetchPetToEdit = async () => {
        const { data, error } = await supabase.from('pets').select('*').eq('id', id).single();
        if (data) {
          setName(data.name || '');
          setSpecies(data.species || '');
          setBreed(data.breed || '');
          setAllergies(data.allergies || '');
          setNotes(data.notes || '');
          setSelectedVaccines(data.vaccines || []);
          if (data.birthdate) setBirthdate(new Date(data.birthdate));
          if (data.adoption_date) setAdoptionDate(new Date(data.adoption_date));
        } else if (error) {
          Alert.alert('Error', error.message);
        }
        setFetching(false);
      };
      fetchPetToEdit();
    }
  }, [id, isEditing]);

  const toggleVaccine = (vaccine: string) => {
    setSelectedVaccines(prev => 
      prev.includes(vaccine) ? prev.filter(v => v !== vaccine) : [...prev, vaccine]
    );
  };

  const handleSavePet = async () => {
    try {
      if (!name.trim()) {
        Alert.alert('Required', 'Pet name is required');
        return;
      }
      if (!session?.user?.id) {
        Alert.alert('Error', 'No authenticated user found.');
        return;
      }
      setLoading(true);
      
      const payload = {
        user_id: session.user.id,
        name: name.trim(),
        species: species.trim(),
        breed: breed.trim(),
        allergies: allergies.trim(),
        notes: notes.trim(),
        vaccines: selectedVaccines,
        birthdate: birthdate ? birthdate.toISOString().split('T')[0] : null,
        adoption_date: adoptionDate ? adoptionDate.toISOString().split('T')[0] : null,
      };

      let error;
      if (isEditing) {
        const res = await supabase.from('pets').update(payload).eq('id', id);
        error = res.error;
      } else {
        const res = await supabase.from('pets').insert([payload]);
        error = res.error;
      }

      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to save pet');
      } else {
        router.back();
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Exception', err.message || JSON.stringify(err));
    }
  };

  if (fetching) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading pet data...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{isEditing ? 'Edit Pet Profile' : 'Add a New Pet'}</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} placeholder="e.g. Bella" value={name} onChangeText={setName} />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Species</Text>
          <TextInput style={styles.input} placeholder="e.g. Dog" value={species} onChangeText={setSpecies} />
        </View>
        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Breed</Text>
          <TextInput style={styles.input} placeholder="e.g. Golden Retriever" value={breed} onChangeText={setBreed} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Birthdate</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowBirthdatePicker(true)}>
            <Text style={birthdate ? styles.dateText : styles.placeholderText}>
              {birthdate ? birthdate.toISOString().split('T')[0] : 'Select Date'}
            </Text>
          </TouchableOpacity>
          {showBirthdatePicker && (
            <DateTimePicker
              value={birthdate || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowBirthdatePicker(Platform.OS === 'ios');
                if (selectedDate) setBirthdate(selectedDate);
              }}
            />
          )}
          {Platform.OS === 'ios' && showBirthdatePicker && (
             <TouchableOpacity style={styles.doneBtn} onPress={() => setShowBirthdatePicker(false)}>
               <Text style={styles.doneBtnText}>Done</Text>
             </TouchableOpacity>
          )}
        </View>

        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Adoption Date</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowAdoptionPicker(true)}>
            <Text style={adoptionDate ? styles.dateText : styles.placeholderText}>
              {adoptionDate ? adoptionDate.toISOString().split('T')[0] : 'Select Date'}
            </Text>
          </TouchableOpacity>
          {showAdoptionPicker && (
            <DateTimePicker
              value={adoptionDate || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowAdoptionPicker(Platform.OS === 'ios');
                if (selectedDate) setAdoptionDate(selectedDate);
              }}
            />
          )}
          {Platform.OS === 'ios' && showAdoptionPicker && (
             <TouchableOpacity style={styles.doneBtn} onPress={() => setShowAdoptionPicker(false)}>
               <Text style={styles.doneBtnText}>Done</Text>
             </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Vaccines</Text>
        <View style={styles.vaccineContainer}>
          {ALL_VACCINES.map(vac => {
            const isSelected = selectedVaccines.includes(vac);
            return (
              <TouchableOpacity 
                key={vac} 
                style={[styles.vaccinePill, isSelected && styles.vaccinePillSelected]}
                onPress={() => toggleVaccine(vac)}
              >
                <Text style={[styles.vaccineText, isSelected && styles.vaccineTextSelected]}>{vac}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Allergies</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Peanuts, Chicken" 
          value={allergies} 
          onChangeText={setAllergies} 
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Notes</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="Any special quirks or information?" 
          value={notes} 
          onChangeText={setNotes} 
          multiline 
          numberOfLines={4} 
        />
      </View>

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSavePet}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Pet'}
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
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 32,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  doneBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  doneBtnText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  vaccineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vaccinePill: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    backgroundColor: '#FAFAFA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  vaccinePillSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  vaccineText: {
    color: '#666',
    fontSize: 14,
  },
  vaccineTextSelected: {
    color: '#fff',
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
