import { GOODS_CATEGORY_OPTIONS, FlatRateGoodsCategory } from '@/lib/limitedCostTrader'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

const PROMPT_TEMPLATE = (accountName: string, accountType: string) => `You are helping categorise a UK accounting Chart of Accounts entry for HMRC's VAT Flat Rate Scheme "Limited Cost Trader" test.

Account name: "${accountName}"
Account type: "${accountType}"

Choose exactly one category from this list:
- qualifying_good: a genuine physical good/stock/material purchase that counts toward HMRC's 2% / £1,000 test
- excluded_capital: capital expenditure (equipment, vehicles, property bought as an asset)
- excluded_food_drink: food or drink for consumption by the business or its staff
- excluded_vehicle_fuel: vehicles, vehicle parts, or fuel (this is excluded UNLESS the account name suggests the business's actual trade is vehicles - e.g. a taxi firm, courier, or haulage company buying fuel to resell/deliver, in which case treat it as qualifying_good)
- excluded_digital: software, subscriptions, SaaS, or any digital/electronic service
- service: anything that isn't a physical good at all (rent, fees, insurance, utilities, subscriptions services, labour, etc.)

Respond with JSON only, no markdown fences, no commentary:
{
  "category": one of the exact strings above,
  "reasoning": a short one-sentence explanation a UK accountant would find useful
}`

export interface GoodsCategorySuggestion {
  category: FlatRateGoodsCategory
  reasoning: string
}

export async function suggestGoodsCategory(accountName: string, accountType: string): Promise<GoodsCategorySuggestion> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: PROMPT_TEMPLATE(accountName, accountType) }],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((c: any) => c.type === 'text')
  if (!textBlock) {
    throw new Error('No text response from category suggestion')
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Could not parse category suggestion as JSON: ${cleaned.slice(0, 200)}`)
  }

  if (!GOODS_CATEGORY_OPTIONS.includes(parsed.category)) {
    throw new Error(`Model returned an unrecognised category: ${parsed.category}`)
  }

  return { category: parsed.category, reasoning: parsed.reasoning || '' }
}
