import './ComparisonCard.css';

interface ComparisonCardProps {
  answer: string;
  concept1?: { term: string; statute: string; paragraph: string };
  concept2?: { term: string; statute: string; paragraph: string };
}

interface ConceptBlock {
  title: string;
  definition: string;
  obligations: string;
  haftung: string;
}

function parseConceptBlock(text: string): ConceptBlock {
  console.log('BLOCK TEXT:', text.substring(0, 500));

  const titleMatch = text.match(/\[([^\]]+)\]\s*(?:\(([^)]+)\))?/);
  const title = titleMatch
    ? (titleMatch[2] ? `${titleMatch[1]} (${titleMatch[2]})` : titleMatch[1])
    : '';

  // Try multiple definition patterns
  const defPatterns = [
    /\*\*Definition[:\*\s]*\*\*:?\s*([^\n]+(?:\n(?![\*\-]|\s*\*\*)[^\n]+)*)/i,
    /Definition[:\s]+([^\n]+)/i,
    /-\s*\*\*Definition[:\*\s]*\*\*:?\s*([^\n]+)/i,
  ];
  let definition = '—';
  for (const p of defPatterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) { definition = m[1].replace(/\*\*/g, '').trim(); break; }
  }

  // Try multiple obligations patterns
  const oblPatterns = [
    /\*\*(?:Key obligations?|Hauptpflichten)[:\*\s]*\*\*:?([\s\S]+?)(?=\*\*(?:Risk|Haftung)|$)/i,
    /(?:Key obligations?|Hauptpflichten)[:\s]+([\s\S]+?)(?=Risk|Haftung|$)/i,
    /-\s*\*\*(?:Key obligations?|Hauptpflichten)[:\*\s]*\*\*:?\s*([^\n]+)/i,
  ];
  let obligations = '—';
  for (const p of oblPatterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) { obligations = m[1].replace(/\*\*/g, '').trim(); break; }
  }

  // Try multiple liability/Haftung patterns
  const liabPatterns = [
    /\*\*(?:Risk[/]?liability|Haftung)[:\*\s]*\*\*:?([\s\S]+?)(?=\n\[|\n\*\*|$)/i,
    /(?:Risk[/]?liability|Haftung)[:\s]+([\s\S]+?)(?=\n|$)/i,
    /-\s*\*\*(?:Risk[/]?liability|Haftung)[:\*\s]*\*\*:?\s*([^\n]+)/i,
  ];
  let haftung = '—';
  for (const p of liabPatterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) { haftung = m[1].replace(/\*\*/g, '').trim(); break; }
  }

  return { title, definition, obligations, haftung };
}

function parseComparisonAnswer(answer: string) {
  // Find all concept tags: [TagName]
  const tagPattern = /\[([^\]]+)\]/g;
  const tags: { name: string; index: number; length: number }[] = [];
  let tagMatch;
  while ((tagMatch = tagPattern.exec(answer)) !== null) {
    tags.push({ name: tagMatch[1], index: tagMatch.index, length: tagMatch[0].length });
  }

  // Find differences section
  const diffIndex = answer.search(/Key Differences|Wesentliche Unterschiede/i);

  let block1 = '';
  let block2 = '';
  let diffBlock = '';
  let concept1Name = 'Konzept 1';
  let concept2Name = 'Konzept 2';

  if (tags.length >= 2) {
    concept1Name = tags[0].name;
    concept2Name = tags[1].name;

    // Include the [Tag] in the block so parseConceptBlock can extract the title
    const start1 = tags[0].index;
    const end1 = tags[1].index;
    block1 = answer.slice(start1, end1);

    const start2 = tags[1].index;
    const end2 = diffIndex !== -1 ? diffIndex : answer.length;
    block2 = answer.slice(start2, end2);
  } else if (tags.length === 1) {
    concept1Name = tags[0].name;
    const start1 = tags[0].index;
    const end1 = diffIndex !== -1 ? diffIndex : answer.length;
    block1 = answer.slice(start1, end1);
  }

  if (diffIndex !== -1) {
    const afterDiff = answer.slice(diffIndex);
    const firstNewline = afterDiff.indexOf('\n');
    diffBlock = firstNewline !== -1 ? afterDiff.slice(firstNewline + 1) : '';
  }

  return { concept1Name, concept2Name, block1, block2, diffBlock };
}

function parseDiffItems(diffBlock: string): string[] {
  return diffBlock
    .split(/\r?\n/)
    .filter(l => l.trim().startsWith('*') || l.trim().startsWith('-'))
    .map(l => l.replace(/^[\s*-]+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);
}

const ROW_FIELDS: { label: string; key: keyof ConceptBlock }[] = [
  { label: 'Definition',     key: 'definition'  },
  { label: 'Hauptpflichten', key: 'obligations' },
  { label: 'Haftung',        key: 'haftung'     },
];

export default function ComparisonCard({ answer, concept1, concept2 }: ComparisonCardProps) {
  const { concept1Name, concept2Name, block1, block2, diffBlock } = parseComparisonAnswer(answer);

  const c1Data = parseConceptBlock(block1);
  const c2Data = parseConceptBlock(block2);
  const diffItems = parseDiffItems(diffBlock);

  const c1Label = concept1
    ? `${concept1.term} ${concept1.paragraph} ${concept1.statute}`
    : (c1Data.title || concept1Name);
  const c2Label = concept2
    ? `${concept2.term} ${concept2.paragraph} ${concept2.statute}`
    : (c2Data.title || concept2Name);

  return (
    <div className="comparison-card">
      <div className="comparison-header-bar">⚖️ Rechtsvergleich</div>

      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th className="comparison-th comparison-th-label" aria-label="Kategorie" />
              <th className="comparison-th">{c1Label}</th>
              <th className="comparison-th">{c2Label}</th>
            </tr>
          </thead>
          <tbody>
            {ROW_FIELDS.map(({ label, key }, i) => (
              <tr key={label} className={i % 2 === 0 ? 'comparison-row-even' : 'comparison-row-odd'}>
                <td className="comparison-td comparison-td-label">{label}</td>
                <td className="comparison-td">{c1Data[key] || '—'}</td>
                <td className="comparison-td">{c2Data[key] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diffItems.length > 0 && (
        <div className="comparison-differences">
          <div className="comparison-differences-header">Wesentliche Unterschiede</div>
          <table className="comparison-table comparison-diff-table">
            <tbody>
              {diffItems.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'comparison-row-even' : 'comparison-row-odd'}>
                  <td className="comparison-td comparison-td-diff">{item}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
