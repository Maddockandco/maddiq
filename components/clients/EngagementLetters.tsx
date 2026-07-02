const { data: engagements } = await supabase
      .from('engagements')
      .select('type, fee, frequency')
      .eq('client_id', clientId)
      .eq('status', 'active')

    const firmName = (firmUser?.firms as any)?.name || 'Our Firm'
    const clientName = client?.name || 'Client'

    const servicesList = engagements && engagements.length > 0
      ? engagements.map(e => `- ${e.type.charAt(0).toUpperCase() + e.type.slice(1)}`).join('\n')
      : '- Services as agreed'

    const feeSummary = engagements && engagements.length > 0
      ? engagements.map(e => `${e.type.charAt(0).toUpperCase() + e.type.slice(1)}: £${e.fee} (${e.frequency})`).join('\n')
      : 'Fees as agreed separately'
