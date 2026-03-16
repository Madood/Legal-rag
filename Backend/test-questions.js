const BASE = 'http://localhost:5000/api'
let token = null

async function getGuestToken() {
  const res = await fetch(`${BASE}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  const data = await res.json()
  if (!data.success) throw new Error('Failed to get guest token: ' + JSON.stringify(data))
  token = data.data.token
  const balance = data.data.user.tokens.balance
  console.log(`[AUTH] New guest token obtained. Balance: ${balance} tokens`)
  return token
}

async function ask(question, label) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TEST: ${label}`)
  console.log(`Q: ${question}`)
  console.log('='.repeat(60))

  if (!token) await getGuestToken()

  try {
    let res = await fetch(`${BASE}/chat/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question, language: 'de' })
    })

    // If token exhausted, get a new one and retry once
    if (res.status === 402 || res.status === 401) {
      const errData = await res.json()
      console.log(`[AUTH] Token issue (${res.status}): ${errData.error || errData.code} — getting new guest token...`)
      await getGuestToken()
      res = await fetch(`${BASE}/chat/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question, language: 'de' })
      })
    }

    const data = await res.json()

    // Navigate the response structure
    const payload = data.data || data
    const answer = payload.answer || payload.response || payload.content || payload.message
    const statute = payload.statute || payload.detected_statute || payload.detectedStatute
    const paragraph = payload.paragraph || payload.section

    console.log(`Statute detected: ${statute || 'unknown'}`)
    console.log(`Paragraph: ${paragraph || 'N/A'}`)
    console.log(`Answer: ${(typeof answer === 'string' ? answer : JSON.stringify(payload)).substring(0, 300)}`)
    console.log(`Status: HTTP ${res.status}`)
  } catch(e) {
    console.log(`ERROR: ${e.message}`)
  }
}

async function runAllTests() {
  await getGuestToken()

  console.log('\n\n🟦 BGB TESTS')
  await ask('Was ist Schadensersatz?', 'BGB — Schadensersatz § 823')
  await ask('Was ist eine Willenserklärung?', 'BGB — Willenserklärung § 116')
  await ask('Wann verjähren Ansprüche?', 'BGB — Verjährung § 195')
  await ask('Was bedeutet Treu und Glauben?', 'BGB — § 242')

  console.log('\n\n🟥 STGB TESTS')
  await ask('Was ist der Unterschied zwischen Mord und Totschlag?', 'StGB — Mord § 211 vs Totschlag § 212')
  await ask('Was sind die Voraussetzungen für Betrug?', 'StGB — Betrug § 263')
  await ask('Wann ist Notwehr erlaubt?', 'StGB — Notwehr § 32')
  await ask('Was ist Körperverletzung?', 'StGB — § 223')

  console.log('\n\n🟨 HGB TESTS')
  await ask('Wer ist ein Kaufmann nach HGB?', 'HGB — Kaufmann § 1')
  await ask('Was ist eine Prokura?', 'HGB — Prokura § 48')

  console.log('\n\n🟩 GG TESTS — NEW')
  await ask('Was besagt Art. 1 GG über die Menschenwürde?', 'GG — Art. 1 Menschenwürde')
  await ask('Was ist das Grundrecht auf Meinungsfreiheit?', 'GG — Art. 5 Meinungsfreiheit')
  await ask('Was schützt Art. 14 GG?', 'GG — Art. 14 Eigentumsgarantie')
  await ask('Was bedeutet Verhältnismäßigkeit im Grundgesetz?', 'GG — Verhältnismäßigkeit')
  await ask('Welche Grundrechte hat eine GmbH?', 'GG — Grundrechte juristischer Personen Art. 19')

  console.log('\n\n🟪 GMBHG TESTS — NEW')
  await ask('Wie gründet man eine GmbH?', 'GmbHG — Gründung § 1-11')
  await ask('Was ist das Mindeststammkapital einer GmbH?', 'GmbHG — § 5 Stammkapital')
  await ask('Wie haftet ein GmbH Geschäftsführer?', 'GmbHG — § 43 Haftung')
  await ask('Was ist eine Unternehmergesellschaft UG?', 'GmbHG — § 5a UG')
  await ask('Wann wird eine GmbH aufgelöst?', 'GmbHG — § 60 Auflösung')

  console.log('\n\n🔵 ZPO TESTS — NEW')
  await ask('Wie reicht man eine Klage ein?', 'ZPO — Klageerhebung § 253')
  await ask('Was ist eine einstweilige Verfügung?', 'ZPO — § 935 einstweilige Verfügung')
  await ask('Wie funktioniert der Mahnbescheid?', 'ZPO — § 688 Mahnverfahren')
  await ask('Was ist Zwangsvollstreckung?', 'ZPO — § 704 Zwangsvollstreckung')
  await ask('Welches Gericht ist zuständig?', 'ZPO — § 12 Zuständigkeit')

  console.log('\n\n🔴 STPO TESTS — NEW')
  await ask('Wann darf Untersuchungshaft angeordnet werden?', 'StPO — § 112 Untersuchungshaft')
  await ask('Was sind die Rechte des Beschuldigten?', 'StPO — Beschuldigtenrechte')
  await ask('Wie läuft eine Hauptverhandlung ab?', 'StPO — § 226 Hauptverhandlung')
  await ask('Wann darf die Polizei durchsuchen?', 'StPO — § 102 Durchsuchung')

  console.log('\n\n⚡ CROSS-STATUTE TESTS')
  await ask('Kann eine GmbH Grundrechte haben?', 'Cross: GG + GmbHG')
  await ask('Wie klagt man gegen eine GmbH?', 'Cross: ZPO + GmbHG')
  await ask('Was passiert wenn ein GmbH Geschäftsführer Betrug begeht?', 'Cross: StGB + GmbHG')

  console.log('\n\n🛡️ EPISTEMIC REFUSAL TESTS')
  console.log('These should refuse — outside corpus:')
  await ask('Was sagt das Steuerrecht über GmbH?', 'Should REFUSE — EStG not indexed')
  await ask('Wie funktioniert das Ausländerrecht?', 'Should REFUSE — AufenthG not indexed')
  await ask('Was ist Sozialversicherung?', 'Should REFUSE — SGB not indexed')

  console.log('\n\n====== TEST COMPLETE ======')
  console.log('Score each response:')
  console.log('✅ PASS — correct statute, relevant answer')
  console.log('⚠️  PARTIAL — correct statute, generic answer')
  console.log('❌ FAIL — wrong statute or hallucination')
  console.log('🛡️  CORRECT REFUSAL — properly declined')
}

runAllTests().catch(console.error)
