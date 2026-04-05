import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function ModalScreen() {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { session } = useAuth();
  const router = useRouter();

  const handleAddPet = async () => {
    try {
      console.log('Attempting to add pet...');
      console.log('Current session:', session);
      
      if (!name.trim()) {
        Alert.alert('Required', 'Pet name is required');
        return;
      }

      if (!session?.user?.id) {
        Alert.alert('Error', 'No authenticated user found. Please try logging out and back in.');
        console.error('No session user ID found');
        return;
      }

      setLoading(true);
      
      const payload = {
        user_id: session.user.id,
        name: name.trim(),
        species: species.trim(),
        breed: breed.trim(),
      };
      
      console.log('Payload:', payload);

      const { data, error } = await supabase.from('pets').insert([payload]).select();

      console.log('Insert Result - Data:', data, 'Error:', error);

      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to save pet');
        console.error('Supabase Insert Error:', error);
      } else {
        console.log('Successfully inserted! Navigating back...');
        router.back();
      }
    } catch (err: any) {
      setLoading(false);
      console.error('Exception caught in handleAddPet:', err);
      Alert.alert('Exception', err.message || JSON.stringify(err));
    }
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Add a New Pet</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Bella"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Species</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dog, Cat"
          value={species}
          onChangeText={setSpecies}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Breed</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Golden Retriever"
          value={breed}
          onChangeText={setBreed}
        />
      </View>

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleAddPet}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Adding...' : 'Save Pet'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
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
