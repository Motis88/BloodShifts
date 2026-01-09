import React, { useState, useMemo } from 'react';
import { 
  Download, Upload, Search, Filter, FileSpreadsheet, 
  FileText, Calendar, MapPin, Users, UserCheck,
  TrendingUp, BarChart3, RefreshCw,
  Archive, Database, Settings, Eye, Trash2, FolderOpen
} from 'lucide-react';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const ArchiveManager = () => {
  const [currentData, setCurrentData] = useState(() => {
    const saved = localStorage.getItem('bloodshift_schedule');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [archiveData, setArchiveData] = useState(() => {
    const archived = localStorage.getItem('bloodshift_archive');
    return archived ? JSON.parse(archived) : [];
  });

  const [viewFilter, setViewFilter] = useState('archive'); // 'all', 'current', 'archive'
  
  // חישוב הנתונים לתצוגה לפי המסנן
  const scheduleList = useMemo(() => {
    switch(viewFilter) {
      case 'current': return currentData;
      case 'archive': return archiveData;
      case 'all': 
      default: return [...currentData, ...archiveData];
    }
  }, [currentData, archiveData, viewFilter]);

  // Gather unique values for select filters
  const uniqueLocations = [...new Set(scheduleList.map(s => s.location))];
  const uniqueDoctors = [...new Set(scheduleList.map(s => s.doctor).filter(Boolean))];
  const uniqueTechnicians = [...new Set(scheduleList.flatMap(s => s.technicians))];
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    location: '',
    doctor: '',
    technician: '',
    searchTerm: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table', 'stats', 'charts'

  // סינון הנתונים
  const filteredData = useMemo(() => {
    return scheduleList.filter(item => {
      const matchesDateRange = (!filters.startDate || new Date(item.date) >= new Date(filters.startDate)) &&
                              (!filters.endDate || new Date(item.date) <= new Date(filters.endDate));
      const matchesLocation = !filters.location || item.location === filters.location;
      const matchesDoctor = !filters.doctor || item.doctor === filters.doctor;
      const matchesTechnician = !filters.technician || 
               item.technicians.includes(filters.technician);
      const matchesSearch = !filters.searchTerm || 
                           [item.location, item.doctor, ...item.technicians].some(field => 
                             field.toLowerCase().includes(filters.searchTerm.toLowerCase()));
      
      return matchesDateRange && matchesLocation && matchesDoctor && matchesTechnician && matchesSearch;
    });
  }, [scheduleList, filters]);

  // חישוב סטטיסטיקות
  const stats = useMemo(() => {
    const data = filteredData;
    const uniqueLocations = [...new Set(data.map(s => s.location))];
    const uniqueDoctors = [...new Set(data.map(s => s.doctor).filter(Boolean))];
    const uniqueTechnicians = [...new Set(data.flatMap(s => s.technicians))];
    
    const locationCounts = {};
    const doctorCounts = {};
    const technicianCounts = {};
    
    data.forEach(item => {
      locationCounts[item.location] = (locationCounts[item.location] || 0) + 1;
      if (item.doctor) doctorCounts[item.doctor] = (doctorCounts[item.doctor] || 0) + 1;
      item.technicians.forEach(tech => {
        technicianCounts[tech] = (technicianCounts[tech] || 0) + 1;
      });
    });

    return {
      total: data.length,
      locations: uniqueLocations.length,
      doctors: uniqueDoctors.length,
      technicians: uniqueTechnicians.length,
      locationCounts,
      doctorCounts,
      technicianCounts
    };
  }, [filteredData]);

  // יצוא לאקסל
  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert('אין נתונים לייצוא');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Archive');
    const fileName = `BloodShift_Archive_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // יצוא ל-PDF
  const exportToPDF = () => {
    if (filteredData.length === 0) {
      alert('אין נתונים לייצוא');
      return;
    }

    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'normal');
    
    // כותרת
    pdf.setFontSize(20);
    pdf.text('BloodShift Archive Report', 20, 20);
    pdf.setFontSize(12);
    pdf.text(`Generated: ${new Date().toLocaleDateString('he-IL')}`, 20, 30);
    pdf.text(`Total Records: ${filteredData.length}`, 20, 40);

    // נתונים
    let yPosition = 60;
    const pageHeight = pdf.internal.pageSize.height;
    
    filteredData.forEach((item, index) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.text(`${index + 1}. Date: ${item.date}`, 20, yPosition);
      pdf.text(`   Location: ${item.location}`, 20, yPosition + 8);
      pdf.text(`   Doctor: ${item.doctor || 'Not assigned'}`, 20, yPosition + 16);
      pdf.text(`   Technicians: ${item.technicians.join(', ') || 'None'}`, 20, yPosition + 24);
      
      yPosition += 35;
    });

    const fileName = `BloodShift_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  };

  // יצוא JSON
  const exportToJSON = () => {
    if (filteredData.length === 0) {
      alert('אין נתונים לייצוא');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalRecords: filteredData.length,
      filters: filters,
      statistics: stats,
      data: filteredData
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const fileName = `BloodShift_Data_${new Date().toISOString().split('T')[0]}.json`;
    saveAs(dataBlob, fileName);
  };

  // ייבוא JSON
  const importFromJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData.data && Array.isArray(importedData.data)) {
          const mergedData = [...currentData];
          let importCount = 0;
          
          importedData.data.forEach(item => {
            // בדיקה אם הרשומה כבר קיימת
            const exists = mergedData.some(existing => 
              existing.date === item.date &&
              existing.location === item.location
            );
            
            if (!exists) {
              mergedData.push(item);
              importCount++;
            }
          });

          setCurrentData(mergedData);
          localStorage.setItem('bloodshift_schedule', JSON.stringify(mergedData));
          alert(`יובאו בהצלחה ${importCount} רשומות חדשות (${importedData.data.length - importCount} כבר קיימות)`);
        } else {
          alert('קובץ לא תקין - לא נמצאו נתונים');
        }
      } catch (error) {
        alert('שגיאה בקריאת הקובץ: ' + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // איפוס השדה
  };

  // ניקוי מסנן
  const clearFilters = () => {
    setFilters({
      startDate: '', endDate: '', location: '', 
      doctor: '', technician: '', searchTerm: ''
    });
  };

  // פונקציות ניהול ארכיון
  const clearArchive = () => {
    if (confirm('האם אתה בטוח שברצונך למחוק את כל הארכיון? פעולה זו בלתי הפיכה!')) {
      localStorage.removeItem('bloodshift_archive');
      setArchiveData([]);
      alert('הארכיון נוקה בהצלחה');
    }
  };

  const refreshArchiveData = () => {
    const saved = localStorage.getItem('bloodshift_schedule');
    const archived = localStorage.getItem('bloodshift_archive');
    const current = saved ? JSON.parse(saved) : [];
    const archive = archived ? JSON.parse(archived) : [];
    setCurrentData(current);
    setArchiveData(archive);
    alert('נתוני הארכיון רוענו בהצלחה');
  };

  // חישוב סטטיסטיקות ארכיון
  const archiveStats = useMemo(() => {
    return {
      archiveCount: archiveData.length,
      currentCount: currentData.length,
      totalCount: archiveData.length + currentData.length,
      oldestDate: archiveData.length > 0 ? 
        Math.min(...archiveData.map(item => new Date(item.date).getTime())) : null,
      newestDate: currentData.length > 0 ? 
        Math.max(...currentData.map(item => new Date(item.date).getTime())) : null
    };
  }, [currentData, archiveData]);

  return (
    <div className="space-y-6">
      {/* כותרת מודרנית */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-2xl flex items-center justify-center">
              <Archive size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">ארכיון נתונים</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">ניהול, חיפוש וייצוא נתוני שיבוצים</p>
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{filteredData.length}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">רשומות</div>
          </div>
        </div>
      </div>

      {/* פרטי ארכיון וניהול */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl border border-orange-200 dark:border-orange-800 p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0 mb-4">
          <div className="flex items-center gap-3">
            <FolderOpen size={20} className="text-orange-600 dark:text-orange-400" />
            <h3 className="text-base md:text-lg font-bold text-orange-800 dark:text-orange-300">ניהול ארכיון</h3>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={refreshArchiveData}
              className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs md:text-sm flex-1 md:flex-initial"
            >
              <RefreshCw size={14} className="md:w-4 md:h-4" />
              <span>רענן</span>
            </button>
            <button
              onClick={clearArchive}
              className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs md:text-sm flex-1 md:flex-initial"
            >
              <Trash2 size={14} className="md:w-4 md:h-4" />
              <span>נקה</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg text-center border border-orange-200 dark:border-orange-700">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{archiveStats.archiveCount}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">בארכיון</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg text-center border border-orange-200 dark:border-orange-700">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{archiveStats.currentCount}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">נוכחיים</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg text-center border border-orange-200 dark:border-orange-700">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{archiveStats.totalCount}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">סה"כ</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg text-center border border-orange-200 dark:border-orange-700">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {archiveStats.oldestDate ? 
                Math.ceil((Date.now() - archiveStats.oldestDate) / (1000 * 60 * 60 * 24)) : 0}
            </div>
            <div className="text-xs text-gray-600">ימים בארכיון</div>
          </div>
        </div>
      </div>

      {/* כפתורי תצוגה */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center justify-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-all text-xs md:text-sm flex-1 md:flex-initial ${
                viewMode === 'table' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-zinc-700/50'
              }`}
            >
              <Database size={16} />
              <span className="hidden sm:inline">טבלה</span>
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`flex items-center justify-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-all text-xs md:text-sm flex-1 md:flex-initial ${
                viewMode === 'stats' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-zinc-700/50'
              }`}
            >
              <TrendingUp size={16} />
              <span className="hidden sm:inline">סטטיסטיקות</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* כפתורי סינון נתונים */}
            <div className="flex gap-1 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-1">
              <button
                onClick={() => setViewFilter('archive')}
                className={`px-2 md:px-3 py-1 rounded-lg transition-all text-xs flex-1 sm:flex-initial ${
                  viewFilter === 'archive' ? 'bg-orange-500 text-white shadow-sm font-medium' : 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                }`}
              >
                📦 ארכיון
              </button>
              <button
                onClick={() => setViewFilter('current')}
                className={`px-2 md:px-3 py-1 rounded-lg transition-all text-xs flex-1 sm:flex-initial ${
                  viewFilter === 'current' ? 'bg-blue-500 text-white shadow-sm font-medium' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                }`}
              >
                📅 נוכחי
              </button>
              <button
                onClick={() => setViewFilter('all')}
                className={`px-2 md:px-3 py-1 rounded-lg transition-all text-xs flex-1 sm:flex-initial ${
                  viewFilter === 'all' ? 'bg-purple-500 text-white shadow-sm font-medium' : 'text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                }`}
              >
                🔍 הכל
              </button>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all text-xs md:text-sm"
            >
              <Filter size={16} />
              <span>מסננים</span>
            </button>
          </div>
        </div>
      </div>

      {/* מסננים */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Settings size={20} />
              🔍 מסננים מתקדמים
            </h3>
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              <RefreshCw size={16} />
              נקה הכל
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                <Calendar size={16} />
                מתאריך
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters(prev => ({...prev, startDate: e.target.value}))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Calendar size={16} />
                עד תאריך
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters(prev => ({...prev, endDate: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <MapPin size={16} />
                מיקום
              </label>
              <select
                value={filters.location}
                onChange={e => setFilters(prev => ({...prev, location: e.target.value}))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="">הכל</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <UserCheck size={16} />
                רופא
              </label>
              <select
                value={filters.doctor}
                onChange={e => setFilters(prev => ({...prev, doctor: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">הכל</option>
                {uniqueDoctors.map(doc => (
                  <option key={doc} value={doc}>{doc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Users size={16} />
                טכנאי
              </label>
              <select
                value={filters.technician}
                onChange={e => setFilters(prev => ({...prev, technician: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">הכל</option>
                {uniqueTechnicians.map(tech => (
                  <option key={tech} value={tech}>{tech}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Search size={16} />
                חיפוש כללי
              </label>
              <input
                type="text"
                value={filters.searchTerm}
                onChange={e => setFilters(prev => ({...prev, searchTerm: e.target.value}))}
                placeholder="חפש בכל השדות..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* כפתורי ייצוא וייבוא */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2 text-sm md:text-base">
          <Download size={20} />
          📥 ייצוא וייבוא נתונים
        </h3>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-xs md:text-sm"
          >
            <FileSpreadsheet size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="hidden sm:inline">📊 אקסל</span>
            <span className="sm:hidden">📊</span>
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-xs md:text-sm"
          >
            <FileText size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="hidden sm:inline">📄 PDF</span>
            <span className="sm:hidden">📄</span>
          </button>
          <button
            onClick={exportToJSON}
            className="flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs md:text-sm"
          >
            <Database size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="hidden sm:inline">💾 JSON</span>
            <span className="sm:hidden">💾</span>
          </button>
          <label className="flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all cursor-pointer text-xs md:text-sm">
            <Upload size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="hidden sm:inline">📤 ייבוא</span>
            <span className="sm:hidden">📤</span>
            <input
              type="file"
              accept=".json"
              onChange={importFromJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* תוכן לפי מצב תצוגה */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-zinc-800 border-b dark:border-gray-700">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Eye size={20} />
              📋 רשימת שיבוצים ({filteredData.length})
            </h3>
          </div>
          {filteredData.length > 0 ? (
            <>
              {/* תצוגת כרטיסים למובייל */}
              <div className="block md:hidden">
                <div className="p-3 space-y-3">
                  {filteredData.map((item, index) => (
                    <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200 dark:border-blue-800">
                        <div className="text-lg font-bold text-blue-900 dark:text-blue-300">{item.date}</div>
                        <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">{item.location}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <UserCheck size={16} className="text-purple-600 dark:text-purple-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">רופא:</span>
                          {item.doctor ? (
                            <span className="inline-flex items-center px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
                              {item.doctor}
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">לא נבחר</span>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          <Users size={16} className="text-orange-600 dark:text-orange-400 mt-1" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">טכנאים:</span>
                          <div className="flex flex-wrap gap-1">
                            {item.technicians.length > 0 ? item.technicians.map((tech, techIndex) => (
                              <span key={techIndex} className="inline-flex items-center px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 rounded-full text-xs font-medium">
                                {tech}
                              </span>
                            )) : (
                              <span className="text-gray-500 dark:text-gray-400 text-sm">לא נבחרו</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* תצוגת טבלה למסכים גדולים */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">תאריך</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">מיקום</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">רופא</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">טכנאים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, index) => (
                      <tr key={index} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800">
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{item.date}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{item.location}</td>
                        <td className="px-4 py-3">
                          {item.doctor ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded-full text-xs">
                              <UserCheck size={12} />
                              {item.doctor}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">לא נבחר</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.technicians.map((tech, techIndex) => (
                              <span key={techIndex} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 rounded-full text-xs">
                                <Users size={10} />
                                {tech}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Database size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">אין נתונים להצגה</h3>
              <p className="text-gray-500 dark:text-gray-400">לא נמצאו רשומות התואמות למסננים שנבחרו</p>
            </div>
          )}
        </div>
      )}

      {viewMode === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              📊 סטטיסטיקות כלליות
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-blue-800 font-medium">סה"כ שיבוצים</span>
                <span className="text-2xl font-bold text-blue-600">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-green-800 font-medium">מיקומים פעילים</span>
                <span className="text-2xl font-bold text-green-600">{stats.locations}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-purple-800 font-medium">רופאים פעילים</span>
                <span className="text-2xl font-bold text-purple-600">{stats.doctors}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-orange-800 font-medium">טכנאים פעילים</span>
                <span className="text-2xl font-bold text-orange-600">{stats.technicians}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin size={20} />
              🏥 שיבוצים לפי מיקום
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.locationCounts).map(([location, count]) => (
                <div key={location} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{location}</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserCheck size={20} />
              👨‍⚕️ שיבוצים לפי רופא
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.doctorCounts).map(([doctor, count]) => (
                <div key={doctor} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{doctor}</span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'charts' && (
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
          <BarChart3 size={64} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-4">📈 גרפים וויזואליזציה</h3>
          <p className="text-gray-600 mb-6">
            תכונה זו תוסף בגרסה עתידית ותכלול גרפים אינטראקטיביים ומתקדמים
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">💡 תכונות מתוכננות:</h4>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>📊 גרף עמודות לשיבוצים לפי מיקום</li>
              <li>🥧 גרף עוגה לחלוקת רופאים</li>
              <li>📈 גרף קווים למגמות לאורך זמן</li>
              <li>🎨 תצוגה אינטראקטיבית</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveManager;