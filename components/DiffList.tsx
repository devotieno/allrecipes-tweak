'use client';

import { diffArrays, diffWords } from 'diff';
import React from 'react';

interface DiffListProps {
  original: string[];
  modified: string[];
}

export function DiffList({ original, modified }: DiffListProps) {
  const parts = diffArrays(original, modified);
  const rendered: React.ReactElement[] = [];
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    const next = parts[i + 1];

    // A removed block immediately followed by an added block of the same
    // length is treated as "modified lines" so we can highlight just the
    // changed words, not the whole line.
    if (part.removed && next?.added && part.value.length === next.value.length) {
      part.value.forEach((oldLine: string, idx: number) => {
        const newLine = next.value[idx];
        const wordDiff = diffWords(oldLine, newLine);
        rendered.push(
          <li key={`mod-${i}-${idx}`} className="rounded bg-amber-50 px-2 py-1 text-sm">
            {wordDiff.map((w, wi) =>
              w.added ? (
                <span key={wi} className="rounded bg-green-200 px-0.5 text-green-900">
                  {w.value}
                </span>
              ) : w.removed ? (
                <span key={wi} className="rounded bg-red-200 px-0.5 text-red-900 line-through">
                  {w.value}
                </span>
              ) : (
                <span key={wi}>{w.value}</span>
              )
            )}
          </li>
        );
      });
      i += 2;
      continue;
    }

    if (part.added) {
      part.value.forEach((line: string, idx: number) =>
        rendered.push(
          <li key={`add-${i}-${idx}`} className="rounded bg-green-100 px-2 py-1 text-sm text-green-900">
            + {line}
          </li>
        )
      );
    } else if (part.removed) {
      part.value.forEach((line: string, idx: number) =>
        rendered.push(
          <li
            key={`rem-${i}-${idx}`}
            className="rounded bg-red-100 px-2 py-1 text-sm text-red-900 line-through"
          >
            − {line}
          </li>
        )
      );
    } else {
      part.value.forEach((line: string, idx: number) =>
        rendered.push(
          <li key={`same-${i}-${idx}`} className="px-2 py-1 text-sm text-gray-700">
            {line}
          </li>
        )
      );
    }
    i += 1;
  }

  if (rendered.length === 0) {
    return <p className="text-sm text-gray-400">Nothing here.</p>;
  }

  return <ul className="space-y-1">{rendered}</ul>;
}
