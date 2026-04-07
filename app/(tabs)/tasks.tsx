import { useState, useCallback, useEffect, useRef } from 'react';
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Create a 30-day rolling window around today
  const [dateWindow] = useState(() => Array.from({ length: 31 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + (i - 15));
    return d;
  }));

  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to center on mount
  useEffect(() => {
    // Arbitrary timeout to allow layout to compute
    setTimeout(() => {
       if (scrollViewRef.current) {
          // approx width of 15 items * 52px each
          scrollViewRef.current.scrollTo({ x: 15 * 52 - 150, animated: false });
       }
    }, 100);
  }, []);

  const fetchTasks = async () => {
    if (!session?.user?.id) return;
    
    // Use selectedDate for all logic!
    const localDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    // Parallel Sub-Queries
    const { data: feedingSched } = await supabase.from('feeding_schedules').select('*, pets(name, avatar_url)');
    const { data: feedingLogs } = await supabase.from('feeding_logs').select('*').eq('date', localDateString);

    const { data: medicineSched } = await supabase.from('medicine_schedules').select('*, pets(name, avatar_url)');
    const { data: medicineLogs } = await supabase.from('medicine_logs').select('*').eq('date', localDateString);

    const { data: groomingSched } = await supabase.from('grooming_schedules').select('*, pets(name, avatar_url)');
    const { data: groomingLogs } = await supabase.from('grooming_logs').select('*').eq('date', localDateString);

    const { data: rawQuickTasks } = await supabase
      .from('quick_tasks')
      .select('*, pets(name, avatar_url)')
      .or(`due_date.eq.${localDateString},recurrence.neq.none`);

    const { data: quickLogs } = await supabase.from('quick_task_logs').select('*').eq('date', localDateString);

    let combinedTasks: any[] = [];

    // Map Food
    if (feedingSched) combinedTasks = combinedTasks.concat(feedingSched.map((s: any) => ({ ...s, taskType: 'Food', is_completed: feedingLogs?.some((l: any) => l.schedule_id === s.id) || false })));
    // Map Medicine
    if (medicineSched) combinedTasks = combinedTasks.concat(medicineSched.map((s: any) => ({ ...s, taskType: 'Medicine', is_completed: medicineLogs?.some((l: any) => l.schedule_id === s.id) || false })));
    // Map Grooming
    if (groomingSched) combinedTasks = combinedTasks.concat(groomingSched.map((s: any) => ({ ...s, taskType: 'Grooming', is_completed: groomingLogs?.some((l: any) => l.schedule_id === s.id) || false })));
    
    // Map Quick Tasks
    if (rawQuickTasks) {
      const parsedQuick = rawQuickTasks.filter((t: any) => {
          const startDate = new Date(t.due_date);
          const current = new Date(localDateString);
          
          if (current < startDate && current.toDateString() !== startDate.toDateString()) return false;

          if (t.recurrence === 'none' || !t.recurrence) return t.due_date === localDateString;
          if (t.recurrence === 'daily') return true;
          if (t.recurrence === 'weekly') return current.getUTCDay() === startDate.getUTCDay();
          if (t.recurrence === 'monthly') return current.getUTCDate() === startDate.getUTCDate();
          return false;
      }).map((t: any) => {
          if (t.recurrence === 'none' || !t.recurrence) {
             return { ...t, time: t.due_time, taskType: 'QuickTask', is_completed: t.is_completed };
          } else {
             return { ...t, time: t.due_time, taskType: 'QuickTask', is_completed: quickLogs?.some((l: any) => l.task_id === t.id) || false };
          }
      });
      combinedTasks = combinedTasks.concat(parsedQuick);
    }

    // Sort chronologically
    combinedTasks.sort((a, b) => a.time.localeCompare(b.time));
    setTasks(combinedTasks);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTasks().then(() => setRefreshing(false));
  }, [session, selectedDate]);

  // Refetch when selectedDate changes
  useFocusEffect(useCallback(() => { fetchTasks(); }, [session, selectedDate]));

  const markAsCompleted = async (taskId: string, petId: string, taskType: string) => {
    if (!session?.user?.id) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: true } : t));

    if (taskType === 'QuickTask') {
       const task = tasks.find(t => t.id === taskId);
       if (task?.recurrence === 'none' || !task?.recurrence) {
         const { error } = await supabase.from('quick_tasks').update({ is_completed: true }).eq('id', taskId);
         if (error) { fetchTasks(); console.error(error); }
       } else {
         const localDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
         const payload = { task_id: taskId, user_id: session.user.id, date: localDateString };
         const { error } = await supabase.from('quick_task_logs').insert([payload]);
         if (error) { fetchTasks(); console.error(error); }
       }
       return;
    }

    const localDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
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
       const task = tasks.find(t => t.id === taskId);
       if (task?.recurrence === 'none' || !task?.recurrence) {
         const { error } = await supabase.from('quick_tasks').update({ is_completed: false }).eq('id', taskId);
         if (error) fetchTasks();
       } else {
         const localDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
         const { error } = await supabase.from('quick_task_logs').delete().eq('task_id', taskId).eq('date', localDateString);
         if (error) fetchTasks();
       }
       return;
    }

    const localDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    
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
  const selectedDayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const selectedMonthYear = selectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <View style={styles.container}>
      
      {/* HEADER TOP ROW */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{selectedDayName}</Text>
          <View style={styles.monthHeader}>
            <Text style={styles.monthHeaderText}>{selectedMonthYear.toUpperCase()}</Text>
            <FontAwesome5 name="chevron-right" size={12} color="#8E8E93" style={{marginLeft: 6}} />
          </View>
        </View>

        {/* FAB + BUTTON IN SAME HEADER */}
        <View style={styles.headerRight}>
           <Link href="/quick-task-modal" asChild>
             <TouchableOpacity style={styles.headerAddBtn}>
               <FontAwesome5 name="plus" size={18} color="#111" />
             </TouchableOpacity>
           </Link>
        </View>
      </View>

      {/* HORIZONTAL WEEK/DATE VIEW */}
      <View style={styles.dateStripWrapper}>
         <ScrollView 
           horizontal 
           showsHorizontalScrollIndicator={false} 
           contentContainerStyle={styles.dateStrip}
           ref={scrollViewRef}
         >
           {dateWindow.map((d, index) => {
             const isSelected = d.toDateString() === selectedDate.toDateString();
             const isToday = d.toDateString() === new Date().toDateString();
             const dayChar = d.toLocaleDateString('en-US', { weekday: 'narrow' }); // 'M', 'T', 'W'
             const dateNum = d.getDate();

             return (
               <TouchableOpacity 
                 key={index} 
                 style={[styles.dateItem, isSelected && styles.dateItemActive]}
                 onPress={() => setSelectedDate(d)}
               >
                 <Text style={[styles.dayChar, isSelected && styles.dayCharActive, isToday && { color: '#FF3B30' }]}>{dayChar}</Text>
                 <Text style={[styles.dateNum, isSelected && styles.dateNumActive, isToday && { color: '#FF3B30' }]}>{dateNum}</Text>
                 {isSelected && <View style={[styles.activeIndicator, isToday && { backgroundColor: '#FF3B30' }]} />}
               </TouchableOpacity>
             )
           })}
         </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nothing scheduled.</Text>
            <Text style={styles.emptySubtext}>You have a free calendar.</Text>
          </View>
        ) : (
          <>
            {/* PENDING / UPCOMING SECTION */}
            {pendingTasks.length === 0 ? (
               <View style={styles.allDoneContainer}>
                  <Text style={styles.allDoneText}>All caught up for this day. Great job!</Text>
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
    paddingTop: 65,
    paddingBottom: 16,
    backgroundColor: '#F9F9FB',
  },
  headerTop: {
    justifyContent: 'center',
  },
  headerRight: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: -130, // Position it floating to the right of the huge title, mimicking image 2
    bottom: 8,
  },
  monthHeaderText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Date Strip CSS
  dateStripWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#F9F9FB',
    paddingBottom: 16,
  },
  dateStrip: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dateItem: {
    width: 48,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderRadius: 16,
  },
  dateItemActive: {
    backgroundColor: '#F2F2F7',
  },
  dayChar: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '700',
    marginBottom: 4,
  },
  dayCharActive: {
    color: '#8E8E93',
  },
  dateNum: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '600',
  },
  dateNumActive: {
    color: '#111',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 8,
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 32,
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
