import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractDocumentData } from '@/lib/anthropicExtraction'

export async function POST(req: NextRequest) {
  const { extractionId } = await req.json()
  if (!extractionId) {
    return NextResponse.json({ error: 'Missing extractionId' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const supabase = bearerToken
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      )
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: extraction } = await supabase
    .from('document_extractions')
    .select('*')
    .eq('id', extractionId)
    .single()

  if (!extraction) {
    return NextResponse.json({ error: 'Extraction record not found' }, { status: 404 })
  }

  await supabase.from('document_extractions').update({ status: 'processing' }).eq('id', extractionId)

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(extraction.file_path)

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message || 'Could not download the file from storage')
    }

    const fileBytes = await fileBlob.arrayBuffer()
    const extractedData = await extractDocumentData(fileBytes, extraction.file_name)

    await supabase
      .from('document_extractions')
      .update({ status: 'extracted', extracted_data: extractedData, error_message: null, updated_at: new Date().toISOString() })
      .eq('id', extractionId)

    return NextResponse.json({ extractedData })
  } catch (err: any) {
    await supabase
      .from('document_extractions')
      .update({ status: 'failed', error_message: err.message, updated_at: new Date().toISOString() })
      .eq('id', extractionId)

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
