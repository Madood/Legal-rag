// Re-ingestion script for BGB, HGB, StGB
// Run: node Backend/reingest.js
//
// PDFs are at: documents/german_law/German-Civilcode/{dir}/{file}.pdf
// Python ingestion endpoint: POST http://localhost:8000/api/ingestion/{statute}

const fs = require('fs')
const path = require('path')

const PYTHON = 'http://localhost:8000'

// PDF locations relative to repo root
const STATUTES_TO_INGEST = [
  {
    statute: 'BGB',
    pdfPath: path.resolve(__dirname, '../documents/german_law/German-Civilcode/bgb/BGB.pdf')
  },
  {
    statute: 'HGB',
    pdfPath: path.resolve(__dirname, '../documents/german_law/German-Civilcode/hgb/HGB.pdf')
  },
  {
    statute: 'STGB',
    pdfPath: path.resolve(__dirname, '../documents/german_law/German-Civilcode/Stgb/stgb.pdf')
  }
]

async function checkStatus() {
  console.log('Checking current corpus status...')
  try {
    const res = await fetch(`${PYTHON}/api/ingestion/status`)
    const data = await res.json()
    console.log('Corpus status:', JSON.stringify(data, null, 2))
  } catch (e) {
    console.log(`Status check failed: ${e.message}`)
    console.log('Make sure Python service is running on port 8000')
  }
}

async function ingestStatute(statute, pdfPath) {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Ingesting ${statute}...`)
  console.log(`PDF: ${pdfPath}`)

  if (!fs.existsSync(pdfPath)) {
    console.log(`❌ File not found: ${pdfPath}`)
    return false
  }

  const fileSize = fs.statSync(pdfPath).size
  console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`)

  // Use FormData with Blob (Node 18+ built-in)
  const formData = new FormData()
  const fileBuffer = fs.readFileSync(pdfPath)
  const blob = new Blob([fileBuffer], { type: 'application/pdf' })
  formData.append('file', blob, path.basename(pdfPath))

  const endpoint = `${PYTHON}/api/ingestion/${statute.toLowerCase()}`
  console.log(`POST ${endpoint}`)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    })

    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text.substring(0, 300) }
    }

    console.log(`Status: HTTP ${res.status}`)
    console.log(`Response:`, JSON.stringify(data, null, 2).substring(0, 500))

    if (res.ok) {
      console.log(`✅ ${statute} ingestion complete`)
      return true
    } else {
      console.log(`❌ ${statute} ingestion failed (HTTP ${res.status})`)
      return false
    }
  } catch (e) {
    console.log(`❌ ${statute} error: ${e.message}`)
    return false
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   LegalRAG — Re-ingest BGB, HGB, StGB               ║')
  console.log('╚══════════════════════════════════════════════════════╝')

  await checkStatus()

  const results = []
  for (const { statute, pdfPath } of STATUTES_TO_INGEST) {
    const ok = await ingestStatute(statute, pdfPath)
    results.push({ statute, ok })
    // Wait between ingestions — these are CPU-heavy
    if (ok) {
      console.log('Waiting 5s before next ingestion...')
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   Ingestion Summary                                  ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  for (const { statute, ok } of results) {
    const icon = ok ? '✅' : '❌'
    console.log(`║  ${icon} ${statute.padEnd(50)}║`)
  }
  console.log('╚══════════════════════════════════════════════════════╝')

  console.log('\nAfter ingestion, restart Python service and check logs for:')
  console.log('  ✅ BGB:  5000+ vectors')
  console.log('  ✅ HGB:  2000+ vectors')
  console.log('  ✅ STGB: 1600+ vectors')

  // Re-check status
  console.log('\nFinal corpus status:')
  await checkStatus()
}

main().catch(console.error)
