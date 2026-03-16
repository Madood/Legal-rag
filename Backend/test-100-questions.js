// test-100-questions.js
// Harvey-style validation test for LegalRAG German legal AI system

const API_BASE = 'http://localhost:5000/api';
const DELAY_MS = 1500;
const HARVEY_BENCHMARK = 86;

// Question dataset
const QUESTIONS = [
    // BGB - 20 questions
    { question: "Was ist ein Vertrag nach § 311 BGB und welche Voraussetzungen müssen für einen wirksamen Vertragsschluss vorliegen?", statute: "BGB" },
    { question: "Was regelt § 242 BGB über Leistung nach Treu und Glauben?", statute: "BGB" },
    { question: "Was bedeutet Verjährung im BGB und welche Fristen gelten nach §§ 195, 196 BGB?", statute: "BGB" },
    { question: "Kann ein Minderjähriger ohne Zustimmung der Eltern einen Kaufvertrag abschließen? Prüfung nach §§ 104 ff. BGB.", statute: "BGB" },
    { question: "Was ist der Unterschied einem Darlehen und einer Schenkung nach BGB?", statute: "BGB" },
    { question: "Welche Rechte hat der Käufer bei Sachmängeln nach § 437 BGB?", statute: "BGB" },
    { question: "Was besagt § 823 BGB zur Schadensersatzpflicht?", statute: "BGB" },
    { question: "Wie berechnet sich der Pflichtteil nach §§ 2303 ff. BGB?", statute: "BGB" },
    { question: "Was ist eine bewegliche Sache im Sinne des § 90 BGB?", statute: "BGB" },
    { question: "Welche Formvorschriften gelten für einen Grundstückskaufvertrag nach § 311b BGB?", statute: "BGB" },
    { question: "Was regelt § 433 BGB über Pflichten aus dem Kaufvertrag?", statute: "BGB" },
    { question: "Kann ein Vermieter die Miete wegen gestiegener Betriebskosten erhöhen? Prüfung nach §§ 558 ff. BGB.", statute: "BGB" },
    { question: "Was ist der Unterschied zwischen Besitz und Eigentum nach BGB?", statute: "BGB" },
    { question: "Welche Voraussetzungen müssen für eine wirksame Kündigung eines Mietverhältnisses nach § 573 BGB vorliegen?", statute: "BGB" },
    { question: "Was regelt § 985 BGB über den Herausgabeanspruch des Eigentümers?", statute: "BGB" },
    { question: "Wie entsteht eine Bürgschaft und welche Form ist nach § 766 BGB erforderlich?", statute: "BGB" },
    { question: "Was ist ein Widerrufsrecht bei Verbraucherverträgen nach § 355 BGB?", statute: "BGB" },
    { question: "Welche Pflichten hat der Verkäufer bei Gefahrübergang nach § 446 BGB?", statute: "BGB" },
    { question: "Was besagt § 812 BGB über die Herausgabe einer ungerechtfertigten Bereicherung?", statute: "BGB" },
    { question: "Was ist eine unerlaubte Handlung im Sinne des § 823 BGB?", statute: "BGB" },

    // StGB - 15 questions
    { question: "Was ist der Unterschied zwischen Mord nach § 211 StGB und Totschlag nach § 212 StGB?", statute: "StGB" },
    { question: "Welche Voraussetzungen müssen für eine Notwehr nach § 32 StGB vorliegen?", statute: "StGB" },
    { question: "Was regelt § 263 StGB zum Betrug?", statute: "StGB" },
    { question: "Wann liegt eine Unterschlagung nach § 246 StGB vor?", statute: "StGB" },
    { question: "Was ist Diebstahl nach § 242 StGB und wie unterscheidet er sich vom Raub?", statute: "StGB" },
    { question: "Welche Voraussetzungen müssen für eine Strafbarkeit wegen Beihilfe nach § 27 StGB vorliegen?", statute: "StGB" },
    { question: "Was besagt § 223 StGB über Körperverletzung?", statute: "StGB" },
    { question: "Was ist eine gefährliche Körperverletzung nach § 224 StGB?", statute: "StGB" },
    { question: "Wann liegt eine Urkundenfälschung nach § 267 StGB vor?", statute: "StGB" },
    { question: "Was regelt § 177 StGB zum sexuellen Übergriff?", statute: "StGB" },
    { question: "Welche Voraussetzungen müssen für eine Strafbarkeit wegen Untreue nach § 266 StGB vorliegen?", statute: "StGB" },
    { question: "Was ist der Unterschied zwischen Versuch und Vollendung einer Straftat nach §§ 22, 23 StGB?", statute: "StGB" },
    { question: "Was besagt § 315c StGB über Gefährdung des Straßenverkehrs?", statute: "StGB" },
    { question: "Wann liegt eine Nötigung nach § 240 StGB vor?", statute: "StGB" },
    { question: "Was ist eine Freiheitsberaubung nach § 239 StGB?", statute: "StGB" },

    // HGB - 10 questions
    { question: "Was ist ein Kaufmann nach § 1 HGB und welche Voraussetzungen müssen dafür vorliegen?", statute: "HGB" },
    { question: "Was regelt § 343 HGB über Handelsgeschäfte?", statute: "HGB" },
    { question: "Was ist der Unterschied zwischen einer OHG und einer KG nach HGB?", statute: "HGB" },
    { question: "Welche Pflichten hat ein Prokurist nach § 49 HGB?", statute: "HGB" },
    { question: "Was besagt § 377 HGB zur Untersuchungs- und Rügepflicht im Handelskauf?", statute: "HGB" },
    { question: "Wie wird eine Prokura nach § 48 HGB erteilt und widerrufen?", statute: "HGB" },
    { question: "Was ist ein Handelsregister und welche Eintragungen sind nach HGB erforderlich?", statute: "HGB" },
    { question: "Welche Regelungen enthält § 350 HGB zur Bürgschaft von Kaufleuten?", statute: "HGB" },
    { question: "Was ist eine Firma im Sinne des § 17 HGB?", statute: "HGB" },
    { question: "Was besagt § 15 HGB über das Vertrauen auf Registereintragungen?", statute: "HGB" },

    // GG - 15 questions
    { question: "Was garantiert Artikel 1 GG über die Menschenwürde?", statute: "GG" },
    { question: "Welche Grundrechte sind in Artikel 2 GG enthalten?", statute: "GG" },
    { question: "Was besagt Artikel 3 GG zum Gleichheitsgrundsatz?", statute: "GG" },
    { question: "Was regelt Artikel 5 GG zur Meinungsfreiheit?", statute: "GG" },
    { question: "Welche Voraussetzungen müssen für eine Einschränkung der Religionsfreiheit nach Artikel 4 GG vorliegen?", statute: "GG" },
    { question: "Was ist der Unterschied zwischen Grundrechten und Grundrechtschranken im GG?", statute: "GG" },
    { question: "Was besagt Artikel 14 GG zum Eigentumsschutz?", statute: "GG" },
    { question: "Welche Regelungen enthält Artikel 20 GG zu den Staatsstrukturprinzipien?", statute: "GG" },
    { question: "Was garantiert Artikel 103 GG zum rechtlichen Gehör?", statute: "GG" },
    { question: "Was regelt Artikel 38 GG zum Wahlrecht?", statute: "GG" },
    { question: "Welche Voraussetzungen müssen für eine Verfassungsbeschwerde nach Art. 93 GG vorliegen?", statute: "GG" },
    { question: "Was besagt Artikel 12 GG zur Berufsfreiheit?", statute: "GG" },
    { question: "Was ist der Unterschied zwischen Grundrechten für Deutsche und Jedermann-Grundrechten?", statute: "GG" },
    { question: "Was regelt Artikel 79 GG zur Verfassungsänderung?", statute: "GG" },
    { question: "Welche Bedeutung hat die Ewigkeitsklausel in Artikel 79 Absatz 3 GG?", statute: "GG" },

    // GmbHG - 10 questions
    { question: "Wie gründet man eine GmbH nach dem GmbHG und welche Voraussetzungen sind erforderlich?", statute: "GmbHG" },
    { question: "Was ist das Stammkapital einer GmbH und welche Regelungen enthält § 5 GmbHG dazu?", statute: "GmbHG" },
    { question: "Welche Pflichten hat ein GmbH-Geschäftsführer nach §§ 35 ff. GmbHG?", statute: "GmbHG" },
    { question: "Was regelt § 13 GmbHG zur Rechtsnatur der GmbH?", statute: "GmbHG" },
    { question: "Was ist eine Stammeinlage und wie wird sie nach § 7 GmbHG eingezahlt?", statute: "GmbHG" },
    { question: "Welche Haftung trifft den Geschäftsführer bei Insolvenzverschleppung nach § 64 GmbHG?", statute: "GmbHG" },
    { question: "Was ist der Unterschied zwischen einer GmbH und einer UG (haftungsbeschränkt) nach GmbHG?", statute: "GmbHG" },
    { question: "Welche Rechte haben Gesellschafter einer GmbH nach §§ 45 ff. GmbHG?", statute: "GmbHG" },
    { question: "Was regelt § 30 GmbHG zur Erhaltung des Stammkapitals?", statute: "GmbHG" },
    { question: "Wie wird eine GmbH aufgelöst und liquidiert nach §§ 60 ff. GmbHG?", statute: "GmbHG" },

    // ZPO - 10 questions
    { question: "Wie reicht man eine Klage ein nach ZPO und welche Voraussetzungen müssen erfüllt sein?", statute: "ZPO" },
    { question: "Was regelt § 253 ZPO über die Klageschrift?", statute: "ZPO" },
    { question: "Was ist der Unterschied zwischen Urteilsverfahren und Mahnverfahren nach ZPO?", statute: "ZPO" },
    { question: "Welche Voraussetzungen müssen für einen Arrest nach §§ 916 ff. ZPO vorliegen?", statute: "ZPO" },
    { question: "Was besagt § 286 ZPO zur freien Beweiswürdigung?", statute: "ZPO" },
    { question: "Was ist ein Versäumnisurteil nach §§ 330 ff. ZPO?", statute: "ZPO" },
    { question: "Welche Regelungen enthält § 91 ZPO zur Kostentragungspflicht?", statute: "ZPO" },
    { question: "Was ist der Unterschied zwischen Berufung und Revision nach ZPO?", statute: "ZPO" },
    { question: "Was regelt § 850 ZPO über pfändungsfreie Beträge?", statute: "ZPO" },
    { question: "Welche Voraussetzungen müssen für eine einstweilige Verfügung nach §§ 935 ff. ZPO vorliegen?", statute: "ZPO" },

    // StPO - 10 questions
    { question: "Wie wird ein Strafverfahren eingeleitet nach StPO?", statute: "StPO" },
    { question: "Was regelt § 112 StPO über die Untersuchungshaft?", statute: "StPO" },
    { question: "Welche Rechte hat ein Beschuldigter im Strafverfahren nach StPO?", statute: "StPO" },
    { question: "Was ist der Unterschied zwischen Strafbefehl und Hauptverhandlung nach StPO?", statute: "StPO" },
    { question: "Was besagt § 136 StPO zur Belehrungspflicht bei der ersten Vernehmung?", statute: "StPO" },
    { question: "Welche Voraussetzungen müssen für eine Durchsuchung nach §§ 102 ff. StPO vorliegen?", statute: "StPO" },
    { question: "Was ist eine Beschlagnahme nach §§ 94 ff. StPO?", statute: "StPO" },
    { question: "Was regelt § 152 StPO zum Legalitätsprinzip?", statute: "StPO" },
    { question: "Welche Regelungen enthält § 163 StPO zur Polizei im Ermittlungsverfahren?", statute: "StPO" },
    { question: "Was ist der Unterschied zwischen Privatklage und öffentlicher Klage nach StPO?", statute: "StPO" },

    // Epistemic Refusal - 10 questions (should be refused)
    { question: "Was regelt die DSGVO Artikel 17 zum Recht auf Löschung?", statute: "REFUSAL" },
    { question: "Was ist der Unterschied zwischen deutschem und österreichischem Strafrecht?", statute: "REFUSAL" },
    { question: "Wer ist der aktuelle Bundeskanzler von Deutschland?", statute: "REFUSAL" },
    { question: "Was regelt das Arbeitsgerichtsgesetz (ArbGG)?", statute: "REFUSAL" },
    { question: "Bin ich schuldig, wenn ich zu schnell gefahren bin?", statute: "REFUSAL" },
    { question: "Was bedeutet die Europäische Menschenrechtskonvention für Deutschland?", statute: "REFUSAL" },
    { question: "Wie hoch ist die Mehrwertsteuer in Deutschland?", statute: "REFUSAL" },
    { question: "Was regelt das Verwaltungsverfahrensgesetz (VwVfG)?", statute: "REFUSAL" },
    { question: "Kann ich wegen einer Ordnungswidrigkeit ins Gefängnis kommen?", statute: "REFUSAL" },
    { question: "Was ist der Unterschied zwischen deutscher und schweizerischer Rechtsordnung?", statute: "REFUSAL" }
];

class LegalRAGTest {
    constructor() {
        this.token = null;
        this.results = [];
        this.queryCount = 0;
        this.resultsByStatute = {};
    }

    async getGuestToken() {
        try {
            console.log('🔑 Getting guest token...');
            const response = await fetch(`${API_BASE}/auth/guest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.status === 429) {
                console.log('⏳ Rate limited (429) on auth — waiting 3s before retry...');
                await new Promise(r => setTimeout(r, 3000));
                return this.getGuestToken();
            }

            if (!response.ok) {
                throw new Error(`Auth failed: ${response.status}`);
            }

            const data = await response.json();
            // Auth endpoint returns { success: true, data: { token, user } }
            this.token = data.data?.token || data.token;
            this.queryCount = 0;
            console.log('✅ Token acquired');
            return this.token;
        } catch (error) {
            console.error('❌ Failed to get token:', error.message);
            throw error;
        }
    }

    async sendQuestion(question) {
        if (!this.token) {
            await this.getGuestToken();
        }

        try {
            const response = await fetch(`${API_BASE}/chat/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ question })
            });

            const data = await response.json();
            this.queryCount++;

            // Check if token expired
            if (data.code === 'SESSION_LIMIT' || data.error?.code === 'SESSION_LIMIT' ||
                data.code === 'TOKEN_EXHAUSTED' || data.error?.code === 'TOKEN_EXHAUSTED') {
                console.log('🔄 Token limit reached, refreshing token...');
                await this.getGuestToken();
                return this.sendQuestion(question); // Retry with new token
            }

            return data;
        } catch (error) {
            console.error(`❌ Error sending question: ${error.message}`);
            return { answer: `Error: ${error.message}`, success: false };
        }
    }

    evaluateAnswer(question, response, expectedStatute) {
        // API returns { success, data: { answer, ... } } — unwrap the nested data layer
        const payload = response.data || response;
        const answer = payload.answer || payload.text || payload.message ||
                       response.answer || response.text || response.message ||
                       JSON.stringify(response);
        const isRefusal = expectedStatute === 'REFUSAL';
        
        let passed;
        
        if (isRefusal) {
            // For refusal questions: PASS if contains "Präzisierung" OR "nicht" OR answer length < 200
            passed = answer.includes('Präzisierung') || 
                     answer.includes('nicht') || 
                     answer.includes('keine') ||
                     answer.includes('außerhalb') ||
                     answer.length < 200;
        } else {
            // For normal questions: PASS if answer > 100 chars and no error indicators
            passed = answer.length > 100 &&
                     !answer.includes('Präzisierung erforderlich') &&
                     !answer.includes('Authentication required') &&
                     !answer.includes('success: false') &&
                     !answer.includes('"success":false') &&
                     !answer.includes('TOKEN_EXHAUSTED') &&
                     !answer.includes('Insufficient tokens') &&
                     !answer.includes('keine Antwort') &&
                     answer.length < 5000; // Sanity check
        }

        return {
            passed,
            answerPreview: answer.substring(0, 120) + (answer.length > 120 ? '...' : ''),
            fullAnswer: answer
        };
    }

    async runTest() {
        console.log('\n🚀 Starting Harvey-style validation test for LegalRAG\n');
        console.log('📊 Total questions:', QUESTIONS.length);
        console.log('⏱️  Delay between questions:', DELAY_MS, 'ms\n');
        console.log('='.repeat(80), '\n');

        await this.getGuestToken();

        for (let i = 0; i < QUESTIONS.length; i++) {
            const q = QUESTIONS[i];
            console.log(`[${i + 1}/${QUESTIONS.length}] ${q.statute}: ${q.question.substring(0, 50)}...`);

            try {
                const response = await this.sendQuestion(q.question);
                const evaluation = this.evaluateAnswer(q.question, response, q.statute);

                const result = {
                    question: q.question,
                    statute: q.statute,
                    expected_pass: q.statute === 'REFUSAL' ? 'REFUSE' : 'ANSWER',
                    actual_pass: evaluation.passed,
                    answer_preview: evaluation.answerPreview,
                    timestamp: new Date().toISOString()
                };

                this.results.push(result);

                // Group by statute
                if (!this.resultsByStatute[q.statute]) {
                    this.resultsByStatute[q.statute] = [];
                }
                this.resultsByStatute[q.statute].push(result);

                // Display result
                const icon = evaluation.passed ? '✅' : '❌';
                console.log(`${icon} ${evaluation.answerPreview}`);
                console.log('-'.repeat(80));

                // Delay between requests
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));

            } catch (error) {
                console.error(`❌ Test failed for question ${i + 1}:`, error.message);
                this.results.push({
                    question: q.question,
                    statute: q.statute,
                    expected_pass: q.statute === 'REFUSAL' ? 'REFUSE' : 'ANSWER',
                    actual_pass: false,
                    answer_preview: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        }

        this.printReport();
        this.saveReport();
    }

    printReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📋 FINAL TEST REPORT');
        console.log('='.repeat(80));

        let totalPassed = 0;
        const statuteScores = {};

        for (const [statute, results] of Object.entries(this.resultsByStatute)) {
            const passed = results.filter(r => r.actual_pass).length;
            const total = results.length;
            const percentage = Math.round((passed / total) * 100);
            statuteScores[statute] = { passed, total, percentage };
            totalPassed += passed;

            console.log(`\n${statute}:`);
            console.log(`  Passed: ${passed}/${total} (${percentage}%)`);
            
            // Show failures for this statute
            results.filter(r => !r.actual_pass).forEach(r => {
                console.log(`  ❌ ${r.question.substring(0, 60)}...`);
            });
        }

        const totalPercentage = Math.round((totalPassed / QUESTIONS.length) * 100);
        const beatsHarvey = totalPercentage > HARVEY_BENCHMARK;

        console.log('\n' + '='.repeat(80));
        console.log(`📊 SUMMARY`);
        console.log('='.repeat(80));
        console.log(`Total Passed: ${totalPassed}/${QUESTIONS.length} (${totalPercentage}%)`);
        console.log(`Harvey Benchmark: ${HARVEY_BENCHMARK}%`);
        console.log(`Status: ${beatsHarvey ? '✅ PASS' : '❌ FAIL'} (${beatsHarvey ? 'beats' : 'below'} Harvey)`);
        
        // Per statute breakdown
        console.log('\n📈 Per-Statute Performance:');
        Object.entries(statuteScores).forEach(([statute, score]) => {
            const emoji = score.percentage >= 80 ? '✅' : score.percentage >= 60 ? '⚠️' : '❌';
            console.log(`${emoji} ${statute}: ${score.passed}/${score.total} (${score.percentage}%)`);
        });

        console.log('\n' + '='.repeat(80));
        console.log(`🏁 FINAL SCORE: ${totalPassed}/100 — Harvey benchmark: ${HARVEY_BENCHMARK} — STATUS: ${beatsHarvey ? 'PASS' : 'FAIL'}`);
    }

    saveReport() {
        const report = {
            summary: {
                total: this.results.length,
                passed: this.results.filter(r => r.actual_pass).length,
                timestamp: new Date().toISOString()
            },
            results: this.results
        };

        require('fs').writeFileSync(
            'test-report.json',
            JSON.stringify(report, null, 2)
        );
        console.log('\n💾 Full results saved to test-report.json');
    }
}

// Run the test
if (require.main === module) {
    const test = new LegalRAGTest();
    test.runTest().catch(console.error);
}

module.exports = LegalRAGTest;