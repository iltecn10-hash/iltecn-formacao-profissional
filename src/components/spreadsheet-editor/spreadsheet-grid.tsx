"use client";

import { useState, type KeyboardEvent } from "react";
import { evaluateGrid, colIndexToLetter } from "@/lib/spreadsheet-formulas";

export function SpreadsheetGrid({
  rows,
  cols,
  cells,
  editable,
  onCellChange,
}: {
  rows: number;
  cols: number;
  cells: Record<string, string>;
  editable: boolean;
  onCellChange: (key: string, value: string) => void;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const evaluated = evaluateGrid(cells, rows, cols);

  function moveActive(col: number, row: number) {
    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      setActiveKey(null);
      return;
    }
    setActiveKey(`${colIndexToLetter(col)}${row + 1}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, col: number, row: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      moveActive(col, row + 1);
    } else if (event.key === "Tab") {
      event.preventDefault();
      moveActive(event.shiftKey ? col - 1 : col + 1, row);
    } else if (event.key === "Escape") {
      setActiveKey(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-10 border border-border bg-background" />
            {Array.from({ length: cols }, (_, c) => (
              <th
                key={c}
                className="min-w-[7rem] border border-border bg-background px-2 py-1 text-xs font-semibold text-muted"
              >
                {colIndexToLetter(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th className="sticky left-0 z-10 w-10 border border-border bg-background px-2 py-1 text-xs font-semibold text-muted">
                {r + 1}
              </th>
              {Array.from({ length: cols }, (_, c) => {
                const key = `${colIndexToLetter(c)}${r + 1}`;
                const cell = evaluated[key] ?? { raw: "", display: "", isFormula: false };
                const isActive = editable && activeKey === key;

                if (isActive) {
                  return (
                    <td key={key} className="border border-border p-0">
                      <input
                        autoFocus
                        value={cell.raw}
                        onChange={(e) => onCellChange(key, e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => setActiveKey(null)}
                        onKeyDown={(e) => handleKeyDown(e, c, r)}
                        className="w-full min-w-[7rem] bg-primary-light/50 px-2 py-1.5 text-sm outline-none"
                      />
                    </td>
                  );
                }

                return (
                  <td
                    key={key}
                    onClick={() => editable && setActiveKey(key)}
                    tabIndex={editable ? 0 : -1}
                    onFocus={() => editable && setActiveKey(key)}
                    title={cell.error}
                    className={`min-w-[7rem] whitespace-nowrap border border-border px-2 py-1.5 ${
                      editable ? "cursor-text hover:bg-background" : ""
                    } ${cell.error ? "bg-danger/10 text-danger" : cell.isFormula ? "text-primary-dark" : "text-foreground"}`}
                  >
                    {cell.display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
