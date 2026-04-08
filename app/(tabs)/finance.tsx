import { StyleSheet, TouchableOpacity, ScrollView, View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import Colors from '../../constants/Colors';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

export default function FinanceTab() {
  const { session } = useAuth();
  const { colorScheme } = useThemeContext();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    fetchExpenses();
  }, [session]);

  const fetchExpenses = async () => {
    if (!session?.user?.id) return;
    
    // Natively fetches expenses. In a production app, we'd filter the last 30 days.
    const { data, error } = await supabase
      .from('pet_expenses')
      .select('*, pets(name)')
      .order('date', { ascending: false })
      .limit(50);
      
    if (data) setExpenses(data);
    setLoading(false);
  };

  const deleteExpense = async (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    await supabase.from('pet_expenses').delete().eq('id', id);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // Aggregate Data for Native Bar Visualization
  let totalSpent = 0;
  const categories: Record<string, number> = {
    Food: 0,
    Vet: 0,
    Toys: 0,
    Insurance: 0,
    Other: 0
  };

  expenses.forEach(e => {
    totalSpent += Number(e.amount);
    if (categories[e.category] !== undefined) {
      categories[e.category] += Number(e.amount);
    } else {
      categories.Other += Number(e.amount);
    }
  });

  const CAT_COLORS: Record<string, string> = {
    Food: '#FF9500', 
    Vet: '#34C759', 
    Toys: '#AF52DE', 
    Insurance: '#007AFF', 
    Other: '#8E8E93'
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.Text entering={FadeInDown.springify()} style={[styles.title, { color: colors.text }]}>The Pet Wallet</Animated.Text>
      
      <Animated.View entering={FadeInUp.delay(50).springify()} style={[styles.card, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
        <View style={styles.headerBlock}>
           <Text style={[styles.headerLabel, { color: colors.mutedText }]}>TOTAL SPENT</Text>
           <Text style={[styles.headerValue, { color: colors.text }]}>${totalSpent.toFixed(2)}</Text>
        </View>

        {totalSpent > 0 ? (
          <>
            {/* Native Stacked Horizontal Bar */}
            <View style={styles.stackedBarContainer}>
               {Object.entries(categories).map(([cat, val]) => {
                 if (val === 0) return null;
                 const pct = (val / totalSpent) * 100;
                 return (
                   <View key={cat} style={[styles.stackedSegment, { width: `${pct}%`, backgroundColor: CAT_COLORS[cat] }]} />
                 )
               })}
            </View>

            <View style={styles.legendContainer}>
              {Object.entries(categories).map(([cat, val]) => {
                if (val === 0) return null;
                const pct = ((val / totalSpent) * 100).toFixed(0);
                return (
                  <View key={cat} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CAT_COLORS[cat] }]} />
                    <Text style={[styles.legendText, { color: colors.mutedText }]}>{cat} ({pct}%)</Text>
                  </View>
                )
              })}
            </View>
          </>
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <FontAwesome5 name="wallet" size={32} color={colors.mutedText} style={{marginBottom: 12}} />
            <Text style={{color: colors.mutedText}}>No expenses logged yet.</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.logButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/finance/log-expense-modal')}
        >
          <FontAwesome5 name="plus" size={12} color="#FFFFFF" style={{marginRight: 8}} />
          <Text style={[styles.logButtonText, { color: '#FFFFFF' }]}>Log Expense</Text>
        </TouchableOpacity>
      </Animated.View>

      <Text style={[styles.listTitle, { color: colors.text }]}>Recent Transactions</Text>
      
      {expenses.length === 0 ? (
         <Text style={[styles.emptyText, { color: colors.mutedText }]}>The ledger is completely clean.</Text>
      ) : (
        <View style={[styles.listCard, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          {expenses.map((expense, i) => {
            const d = new Date(expense.date);
            const isLast = i === expenses.length - 1;

            return (
              <Animated.View entering={FadeInUp.delay(100 + (i * 30)).springify()} key={expense.id} style={[styles.historyRow, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]}>
                 <View style={[styles.iconCircle, { backgroundColor: `${CAT_COLORS[expense.category] || CAT_COLORS.Other}20` }]}>
                    <FontAwesome5 name="receipt" size={14} color={CAT_COLORS[expense.category] || CAT_COLORS.Other} />
                 </View>
                 <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.historyCategory, { color: colors.text }]}>
                      {expense.category}
                      {expense.pets?.name ? ` • ${expense.pets.name}` : ''}
                    </Text>
                    <Text style={[styles.historyDate, { color: colors.mutedText }]}>
                      {d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      {expense.notes && ` - ${expense.notes}`}
                    </Text>
                 </View>
                 <View style={{ alignItems: 'flex-end', flexDirection: 'row' }}>
                    <Text style={[styles.historyAmount, { color: colors.text }]}>${Number(expense.amount).toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => deleteExpense(expense.id)} style={{ padding: 8, marginLeft: 8 }}>
                       <FontAwesome5 name="trash" size={12} color="#FF3B30" />
                    </TouchableOpacity>
                 </View>
              </Animated.View>
            )
          })}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flexGrow: 1,
    paddingTop: 65,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 24,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 30,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerValue: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  stackedBarContainer: {
    height: 16,
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  stackedSegment: {
    height: '100%',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  logButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    marginLeft: 8,
  },
  listCard: {
    borderRadius: 20,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 3,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyCategory: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 13,
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    paddingLeft: 8,
    fontSize: 15,
  }
});
