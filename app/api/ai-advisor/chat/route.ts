import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildClientFinancialContext, getApprovedIndustryKnowledge, buildSystemPrompt, extractGeneralizableInsight, ADVISOR_TOOLS, executeSearchPurchaseLines, executeSearchSalesLines, executeSearchPurchaseBills, executeSearchSalesInvoices } from '@/lib/aiAdvisor'
import { detectIndustry } from '@/lib/industryDetection'

export async function POST(req: NextRequest) {
  const { clientId, conversationId, message } = (await req.json()) as {
    clientId: string
    conversationId: string | null
    message: string
  }

  if (!clientId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing clientId or message' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user.id).single()
  if (!firmUser) {
    return NextResponse.json({ error: 'Could not find your firm' }, { status: 400 })
  }

  const { data: client } = await supabase.from('clients').select('sic_code, industry').eq('id', clientId).single()
  const industry = detectIndustry(client?.sic_code, client?.industry) || 'general'

  try {
    // Load or create the conversation
    let convId = conversationId
    let history: { role: 'user' | 'assistant'; content: string }[] = []

    if (convId) {
      const { data: messages } = await supabase
        .from('ai_advisor_messages')
        .select('role, content')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
      history = messages || []
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('ai_advisor_conversations')
        .insert({ firm_id: firmUser.firm_id, client_id: clientId, industry, created_by: user.id, title: message.slice(0, 80) })
        .select()
        .single()
      if (convError || !newConv) throw new Error(convError?.message || 'Could not start conversation')
      convId = newConv.id
    }

    const context = await buildClientFinancialContext(clientId, supabase, industry)
    const knowledge = await getApprovedIndustryKnowledge(firmUser.firm_id, industry, supabase)
    const systemPrompt = buildSystemPrompt(context, knowledge)

    // The conversation sent to Anthropic (including any tool-use turns) is
    // ephemeral per-request - only the final user message and final
    // assistant text reply get persisted to ai_advisor_messages, keeping the
    // stored conversation readable.
    let anthropicMessages: any[] = [...history, { role: 'user', content: message }]
    let reply = ''

    for (let i = 0; i < 5; i++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 1000,
          system: systemPrompt,
          messages: anthropicMessages,
          tools: ADVISOR_TOOLS,
        }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`AI advisor request failed: ${errBody}`)
      }

      const data = await res.json()
      const toolUseBlocks = (data.content || []).filter((c: any) => c.type === 'tool_use')

      if (toolUseBlocks.length === 0) {
        reply = (data.content || []).find((c: any) => c.type === 'text')?.text || 'Sorry, I could not generate a response.'
        break
      }

      anthropicMessages.push({ role: 'assistant', content: data.content })

      const toolResults = []
      for (const block of toolUseBlocks) {
        let result: any = []
        if (block.name === 'search_purchase_lines') {
          result = await executeSearchPurchaseLines(clientId, block.input.keyword, block.input.months_back, supabase)
        } else if (block.name === 'search_sales_lines') {
          result = await executeSearchSalesLines(clientId, block.input.keyword, block.input.months_back, supabase)
        } else if (block.name === 'search_purchase_bills') {
          result = await executeSearchPurchaseBills(clientId, block.input.query, block.input.months_back, supabase)
        } else if (block.name === 'search_sales_invoices') {
          result = await executeSearchSalesInvoices(clientId, block.input.query, block.input.months_back, supabase)
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
      }

      anthropicMessages.push({ role: 'user', content: toolResults })
    }

    if (!reply) reply = "Sorry, I wasn't able to finish that - try rephrasing or asking something narrower."

    await supabase.from('ai_advisor_messages').insert([
      { conversation_id: convId, role: 'user', content: message },
      { conversation_id: convId, role: 'assistant', content: reply },
    ])
    await supabase.from('ai_advisor_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)

    // Fire-and-forget: extract any generalizable insight for this industry's
    // knowledge base. Never blocks the user's actual reply on this.
    extractGeneralizableInsight(message, reply)
      .then(async (insight) => {
        if (!insight) return
        await supabase.from('ai_advisor_industry_knowledge').insert({
          firm_id: firmUser.firm_id,
          industry,
          insight,
          status: 'pending_review',
          source_conversation_id: convId,
        })
      })
      .catch(() => {})

    return NextResponse.json({ conversationId: convId, reply, industry })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
