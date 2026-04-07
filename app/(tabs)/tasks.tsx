import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, RefreshControl, Image, ScrollView, View } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TasksTab() {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    if (!session?.user?.id) return;
    
    // Fetch Feeding
    const { data: feedingSched } = await supabase
      .from('feeding_schedules')
      .select('*, pets(name, avatar_url)');
    const now = new Date();
    const localDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const { data: feedingLogs } = await supabase
      .from('feeding_logs')
      .select('*')
      .eq('date', localDateString);

    // Fetch Medicines
    const { data: medicineSched } = await supabase
      .from('medicine_schedules')
      .select('*, pets(name, avatar_url)');
    const { data: medicineLogs } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('date', localDateString);

    let combinedTasks: any[] = [];

    // Map Food
    if (feedingSched) {
      combinedTasks = combinedTasks.concat(feedingSched.map(s => ({
        ...s,
        taskType: 'Food',
        is_completed: feedingLogs?.some(l => l.schedule_id === s.id) || false
      })));
    }

    // Map Medicine
    if (medicineSched) {
      combinedTasks = combinedTasks.concat(medicineSched.map(s => ({
        ...s,
        taskType: 'Medicine',
        is_completed: medicineLogs?.some(l => l.schedule_id === s.id) || false
      })));
    }

    // Sort chronologically
    combinedTasks.sort((a, b) => a.time.localeCompare(b.time));
    setTasks(combinedTasks);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTasks().then(() => setRefreshing(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [session])
  );

  const markAsCompleted = async (taskId: string, petId: string, taskType: string) => {
    if (!session?.user?.id) return;
    
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: true } : t));

    const now = new Date();
    const localDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const payload = {
      schedule_id: taskId,
      pet_id: petId,
      user_id: session.user.id,
      date: localDateString
    };
    
    const tableName = taskType === 'Food' ? 'feeding_logs' : 'medicine_logs';
    const { error } = await supabase.from(tableName).insert([payload]);
    
    if (error) {
       fetchTasks();
       console.error(`Failed to execute ${taskType} log`, error);
    }
  };

  const unmarkAsCompleted = async (taskId: string, taskType: string) => {
    if (!session?.user?.id) return;
    
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: false } : t));

    const now = new Date();
    const localDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const tableName = taskType === 'Food' ? 'feeding_logs' : 'medicine_logs';
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('schedule_id', taskId)
      .eq('date', localDateString);
    
    if (error) {
       fetchTasks();
       console.error(`Failed to remove ${taskType} log`, error);
    }
  };

  const formatTime = (timeString: string) => {
    const [h, m] = timeString.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${m} ${ampm}`;
  };

  // Split out pending and completed
  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  // Grouping Logic for PENDING tasks ONLY
  type MealGroup = Record<string, Record<string, any[]>>;
  const groupedTasks: MealGroup = {
    'Breakfast': {},
    'Lunch': {},
    'Dinner': {}
  };

  pendingTasks.forEach(task => {
    const hour = parseInt(task.time.split(':')[0], 10);
    let meal = 'Dinner';
    if (hour < 11) meal = 'Breakfast';
    else if (hour < 16) meal = 'Lunch';

    const petName = task.pets?.name || 'Unknown Pet';
    
    if (!groupedTasks[meal][petName]) {
      groupedTasks[meal][petName] = [];
    }
    groupedTasks[meal][petName].push(task);
  });

  const timeBlocks = ['Breakfast', 'Lunch', 'Dinner'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks found.</Text>
            <Text style={styles.emptySubtext}>Add feeding or medical schedules in from a pet's profile.</Text>
          </View>
        ) : (
          <>
            {/* COMPLETED TASKS SECTION */}
            {completedTasks.length > 0 && (
               <View style={styles.completedSection}>
                  <Text style={styles.completedTitle}>Completed Today</Text>
                  
                  {completedTasks.map(task => (
                    <View key={task.id} style={[styles.scheduleCard, styles.scheduleCardComplete, { marginLeft: 0 }]}>
                      <View style={styles.scheduleMeta}>
                        
                        {/* Show Pet Avatar inline since we are not grouping by pet here */}
                        {task.pets?.avatar_url ? (
                          <Image source={{ uri: task.pets.avatar_url }} style={styles.miniAvatarCompleted} />
                        ) : (
                          <View style={styles.miniAvatarCompletedFallback}>
                            <FontAwesome5 name="paw" size={10} color="#999" />
                          </View>
                        )}

                        <View>
                          <Text style={[styles.schedTime, styles.textMuted]}>
                            {formatTime(task.time)} • {task.pets?.name || 'Pet'}
                          </Text>
                          <Text style={[styles.schedDetails, styles.textMuted]}>
                            {task.taskType === 'Medicine' ? `${task.dosage} • ${task.medicine_name}` : `${task.amount} • ${task.food_type}`}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity onPress={() => unmarkAsCompleted(task.id, task.taskType)}>
                        <View style={styles.checkCircleComplete}>
                          <FontAwesome5 name="check" size={14} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
               </View>
            )}

            {/* PENDING / UPCOMING SECTION */}
            {pendingTasks.length === 0 ? (
               <View style={styles.allDoneContainer}>
                  <Text style={styles.allDoneText}>All caught up for today! 🎉</Text>
               </View>
            ) : (
              timeBlocks.map(block => {
                const blockTasks = groupedTasks[block];
                const petNames = Object.keys(blockTasks);
                
                if (petNames.length === 0) return null;
    
                return (
                  <View key={block} style={styles.mealSection}>
                    <Text style={styles.mealTitle}>{block}</Text>
                    
                    {petNames.map(petName => (
                      <View key={petName} style={styles.petGroup}>
                        
                        <View style={styles.petGroupHeader}>
                          {blockTasks[petName][0]?.pets?.avatar_url ? (
                            <Image source={{ uri: blockTasks[petName][0].pets.avatar_url }} style={styles.miniAvatarPetGroup} />
                          ) : (
                            <FontAwesome5 name="paw" size={12} color="#999" style={styles.miniAvatarFallback} />
                          )}
                          <Text style={styles.petGroupTitle}>{petName}</Text>
                        </View>
    
                        {blockTasks[petName].map((task: any) => (
                          <View 
                             key={task.id} 
                             style={[
                               styles.scheduleCard, 
                               task.taskType === 'Medicine' && { borderLeftColor: '#FF9500' }
                             ]}
                          >
                            <View style={styles.scheduleMeta}>
                              {task.taskType === 'Medicine' && (
                                <View style={styles.taskIconCircle}>
                                  <FontAwesome5 name="pills" size={12} color="#FF9500" />
                                </View>
                              )}
                              <View>
                                <Text style={styles.schedTime}>
                                  {formatTime(task.time)}
                                </Text>
                                <Text style={styles.schedDetails}>
                                  {task.taskType === 'Medicine' ? `${task.dosage} • ${task.medicine_name}` : `${task.amount} • ${task.food_type}`}
                                </Text>
                              </View>
                            </View>
    
                            <TouchableOpacity 
                              style={styles.checkCircle} 
                              onPress={() => markAsCompleted(task.id, task.pet_id, task.taskType)}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })
            )}

          </>
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
  mealSection: {
    marginBottom: 32,
  },
  mealTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#EAEAEA',
    paddingBottom: 8,
  },
  petGroup: {
    marginBottom: 20,
  },
  petGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  petGroupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  miniAvatarPetGroup: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  miniAvatarFallback: {
    marginRight: 8,
    marginLeft: 4,
  },
  miniAvatarCompleted: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    opacity: 0.6,
  },
  miniAvatarCompletedFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskIconCircle: {
     width: 28, 
     height: 28, 
     borderRadius: 14, 
     backgroundColor: '#FFF0D9', 
     justifyContent: 'center', 
     alignItems: 'center', 
     marginRight: 12 
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
    borderLeftColor: '#007AFF', // highlight accent default (food)
    marginLeft: 12, 
  },
  scheduleCardComplete: {
    borderLeftColor: '#EAEAEA',
    backgroundColor: '#F9F9F9',
    shadowOpacity: 0,
    elevation: 0,
  },
  scheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
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
  allDoneContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#F0F8FF',
    borderRadius: 16,
    marginBottom: 32,
  },
  allDoneText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  completedSection: {
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: '#EAEAEA',
    paddingBottom: 24,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#999',
    marginBottom: 16,
  },
});
