import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, RefreshControl, Image, ScrollView, View } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, Link } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TasksTab() {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    if (!session?.user?.id) return;
    
    // Time Strings
    const now = new Date();
    const localDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Parallel Sub-Queries
    const { data: feedingSched } = await supabase.from('feeding_schedules').select('*, pets(name, avatar_url)');
    const { data: feedingLogs } = await supabase.from('feeding_logs').select('*').eq('date', localDateString);

    const { data: medicineSched } = await supabase.from('medicine_schedules').select('*, pets(name, avatar_url)');
    const { data: medicineLogs } = await supabase.from('medicine_logs').select('*').eq('date', localDateString);

    const { data: groomingSched } = await supabase.from('grooming_schedules').select('*, pets(name, avatar_url)');
    const { data: groomingLogs } = await supabase.from('grooming_logs').select('*').eq('date', localDateString);

    const { data: quickTasks } = await supabase.from('quick_tasks').select('*, pets(name, avatar_url)').eq('due_date', localDateString);

    let combinedTasks: any[] = [];

    // Map Food
    if (feedingSched) combinedTasks = combinedTasks.concat(feedingSched.map(s => ({ ...s, taskType: 'Food', is_completed: feedingLogs?.some(l => l.schedule_id === s.id) || false })));
    // Map Medicine
    if (medicineSched) combinedTasks = combinedTasks.concat(medicineSched.map(s => ({ ...s, taskType: 'Medicine', is_completed: medicineLogs?.some(l => l.schedule_id === s.id) || false })));
    // Map Grooming
    if (groomingSched) combinedTasks = combinedTasks.concat(groomingSched.map(s => ({ ...s, taskType: 'Grooming', is_completed: groomingLogs?.some(l => l.schedule_id === s.id) || false })));
    
    // Map Quick Tasks
    if (quickTasks) {
      combinedTasks = combinedTasks.concat(quickTasks.map(t => ({
        ...t,
        time: t.due_time, // Standardize sorting key
        taskType: 'QuickTask',
        is_completed: t.is_completed // Pulled straight from the object
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

  useFocusEffect(useCallback(() => { fetchTasks(); }, [session]));

  const markAsCompleted = async (taskId: string, petId: string, taskType: string) => {
    if (!session?.user?.id) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: true } : t));

    if (taskType === 'QuickTask') {
       const { error } = await supabase.from('quick_tasks').update({ is_completed: true }).eq('id', taskId);
       if (error) { fetchTasks(); console.error(error); }
       return;
    }

    const now = new Date();
    const localDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const payload = { schedule_id: taskId, pet_id: petId, user_id: session.user.id, date: localDateString };
    
    let tableName = 'feeding_logs';
    if (taskType === 'Medicine') tableName = 'medicine_logs';
    if (taskType === 'Grooming') tableName = 'grooming_logs';

    const { error } = await supabase.from(tableName).insert([payload]);
    if (error) fetchTasks();
  };

  const unmarkAsCompleted = async (taskId: string, taskType: string) => {
    if (!session?.user?.id) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: false } : t));

    if (taskType === 'QuickTask') {
       const { error } = await supabase.from('quick_tasks').update({ is_completed: false }).eq('id', taskId);
       if (error) fetchTasks();
       return;
    }

    const now = new Date();
    const localDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    let tableName = 'feeding_logs';
    if (taskType === 'Medicine') tableName = 'medicine_logs';
    if (taskType === 'Grooming') tableName = 'grooming_logs';

    const { error } = await supabase.from(tableName).delete().eq('schedule_id', taskId).eq('date', localDateString);
    if (error) fetchTasks();
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [h, m] = timeString.split(':');
    const hours = parseInt(h, 10);
    const hours12 = hours % 12 || 12;
    return `${hours12}:${m}`; 
  };

  const formatAMPM = (timeString: string) => {
    if (!timeString) return '';
    const [h] = timeString.split(':');
    return parseInt(h, 10) >= 12 ? 'pm' : 'am';
  };

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  type MealGroup = Record<string, Record<string, any[]>>;
  const groupedTasks: MealGroup = {
    'Morning': {},
    'Afternoon': {},
    'Evening': {}
  };

  pendingTasks.forEach(task => {
    const hour = parseInt(task.time.split(':')[0], 10);
    let meal = 'Evening';
    if (hour < 12) meal = 'Morning';
    else if (hour < 17) meal = 'Afternoon';

    const petName = task.pets?.name || 'Home'; // Fallback to 'Home' for Global Tasks
    
    if (!groupedTasks[meal][petName]) {
      groupedTasks[meal][petName] = [];
    }
    groupedTasks[meal][petName].push(task);
  });

  const timeBlocks = ['Morning', 'Afternoon', 'Evening'];
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateSub = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>{dayName}</Text>
          <Text style={styles.subtitle}>{dateSub}</Text>
        </View>
        <Link href="/quick-task-modal" asChild>
          <TouchableOpacity style={styles.headerAddBtn}>
             <FontAwesome5 name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </Link>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nothing scheduled yet.</Text>
            <Text style={styles.emptySubtext}>Head over to a pet's profile to add routines.</Text>
          </View>
        ) : (
          <>
            {/* COMPLETED TASKS SECTION */}
            {completedTasks.length > 0 && (
               <View style={styles.completedSection}>
                  <View style={styles.sectionPill}>
                    <FontAwesome5 name="check-double" size={12} color="#34C759" />
                    <Text style={styles.sectionPillText}>COMPLETED ({completedTasks.length})</Text>
                  </View>
                  
                  {completedTasks.map(task => (
                    <View key={task.id} style={[styles.scheduleCard, styles.scheduleCardComplete, { marginLeft: 0 }]}>
                      <View style={styles.scheduleMeta}>
                        
                        {task.pets?.avatar_url ? (
                          <Image source={{ uri: task.pets.avatar_url }} style={styles.miniAvatarCompleted} />
                        ) : (
                          <View style={styles.miniAvatarCompletedFallback}>
                            <FontAwesome5 name={task.taskType === 'QuickTask' && !task.pet_id ? 'home' : 'paw'} size={10} color="#999" />
                          </View>
                        )}

                        <View>
                          <Text style={[styles.schedTime, styles.textMuted]}>
                            {formatTime(task.time)}<Text style={styles.ampm}>{formatAMPM(task.time)}</Text> • {task.pets?.name || 'Home'}
                          </Text>
                          <Text style={[styles.schedDetails, styles.textMuted]}>
                            {task.taskType === 'Food' && `${task.amount} • ${task.food_type}`}
                            {task.taskType === 'Medicine' && `${task.dosage} • ${task.medicine_name}`}
                            {task.taskType === 'Grooming' && task.activity}
                            {task.taskType === 'QuickTask' && `${task.category} • ${task.title}`}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity onPress={() => unmarkAsCompleted(task.id, task.taskType)}>
                        <View style={styles.checkCircleComplete}>
                          <FontAwesome5 name="check" size={12} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
               </View>
            )}

            {/* PENDING / UPCOMING SECTION */}
            {pendingTasks.length === 0 ? (
               <View style={styles.allDoneContainer}>
                  <Text style={styles.allDoneText}>All caught up for today. Great job!</Text>
               </View>
            ) : (
              timeBlocks.map(block => {
                const blockTasks = groupedTasks[block];
                const petNames = Object.keys(blockTasks);
                
                if (petNames.length === 0) return null;
                
                let iconName = 'sun';
                let iconColor = '#FF9500';
                if (block === 'Afternoon') { iconName = 'cloud-sun'; iconColor = '#FF3B30'; }
                if (block === 'Evening') { iconName = 'moon'; iconColor = '#5856D6'; }
    
                return (
                  <View key={block} style={styles.mealSection}>
                    <View style={styles.sectionPill}>
                      <FontAwesome5 name={iconName} size={14} color={iconColor} />
                      <Text style={styles.sectionPillText}>{block.toUpperCase()} ({Object.values(blockTasks).flat().length})</Text>
                    </View>
                    
                    {petNames.map(petName => (
                      <View key={petName} style={styles.petGroup}>
                        
                        {/* Soft Pet Header */}
                        <View style={styles.petGroupHeader}>
                          {blockTasks[petName][0]?.pets?.avatar_url ? (
                            <Image source={{ uri: blockTasks[petName][0].pets.avatar_url }} style={styles.miniAvatarPetGroup} />
                          ) : (
                            <FontAwesome5 name={petName === 'Home' ? 'home' : 'paw'} size={12} color="#999" style={styles.miniAvatarFallback} />
                          )}
                          <Text style={styles.petGroupTitle}>{petName}</Text>
                        </View>
    
                        {blockTasks[petName].map((task: any) => {
                           let bgCol = '#E5F1FF';
                           let icnCol = '#007AFF';
                           let icnNode = 'bone';
                           if (task.taskType === 'Medicine') { bgCol = '#F2E8FB'; icnCol = '#9C51E0'; icnNode = 'pills'; }
                           if (task.taskType === 'Grooming') { bgCol = '#E5FAEE'; icnCol = '#34C759'; icnNode = 'bath'; }
                           if (task.taskType === 'QuickTask') { bgCol = '#FFF0E5'; icnCol = '#FF9500'; icnNode = 'clipboard-list'; }

                           return (
                            <View key={task.id} style={styles.scheduleCard}>
                              <View style={styles.scheduleMeta}>
                                <View style={[styles.taskIconCircle, { backgroundColor: bgCol }]}>
                                   <FontAwesome5 name={icnNode} size={14} color={icnCol} />
                                </View>
                                <View>
                                  <Text style={styles.schedTime}>
                                    {task.taskType === 'Food' && task.food_type}
                                    {task.taskType === 'Medicine' && task.medicine_name}
                                    {task.taskType === 'Grooming' && task.activity}
                                    {task.taskType === 'QuickTask' && task.title}
                                  </Text>
                                  <Text style={styles.schedDetails}>
                                     {formatTime(task.time)}{formatAMPM(task.time)} • {task.taskType === 'Medicine' ? task.dosage : (task.amount || task.category || '')}
                                  </Text>
                                </View>
                              </View>
      
                              <TouchableOpacity 
                                style={styles.checkCircle} 
                                onPress={() => markAsCompleted(task.id, task.pet_id, task.taskType)}
                              />
                            </View>
                           );
                        })}
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
    backgroundColor: '#F9F9FB', // soft Apple background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 24,
    backgroundColor: '#F9F9FB',
  },
  headerTitles: {
    justifyContent: 'center',
  },
  headerAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 150, 
  },
  sectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20, 
    alignSelf: 'flex-start',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionPillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#333',
    marginLeft: 8,
  },
  mealSection: {
    marginBottom: 40,
  },
  petGroup: {
    marginBottom: 16,
  },
  petGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  petGroupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  miniAvatarPetGroup: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  miniAvatarFallback: {
    marginRight: 10,
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
     width: 44, 
     height: 44, 
     borderRadius: 22, 
     justifyContent: 'center', 
     alignItems: 'center', 
     marginRight: 16 
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 24, 
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    borderWidth: 0, 
  },
  scheduleCardComplete: {
    backgroundColor: '#F9F9F9',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  scheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schedTime: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  ampm: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 2,
  },
  schedDetails: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
  },
  textMuted: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5, 
    borderColor: '#D1D1D6',
    backgroundColor: '#fff',
  },
  checkCircleComplete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8E8E93',
  },
  allDoneContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  allDoneText: {
    fontSize: 18,
    color: '#34C759',
    fontWeight: '700',
  },
  completedSection: {
    marginBottom: 32,
  },
});
