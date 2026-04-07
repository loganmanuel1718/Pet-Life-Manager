import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, Platform, Image, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

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

interface VaccineEntry {
  name: string;
  date: string;
}

export default function ModalScreen() {
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [adoptionDate, setAdoptionDate] = useState<Date | null>(null);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
  const [showAdoptionPicker, setShowAdoptionPicker] = useState(false);
  
  const [selectedVaccines, setSelectedVaccines] = useState<VaccineEntry[]>([]);
  const [activeVaccineForDate, setActiveVaccineForDate] = useState<string | null>(null);
  const [showVaccineDatePicker, setShowVaccineDatePicker] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
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
          setAvatarUrl(data.avatar_url || '');
          
          // Parse historical payloads (either raw string array or pipe-delimited)
          const parsedVaccines = (data.vaccines || []).map((v: string) => {
             if (v.includes('|')) {
               const [n, d] = v.split('|');
               return { name: n, date: d || '' };
             }
             return { name: v, date: '' };
          });
          setSelectedVaccines(parsedVaccines);

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
    setSelectedVaccines(prev => {
      const exists = prev.find(v => v.name === vaccine);
      if (exists) return prev.filter(v => v.name !== vaccine);
      return [...prev, { name: vaccine, date: '' }];
    });
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0] && session?.user?.id) {
        setImageUploading(true);
        const image = result.assets[0];
        
        const base64Str = image.base64;
        if (!base64Str) throw new Error("Could not extract image base64");
        
        const filePath = `${session.user.id}/${Date.now()}.jpg`;
        const contentType = 'image/jpeg';
        
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64Str), { contentType });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        setAvatarUrl(publicUrlData.publicUrl);
        setImageUploading(false);
      }
    } catch (err: any) {
      setImageUploading(false);
      Alert.alert('Error uploading image', err.message);
    }
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
      
      const payloadVaccines = selectedVaccines.map(v => `${v.name}|${v.date}`);

      const payload = {
        user_id: session.user.id,
        name: name.trim(),
        species: species.trim(),
        breed: breed.trim(),
        allergies: allergies.trim(),
        notes: notes.trim(),
        vaccines: payloadVaccines,
        avatar_url: avatarUrl || null,
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
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{isEditing ? 'Edit Pet Profile' : 'Add a New Pet'}</Text>

      {/* Avatar Picker Section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarCircle} onPress={pickImage} disabled={imageUploading}>
          {imageUploading ? (
             <ActivityIndicator color="#007AFF" />
          ) : avatarUrl ? (
             <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
             <View style={styles.avatarPlaceholder}>
               <FontAwesome5 name="paw" size={40} color="#999" />
               <View style={styles.avatarEditBadge}>
                 <FontAwesome5 name="camera" size={12} color="#fff" />
               </View>
             </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change photo</Text>
      </View>
      
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
        <Text style={styles.label}>Vaccines & Records</Text>
        <View style={styles.vaccineContainer}>
          {ALL_VACCINES.map(vac => {
            const isSelected = selectedVaccines.some(v => v.name === vac);
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

      {selectedVaccines.length > 0 && (
         <View style={styles.inputContainer}>
            <Text style={styles.label}>Vaccination Dates</Text>
            {selectedVaccines.map(sv => (
               <View key={sv.name} style={styles.vaccineDateRow}>
                  <Text style={styles.vaccineDateName}>{sv.name}</Text>
                  <TouchableOpacity 
                    style={styles.vaccineDateInput} 
                    onPress={() => {
                       setActiveVaccineForDate(sv.name);
                       setShowVaccineDatePicker(true);
                    }}
                  >
                     <Text style={sv.date ? styles.vaccineDateTextSelected : styles.placeholderText}>
                        {sv.date || 'Set Date'}
                     </Text>
                  </TouchableOpacity>
               </View>
            ))}

            {showVaccineDatePicker && (
               <DateTimePicker
                 value={
                   activeVaccineForDate && selectedVaccines.find(v => v.name === activeVaccineForDate)?.date 
                     ? new Date(selectedVaccines.find(v => v.name === activeVaccineForDate)!.date) 
                     : new Date()
                 }
                 mode="date"
                 display="default"
                 onChange={(event, date) => {
                   if (Platform.OS !== 'ios') {
                      setShowVaccineDatePicker(false);
                   }
                   if (date && activeVaccineForDate) {
                     const dStr = date.toISOString().split('T')[0];
                     setSelectedVaccines(prev => prev.map(v => v.name === activeVaccineForDate ? { ...v, date: dStr } : v));
                   }
                 }}
               />
            )}
            {Platform.OS === 'ios' && showVaccineDatePicker && (
               <TouchableOpacity style={styles.doneBtn} onPress={() => setShowVaccineDatePicker(false)}>
                 <Text style={styles.doneBtnText}>Done</Text>
               </TouchableOpacity>
            )}
         </View>
      )}

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
    marginBottom: 24,
    color: '#333',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EAEAEA',
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 8,
    right: 28,
    backgroundColor: '#111',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#111',
    borderColor: '#111',
  },
  vaccineText: {
    color: '#666',
    fontSize: 14,
  },
  vaccineTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  vaccineDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vaccineDateName: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  vaccineDateInput: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  vaccineDateTextSelected: {
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
