
import React, { useState } from 'react';
import { Save, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import ArchiveManager from './ArchiveManager.jsx';

const ShiftForm = () => {
  const [showArchive, setShowArchive] = useState(false);
  const [formData, setFormData] = useState({ date: '', locations: [] });
  const [locationDetails, setLocationDetails] = useState({});
  const [scheduleList, setScheduleList] = useState(() => {
    const saved = localStorage.getItem('bloodshift_schedule');
    return saved ? JSON.parse(saved) : [];
  });
  const [editIndex, setEditIndex] = useState(null);
  // Dynamic lists for manual add
  const [customLocations, setCustomLocations] = useState([]);
  const [customDoctors, setCustomDoctors] = useState([]);
  const [customTechnicians, setCustomTechnicians] = useState([]);

  const baseLocations = ['בית עובד','פתחיה','חולון','רחובות','איגוד ערים דן'];
  const doctors = ['מוטי','נטלי גרי','נטלי נבון','מאיה','מיקי','שחר','עדי','דור', ...customDoctors];
  const technicians = ['ליאור','עדן','שירה','תמר','שמעון','עמית','ראשל','ערן','הילה','דנה','שירי','אנה','גל','טל ברכה', ...customTechnicians];

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const handleLocationsChange = e => setFormData(prev => ({ ...prev, locations: Array.from(e.target.selectedOptions).map(o=>o.value) }));
  const handleDoctorChange = (loc, doc) => setLocationDetails(prev => ({ ...prev, [loc]: { ...prev[loc], doctor: doc } }));
  const handleTechChange = (loc, e) => setLocationDetails(prev => ({ ...prev, [loc]: { ...prev[loc], technicians: Array.from(e.target.selectedOptions).map(o=>o.value) } }));

  const handleSave = () => {
    if (!formData.date) return alert('נא לבחור תאריך');
    if (formData.locations.length === 0) return alert('נא לבחור מיקומים');

    const newList = [...scheduleList];
    
    if (editIndex !== null) {
      // במצב עריכה - נשמור רק מה שהשתנה ולא נמחק נתונים קיימים
      const existingEntry = scheduleList[editIndex];
      const loc = formData.locations[0];
      const updatedEntry = {
        date: formData.date,
        location: loc,
        doctor: locationDetails[loc]?.doctor !== undefined 
          ? locationDetails[loc].doctor 
          : existingEntry.doctor,
        technicians: locationDetails[loc]?.technicians !== undefined 
          ? locationDetails[loc].technicians 
          : existingEntry.technicians
      };
      newList[editIndex] = updatedEntry;
    } else {
      // הוספת שיבוצים חדשים
      const entries = formData.locations.map(loc => ({
        date: formData.date,
        location: loc,
        doctor: locationDetails[loc]?.doctor || '',
        technicians: locationDetails[loc]?.technicians || []
      }));
      newList.push(...entries);
    }

    setScheduleList(newList);
    localStorage.setItem('bloodshift_schedule', JSON.stringify(newList));
    setFormData({ date: '', locations: [] });
    setLocationDetails({}); 
    setEditIndex(null);
  };


  // Sort by date ascending
  const sorted = [...scheduleList]
    .map((item,idx)=>({ ...item, originalIndex: idx }))
    .sort((a,b)=>new Date(a.date) - new Date(b.date));

  // Map JS day (0-6) to Hebrew letter
  const hebDayLetter = d => {
    const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    if (!d) return '';
    const dateObj = new Date(d);
    // JS: 0=Sunday, 6=Saturday. Hebrew: א=Sunday, ... ש=Saturday
    // But in Israel, week starts Sunday (0)
    return days[dateObj.getDay()] || '';
  };

  const handleDelete = idx=>{
    const updated=[...scheduleList]; 
    updated.splice(idx,1);
    setScheduleList(updated);
    localStorage.setItem('bloodshift_schedule', JSON.stringify(updated));
  };

  const handleEdit = item=>{
    setFormData({ date: item.date, locations: [item.location] });
    setLocationDetails({ [item.location]: { doctor: item.doctor, technicians: item.technicians } });
    setEditIndex(item.originalIndex);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  // העברה לארכיון של ימים שעברו
  const moveOldToArchive = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oldEntries = scheduleList.filter(item => new Date(item.date) < today);
    const currentEntries = scheduleList.filter(item => new Date(item.date) >= today);
    
    if (oldEntries.length === 0) {
      alert('אין ימים שעברו להעברה לארכיון');
      return;
    }

    // שמירת הנתונים הישנים בארכיון
    const existingArchive = localStorage.getItem('bloodshift_archive');
    const archive = existingArchive ? JSON.parse(existingArchive) : [];
    const updatedArchive = [...archive, ...oldEntries];
    
    localStorage.setItem('bloodshift_archive', JSON.stringify(updatedArchive));
    
    // עדכון הרשימה הנוכחית - רק עתיד והיום
    setScheduleList(currentEntries);
    localStorage.setItem('bloodshift_schedule', JSON.stringify(currentEntries));
    
    alert(`${oldEntries.length} שיבוצים מימים שעברו הועברו לארכיון`);
  };

  const downloadSchedule = () => {
    if (scheduleList.length === 0) {
      alert('אין שיבוצים להורדה');
      return;
    }
    const rows = sorted.map(item => ({
      תאריך: item.date,
      יום: hebDayLetter(item.date),
      מיקום: item.location,
      רופא: item.doctor || '',
      טכנאים: (item.technicians || []).join(', ')
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'שיבוצים');
    const fileName = `BloodShift_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="max-w-6xl mx-auto mt-4 p-6 rounded-3xl shadow-2xl border-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg">
      {/* כותרת */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 mb-4 flex items-center justify-center gap-3 drop-shadow-lg">
          🩸 BloodShift
        </h1>
      </div>

      {/* כפתורי ניווט */}
      <div className="flex justify-center mb-8 bg-gray-100 dark:bg-zinc-800/60 rounded-2xl p-2 shadow">
        <button
          onClick={() => setShowArchive(false)}
          className={`px-6 py-3 rounded-full font-bold transition-all duration-200 shadow-md text-lg ${
            !showArchive 
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white scale-105' 
              : 'text-gray-700 dark:text-gray-100 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:shadow-lg'
          }`}
        >
          שיבוצים
        </button>
        <button
          onClick={() => setShowArchive(true)}
          className={`ml-4 px-6 py-3 rounded-full font-bold transition-all duration-200 shadow-md text-lg ${
            showArchive 
              ? 'bg-gradient-to-r from-pink-500 to-yellow-500 text-white scale-105' 
              : 'text-gray-700 dark:text-gray-100 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:shadow-lg'
          }`}
        >
          ארכיון
        </button>
      </div>

      {showArchive ? (
        <ArchiveManager />
      ) : (
        <>
          {/* טופס שיבוץ יומי */}
          <div className="bg-gradient-to-r from-blue-100/80 to-indigo-100/80 dark:from-blue-900/60 dark:to-indigo-900/60 rounded-2xl p-6 mb-8 shadow-md backdrop-blur">
            <h2 className="text-2xl font-extrabold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-200 dark:to-indigo-300 flex items-center justify-center gap-3 drop-shadow">
              📅 טופס שיבוץ יומי
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
                  תאריך השיבוץ
                </label>
                <input 
                  type="date" 
                  value={formData.date} 
                  onChange={e=>handleChange('date',e.target.value)} 
                  className="w-full p-4 border-2 border-blue-200 dark:border-blue-700 rounded-2xl bg-white/80 dark:bg-zinc-900/60 text-lg focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900 transition-all"
                />
              </div>
              {formData.date && (
                <div className="mb-6">
                  <label className="font-semibold mb-3 text-gray-700 dark:text-gray-200 block">
                    בחר מיקומים
                  </label>
                  <select 
                    multiple 
                    value={formData.locations} 
                    onChange={e => {
                      if ([...e.target.selectedOptions].some(o => o.value === '__add_location__')) {
                        const newLocation = prompt('הזן שם מיקום חדש:');
                        if (newLocation && newLocation.trim() && !customLocations.includes(newLocation.trim())) {
                          setCustomLocations([...customLocations, newLocation.trim()]);
                        }
                        e.target.value = '';
                        return;
                      }
                      handleLocationsChange(e);
                    }}
                    className="w-full p-4 border-2 border-blue-200 dark:border-blue-700 rounded-2xl h-32 bg-white/80 dark:bg-zinc-900/60 text-gray-900 dark:text-gray-100 text-lg focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900 transition-all"
                  >
                    {[...baseLocations, ...customLocations].map(loc=><option key={loc} value={loc}>{loc}</option>)}
                    <option value="__add_location__">➕ הוסף מיקום חדש...</option>
                  </select>
                </div>
              )}
            </div>
            {formData.date && formData.locations.length > 0 && (
              <>
                {formData.locations.map(loc=>(
                  <div key={loc} className="mb-6 p-6 bg-white/90 dark:bg-zinc-900/80 border-2 border-blue-200 dark:border-blue-700 rounded-2xl shadow-lg backdrop-blur">
                    <h3 className="font-bold mb-4 text-blue-900 dark:text-blue-200">
                      שיבוץ עבור {loc}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="font-semibold mb-3 text-gray-700 dark:text-gray-200 block">
                          רופא:
                        </label>
                        <select 
                          value={locationDetails[loc]?.doctor||''} 
                          onChange={e => {
                            if (e.target.value === '__add_doctor__') {
                              const newDoctor = prompt('הזן שם רופא חדש:');
                              if (newDoctor && newDoctor.trim() && !customDoctors.includes(newDoctor.trim())) {
                                setCustomDoctors([...customDoctors, newDoctor.trim()]);
                              }
                              return;
                            }
                            handleDoctorChange(loc, e.target.value);
                          }}
                          className="w-full p-3 border-2 border-blue-200 dark:border-blue-700 rounded-xl bg-white/80 dark:bg-zinc-900/60 text-gray-900 dark:text-gray-100 text-lg focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900 transition-all"
                        >
                          <option value="">בחר רופא</option>
                          {doctors.map(doc=><option key={doc} value={doc}>{doc}</option>)}
                          <option value="__add_doctor__">➕ הוסף רופא חדש...</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold mb-3 text-gray-700 dark:text-gray-200 block">
                          טכנאים:
                        </label>
                        
                        {/* Dropdown לבחירת טכנאי */}
                        <select 
                          value="" 
                          onChange={e => {
                            if (e.target.value === '__add_tech__') {
                              const newTechnician = prompt('הזן שם טכנאי חדש:');
                              if (newTechnician && newTechnician.trim() && !customTechnicians.includes(newTechnician.trim())) {
                                setCustomTechnicians([...customTechnicians, newTechnician.trim()]);
                              }
                              return;
                            }
                            if (e.target.value) {
                              const currentTechs = locationDetails[loc]?.technicians || [];
                              if (!currentTechs.includes(e.target.value)) {
                                setLocationDetails(prev => ({
                                  ...prev,
                                  [loc]: { 
                                    ...prev[loc], 
                                    technicians: [...currentTechs, e.target.value]
                                  }
                                }));
                              }
                            }
                          }}
                          className="w-full p-3 border-2 border-blue-200 dark:border-blue-700 rounded-xl bg-white/80 dark:bg-zinc-900/60 text-gray-900 dark:text-gray-100 text-lg focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900 transition-all"
                        >
                          <option value="">בחר טכנאי</option>
                          {technicians.map(tech=><option key={tech} value={tech}>{tech}</option>)}
                          <option value="__add_tech__">➕ הוסף טכנאי חדש...</option>
                        </select>
                        
                        {/* תצוגת טכנאים נבחרים */}
                        {locationDetails[loc]?.technicians && locationDetails[loc].technicians.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                            {locationDetails[loc].technicians.map(tech => (
                              <span key={tech} className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/80 text-orange-900 dark:text-orange-100 rounded-full text-sm font-medium shadow">
                                {tech}
                                <button
                                  onClick={() => {
                                    const newTechs = locationDetails[loc].technicians.filter(t => t !== tech);
                                    setLocationDetails(prev => ({
                                      ...prev,
                                      [loc]: { ...prev[loc], technicians: newTechs }
                                    }));
                                  }}
                                  className="hover:bg-orange-200 dark:hover:bg-orange-800 rounded-full p-0.5 transition-colors"
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={handleSave} 
                  className="w-full p-4 rounded-full font-bold text-lg shadow-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-white hover:from-pink-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-3"
                >
                  <Save size={20} />
                  {editIndex !== null ? '💾 עדכן שיבוץ' : '✅ שמור שיבוץ'}
                </button>
              </>
            )}
          </div>

          {/* טבלה לפי תאריכים */}
          <div className="mb-8 bg-white/90 dark:bg-zinc-900/80 rounded-2xl border-0 shadow-xl overflow-hidden backdrop-blur">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow-md flex items-center justify-between">
              <h3 className="flex items-center gap-3 text-xl font-bold">
                📅 כל השיבוצים לפי תאריך
              </h3>
              <button
                onClick={downloadSchedule}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold text-sm transition-all shadow"
              >
                <Download size={16} />
                הורד
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">יום</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">תאריך</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">מיקום</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">רופא</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">טכנאים</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-gray-400 dark:text-gray-500">אין שיבוצים להצגה</td>
                    </tr>
                  ) : (
                    sorted.map((item, idx) => (
                      <tr key={item.originalIndex} className="hover:bg-indigo-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 font-bold text-lg text-gray-900 dark:text-gray-100">
                          {hebDayLetter(item.date)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{item.date}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 font-medium text-gray-800 dark:text-gray-200">{item.location}</td>
                        <td className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                          {item.doctor ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/80 text-purple-900 dark:text-purple-100 rounded-full text-xs shadow font-medium">
                              {item.doctor}
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-xs">לא נבחר</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100">
                          {item.technicians && item.technicians.length > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {item.technicians.slice(0,2).map(tech => (
                                <span key={tech} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/80 text-orange-900 dark:text-orange-100 rounded-full text-xs shadow font-medium">
                                  {tech}
                                </span>
                              ))}
                              {item.technicians.length > 2 && (
                                <span className="text-xs text-gray-600 dark:text-gray-400">+{item.technicians.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-xs">לא נבחרו</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100">
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={()=>handleEdit(item)} 
                              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 hover:text-white text-xs px-3 py-1 rounded-full transition-all transform hover:scale-105 shadow"
                            >
                              ערוך
                            </button>
                            <button 
                              onClick={()=>handleDelete(item.originalIndex)} 
                              className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded-full transition-all transform hover:scale-105 shadow"
                            >
                              מחק
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* כפתור העברה לארכיון */}
            {scheduleList.some(item => new Date(item.date) < new Date()) && (
              <div className="p-4 bg-gray-50 dark:bg-zinc-800/40 border-t border-gray-200 dark:border-zinc-700">
                <button 
                  onClick={moveOldToArchive}
                  className="w-full p-3 rounded-xl font-bold text-sm shadow-lg bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transform hover:scale-102 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  📦 העבר ימים שעברו לארכיון
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  פעולה זו תעביר את כל השיבוצים מימים שעברו לארכיון ותשאיר רק עתיד והיום
                </p>
              </div>
            )}
          </div>

          {/* סטטיסטיקות */}
          <div className="bg-gradient-to-r from-indigo-100/80 to-purple-100/80 dark:from-indigo-900/60 dark:to-purple-900/60 border border-indigo-200 dark:border-purple-900 rounded-2xl p-6 mt-8 shadow-md backdrop-blur">
            <h3 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-200 dark:to-purple-300 text-lg mb-4 flex items-center gap-2 drop-shadow">
              📊 סטטיסטיקות מערכת
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/90 dark:bg-zinc-900/80 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center shadow">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{scheduleList.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">סה"כ שיבוצים</div>
              </div>
              <div className="bg-white/90 dark:bg-zinc-900/80 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {new Set(scheduleList.map(s => s.location)).size}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">מיקומים</div>
              </div>
              <div className="bg-white/90 dark:bg-zinc-900/80 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {new Set(scheduleList.map(s => s.doctor).filter(Boolean)).size}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">רופאים פעילים</div>
              </div>
            </div>
            <div className="mt-4 text-center space-y-2">
              <p className="text-indigo-600 dark:text-indigo-400 text-sm">
                💡 <strong>עכשיו זמין:</strong> מעבר לארכיון לייצוא נתונים ולניהול מתקדם
              </p>
              <p className="text-orange-600 dark:text-orange-400 text-xs">
                📦 <strong>טיפ:</strong> השתמש בכפתור "העבר ימים שעברו לארכיון" למעלה כדי לנקות שיבוצים ישנים
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ShiftForm;