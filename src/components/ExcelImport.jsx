import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * ExcelImport – reads an Excel / CSV file and converts it to shift entries.
 *
 * Expected columns (order-independent, Hebrew or English header names):
 *   תאריך  | date       – e.g. 2025-06-01 or an Excel serial date
 *   מיקום  | location   – location name
 *   רופא   | doctor     – doctor name (optional)
 *   טכנאים | technicians – comma-separated technician names (optional)
 *   טכנאי 1, טכנאי 2 … – alternative: separate columns per technician
 *
 * On confirmation the rows are merged with the existing schedule in localStorage.
 */
const ExcelImport = ({ onImport, onClose }) => {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null); // parsed rows ready for display
  const [errors, setErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  // ---- helpers ----

  /** Try to detect the column name regardless of case / language variant */
  const findCol = (headers, candidates) => {
    const lower = headers.map(h => String(h).trim().toLowerCase());
    for (const c of candidates) {
      const idx = lower.indexOf(c.toLowerCase());
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  /** Convert an Excel serial date or various string formats to YYYY-MM-DD */
  const normalizeDate = (raw) => {
    if (!raw && raw !== 0) return null;
    // Excel serial number
    if (typeof raw === 'number') {
      const date = XLSX.SSF.parse_date_code(raw);
      if (!date) return null;
      const y = date.y;
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(raw).trim();
    // Already ISO: 2025-06-01
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY or D/M/YYYY
    const dmyMatch = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Try native Date parse as last resort
    const parsed = new Date(s);
    if (!isNaN(parsed)) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  };

  /** Collect all tech names from dedicated columns (טכנאי 1, טכנאי 2, …) */
  const collectTechColumns = (row, headers) => {
    const techs = [];
    for (const h of headers) {
      const clean = String(h).trim();
      if (/^(טכנאי\s*\d+|technician\s*\d+)$/i.test(clean)) {
        const val = row[h];
        if (val && String(val).trim()) techs.push(String(val).trim());
      }
    }
    return techs;
  };

  // ---- file handling ----

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setErrors([]);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) {
          setErrors(['הקובץ ריק – לא נמצאו שורות נתונים']);
          return;
        }

        const headers = Object.keys(rawRows[0]);

        // Map column names
        const dateCol  = findCol(headers, ['תאריך', 'date', 'Date', 'DATE', 'יום']);
        const locCol   = findCol(headers, ['מיקום', 'location', 'Location', 'LOCATION', 'אתר', 'site']);
        const docCol   = findCol(headers, ['רופא', 'doctor', 'Doctor', 'DOCTOR', 'ד"ר', 'רופאה']);
        const techCol  = findCol(headers, ['טכנאים', 'technicians', 'Technicians', 'טכנאי', 'technician']);

        const errs = [];
        if (!dateCol) errs.push('לא נמצאה עמודת תאריך (תאריך / date)');
        if (!locCol)  errs.push('לא נמצאה עמודת מיקום (מיקום / location)');
        if (errs.length) { setErrors(errs); return; }

        const parsed = [];
        const rowErrors = [];

        rawRows.forEach((row, i) => {
          const rowNum = i + 2; // 1-indexed, row 1 = header
          const dateVal = normalizeDate(row[dateCol]);
          const locVal  = String(row[locCol] || '').trim();

          if (!dateVal) {
            rowErrors.push(`שורה ${rowNum}: תאריך לא תקין ("${row[dateCol]}")`);
            return;
          }
          if (!locVal) {
            rowErrors.push(`שורה ${rowNum}: מיקום חסר`);
            return;
          }

          // Technicians: dedicated column or separate per-tech columns
          let techsList = [];
          if (techCol && row[techCol]) {
            techsList = String(row[techCol]).split(/[,،;\s]+/).map(t => t.trim()).filter(Boolean);
          }
          const extraTechs = collectTechColumns(row, headers);
          techsList = [...new Set([...techsList, ...extraTechs])];

          parsed.push({
            date: dateVal,
            location: locVal,
            doctor: docCol ? String(row[docCol] || '').trim() : '',
            technicians: techsList,
          });
        });

        if (parsed.length === 0 && rowErrors.length > 0) {
          setErrors(rowErrors);
          return;
        }

        setPreview(parsed);
        if (rowErrors.length) setErrors(rowErrors); // show warnings but still allow import
      } catch (err) {
        setErrors([`שגיאה בקריאת הקובץ: ${err.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e) => handleFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleConfirm = () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    onImport(preview);
    setImporting(false);
  };

  // ---- render ----

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-5 rounded-t-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={28} />
            <h2 className="text-2xl font-extrabold">ייבוא שיבוצים מאקסל</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 text-sm text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-bold text-base mb-2">📋 פורמט הקובץ הנדרש</p>
            <p>הקובץ צריך להכיל את העמודות הבאות:</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li><strong>תאריך</strong> – תאריך השיבוץ (DD/MM/YYYY או YYYY-MM-DD)</li>
              <li><strong>מיקום</strong> – שם המיקום (למשל: בית עובד, פתחיה)</li>
              <li><strong>רופא</strong> – שם הרופא (אופציונלי)</li>
              <li><strong>טכנאים</strong> – שמות מופרדים בפסיק (אופציונלי)</li>
            </ul>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              💡 ניתן גם להשתמש בעמודות נפרדות: <em>טכנאי 1, טכנאי 2</em> וכו׳
            </p>
          </div>

          {/* Drop zone */}
          {!preview && (
            <div
              className="border-2 border-dashed border-green-400 dark:border-green-600 rounded-2xl p-10 text-center cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <Upload size={48} className="mx-auto mb-3 text-green-500" />
              <p className="font-bold text-gray-700 dark:text-gray-200 text-lg">גרור קובץ לכאן או לחץ לבחירה</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">קבצי Excel (.xlsx, .xls) או CSV</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {fileName && !preview && (
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">📂 {fileName}</p>
          )}

          {/* Errors / warnings */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-200 mb-1">
                <AlertCircle size={18} /> {preview ? '⚠️ אזהרות (הנתונים שתקינים יוכנסו)' : '❌ שגיאות בקריאת הקובץ'}
              </div>
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-red-700 dark:text-red-300">{e}</p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-bold">
                <CheckCircle size={20} />
                נמצאו {preview.length} שיבוצים לייבוא
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700">
                <table className="w-full text-sm text-center">
                  <thead className="bg-gray-50 dark:bg-zinc-800">
                    <tr>
                      {['תאריך','מיקום','רופא','טכנאים'].map(h => (
                        <th key={h} className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 font-semibold text-gray-700 dark:text-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-2 border-b border-gray-100 dark:border-zinc-700 text-gray-800 dark:text-gray-200">{row.date}</td>
                        <td className="px-3 py-2 border-b border-gray-100 dark:border-zinc-700 text-gray-800 dark:text-gray-200">{row.location}</td>
                        <td className="px-3 py-2 border-b border-gray-100 dark:border-zinc-700">
                          {row.doctor
                            ? <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-900 dark:text-purple-100 rounded-full text-xs">{row.doctor}</span>
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 dark:border-zinc-700">
                          {row.technicians.length > 0
                            ? <span className="text-xs text-orange-700 dark:text-orange-300">{row.technicians.join(', ')}</span>
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-center text-gray-500 text-xs">…ועוד {preview.length - 50} שורות</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            {preview && preview.length > 0 && (
              <button
                onClick={handleConfirm}
                disabled={importing}
                className="flex-1 py-3 rounded-full font-bold text-lg bg-gradient-to-r from-green-500 to-teal-500 text-white hover:from-green-600 hover:to-teal-600 shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <CheckCircle size={20} />
                {importing ? 'מייבא…' : `✅ ייבא ${preview.length} שיבוצים`}
              </button>
            )}
            {preview && (
              <button
                onClick={() => { setPreview(null); setErrors([]); setFileName(''); }}
                className="px-5 py-3 rounded-full font-bold bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-zinc-600 transition-all"
              >
                בחר קובץ אחר
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-full font-bold bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-zinc-600 transition-all"
            >
              סגור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelImport;
