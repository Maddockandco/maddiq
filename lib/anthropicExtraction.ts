const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

const EXTRACTION_PROMPT = `You are analyzing a receipt, invoice, or bill for a UK accounting system. Look at the attached document carefully (all pages) and extract the following information as JSON only — no markdown fences, no commentary, no explanation, just the raw JSON object.

{
  "direction": "purchase" or "sale" — "purchase" if this business received/bought something (a supplier receipt or bill), "sale" if this business issued it to a customer,
  "vendor_or_customer_name": the name of the supplier (if a purchase) or customer (if a sale),
  "document_date": the document's date in YYYY-MM-DD format,
  "document_number": the invoice/receipt number if visible, otherwise null,
  "currency": ISO currency code, default "GBP" if not clearly stated otherwise,
  "subtotal": the net amount before VAT, as a number,
  "vat_amount": the total VAT amount, as a number (0 only if the document genuinely shows no VAT at all - see the VAT detection rules below before defaulting to 0),
  "total_amount": the gross total, as a number,
  "line_items": an array of { "description": string, "quantity": number, "unit_price": number, "line_total": number, "vat_rate_percent": number or null } — do your best even if the document only shows a single total with no itemized breakdown, in which case return one line item covering the whole amount,
  "confidence": "high", "medium", or "low" — your own honest assessment of how confident you are in this extraction,
  "notes": a short string flagging anything unclear, illegible, or worth a human double-checking (including any VAT figures you had to reconcile or couldn't fully verify), or null if nothing stands out
}

VAT detection rules - read these carefully, this is the part most likely to be gotten wrong:
- Many UK wholesaler/cash-and-carry receipts (e.g. Booker, Costco, Bookers) show a single LETTER or short CODE per line in a "VAT" column (e.g. "A", "B", "Z", "S") instead of a percentage. These documents almost always include a rate legend or summary table, usually near the bottom, mapping each code to an actual percentage - for example a line reading "A: 0.00  437.85  0.00" and "B:20.00  17.98  3.60" means code A = 0% VAT and code B = 20% VAT. Find this legend and use it to set the correct vat_rate_percent on every line sharing that code. Do NOT assume every line is zero-rated just because most of them are.
- If some lines are food/grocery items (commonly zero-rated in the UK) and other lines on the SAME document are non-food (till rolls, gloves, cleaning products, packaging, equipment - commonly standard-rated), expect them to have DIFFERENT vat_rate_percent values even within the same invoice. Check each line's own code/rate indicator - don't apply one blanket rate to the whole document.
- If the document has an explicit VAT/goods summary broken out by rate band (a table showing goods and VAT totals per rate), that summary is the authoritative source of truth. The sum of your line-level VAT amounts (quantity × unit_price × vat_rate_percent/100) should reconcile with it. If they don't reconcile, trust the document's own summary totals for the top-level "vat_amount" field and say so in "notes" rather than silently returning a mismatched or zero figure.
- Never return "vat_amount": 0 when the document contains any visible non-zero VAT figure anywhere on it, even if you're unsure which specific lines it applies to - in that case, distribute it as best you can and flag your uncertainty in "notes" rather than dropping it entirely.

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
