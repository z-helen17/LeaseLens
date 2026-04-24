export const BIAS_COLORS = {
  1: '#4c1d95',
  2: '#7c3aed',
  3: '#eab308',
  4: '#f97316',
  5: '#c2410c',
  x: '#ef4444',
};

export const BIAS_LABELS = {
  1: 'Very Landlord-Friendly',
  2: 'Leans Landlord',
  3: 'Neutral',
  4: 'Leans Tenant',
  5: 'Very Tenant-Friendly',
  x: 'Unclear / Drafting Error',
};

function meanToDisplay(mean) {
  if (mean <= 20) return 1;
  if (mean <= 40) return 2;
  if (mean <= 60) return 3;
  if (mean <= 80) return 4;
  return 5;
}

export function computeOverallScore(clauses) {
  const scored = clauses.filter((c) => c.score !== null && c.score !== undefined);
  if (!scored.length) return { mean: 50, display: 3 };
  const mean = scored.reduce((s, c) => s + c.score, 0) / scored.length;
  return { mean, display: meanToDisplay(mean) };
}

const sortScore = (c) => (c.score !== null && c.score !== undefined ? c.score : 50);

export function filterAndSort(clauses, option) {
  let filtered;
  switch (option) {
    case 1:
      filtered = [...clauses];
      return filtered.sort((a, b) => sortScore(a) - sortScore(b));
    case 2:
      filtered = clauses.filter((c) => c.bias === 4 || c.bias === 5 || c.bias === 'x');
      return filtered.sort((a, b) => sortScore(b) - sortScore(a));
    case 3:
      filtered = clauses.filter((c) => c.bias === 1 || c.bias === 2 || c.bias === 'x');
      return filtered.sort((a, b) => sortScore(a) - sortScore(b));
    case 4:
      filtered = clauses.filter((c) => c.lenderFlag || c.bias === 'x');
      return filtered.sort((a, b) => sortScore(a) - sortScore(b));
    default:
      return clauses;
  }
}

export function getBarChartData(clauses, option, mean) {
  const valid = clauses.filter((c) => c.score !== null && c.score !== undefined);
  let pool;

  switch (option) {
    case 2:
      pool = valid
        .filter((c) => c.bias === 4 || c.bias === 5)
        .sort((a, b) => b.score - a.score);
      break;
    case 3:
      pool = valid
        .filter((c) => c.bias === 1 || c.bias === 2)
        .sort((a, b) => a.score - b.score);
      break;
    case 4:
      pool = valid
        .filter((c) => c.lenderFlag)
        .sort((a, b) => Math.abs(b.score - mean) - Math.abs(a.score - mean));
      break;
    default:
      pool = [...valid].sort(
        (a, b) => Math.abs(b.score - mean) - Math.abs(a.score - mean),
      );
  }

  return pool.slice(0, 5).map((c) => {
    let deviation;
    if (option === 2) deviation = c.score - mean;
    else if (option === 3) deviation = mean - c.score;
    else deviation = Math.abs(c.score - mean);

    const shortName = c.name.length > 32 ? c.name.slice(0, 29) + '…' : c.name;
    return {
      name: shortName,
      fullName: c.name,
      score: c.score,
      deviation: Math.max(deviation, 0.5),
      bias: c.bias,
      color: BIAS_COLORS[c.bias] || '#6b7280',
    };
  });
}
