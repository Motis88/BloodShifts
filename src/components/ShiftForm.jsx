
import React, { useState, useEffect, useRef } from 'react';
import { Save, Settings, X, Trash2, Camera } from 'lucide-react';
import ArchiveManager from './ArchiveManager.jsx';
import { ToastContainer } from './Toast.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const ShiftForm = () => {
  const [showArchive, setShowArchive] = useState(false);
  const [showListEditor, setShowListEditor] = useState(false);
  const tableRef = useRef(null);
  const [formData, setFormData] = useState({ date: '', locations: [] });
  const [locationDetails, setLocationDetails] = useState({});
  const [scheduleList, setScheduleList] = useState(() => {
    const saved = localStorage.getItem('bloodshift_schedule');
    return saved ? JSON.parse(saved) : [];
  });
  const [editIndex, setEditIndex] = useState(null);
  const [autoAddNotice, setAutoAddNotice] = useState('');
  const [toasts, setToasts] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, index: null });
  // Dynamic lists for manual add - with localStorage persistence
  const [customLocations, setCustomLocations] = useState(() => {
    const saved = localStorage.getItem('bloodshift_custom_locations');
    return saved ? JSON.parse(saved) : [];
  });
  const [customDoctors, setCustomDoctors] = useState(() => {
    const saved = localStorage.getItem('bloodshift_custom_doctors');
    return saved ? JSON.parse(saved) : [];
  });
  const [customTechnicians, setCustomTechnicians] = useState(() => {
    const saved = localStorage.getItem('bloodshift_custom_technicians');
    return saved ? JSON.parse(saved) : [];
  });

  const baseLocations = ['בית עובד','פתחיה','חולון','רחובות','איגוד ערים דן','משטרה'];
  const doctors = ['מוטי','נטלי גרי','נטלי נבון','מאיה','מיקי','שחר','עדי','דור', ...customDoctors];
  const technicians = ['ליאור','עדן','שירה','תמר','שמעון','עמית','ראשל','ערן','הילה','דנה','שירי','אנה','גל','טל ברכה', ...customTechnicians];

  // Save custom lists to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('bloodshift_custom_locations', JSON.stringify(customLocations));
  }, [customLocations]);

  useEffect(() => {
    localStorage.setItem('bloodshift_custom_doctors', JSON.stringify(customDoctors));
  }, [customDoctors]);

  useEffect(() => {
    localStorage.setItem('bloodshift_custom_technicians', JSON.stringify(customTechnicians));
  }, [customTechnicians]);

  // Toast management functions
  const addToast = (message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // שיבוצים קבועים לפי יום בשבוע
    if (field === 'date' && value) {
      const selectedDate = new Date(value);
      const dayOfWeek = selectedDate.getDay(); // 0=ראשון, 1=שני, 2=שלישי, 3=רביעי, 4=חמישי, 5=שישי, 6=שבת

      // ימים 0-4 = ראשון עד חמישי: איגוד ערים דן
      if (dayOfWeek >= 0 && dayOfWeek <= 4) {
        const autoLocs = ['איגוד ערים דן'];
        const autoDetails = {};

        // יום שלישי (2): משטרה + מוטי רופא + ערן טכנאי
        if (dayOfWeek === 2) {
          autoLocs.push('משטרה');
          autoDetails['משטרה'] = { doctor: 'מוטי', technicians: ['ערן'] };
        }

        // יום רביעי (3): רחובות + עדי רופאה
        if (dayOfWeek === 3) {
          autoLocs.push('רחובות');
          autoDetails['רחובות'] = { doctor: 'עדי', technicians: [] };
        }

        setFormData(prev => {
          const current = prev.locations || [];
          const toAdd = autoLocs.filter(l => !current.includes(l));
          if (toAdd.length === 0) return prev;
          setAutoAddNotice('✅ שיבוצים קבועים נוספו אוטומטית');
          setTimeout(() => setAutoAddNotice(''), 3000);
          return { ...prev, locations: [...current, ...toAdd] };
        });

        if (Object.keys(autoDetails).length > 0) {
          setLocationDetails(prev => {
            const updated = { ...prev };
            for (const [loc, details] of Object.entries(autoDetails)) {
              if (!updated[loc]) {
                updated[loc] = details;
              }
            }
            return updated;
          });
        }
      } else {
        setAutoAddNotice('');
      }
    }
  };
  
  const handleLocationsChange = e => setFormData(prev => ({ ...prev, locations: Array.from(e.target.selectedOptions).map(o=>o.value) }));
  const handleDoctorChange = (loc, doc) => setLocationDetails(prev => ({ ...prev, [loc]: { ...prev[loc], doctor: doc } }));
  const handleTechChange = (loc, e) => setLocationDetails(prev => ({ ...prev, [loc]: { ...prev[loc], technicians: Array.from(e.target.selectedOptions).map(o=>o.value) } }));

  const handleSave = () => {
    if (!formData.date) {
      addToast('נא לבחור תאריך', 'warning');
      return;
    }
    if (formData.locations.length === 0) {
      addToast('נא לבחור לפחות מיקום אחד', 'warning');
      return;
    }

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
      addToast('✅ שיבוץ עודכן בהצלחה!', 'success');
    } else {
      // הוספת שיבוצים חדשים
      const entries = formData.locations.map(loc => ({
        date: formData.date,
        location: loc,
        doctor: locationDetails[loc]?.doctor || '',
        technicians: locationDetails[loc]?.technicians || []
      }));
      newList.push(...entries);
      addToast(`✅ נוספו ${entries.length} שיבוץ/ים בהצלחה!`, 'success');
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
    setConfirmDelete({ isOpen: true, index: idx });
  };

  const confirmDeleteShift = () => {
    const updated=[...scheduleList]; 
    updated.splice(confirmDelete.index,1);
    setScheduleList(updated);
    localStorage.setItem('bloodshift_schedule', JSON.stringify(updated));
    addToast('🗑️ שיבוץ נמחק בהצלחה', 'info');
  };

  const handleEdit = item=>{
    setFormData({ date: item.date, locations: [item.location] });
    setLocationDetails({ [item.location]: { doctor: item.doctor, technicians: item.technicians } });
    setEditIndex(item.originalIndex);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const handleCancelEdit = () => {
    setFormData({ date: '', locations: [] });
    setLocationDetails({});
    setEditIndex(null);
    addToast('✖️ עריכה בוטלה', 'info');
  };

  // העברה לארכיון של ימים שעברו
  const moveOldToArchive = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oldEntries = scheduleList.filter(item => new Date(item.date) < today);
    const currentEntries = scheduleList.filter(item => new Date(item.date) >= today);
    
    if (oldEntries.length === 0) {
      addToast('אין ימים שעברו להעברה לארכיון', 'info');
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
    
    addToast(`📦 ${oldEntries.length} שיבוצים הועברו לארכיון`, 'success');
  };

  // Export table as image
  const exportTableAsImage = async () => {
    if (sorted.length === 0) {
      addToast('אין שיבוצים לייצוא', 'warning');
      return;
    }
    try {
      // Create a clean off-screen table for export
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;background:#fff;padding:20px;font-family:Varela Round,Arial,sans-serif;direction:rtl;min-width:600px;';
      
      const title = document.createElement('h2');
      title.textContent = '🩸 BloodShift - שיבוצים';
      title.style.cssText = 'text-align:center;color:#e11d48;font-size:20px;margin-bottom:4px;';
      container.appendChild(title);

      const dateLabel = document.createElement('p');
      dateLabel.textContent = `📅 ${new Date().toLocaleDateString('he-IL')}`;
      dateLabel.style.cssText = 'text-align:center;color:#666;font-size:12px;margin-bottom:12px;';
      container.appendChild(dateLabel);
      
      const table = document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;text-align:center;';
      
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      ['יום', 'תאריך', 'מיקום', 'רופא', 'טכנאים'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.cssText = 'padding:8px 10px;background:#4f46e5;color:white;border:1px solid #e5e7eb;font-weight:600;';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      const tbody = document.createElement('tbody');
      sorted.forEach((item, i) => {
        const row = document.createElement('tr');
        row.style.cssText = i % 2 === 0 ? 'background:#f8fafc;' : 'background:#ffffff;';
        
        const cells = [
          hebDayLetter(item.date),
          item.date,
          item.location,
          item.doctor || '-',
          item.technicians?.join(', ') || '-'
        ];
        
        cells.forEach(text => {
          const td = document.createElement('td');
          td.textContent = text;
          td.style.cssText = 'padding:6px 10px;border:1px solid #e5e7eb;color:#1e293b;';
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      container.appendChild(table);
      
      document.body.appendChild(container);
      
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      
      document.body.removeChild(container);
      
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `BloodShift_${new Date().toISOString().split('T')[0]}.png`;

      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'BloodShift - שיבוצים',
          url: savedFile.uri,
        });
      } else {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
      addToast('📸 התמונה נשמרה בהצלחה!', 'success');
    } catch {
      addToast('שגיאה בייצוא התמונה', 'error');
    }
  };

  // List editor component
  const ListEditor = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">⚙️ עריכת רשימות</h3>
          <button onClick={() => setShowListEditor(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        
        {/* Custom Locations */}
        {customLocations.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📍 מיקומים מותאמים אישית</h4>
            <div className="space-y-1">
              {customLocations.map((loc, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                  <span className="text-sm text-gray-800 dark:text-gray-200">{loc}</span>
                  <button onClick={() => {
                    setCustomLocations(customLocations.filter((_, idx) => idx !== i));
                    addToast(`🗑️ "${loc}" הוסר מהמיקומים`, 'info');
                  }} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Doctors */}
        {customDoctors.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">👨‍⚕️ רופאים מותאמים אישית</h4>
            <div className="space-y-1">
              {customDoctors.map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                  <span className="text-sm text-gray-800 dark:text-gray-200">{doc}</span>
                  <button onClick={() => {
                    setCustomDoctors(customDoctors.filter((_, idx) => idx !== i));
                    addToast(`🗑️ "${doc}" הוסר מהרופאים`, 'info');
                  }} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Technicians */}
        {customTechnicians.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🔧 טכנאים מותאמים אישית</h4>
            <div className="space-y-1">
              {customTechnicians.map((tech, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                  <span className="text-sm text-gray-800 dark:text-gray-200">{tech}</span>
                  <button onClick={() => {
                    setCustomTechnicians(customTechnicians.filter((_, idx) => idx !== i));
                    addToast(`🗑️ "${tech}" הוסר מהטכנאים`, 'info');
                  }} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {customLocations.length === 0 && customDoctors.length === 0 && customTechnicians.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">אין פריטים מותאמים אישית עדיין. הוסף דרך הטופס.</p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {showListEditor && <ListEditor />}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, index: null })}
        onConfirm={confirmDeleteShift}
        title="⚠️ אישור מחיקה"
        message="האם אתה בטוח שברצונך למחוק את השיבוץ? פעולה זו לא ניתנת לביטול."
        confirmText="מחק"
        cancelText="ביטול"
        type="danger"
      />
      <div className="max-w-6xl mx-auto mt-4 p-6 rounded-3xl shadow-2xl border-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg">
      {/* כותרת */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 mb-2 flex items-center justify-center gap-2 drop-shadow-lg">
          🩸 BloodShift
        </h1>
      </div>

      {/* כפתורי ניווט */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="flex bg-gray-100 dark:bg-zinc-800/60 rounded-xl p-1.5 shadow">
          <button
            onClick={() => setShowArchive(false)}
            className={`px-4 py-2 rounded-full font-bold transition-all duration-200 shadow-sm text-sm ${
              !showArchive 
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white scale-105' 
                : 'text-gray-700 dark:text-gray-100 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:shadow-lg'
            }`}
          >
            שיבוצים
          </button>
          <button
            onClick={() => setShowArchive(true)}
            className={`ml-2 px-4 py-2 rounded-full font-bold transition-all duration-200 shadow-sm text-sm ${
              showArchive 
                ? 'bg-gradient-to-r from-pink-500 to-yellow-500 text-white scale-105' 
                : 'text-gray-700 dark:text-gray-100 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:shadow-lg'
            }`}
          >
            ארכיון
          </button>
        </div>
        <button
          onClick={() => setShowListEditor(true)}
          className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors shadow-sm"
          title="עריכת רשימות"
        >
          <Settings size={18} />
        </button>
      </div>

      {showArchive ? (
        <ArchiveManager />
      ) : (
        <>
          {/* הודעת תוספת אוטומטית */}
          {autoAddNotice && (
            <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600 rounded-xl text-green-800 dark:text-green-200 font-bold text-center animate-pulse shadow-lg">
              {autoAddNotice}
            </div>
          )}

          {/* טופס שיבוץ יומי */}
          <div className="bg-gradient-to-r from-blue-100/80 to-indigo-100/80 dark:from-blue-900/60 dark:to-indigo-900/60 rounded-xl p-4 mb-4 shadow-md backdrop-blur">
            <h2 className="text-lg font-extrabold mb-3 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-200 dark:to-indigo-300 flex items-center justify-center gap-2 drop-shadow">
              📅 טופס שיבוץ יומי
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-200">
                  תאריך השיבוץ
                </label>
                <input 
                  type="date" 
                  value={formData.date} 
                  onChange={e=>handleChange('date',e.target.value)} 
                  className="w-full p-2.5 border-2 border-blue-200 dark:border-blue-700 rounded-xl bg-white/80 dark:bg-zinc-900/60 text-gray-900 dark:text-gray-100 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900 transition-all"
                />
              </div>
              {formData.date && (
                <div className="mb-3">
                  <label className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-200 block">
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
                    className="w-full p-2.5 border-2 border-blue-200 dark:border-blue-700 rounded-xl h-28 bg-white/80 dark:bg-zinc-900/60 text-gray-900 dark:text-gray-100 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900 transition-all"
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
                  <div key={loc} className="mb-3 p-4 bg-white/90 dark:bg-zinc-900/80 border-2 border-blue-200 dark:border-blue-700 rounded-xl shadow-md backdrop-blur">
                    <h3 className="font-bold mb-2 text-sm text-blue-900 dark:text-blue-200">
                      שיבוץ עבור {loc}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-200 block">
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
                          className="w-full p-2 border-2 border-blue-200 dark:border-blue-700 rounded-lg bg-white/80 dark:bg-zinc-900/60 text-gray-900 dark:text-gray-100 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900 transition-all"
                        >
                          <option value="">בחר רופא</option>
                          {doctors.map(doc=><option key={doc} value={doc}>{doc}</option>)}
                          <option value="__add_doctor__">➕ הוסף רופא חדש...</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-200 block">
                          טכנאים:
                        </label>
                        
                        {/* רשימת טכנאים עם צ'קבוקסים */}
                        <div className="max-h-36 overflow-y-auto p-2 border-2 border-blue-200 dark:border-blue-700 rounded-lg bg-white/80 dark:bg-zinc-900/60">
                          {technicians.map(tech => {
                            const isSelected = (locationDetails[loc]?.technicians || []).includes(tech);
                            return (
                              <label key={tech} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm transition-colors ${
                                isSelected ? 'bg-orange-100 dark:bg-orange-900/40 font-medium' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const currentTechs = locationDetails[loc]?.technicians || [];
                                    const newTechs = isSelected 
                                      ? currentTechs.filter(t => t !== tech)
                                      : [...currentTechs, tech];
                                    setLocationDetails(prev => ({
                                      ...prev,
                                      [loc]: { ...prev[loc], technicians: newTechs }
                                    }));
                                  }}
                                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                                />
                                <span className="text-gray-800 dark:text-gray-200">{tech}</span>
                              </label>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              const newTechnician = prompt('הזן שם טכנאי חדש:');
                              if (newTechnician && newTechnician.trim() && !customTechnicians.includes(newTechnician.trim())) {
                                setCustomTechnicians([...customTechnicians, newTechnician.trim()]);
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded w-full mt-1"
                          >
                            ➕ הוסף טכנאי חדש...
                          </button>
                        </div>
                        
                        {/* תצוגת טכנאים נבחרים */}
                        {locationDetails[loc]?.technicians && locationDetails[loc].technicians.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {locationDetails[loc].technicians.map(tech => (
                              <span key={tech} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/80 text-orange-900 dark:text-orange-100 rounded-full text-xs font-medium shadow">
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
                <div className="flex gap-2">
                  <button 
                    onClick={handleSave} 
                    className="flex-1 p-2.5 rounded-xl font-bold text-sm shadow-md bg-gradient-to-r from-pink-500 to-indigo-500 text-white hover:from-pink-600 hover:to-indigo-600 transform hover:scale-102 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    {editIndex !== null ? '💾 עדכן שיבוץ' : '✅ שמור שיבוץ'}
                  </button>
                  {editIndex !== null && (
                    <button 
                      onClick={handleCancelEdit}
                      className="px-4 p-2.5 rounded-xl font-bold text-sm shadow-md bg-gray-500 text-white hover:bg-gray-600 transform hover:scale-102 transition-all duration-200 flex items-center justify-center gap-1"
                    >
                      ✖️ ביטול
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* טבלה לפי תאריכים */}
          <div ref={tableRef} className="mb-4 bg-white/90 dark:bg-zinc-900/80 rounded-xl border-0 shadow-xl overflow-hidden backdrop-blur">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 shadow-md flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold">
                📅 כל השיבוצים לפי תאריך
              </h3>
              <button
                onClick={exportTableAsImage}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs transition-colors"
              >
                <Camera size={14} />
                ייצוא תמונה
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
                    sorted.map((item, idx) => {
                      const isPast = new Date(item.date) < new Date(new Date().setHours(0, 0, 0, 0));
                      const isToday = new Date(item.date).toDateString() === new Date().toDateString();
                      return (
                      <tr key={item.originalIndex} className={`transition-colors ${
                        isPast 
                          ? 'bg-gray-100 dark:bg-zinc-800/60 opacity-70' 
                          : isToday 
                            ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' 
                            : 'hover:bg-indigo-50 dark:hover:bg-zinc-800/40'
                      }`}>
                        <td className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{hebDayLetter(item.date)}</span>
                            {isToday && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">היום</span>}
                            {isPast && <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">עבר</span>}
                          </div>
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
                        <td className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
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
                        <td className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
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
                      );
                    })
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  פעולה זו תעביר את כל השיבוצים מימים שעברו לארכיון ותשאיר רק עתיד והיום
                </p>
              </div>
            )}
          </div>

          {/* סטטיסטיקות */}
          <div className="bg-gradient-to-r from-indigo-100/80 to-purple-100/80 dark:from-indigo-900/60 dark:to-purple-900/60 border border-indigo-200 dark:border-purple-900 rounded-xl p-4 mt-4 shadow-md backdrop-blur">
            <h3 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-200 dark:to-purple-300 text-sm mb-3 flex items-center gap-2 drop-shadow">
              📊 סטטיסטיקות מערכת
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/90 dark:bg-zinc-900/80 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 text-center shadow">
                <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{scheduleList.length}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">סה"כ שיבוצים</div>
              </div>
              <div className="bg-white/90 dark:bg-zinc-900/80 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 text-center">
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {new Set(scheduleList.map(s => s.location)).size}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">מיקומים</div>
              </div>
              <div className="bg-white/90 dark:bg-zinc-900/80 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 text-center">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {new Set(scheduleList.map(s => s.doctor).filter(Boolean)).size}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">רופאים פעילים</div>
              </div>
            </div>
            {/* שיבוצים לפי טכנאי */}
            {(() => {
              const techCount = {};
              scheduleList.forEach(s => {
                (s.technicians || []).forEach(t => {
                  techCount[t] = (techCount[t] || 0) + 1;
                });
              });
              const sorted = Object.entries(techCount).sort((a, b) => b[1] - a[1]);
              return (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2">🔧 שיבוצים לפי טכנאי</h4>
                  {sorted.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center">אין שיבוצי טכנאים עדיין</p>
                  ) : (
                    <div className="space-y-1">
                      {sorted.map(([tech, count]) => (
                        <div key={tech} className="flex items-center gap-2">
                          <span className="text-xs text-gray-700 dark:text-gray-300 w-20 truncate">{tech}</span>
                          <div className="flex-1 bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                            <div
                              className="bg-indigo-500 dark:bg-indigo-400 h-2 rounded-full transition-all"
                              style={{ width: `${Math.round((count / sorted[0][1]) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 w-5 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
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
    </>
  );
};

export default ShiftForm;