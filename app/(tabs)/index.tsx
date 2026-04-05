import { useState, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';

type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string;
};

export default function PetDashboard() {
  const { session } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPets = async () => {
    if (!session?.user.id) return;
    
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data) {
      setPets(data);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPets().then(() => setRefreshing(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      fetchPets();
    }, [session])
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Pets</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You haven't added any pets yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/pet/${item.id}`)}>
            <View style={styles.petCard}>
              <Text style={styles.petName}>{item.name}</Text>
              <Text style={styles.petDetails}>
                {item.species || 'Unknown Species'} {item.breed ? `• ${item.breed}` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/modal')}>
        <Text style={styles.fabText}>+ Add Pet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100, // For the FAB
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  petCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  petName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  petDetails: {
    fontSize: 14,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: [{ translateX: -70 }],
    width: 140,
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
