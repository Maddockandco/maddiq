const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

const EXTRACTION_PROMPT = `You are analyzing a receipt, invoice, or bill for a UK accounting system. Look at the attached document carefully and extract the following information as JSON only — no markdown fences, no commentary, no explanation, just the raw JSON object.

{
  "direction": "purchase" or "sale" — "purchase" if this business received/bought something (a supplier receipt or bill), "sale" if this business issued it to a customer,
  "vendor_or_customer_name": the name of the supplier (if a purchase) or customer (if a sale),
  "document_date": the document's date in YYYY-MM-DD format,
  "document_number": the invoice/receipt number if visible, otherwise null,
  "currency": ISO currency code, default "GBP" if not clearly stated otherwise,
  "subtotal": the net amount before VAT, as a number,
  "vat_amount": the total VAT amount, as a number (0 if no VAT is shown),
  "total_amount": the gross total, as a number,
  "line_items": an array of { "description": string, "quantity": number, "unit_price": number, "line_total": number } — do your best even if the document only shows a single total with no itemized breakdown, in which case return one line item covering the whole amount,
  "confidence": "high", "medium", or "low" — your own honest assessment of how confident you are in this extraction,
  "notes": a short string flagging anything unclear, illegible, or worth a human double-checking, or null if nothing stands out
}

If any field is genuinely not determinable from the document, use null rather than guessing at a specific value. Respond with the JSON object only.`

function getMediaType(fileName: string): { type: 'image' | 'document'; mediaType: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return { type: 'document', mediaType: 'application/pdf' }
  if (ext === 'png') return { type: 'image', mediaType: 'image/png' }
  if (ext === 'webp') return { type: 'image', mediaType: 'image/webp' }
  if (ext === 'gif') return { type: 'image', mediaType: 'image/gif' }
  return { type: 'image', mediaType: 'image/jpeg' } // covers jpg/jpeg, and a reasonable default
}

export async function extractDocumentData(fileBytes: ArrayBuffer, fileName: string) {
  const { type, mediaType } = getMediaType(fileName)
  const base64Data = Buffer.from(fileBytes).toString('base64')

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type,
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  if (!textBlock) {
    throw new Error('No text response from extraction')
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Could not parse extraction result as JSON: ${cleaned.slice(0, 200)}`)
  }
}
