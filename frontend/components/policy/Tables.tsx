import { normalizeTables } from "../../lib/policy-utils";

export function Tables({ tables, editing, onChange }: { tables: unknown; editing?: boolean; onChange?: (value: string[][][]) => void }) {
  const safeTables = normalizeTables(tables);
  const change = (tableIndex: number, rowIndex: number, cellIndex: number, value: string) => onChange?.(safeTables.map((table, currentTable) => currentTable === tableIndex ? table.map((row, currentRow) => currentRow === rowIndex ? row.map((cell, currentCell) => currentCell === cellIndex ? value : cell) : row) : table));
  return <div className="policy-tables">
    {safeTables.map((table, tableIndex) => <div className="policy-table" key={tableIndex}>
      <span className="table-caption">表格 {tableIndex + 1}</span><table><tbody>{table.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => editing ? <td key={cellIndex}><input value={cell} onChange={(event) => change(tableIndex, rowIndex, cellIndex, event.target.value)} placeholder={rowIndex === 0 ? "欄位名稱" : "輸入文字"} /></td> : rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>
      {editing && <div className="table-tools"><button type="button" onClick={() => onChange?.(safeTables.map((item, index) => index === tableIndex ? [...item, Array(item[0]?.length || 3).fill("")] : item))}>＋ 列</button><button type="button" onClick={() => onChange?.(safeTables.map((item, index) => index === tableIndex ? item.map((row) => [...row, ""]) : item))}>＋ 欄</button><button type="button" onClick={() => onChange?.(safeTables.filter((_, index) => index !== tableIndex))}>刪除表格</button></div>}
    </div>)}
    {editing && <button type="button" className="ghost" onClick={() => onChange?.([...safeTables, [["欄位 1", "欄位 2", "欄位 3"], ["", "", ""]]])}>＋ 新增表格</button>}
  </div>;
}
