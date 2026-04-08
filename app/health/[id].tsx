import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { useThemeContext } from '../../contexts/ThemeContext';
import Colors from '../../constants/Colors';
import Animated, { FadeInUp } from 'react-native-reanimated';

const SEVERITY_LEVELS = [
  { level: 0, label: 'None', color: '#34C759' }, // Green
  { level: 1, label: 'Mild', color: '#FFCC00' }, // Yellow
  { level: 2, label: 'Moderate', color: '#FF9500' }, // Orange
  { level: 3, label: 'Severe', color: '#FF3B30' }, // Red
];

export default function PetHealthScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { colorScheme } = useThemeContext();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [pet, setPet] = useState<any>(null);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [allergyLogs, setAllergyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealthData = async () => {
    if (!id || !session?.user?.id) return;
    
    const { data: petData } = await supabase.from('pets').select('name').eq('id', id).single();
    if (petData) setPet(petData);

    // Fetch Weights
    const { data: wLogData, error: wError } = await supabase
      .from('pet_weight_logs')
      .select('*')
      .eq('pet_id', id)
      .order('date', { ascending: true }); // Chronological for graph

    if (!wError && wLogData) {
      setWeightLogs(wLogData);
    }

    // Fetch Allergies
    const { data: aLogData, error: aError } = await supabase
      .from('pet_allergy_logs')
      .select('*')
      .eq('pet_id', id)
      .order('date', { ascending: false }); // Reverse chronological for list

    if (!aError && aLogData) {
      setAllergyLogs(aLogData);
    }

    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchHealthData(); }, [id]));

  const handleDeleteLog = (logId: string) => {
    Alert.alert("Remove Entry", "Remove this weight record?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive", 
        onPress: async () => {
          const { error } = await supabase.from('pet_weight_logs').delete().eq('id', logId);
          if (error) Alert.alert('Error', error.message);
          else fetchHealthData();
        }
      }
    ]);
  };

  const handleDeleteAllergyLog = (logId: string) => {
    Alert.alert("Remove Entry", "Remove this allergy symptom diary entry?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive", 
        onPress: async () => {
          const { error } = await supabase.from('pet_allergy_logs').delete().eq('id', logId);
          if (error) Alert.alert('Error', error.message);
          else fetchHealthData();
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // Pure Native CSS Bar Graph logic 
  const absoluteMax = weightLogs.length > 0 ? Math.max(...weightLogs.map(l => l.weight)) : 10;
  const maxRenderWeight = absoluteMax * 1.15; 
  const displayLogs = weightLogs.slice(-8); 

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: pet ? `${pet.name}'s Health` : 'Health Hub',
          headerBackTitle: 'Back',
        }} 
      />
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
        
        {/* WEIGHT ENGINE */}
        <Text style={[styles.title, { color: colors.text }]}>Weight Tracking</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          {weightLogs.length === 0 ? (
            <View style={styles.emptyChart}>
               <FontAwesome5 name="weight" size={32} color={colors.mutedText} style={{marginBottom: 12}} />
               <Text style={[styles.emptyText, { color: colors.text }]}>No weight data yet.</Text>
               <Text style={[styles.emptySubText, { color: colors.mutedText }]}>Log a weigh-in to render the chart.</Text>
            </View>
          ) : (
            <>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartHeaderLabel, { color: colors.mutedText }]}>Latest Weight</Text>
                <Text style={[styles.chartHeaderValue, { color: colors.text }]}>{weightLogs[weightLogs.length - 1].weight} <Text style={{fontSize: 16, color: colors.mutedText}}>kg</Text></Text>
              </View>

              {/* CSS Flexbox Bar Chart */}
              <View style={[styles.chartContainer, { borderBottomColor: colors.border }]}>
                {displayLogs.map((log, index) => {
                  const heightPct = Math.max(2, (log.weight / maxRenderWeight) * 100); 
                  const isLatest = index === displayLogs.length - 1;
                  const dateObj = new Date(log.date);
                  
                  return (
                    <Animated.View key={log.id} style={styles.chartColumn} entering={FadeInUp.delay(50 * index).springify()}>
                      <View style={styles.chartBarWrapper}>
                        <View style={[
                          styles.chartBar, 
                          { height: `${heightPct}%`, backgroundColor: colors.pillPrimary },
                          isLatest && { backgroundColor: colors.tint } 
                        ]} />
                      </View>
                      <Text style={[styles.chartDateLabel, { color: colors.mutedText }, isLatest && { color: colors.text }]}>
                         {dateObj.getMonth() + 1}/{dateObj.getDate()}
                      </Text>
                      <Text style={[styles.chartWeightLabel, { color: colors.mutedText }, isLatest && { color: colors.tint }]}>
                         {log.weight}
                      </Text>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity 
            style={[styles.logButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push(`/health/log-weight-modal?pet_id=${id}`)}
          >
            <FontAwesome5 name="plus" size={12} color="#FFFFFF" style={{marginRight: 8}} />
            <Text style={[styles.logButtonText, { color: '#FFFFFF' }]}>Log Weight</Text>
          </TouchableOpacity>
        </View>

        {weightLogs.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
            <Text style={[styles.listTitle, { color: colors.text }]}>Weight History</Text>
            {weightLogs.slice().reverse().map((log, i) => {
               const d = new Date(log.date);
               return (
                 <View key={log.id} style={[styles.historyRow, { borderBottomColor: colors.border }, i === weightLogs.length - 1 && { borderBottomWidth: 0 }]}>
                    <View>
                       <Text style={[styles.historyWeight, { color: colors.text }]}>{log.weight} kg</Text>
                       <Text style={[styles.historyDate, { color: colors.mutedText }]}>{d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                       {!!log.notes && <Text style={[styles.historyNotes, { color: colors.mutedText }]}>{log.notes}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteLog(log.id)}>
                       <FontAwesome5 name="trash" size={14} color="#FF3B30" />
                    </TouchableOpacity>
                 </View>
               )
            })}
          </View>
        )}

        {/* ALLERGY ENGINE */}
        <Text style={[styles.title, { marginTop: 12, color: colors.text }]}>Allergy Diary</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          {allergyLogs.length === 0 ? (
            <View style={styles.emptyChart}>
               <FontAwesome5 name="allergies" size={32} color={colors.mutedText} style={{marginBottom: 12}} />
               <Text style={[styles.emptyText, { color: colors.text }]}>No allergy reactions tracked.</Text>
               <Text style={[styles.emptySubText, { color: colors.mutedText }]}>Log an episode to establish a baseline.</Text>
            </View>
          ) : (
            <>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartHeaderLabel, { color: colors.mutedText }]}>Latest Reaction</Text>
                {(() => {
                  const latestLog = allergyLogs[0];
                  const latestMeta = SEVERITY_LEVELS.find(s => s.level === latestLog.severity) || SEVERITY_LEVELS[0];
                  return (
                    <Text style={[styles.chartHeaderValue, { fontSize: 32, color: latestMeta.color, marginTop: 4 }]}>
                      {latestMeta.label}
                    </Text>
                  )
                })()}
              </View>

              {/* Allergy CSS Bar Chart */}
              <View style={[styles.chartContainer, { height: 140, borderBottomColor: colors.border }]}>
                {allergyLogs.slice(0, 8).reverse().map((log, index, arr) => {
                  const severityMeta = SEVERITY_LEVELS.find(s => s.level === log.severity) || SEVERITY_LEVELS[0];
                  // Calculate height visually based on 0-3 scale. (0 = 10%, 1=40%, 2=70%, 3=100%)
                  const heightPct = log.severity === 0 ? 8 : (log.severity / 3) * 100;
                  const isLatest = index === arr.length - 1;
                  const dateObj = new Date(log.date);

                  return (
                    <Animated.View key={`chart-${log.id}`} style={styles.chartColumn} entering={FadeInUp.delay(50 * index).springify()}>
                      <View style={styles.chartBarWrapper}>
                        <View style={[
                          styles.chartBar, 
                          { height: `${heightPct}%`, backgroundColor: severityMeta.color, opacity: isLatest ? 1 : 0.6 }
                        ]} />
                      </View>
                      <Text style={[styles.chartDateLabel, { color: colors.mutedText }, isLatest && { color: colors.text }]}>
                         {dateObj.getMonth() + 1}/{dateObj.getDate()}
                      </Text>
                    </Animated.View>
                  );
                })}
              </View>

              <View style={{ marginBottom: 16 }}>
                 {allergyLogs.map((log, i) => {
                    const severityMeta = SEVERITY_LEVELS.find(s => s.level === log.severity) || SEVERITY_LEVELS[0];
                    const d = new Date(log.date);
                    
                    return (
                       <View key={log.id} style={[styles.historyRow, { borderBottomColor: colors.border }, i === allergyLogs.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={{ flexDirection: 'row', flex: 1, paddingRight: 10 }}>
                             <View style={[styles.colorDot, { backgroundColor: severityMeta.color }]} />
                             <View style={{ flex: 1 }}>
                                <Text style={[styles.historyWeight, { color: severityMeta.color }]}>
                                  {severityMeta.label}
                                </Text>
                                <Text style={[styles.historyDate, { color: colors.mutedText }]}>{d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                {(log.symptoms || log.notes) && (
                                   <Text style={[styles.historyNotes, { color: colors.mutedText }]}>
                                      {log.symptoms ? `Symptoms: ${log.symptoms}` : ''}
                                      {log.symptoms && log.notes ? '\n' : ''}
                                      {log.notes ? `Notes: ${log.notes}` : ''}
                                   </Text>
                                )}
                             </View>
                          </View>
                          <TouchableOpacity onPress={() => handleDeleteAllergyLog(log.id)} style={{ padding: 8 }}>
                             <FontAwesome5 name="trash" size={14} color="#FF3B30" />
                          </TouchableOpacity>
                       </View>
                    )
                 })}
              </View>
            </>
          )}

          <TouchableOpacity 
            style={[styles.logButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push(`/health/log-allergy-modal?pet_id=${id}`)}
          >
            <FontAwesome5 name="plus" size={12} color="#FFFFFF" style={{marginRight: 8}} />
            <Text style={[styles.logButtonText, { color: '#FFFFFF' }]}>Log Reaction</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F9F9FB',
    flexGrow: 1,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 24,
  },
  emptyChart: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  chartHeader: {
    marginBottom: 24,
  },
  chartHeaderLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartHeaderValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -1.5,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 180, // strict height for chart zone
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 40, 
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 20,
  },
  chartColumn: {
    alignItems: 'center',
    width: 32,
    height: '100%',
  },
  chartBarWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    width: 24,
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#EAEAEA',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  chartBarLatest: {
    backgroundColor: '#007AFF', // highlight most recent
  },
  chartDateLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    fontWeight: '600',
  },
  chartDateLabelLatest: {
    color: '#111',
  },
  chartWeightLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    fontWeight: '500',
  },
  chartWeightLabelLatest: {
    color: '#007AFF',
    fontWeight: '700',
  },
  logButton: {
    backgroundColor: '#111',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    marginBottom: 24,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyWeight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
    marginTop: 4,
  },
});
