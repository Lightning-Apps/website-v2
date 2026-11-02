// Word-level diff for the change details (longest common subsequence over words and spaces).

export interface Segment {
  type: 'same' | 'add' | 'del';
  text: string;
}

/** Above this many token pairs the comparison is skipped (before/after are shown in full instead). */
const MAX_CELLS = 4_000_000;

export function wordDiff(before: string, after: string): Segment[] | null {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  if (a.length * b.length > MAX_CELLS) return null;

  // lengths[i][j] = LCS length of a[i..] and b[j..], stored row by row.
  const width = b.length + 1;
  const lengths = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] = a[i] === b[j] ? lengths[(i + 1) * width + j + 1] + 1 : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }

  const segments: Segment[] = [];
  const push = (type: Segment['type'], text: string) => {
    const last = segments.at(-1);
    if (last?.type === type) last.text += text;
    else segments.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) push('del', a[i++]);
    else push('add', b[j++]);
  }
  while (i < a.length) push('del', a[i++]);
  while (j < b.length) push('add', b[j++]);
  return segments;
}
