import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, RefreshControl, Image, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function FeedingTab() {
  const { session } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedules = async () => {
    if (!session?.user?.id) return;
    
    // Fetch Schedules
    const { data: schedData } = await supabase
      .from('feeding_schedules')
      .select('*, pets(name, avatar_url)');
      
    // Fetch Today's Logs
    const dateToday = new Date().toISOString().split('T')[0];
    const { data: logData } = await supabase
      .from('feeding_logs')
      .select('*')
      .eq('date', dateToday);

    if (schedData && logData) {
      const fullSchedules = schedData.map(s => ({
        ...s,
        is_fed: logData.some(l => l.schedule_id === s.id) // True if a log exists for today
      }));
      fullSchedules.sort((a, b) => a.time.localeCompare(b.time));
      setSchedules(fullSchedules);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSchedules().then(() => setRefreshing(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      fetchSchedules();
    }, [session])
  );

  const markAsFed = async (scheduleId: string, petId: string) => {
    if (!session?.user?.id) return;
    
    // Optimistic UI update
    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, is_fed: true } : s));

    const payload = {
      schedule_id: scheduleId,
      pet_id: petId,
      user_id: session.user.id,
      date: new Date().toISOString().split('T')[0]
    };
    
    const { error } = await supabase.from('feeding_logs').insert([payload]);
    if (error) {
       // Revert UI on failure
       fetchSchedules();
       console.error("Failed to mark fed", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Today's Checklist</Text>

        {schedules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No feeding schedules found.</Text>
            <Text style={styles.emptySubtext}>Add them from a pet's profile.</Text>
          </View>
        ) : (
          schedules.map(sched => (
            <View key={sched.id} style={[styles.scheduleCard, sched.is_fed && styles.scheduleCardComplete]}>
              <View style={styles.scheduleMeta}>
                {sched.pets?.avatar_url ? (
                  <Image source={{ uri: sched.pets.avatar_url }} style={styles.miniAvatar} />
                ) : (
                  <View style={styles.miniAvatarPlaceholder}>
                    <FontAwesome5 name="paw" size={12} color="#999" />
                  </View>
                )}
                <View>
                  <Text style={[styles.schedTime, sched.is_fed && styles.textMuted]}>
                    {new Date(`1970-01-01T${sched.time}Z`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={[styles.schedDetails, sched.is_fed && styles.textMuted]}>
                    {sched.pets?.name} • {sched.amount} {sched.food_type}
                  </Text>
                </View>
              </View>

              {sched.is_fed ? (
                <View style={styles.checkCircleComplete}>
                  <FontAwesome5 name="check" size={14} color="#fff" />
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.checkCircle} 
                  onPress={() => markAsFed(sched.id, sched.pet_id)}
                />
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF', // highlight accent
  },
  scheduleCardComplete: {
    borderLeftColor: '#EAEAEA',
    backgroundColor: '#F9F9F9',
  },
  scheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  miniAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  schedTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  schedDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  textMuted: {
    color: '#999',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EAEAEA',
    backgroundColor: '#fff',
  },
  checkCircleComplete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});
