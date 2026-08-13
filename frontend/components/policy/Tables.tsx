import { useState } from "react";
import type { PolicyTable, TableMerge } from "../../lib/policy-types";
import { normalizeTables } from "../../lib/policy-utils";

type SelectedCell = { table: number; row: number; col: number } | null;
type MergeCell = Exclude<SelectedCell, null>;
const mergeContains = (merge: TableMerge, row: number, col: number) =>
  row >= merge.startRow && row <= merge.endRow && col >= merge.startCol && col <= merge.endCol;

export function Tables({ tables, editing, onChange }: { tables: unknown; editing?: boolean; onChange?: (value: PolicyTable[]) => void }) {
  const safeTables = normalizeTables(tables);
  const [selected, setSelected] = useState<SelectedCell>(null);
  const change = (tableIndex: number, rowIndex: number, cellIndex: number, value: string) => onChange?.(safeTables.map((table, currentTable) => currentTable === tableIndex ? { ...table, cells: table.cells.map((row, currentRow) => currentRow === rowIndex ? row.map((cell, currentCell) => currentCell === cellIndex ? value : cell) : row) } : table));
  const changeTables = (next: PolicyTable[]) => { onChange?.(next); setSelected(null); };
  const selectedMerge = selected && safeTables[selected.table]?.merges?.find((merge) => mergeContains(merge, selected.row, selected.col));
  const [mergeCells, setMergeCells] = useState<MergeCell[]>([]);
  const [mergeModeTable, setMergeModeTable] = useState<number | null>(null);
  const chooseCell = (cell: SelectedCell) => {
    setSelected(cell);
    if (!editing || !cell || mergeModeTable !== cell.table) return;
    setMergeCells((current) => current.some((item) => item.row === cell.row && item.col === cell.col) ? current.filter((item) => item.row !== cell.row || item.col !== cell.col) : [...current, cell]);
  };
  const mergeSelectedCells = (tableIndex: number) => {
    const selectedCells = mergeCells.filter((cell) => cell.table === tableIndex);
    if (selectedCells.length < 2) return;
    const rows = selectedCells.map((cell) => cell.row), columns = selectedCells.map((cell) => cell.col);
    const startRow = Math.min(...rows), endRow = Math.max(...rows);
    const startCol = Math.min(...columns), endCol = Math.max(...columns);
    const expectedCellCount = (endRow - startRow + 1) * (endCol - startCol + 1);
    if (selectedCells.length !== expectedCellCount) return;
    const table = safeTables[tableIndex];
    if (!table.merges?.some((merge) => mergeContains(merge, startRow, startCol) || mergeContains(merge, endRow, endCol))) {
      changeTables(safeTables.map((item, index) => index === tableIndex ? { ...item, merges: [...(item.merges || []), { startRow, startCol, endRow, endCol }] } : item));
    }
    setMergeCells([]);
    setMergeModeTable(null);
  };
  const removeMerge = () => {
    if (!selected || !selectedMerge) return;
    changeTables(safeTables.map((table, index) => index === selected.table ? { ...table, merges: (table.merges || []).filter((merge) => merge !== selectedMerge) } : table));
  };
  const insertSymbol = (symbol: string) => {
    if (!selected) return;
    const table = safeTables[selected.table];
    const merge = table.merges?.find((item) => mergeContains(item, selected.row, selected.col));
    const row = merge?.startRow ?? selected.row, col = merge?.startCol ?? selected.col;
    change(selected.table, row, col, `${table.cells[row]?.[col] || ""}${symbol}`);
  };
  return <div className="policy-tables">
    {safeTables.map((table, tableIndex) => <div className="policy-table" key={tableIndex}>
      <span className="table-caption">表格 {tableIndex + 1}</span><table><tbody>{table.cells.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
        const merge = table.merges?.find((item) => mergeContains(item, rowIndex, cellIndex));
        if (merge && (merge.startRow !== rowIndex || merge.startCol !== cellIndex)) return null;
        const active = selected?.table === tableIndex && mergeContains(merge || { startRow: rowIndex, startCol: cellIndex, endRow: rowIndex, endCol: cellIndex }, selected.row, selected.col);
        const mergePicked = mergeCells.some((item) => item.table === tableIndex && item.row === rowIndex && item.col === cellIndex);
        const cellProps = merge ? { rowSpan: merge.endRow - merge.startRow + 1, colSpan: merge.endCol - merge.startCol + 1 } : {};
        const content = editing ? <input value={cell} onFocus={() => setSelected({ table: tableIndex, row: rowIndex, col: cellIndex })} onClick={(event) => { event.stopPropagation(); chooseCell({ table: tableIndex, row: rowIndex, col: cellIndex }); }} onChange={(event) => change(tableIndex, rowIndex, cellIndex, event.target.value)} placeholder={rowIndex === 0 ? "欄位名稱" : "輸入文字"} /> : cell;
        const cellClassName = `${active ? "selected-table-cell" : ""} ${mergePicked ? "merge-selected-cell" : ""}`.trim();
        return rowIndex === 0 ? <th key={cellIndex} {...cellProps} className={cellClassName}>{content}</th> : <td key={cellIndex} {...cellProps} className={cellClassName} onClick={() => editing && chooseCell({ table: tableIndex, row: rowIndex, col: cellIndex })}>{content}</td>;
      })}</tr>)}</tbody></table>
      {editing && <div className="table-tools"><button type="button" onClick={() => changeTables(safeTables.map((item, index) => index === tableIndex ? { ...item, cells: [...item.cells, Array(item.cells[0]?.length || 2).fill("")] } : item))}>＋ 列</button><button type="button" onClick={() => changeTables(safeTables.map((item, index) => index === tableIndex ? { ...item, cells: item.cells.map((row) => [...row, ""]) } : item))}>＋ 欄</button><button type="button" className={mergeModeTable === tableIndex ? "active-table-tool" : ""} onClick={() => { setMergeModeTable(mergeModeTable === tableIndex ? null : tableIndex); setMergeCells([]); }}>{mergeModeTable === tableIndex ? "取消合併模式" : "合併格"}</button>{mergeModeTable === tableIndex && <><span className="table-merge-hint">點選全部要合併的格子</span><button type="button" className="active-table-tool" disabled={mergeCells.filter((cell) => cell.table === tableIndex).length < 2} onClick={() => mergeSelectedCells(tableIndex)}>合併 {mergeCells.filter((cell) => cell.table === tableIndex).length} 格</button></>}<button type="button" disabled={!selectedMerge} onClick={removeMerge}>取消合併</button><span className="table-symbols"><small>輸入符號</small>{["✓", "×", "○", "◎"].map((symbol) => <button type="button" key={symbol} disabled={!selected || selected.table !== tableIndex} onClick={() => insertSymbol(symbol)}>{symbol}</button>)}</span><button type="button" onClick={() => changeTables(safeTables.filter((_, index) => index !== tableIndex))}>刪除表格</button></div>}
    </div>)}
    {editing && <button type="button" className="ghost" onClick={() => changeTables([...safeTables, { cells: [["欄位 1", "欄位 2"], ["", ""]], merges: [] }])}>＋ 新增表格</button>}
  </div>;
}
