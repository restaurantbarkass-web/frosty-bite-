import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Sparkles, CheckCircle2, Zap, AlertCircle, ChevronRight, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

export interface TimeSlot {
  id: string;
  label: string;
  range: string;
  icon: string;
  hint: string;
  popular?: boolean;
}

export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { id: 'morning', label: 'Morning', range: '09:00 AM - 12:00 PM', icon: '🌅', hint: 'Fresh Morning Bake' },
  { id: 'afternoon', label: 'Afternoon', range: '12:00 PM - 03:00 PM', icon: '☀️', hint: 'Lunch & Tea Time' },
  { id: 'evening', label: 'Evening', range: '03:00 PM - 06:00 PM', icon: '🌇', hint: 'Evening Gatherings', popular: true },
  { id: 'night', label: 'Night', range: '06:00 PM - 09:00 PM', icon: '🌙', hint: 'Dinner & Celebrations' },
  { id: 'midnight', label: 'Midnight Surprise', range: '11:00 PM - 12:00 AM', icon: '🎂', hint: 'Midnight Birthday Special' },
  { id: 'custom', label: 'Exact Time', range: 'Choose Specific Time', icon: '⏱️', hint: 'Custom Hour & Minute' },
];

export interface DeliveryScheduleData {
  mode: 'instant' | 'scheduled';
  date: string; // "YYYY-MM-DD"
  dayName: string; // "Monday", "Tuesday", etc.
  timeSlot: string; // "morning", "afternoon", "evening", "night", "midnight", "custom"
  time: string; // Formatted label, e.g. "Evening (03:00 PM - 06:00 PM)" or "07:30 PM"
  formattedSummary: string;
}

interface DeliveryDatePickerProps {
  mode?: 'instant' | 'scheduled';
  fulfillmentType?: 'delivery' | 'pickup';
  selectedDate?: string;
  selectedTimeSlot?: string;
  customTime?: string;
  onChange: (data: DeliveryScheduleData) => void;
  isInstantClosed?: boolean;
  hasPreorderOnlyItems?: boolean;
  instantDeliveryEstimateMins?: number;
  hasError?: boolean;
  dateInputRef?: React.RefObject<HTMLInputElement>;
  shakeKey?: number;
  className?: string;
}

export const DeliveryDatePicker: React.FC<DeliveryDatePickerProps> = ({
  mode = 'instant',
  fulfillmentType = 'delivery',
  selectedDate,
  selectedTimeSlot = 'evening',
  customTime = '18:00',
  onChange,
  isInstantClosed = false,
  hasPreorderOnlyItems = false,
  instantDeliveryEstimateMins = 30,
  hasError = false,
  dateInputRef,
  shakeKey = 0,
  className = '',
}) => {
  const isPickup = fulfillmentType === 'pickup';
  const [deliveryMode, setDeliveryMode] = useState<'instant' | 'scheduled'>(
    hasPreorderOnlyItems || isInstantClosed ? 'scheduled' : mode
  );
  
  const [date, setDate] = useState<string>(() => {
    if (selectedDate) return selectedDate;
    return new Date().toISOString().split('T')[0];
  });

  const [timeSlot, setTimeSlot] = useState<string>(selectedTimeSlot);
  const [specificTime, setSpecificTime] = useState<string>(customTime);

  // Sync internal state if props change
  useEffect(() => {
    if (hasPreorderOnlyItems || isInstantClosed) {
      setDeliveryMode('scheduled');
    } else if (mode) {
      setDeliveryMode(mode);
    }
  }, [mode, hasPreorderOnlyItems, isInstantClosed]);

  useEffect(() => {
    if (selectedDate && selectedDate !== date) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTimeSlot && selectedTimeSlot !== timeSlot) {
      setTimeSlot(selectedTimeSlot);
    }
  }, [selectedTimeSlot]);

  // Compute day name
  const getDayName = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[d.getDay()] || '';
    } catch {
      return '';
    }
  };

  const getFormattedTimeLabel = (slotId: string, customT: string): string => {
    if (slotId === 'custom') {
      if (!customT) return 'Custom Specific Time';
      const [hStr, mStr] = customT.split(':');
      const h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${mStr} ${ampm}`;
    }
    const found = DEFAULT_TIME_SLOTS.find(s => s.id === slotId);
    return found ? `${found.label} (${found.range})` : 'Evening (03:00 PM - 06:00 PM)';
  };

  // Notify parent of updates
  const emitChange = (
    newMode: 'instant' | 'scheduled',
    newDate: string,
    newSlot: string,
    newSpecificTime: string
  ) => {
    const dayName = getDayName(newDate);
    const timeLabel = newMode === 'instant' ? 'Instant Delivery' : getFormattedTimeLabel(newSlot, newSpecificTime);
    
    let formattedSummary = isPickup ? 'Instant Pickup' : 'Instant Dispatch';
    if (newMode === 'scheduled') {
      const formattedDate = new Date(newDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      formattedSummary = `${dayName}, ${formattedDate} (${timeLabel})`;
    }

    onChange({
      mode: newMode,
      date: newDate,
      dayName,
      timeSlot: newSlot,
      time: timeLabel,
      formattedSummary,
    });
  };

  const handleModeToggle = (newMode: 'instant' | 'scheduled') => {
    if (newMode === 'instant' && (isInstantClosed || hasPreorderOnlyItems)) return;
    setDeliveryMode(newMode);
    emitChange(newMode, date, timeSlot, specificTime);
  };

  const handleDateSelect = (newDate: string) => {
    setDate(newDate);
    emitChange(deliveryMode, newDate, timeSlot, specificTime);
  };

  const handleSlotSelect = (newSlot: string) => {
    setTimeSlot(newSlot);
    emitChange(deliveryMode, date, newSlot, specificTime);
  };

  const handleSpecificTimeChange = (newTime: string) => {
    setSpecificTime(newTime);
    emitChange(deliveryMode, date, 'custom', newTime);
  };

  // Quick date options: Today, Tomorrow, Day After
  const getQuickDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const sub = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dates.push({ label, sub, value: iso });
    }
    return dates;
  };

  const quickDates = getQuickDates();
  const dayName = getDayName(date);
  const timeLabel = getFormattedTimeLabel(timeSlot, specificTime);

  return (
    <div id="delivery-date-picker-container" className={cn("space-y-4 text-left", className)}>
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <Calendar size={13} className="text-primary" /> {isPickup ? 'Pickup Schedule' : 'Delivery Schedule'}
        </label>
        <span className="text-[9px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
          {deliveryMode === 'scheduled' ? (
            <>
              <Clock size={10} /> Pre-Booked Schedule
            </>
          ) : (
            <>
              <Zap size={10} /> Instant Fast Track
            </>
          )}
        </span>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 gap-3">
        {/* Instant Button */}
        <button
          type="button"
          disabled={isInstantClosed || hasPreorderOnlyItems}
          onClick={() => handleModeToggle('instant')}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all relative cursor-pointer ${
            isInstantClosed || hasPreorderOnlyItems
              ? 'bg-zinc-900/40 border-zinc-900/50 text-zinc-650 cursor-not-allowed opacity-60'
              : deliveryMode === 'instant'
                ? 'bg-primary/15 border-primary text-white shadow-lg shadow-primary/15 ring-1 ring-primary/30'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          <Zap 
            size={18} 
            className={(isInstantClosed || hasPreorderOnlyItems) ? 'text-zinc-600' : (deliveryMode === 'instant' ? 'text-primary animate-pulse' : 'text-zinc-500')} 
          />
          <span className="text-[11px] font-black uppercase tracking-wider mt-2">
            {isPickup ? 'Instant Pickup' : 'Instant Delivery'}
          </span>
          {isInstantClosed ? (
            <span className="text-[8px] bg-red-500/10 text-red-500 font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 border border-red-500/20 leading-none">
              CLOSED
            </span>
          ) : hasPreorderOnlyItems ? (
            <span className="text-[8px] bg-sky-500/10 text-sky-400 font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 border border-sky-500/20 leading-none">
              PRE-ORDER ONLY
            </span>
          ) : (
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
              ~{instantDeliveryEstimateMins} mins
            </span>
          )}
        </button>

        {/* Scheduled Button */}
        <button
          type="button"
          onClick={() => handleModeToggle('scheduled')}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
            deliveryMode === 'scheduled'
              ? 'bg-primary/15 border-primary text-white shadow-lg shadow-primary/15 ring-1 ring-primary/30'
              : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          <Clock size={18} className={deliveryMode === 'scheduled' ? 'text-primary' : 'text-zinc-500'} />
          <span className="text-[11px] font-black uppercase tracking-wider mt-2">
            {isPickup ? 'Schedule Pickup' : 'Schedule Order'}
          </span>
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
            Pick Date & Time
          </span>
        </button>
      </div>

      {/* Date & Time Picker Area */}
      <AnimatePresence>
        {deliveryMode === 'scheduled' && (
          <motion.div
            key="scheduled-panel"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-primary/20 space-y-4 shadow-xl overflow-hidden"
          >
            {/* Step 1: Date Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar size={12} className="text-primary" /> 1. Select {isPickup ? 'Pickup' : 'Delivery'} Date
                </label>
                {dayName && (
                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider">
                    {dayName}
                  </span>
                )}
              </div>

              {/* Quick Date Chips */}
              <div className="grid grid-cols-3 gap-2">
                {quickDates.map((qDate) => {
                  const isSelected = date === qDate.value;
                  return (
                    <button
                      key={qDate.value}
                      type="button"
                      onClick={() => handleDateSelect(qDate.value)}
                      className={cn(
                        "p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer",
                        isSelected
                          ? "bg-primary text-black border-primary font-black shadow-md shadow-primary/20 scale-[1.02]"
                          : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      <span className={cn("text-[11px] font-black uppercase tracking-tight", isSelected ? "text-black" : "text-white")}>
                        {qDate.label}
                      </span>
                      <span className={cn("text-[9px] font-bold tracking-wider", isSelected ? "text-black/80" : "text-zinc-400")}>
                        {qDate.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Input */}
              <div className="pt-1">
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    key={`scheduled-date-${shakeKey}`}
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={date}
                    onChange={(e) => handleDateSelect(e.target.value)}
                    className={cn(
                      "w-full h-11 px-4 rounded-xl bg-white/5 border text-white text-xs focus:outline-none transition-all font-semibold uppercase cursor-pointer",
                      hasError
                        ? "border-red-500 ring-2 ring-red-500/30 animate-shake"
                        : "border-white/10 focus:border-primary/50"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Time Slot Selection */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} className="text-primary" /> 2. Select {isPickup ? 'Pickup' : 'Delivery'} Time Window
                </label>
                <span className="text-[9px] font-black text-primary uppercase tracking-wider">
                  {timeSlot === 'midnight' ? '🌙 Midnight Special' : 'Preferred Slot'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEFAULT_TIME_SLOTS.map((slot) => {
                  const isSelected = timeSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSlotSelect(slot.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group",
                        isSelected
                          ? "bg-primary/15 border-primary text-white shadow-lg shadow-primary/10 ring-1 ring-primary/40"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-sm">{slot.icon}</span>
                        {isSelected && <CheckCircle2 size={12} className="text-primary" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <p className={cn("text-[10px] font-black uppercase tracking-tight leading-tight", isSelected ? "text-primary" : "text-zinc-200")}>
                            {slot.label}
                          </p>
                          {slot.popular && !isSelected && (
                            <span className="text-[7px] font-black bg-primary/20 text-primary px-1 py-0.2 rounded uppercase">
                              Hot
                            </span>
                          )}
                        </div>
                        <p className="text-[8px] font-bold text-zinc-400 tracking-tighter mt-0.5 leading-tight">
                          {slot.range}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Exact Specific Time selector if slot === 'custom' */}
              {timeSlot === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-white/5 border border-primary/30 rounded-xl space-y-2 mt-2"
                >
                  <label className="text-[9px] font-black text-primary uppercase tracking-widest block">
                    Choose Exact Hour & Minute
                  </label>
                  <input
                    type="time"
                    value={specificTime}
                    onChange={(e) => handleSpecificTimeChange(e.target.value)}
                    className="w-full h-10 px-3 bg-zinc-900 border border-white/20 rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-primary"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['11:00', '13:30', '17:00', '19:30', '21:00', '23:45'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleSpecificTimeChange(t)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[9px] font-bold font-mono border cursor-pointer",
                          specificTime === t
                            ? "bg-primary text-black border-primary font-black"
                            : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Live Summary Confirmation Badge */}
            {date && (
              <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 px-3.5 py-2.5 rounded-xl">
                <Sparkles size={14} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-white uppercase tracking-wider truncate">
                    {isPickup ? 'Pickup' : 'Delivery'} Scheduled: <span className="text-primary font-bold">{dayName}, {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </p>
                  <p className="text-[9px] font-semibold text-zinc-400 tracking-wider">
                    Target Time: <span className="text-white font-bold">{timeLabel}</span>
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

