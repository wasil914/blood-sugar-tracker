import React, { useState, useEffect } from 'react';
import { Plus, Download, Trash2, Calendar, Bell, TrendingUp, Activity } from 'lucide-react';

const BloodSugarTracker = () => {
  const [readings, setReadings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [viewPeriod, setViewPeriod] = useState('1week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    value: '',
    type: 'fasting'
  });

  // Load data from storage on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = localStorage.getItem('blood-sugar-readings');
      if (result) {
        setReadings(JSON.parse(result));
      }
      
      const telegramResult = localStorage.getItem('telegram-chat-id');
      if (telegramResult) {
        setTelegramChatId(telegramResult);
      }
    } catch (error) {
      console.log('No existing data or error loading:', error);
    }
  };

  const saveData = async (newReadings) => {
    try {
      localStorage.setItem('blood-sugar-readings', JSON.stringify(newReadings));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const saveTelegramId = async (chatId) => {
    try {
      localStorage.setItem('telegram-chat-id', chatId);
      setTelegramChatId(chatId);
    } catch (error) {
      console.error('Error saving Telegram ID:', error);
    }
  };

  const addReading = () => {
    if (!formData.value) {
      alert('Please enter blood sugar value');
      return;
    }

    const newReading = {
      id: Date.now(),
      ...formData,
      timestamp: new Date(`${formData.date}T${formData.time}`).getTime()
    };

    const updatedReadings = [...readings, newReading].sort((a, b) => b.timestamp - a.timestamp);
    setReadings(updatedReadings);
    saveData(updatedReadings);
    
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      value: '',
      type: 'fasting'
    });
    setShowForm(false);
  };

  const deleteReading = (id) => {
    if (confirm('Delete this reading?')) {
      const updatedReadings = readings.filter(r => r.id !== id);
      setReadings(updatedReadings);
      saveData(updatedReadings);
    }
  };

  const getFilteredReadings = () => {
    const now = new Date().getTime();
    let startTime;

    switch(viewPeriod) {
      case '3days':
        startTime = now - (3 * 24 * 60 * 60 * 1000);
        break;
      case '1week':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '15days':
        startTime = now - (15 * 24 * 60 * 60 * 1000);
        break;
      case '1month':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startTime = now - (90 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) return readings;
        const start = new Date(customStartDate).getTime();
        const end = new Date(customEndDate).setHours(23, 59, 59);
        return readings.filter(r => r.timestamp >= start && r.timestamp <= end);
      default:
        return readings;
    }

    return readings.filter(r => r.timestamp >= startTime);
  };

  const calculateStats = (filteredReadings) => {
    if (filteredReadings.length === 0) return { avg: 0, min: 0, max: 0 };
    
    const values = filteredReadings.map(r => parseFloat(r.value));
    return {
      avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  const exportToPDF = async () => {
    const filteredReadings = getFilteredReadings();
    const stats = calculateStats(filteredReadings);
    
    // Dynamic import to keep initial bundle small
    const { jsPDF } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 102, 204);
    doc.text('Blood Sugar Tracker Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    // Period info
    doc.setFontSize(12);
    doc.setTextColor(0);
    let periodText = '';
    switch(viewPeriod) {
      case '3days': periodText = 'Last 3 Days'; break;
      case '1week': periodText = 'Last Week'; break;
      case '15days': periodText = 'Last 15 Days'; break;
      case '1month': periodText = 'Last Month'; break;
      case '3months': periodText = 'Last 3 Months'; break;
      case 'custom': periodText = `${customStartDate} to ${customEndDate}`; break;
    }
    doc.text(`Period: ${periodText}`, 20, 40);
    
    // Statistics box
    doc.setFillColor(240, 248, 255);
    doc.rect(20, 45, 170, 25, 'F');
    doc.setFontSize(11);
    doc.text(`Total Readings: ${filteredReadings.length}`, 25, 53);
    doc.text(`Average: ${stats.avg} mg/dL`, 25, 60);
    doc.text(`Min: ${stats.min} mg/dL`, 80, 60);
    doc.text(`Max: ${stats.max} mg/dL`, 130, 60);
    
    // Table header
    let y = 80;
    doc.setFillColor(0, 102, 204);
    doc.rect(20, y, 170, 8, 'F');
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text('Date', 25, y + 5);
    doc.text('Time', 60, y + 5);
    doc.text('Reading (mg/dL)', 90, y + 5);
    doc.text('Type', 140, y + 5);
    
    // Table rows
    doc.setTextColor(0);
    y += 10;
    
    filteredReadings.forEach((reading, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      const bgColor = index % 2 === 0 ? 250 : 255;
      doc.setFillColor(bgColor);
      doc.rect(20, y, 170, 8, 'F');
      
      const readingDate = new Date(reading.timestamp);
      doc.text(readingDate.toLocaleDateString(), 25, y + 5);
      doc.text(reading.time, 60, y + 5);
      
      // Color code the reading
      const value = parseFloat(reading.value);
      if (value < 70 || value > 180) {
        doc.setTextColor(220, 38, 38);
      } else if (value >= 70 && value <= 100) {
        doc.setTextColor(34, 197, 94);
      } else {
        doc.setTextColor(234, 179, 8);
      }
      doc.text(reading.value, 100, y + 5);
      
      doc.setTextColor(0);
      doc.text(reading.type === 'fasting' ? 'Fasting' : 'Normal', 140, y + 5);
      
      y += 8;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
      doc.text('Disclaimer: This is for tracking purposes only. Consult your healthcare provider.', 105, 285, { align: 'center' });
    }
    
    doc.save(`blood-sugar-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredReadings = getFilteredReadings();
  const stats = calculateStats(filteredReadings);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-3 rounded-xl">
                <Activity className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Blood Sugar Tracker</h1>
                <p className="text-gray-500 text-sm">Monitor your glucose levels</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowTelegramSetup(!showTelegramSetup)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <Bell size={18} />
                <span className="hidden sm:inline">Reminders</span>
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                <Plus size={18} />
                Add Reading
              </button>
            </div>
          </div>
        </div>

        {/* Telegram Setup */}
        {showTelegramSetup && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="text-blue-600" />
              Setup Daily Reminders
            </h3>
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                <p className="text-sm text-gray-700 mb-2"><strong>Step 1:</strong> Open Telegram and search for <code className="bg-white px-2 py-1 rounded">@YourBotName</code></p>
                <p className="text-sm text-gray-700 mb-2"><strong>Step 2:</strong> Send <code className="bg-white px-2 py-1 rounded">/start</code> to the bot</p>
                <p className="text-sm text-gray-700"><strong>Step 3:</strong> Copy your Chat ID and paste below</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter your Telegram Chat ID"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => saveTelegramId(telegramChatId)}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  Save
                </button>
              </div>
              {telegramChatId && (
                <p className="text-green-600 text-sm">✓ Reminders enabled! You'll receive daily notifications.</p>
              )}
            </div>
          </div>
        )}

        {/* Add Reading Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Add New Reading</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reading (mg/dL)</label>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  placeholder="e.g., 95"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="fasting">Fasting</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={addReading}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                Save Reading
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Average</p>
                <p className="text-2xl font-bold text-blue-600">{stats.avg}</p>
                <p className="text-gray-400 text-xs">mg/dL</p>
              </div>
              <TrendingUp className="text-blue-600" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Minimum</p>
                <p className="text-2xl font-bold text-green-600">{stats.min || 0}</p>
                <p className="text-gray-400 text-xs">mg/dL</p>
              </div>
              <Activity className="text-green-600" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Maximum</p>
                <p className="text-2xl font-bold text-red-600">{stats.max || 0}</p>
                <p className="text-gray-400 text-xs">mg/dL</p>
              </div>
              <Activity className="text-red-600" size={32} />
            </div>
          </div>
        </div>

        {/* View Period Selector */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-blue-600" />
            <h3 className="text-lg font-semibold">View Period</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {['3days', '1week', '15days', '1month', '3months', 'custom'].map(period => (
              <button
                key={period}
                onClick={() => setViewPeriod(period)}
                className={`px-4 py-2 rounded-lg transition ${
                  viewPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period === '3days' && '3 Days'}
                {period === '1week' && '1 Week'}
                {period === '15days' && '15 Days'}
                {period === '1month' && '1 Month'}
                {period === '3months' && '3 Months'}
                {period === 'custom' && 'Custom Range'}
              </button>
            ))}
          </div>
          
          {viewPeriod === 'custom' && (
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Readings Table */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Your Readings ({filteredReadings.length})</h3>
            {filteredReadings.length > 0 && (
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                <Download size={18} />
                Export PDF
              </button>
            )}
          </div>
          
          {filteredReadings.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">No readings yet. Add your first reading!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Reading</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReadings.map((reading, index) => {
                    const value = parseFloat(reading.value);
                    let status = 'Normal';
                    let statusColor = 'bg-green-100 text-green-800';
                    
                    if (value < 70) {
                      status = 'Low';
                      statusColor = 'bg-red-100 text-red-800';
                    } else if (value > 180) {
                      status = 'High';
                      statusColor = 'bg-red-100 text-red-800';
                    } else if (value > 100) {
                      status = 'Elevated';
                      statusColor = 'bg-yellow-100 text-yellow-800';
                    }
                    
                    const readingDate = new Date(reading.timestamp);
                    
                    return (
                      <tr key={reading.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-3 px-4 text-sm">{readingDate.toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-sm">{reading.time}</td>
                        <td className="py-3 px-4 text-sm font-semibold">{reading.value} mg/dL</td>
                        <td className="py-3 px-4 text-sm capitalize">{reading.type}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => deleteReading(reading.id)}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>⚕️ Disclaimer: This is for tracking purposes only. Always consult your healthcare provider.</p>
          <p className="mt-2">🔒 Your data is stored securely on your device.</p>
        </div>
      </div>
    </div>
  );
};

export default BloodSugarTracker;