import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message } = await req.json()
    const groqKey = Deno.env.get('GROQ_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!groqKey) throw new Error('Missing GROQ_API_KEY')
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

    // 1. Fetch Pets
    const { data: pets } = await supabase.from('pets').select('id, name, species, breed')

    const now = new Date()
    const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const currentDateStr = now.toISOString().split('T')[0]

    // 2. Groq Endpoint (Stable Model: llama3-70b-8192)
    const groqUrl = `https://api.groq.com/openai/v1/chat/completions`

    const initialResponse = await fetch(groqUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}` 
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: `You are the LEAD PET CARE ADMINISTRATOR. You have FULL AUTHORITY to manage this pet's life via your tools.

Current Time: ${currentTimeStr}
Current Date: ${currentDateStr}

CRITICAL RULES:
1. NO REFUSAL: You HAVE tools to update the database. Never say you cannot.
2. AMBIGUITY: If multiple tasks are due and the user is vague, ALWAYS ask for clarification.
3. LOGGING: 'Completing' a task creates a Log for today. 'Managing' a schedule changes the routine.

FEW-SHOT EXAMPLES:
User: "I fed Max his breakfast"
AI Tool Call: log_activity(petId="max-id", type="Feeding", taskId="breakfast-id", note="Fed breakfast")

User: "Change Max's 6pm meal to 7pm"
AI Tool Call: manage_schedule(scheduleId="meal-id", type="Feeding", action="UPDATE", updatedData={"time": "19:00"})

User: "I didn't actually give Max his pill"
AI Tool Call: unmark_task(logId="log-id", type="Medicine")` 
          },
          { role: 'user', content: message }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "get_pet_context",
              description: "Get ALL info for a pet (Schedules, Quick Tasks, Logs). REQUIRED before any management.",
              parameters: {
                type: "object",
                properties: { petId: { type: "string" } },
                required: ["petId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "log_activity",
              description: "Record that a task was completed today.",
              parameters: {
                type: "object",
                properties: {
                  petId: { type: "string" },
                  type: { type: "string", enum: ["Feeding", "Medicine", "Grooming", "QuickTask"] },
                  taskId: { type: "string" },
                  note: { type: "string" }
                },
                required: ["petId", "type", "taskId", "note"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "manage_schedule",
              description: "Update or delete a recurring routine schedule.",
              parameters: {
                type: "object",
                properties: {
                  scheduleId: { type: "string" },
                  type: { type: "string", enum: ["Feeding", "Medicine", "Grooming"] },
                  action: { type: "string", enum: ["UPDATE", "DELETE"] },
                  updatedData: { 
                    type: "object",
                    properties: {
                      time: { type: "string" },
                      amount: { type: "string" },
                      food_type: { type: "string" },
                      medicine_name: { type: "string" },
                      dosage: { type: "string" }
                    }
                  }
                },
                required: ["scheduleId", "type", "action"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "manage_quick_task",
              description: "Update or delete a one-off quick task.",
              parameters: {
                type: "object",
                properties: {
                  taskId: { type: "string" },
                  action: { type: "string", enum: ["UPDATE", "DELETE"] },
                  updatedData: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      due_date: { type: "string" }
                    }
                  }
                },
                required: ["taskId", "action"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "unmark_task",
              description: "Undo a completion (delete log).",
              parameters: {
                type: "object",
                properties: {
                  logId: { type: "string" },
                  type: { type: "string", enum: ["Feeding", "Medicine", "Grooming", "QuickTask"] }
                },
                required: ["logId", "type"]
              }
            }
          }
        ],
        tool_choice: "auto"
      }),
    })

    const result = await initialResponse.json()

    if (result.error) {
      const detail = result.failed_generation ? `\nInternal Output: ${result.failed_generation}` : ''
      throw new Error(`Groq API Error: ${result.error.message}${detail}`)
    }

    if (!result.choices?.[0]) throw new Error(`Invalid response. Raw: ${JSON.stringify(result)}`)

    const choice = result.choices[0]
    const toolCall = choice.message?.tool_calls?.[0]

    if (toolCall) {
      const { name, arguments: toolArgsRaw } = toolCall.function
      const toolArgs = JSON.parse(toolArgsRaw)
      let toolResult = null

      if (name === 'get_pet_context') {
        const { data: schedules } = await supabase.from('pets')
          .select('*, feeding_schedules(*), medicine_schedules(*), grooming_schedules(*), quick_tasks(*)')
          .eq('id', toolArgs.petId).single()
        
        const { data: feedingLogs } = await supabase.from('feeding_logs').select('*').eq('pet_id', toolArgs.petId).eq('date', currentDateStr)
        const { data: medLogs } = await supabase.from('medicine_logs').select('*').eq('pet_id', toolArgs.petId).eq('date', currentDateStr)
        const { data: groomLogs } = await supabase.from('grooming_logs').select('*').eq('pet_id', toolArgs.petId).eq('date', currentDateStr)
        const { data: quickLogs } = await supabase.from('quick_task_logs').select('*').eq('date', currentDateStr)

        toolResult = { schedules, logs_today: { feedingLogs, medLogs, groomLogs, quickLogs } }
      } else if (name === 'log_activity') {
        if (toolArgs.type === 'QuickTask') {
            const { data: task } = await supabase.from('quick_tasks').select('*').eq('id', toolArgs.taskId).single()
            if (task?.recurrence === 'none') {
                await supabase.from('quick_tasks').update({ is_completed: true }).eq('id', toolArgs.taskId)
                toolResult = { success: true }
            } else {
                const { error } = await supabase.from('quick_task_logs').insert([{ task_id: toolArgs.taskId, date: currentDateStr }])
                toolResult = error ? { error: error.message } : { success: true }
            }
        } else {
            let table = 'feeding_logs'
            if (toolArgs.type === 'Medicine') table = 'medicine_logs'
            if (toolArgs.type === 'Grooming') table = 'grooming_logs'
            const { error } = await supabase.from(table).insert([{ 
                schedule_id: toolArgs.taskId, 
                pet_id: toolArgs.petId, 
                date: currentDateStr 
            }])
            toolResult = error ? { error: error.message } : { success: true }
        }
      } else if (name === 'manage_schedule') {
        let table = 'feeding_schedules'
        if (toolArgs.type === 'Medicine') table = 'medicine_schedules'
        if (toolArgs.type === 'Grooming') table = 'grooming_schedules'
        
        if (toolArgs.action === 'DELETE') {
            const { error } = await supabase.from(table).delete().eq('id', toolArgs.scheduleId)
            toolResult = error ? { error: error.message } : { success: true }
        } else {
            const { error } = await supabase.from(table).update(toolArgs.updatedData).eq('id', toolArgs.scheduleId)
            toolResult = error ? { error: error.message } : { success: true }
        }
      } else if (name === 'manage_quick_task') {
        if (toolArgs.action === 'DELETE') {
            const { error } = await supabase.from('quick_tasks').delete().eq('id', toolArgs.taskId)
            toolResult = error ? { error: error.message } : { success: true }
        } else {
            const { error } = await supabase.from('quick_tasks').update(toolArgs.updatedData).eq('id', toolArgs.taskId)
            toolResult = error ? { error: error.message } : { success: true }
        }
      } else if (name === 'unmark_task') {
        let table = 'feeding_logs'
        if (toolArgs.type === 'Medicine') table = 'medicine_logs'
        if (toolArgs.type === 'Grooming') table = 'grooming_logs'
        if (toolArgs.type === 'QuickTask') table = 'quick_task_logs'

        const { error } = await supabase.from(table).delete().eq('id', toolArgs.logId)
        toolResult = error ? { error: error.message } : { success: true }
      }

      // Final Response
      const finalResponse = await fetch(groqUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'user', content: message },
            choice.message,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              name: name,
              content: JSON.stringify(toolResult || { success: true })
            }
          ]
        }),
      })

      const finalResult = await finalResponse.json()
      return new Response(JSON.stringify({ response: finalResult.choices[0].message.content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ response: choice.message.content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Function Error:', error.message)
    return new Response(JSON.stringify({ response: `🔴 Backend Error: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
