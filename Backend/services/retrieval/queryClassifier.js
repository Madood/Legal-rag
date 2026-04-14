/**
 * queryClassifier.js — lightweight query intent detection
 * Currently handles EBV (Eigentümer-Besitzer-Verhältnis) detection.
 */

/**
 * Returns true when the question is about the EBV (§§987–1003 BGB).
 * Matches: "EBV", "Eigentümer-Besitzer", §987/§988…§1003, "Vindikation",
 * and common exam phrasings.
 */
function isEBVQuestion(question) {
  if (!question) return false;
  const q = question.toLowerCase();

  const SIGNALS = [
    'ebv',
    'eigentümer-besitzer',
    'eigentümer besitzer',
    'vindikationslage',
    '§ 987', '§987',
    '§ 988', '§988',
    '§ 989', '§989',
    '§ 990', '§990',
    '§ 991', '§991',
    '§ 992', '§992',
    '§ 993', '§993',
    '§ 994', '§994',
    '§ 995', '§995',
    '§ 996', '§996',
    '§ 997', '§997',
    '§ 998', '§998',
    '§ 999', '§999',
    '§ 1000', '§1000',
    '§ 1001', '§1001',
    '§ 1002', '§1002',
    '§ 1003', '§1003',
    '§§ 987',
  ];

  // Also catch "§§ 987 bis 1003" / "§§987-1003"
  if (/§{1,2}\s*987/.test(question)) return true;

  return SIGNALS.some(s => q.includes(s));
}

module.exports = { isEBVQuestion };
