import { supabase } from "./supabase.js";

export async function listPets() {
  const { data, error } = await supabase.from("pets").select("id, name, species, breed");
  if (error) throw error;
  return data;
}

export async function getPetDetails(petId: string) {
  const { data, error } = await supabase
    .from("pets")
    .select("*, feeding_schedules(*), medicine_schedules(*), grooming_schedules(*), pet_weight_logs(*)")
    .eq("id", petId)
    .single();
  if (error) throw error;
  return data;
}

export async function addFeedingLog(petId: string, scheduleId: string | null, userId: string, amount: string, foodType: string) {
  const localDateString = new Date().toISOString().split('T')[0];
  const payload = {
    pet_id: petId,
    schedule_id: scheduleId,
    user_id: userId,
    date: localDateString,
    amount,
    food_type: foodType
  };
  const { data, error } = await supabase.from("feeding_logs").insert([payload]);
  if (error) throw error;
  return data;
}

export async function logWeight(petId: string, userId: string, weight: number, notes?: string) {
  const payload = {
    pet_id: petId,
    user_id: userId,
    weight,
    date: new Date().toISOString(),
    notes: notes || ""
  };
  const { data, error } = await supabase.from("pet_weight_logs").insert([payload]);
  if (error) throw error;
  return data;
}

export async function getHouseholdActivity() {
  // Aggregate recent logs across all pets
  const { data: feeding } = await supabase.from("feeding_logs").select("*, profiles(display_name), pets(name)").order('created_at', { ascending: false }).limit(5);
  const { data: weight } = await supabase.from("pet_weight_logs").select("*, profiles(display_name), pets(name)").order('created_at', { ascending: false }).limit(5);
  
  return {
    recentFeeding: feeding,
    recentWeightLogs: weight
  };
}

export async function getHealthTrends(petId: string) {
  const { data: weightLogs, error: weightError } = await supabase
    .from("pet_weight_logs")
    .select("*")
    .eq("pet_id", petId)
    .order('date', { ascending: true });

  const { data: medicineLogs, error: medError } = await supabase
    .from("medicine_logs")
    .select("*")
    .eq("pet_id", petId)
    .order('date', { ascending: false });

  if (weightError || medError) throw weightError || medError;

  return {
    weightHistory: weightLogs,
    recentMedications: medicineLogs,
    note: "AI should analyze weight change over time and check medication adherence."
  };
}
