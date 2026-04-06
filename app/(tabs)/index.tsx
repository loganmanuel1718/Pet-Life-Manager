import { useState, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  avatar_url?: string;
};

export default function PetDashboard() {
  const { session } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPets = async () => {
    if (!session?.user?.id) return;
    
    // Fetch Pets
    const { data: petsData } = await supabase
      .from('pets')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (petsData) setPets(petsData);
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
        <Text style={styles.title}>Pet Life</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* My Pets Roster Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Pets</Text>
          {pets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>You haven't added any pets yet.</Text>
            </View>
          ) : (
            pets.map(item => (
              <TouchableOpacity key={item.id} onPress={() => router.push(`/pet/${item.id}`)}>
                <View style={styles.petCard}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.petAvatar} />
                  ) : (
                    <View style={styles.petAvatarPlaceholder}>
                      <FontAwesome5 name="paw" size={20} color="#999" />
                    </View>
                  )}
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{item.name}</Text>
                    <Text style={styles.petDetails}>
                      {item.species || 'Unknown Species'} {item.breed ? `• ${item.breed}` : ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>

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
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  signOutText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  petCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  petAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
    backgroundColor: '#EAEAEA',
  },
  petAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 14,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
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
