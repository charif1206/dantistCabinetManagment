import React, { useState, useEffect } from 'react'

interface CurrentTimeIndicatorProps {
  isToday: boolean
  dayIndex?: number // 0 to 5 in Week View (Algerian working week: Sat=0 to Thu=5)
  totalDays?: number // default 6
  labelWidth?: number // default 70px
  startHour?: number // default 8
  endHour?: number // default 22
  slotHeight?: number // default 64px
  containerRef?: React.RefObject<HTMLDivElement | null>
}

export const CurrentTimeIndicator: React.FC<CurrentTimeIndicatorProps> = ({
  isToday,
  dayIndex,
  totalDays = 6,
  labelWidth = 70,
  startHour = 8,
  endHour = 22,
  slotHeight = 64,
  containerRef
}) => {
  const [now, setNow] = useState<Date>(new Date())

  // Update every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  // If not today, do not render
  if (!isToday) {
    return null
  }

  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  // Hide if current time is outside working hours (08:00 to 22:59)
  if (currentHour < startHour || currentHour > endHour) {
    return null
  }

  // Calculate vertical offset
  // Total hours displayed = (endHour - startHour + 1), e.g. 22 - 8 + 1 = 15 hours
  const totalHoursCount = endHour - startHour + 1
  const totalDayMinutes = totalHoursCount * 60
  const currentMinutesFromStart = (currentHour - startHour) * 60 + currentMinutes

  // If containerRef provided, use actual scrollHeight / offsetHeight
  let topOffset: number
  if (containerRef?.current) {
    const totalGridHeight = containerRef.current.scrollHeight || totalHoursCount * slotHeight
    topOffset = (currentMinutesFromStart / totalDayMinutes) * totalGridHeight
  } else {
    topOffset = (currentMinutesFromStart / 60) * slotHeight
  }

  const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`

  // Position horizontal bounds
  const isWeekMode = typeof dayIndex === 'number' && dayIndex >= 0

  const positionStyle: React.CSSProperties = isWeekMode
    ? {
        top: `${topOffset}px`,
        left: `calc(${labelWidth}px + (100% - ${labelWidth}px) * ${dayIndex} / ${totalDays})`,
        width: `calc((100% - ${labelWidth}px) / ${totalDays})`
      }
    : {
        top: `${topOffset}px`,
        left: `${labelWidth}px`,
        right: '8px'
      }

  return (
    <div
      style={positionStyle}
      className="absolute z-20 pointer-events-none flex items-center transition-all duration-300"
    >
      {/* Pulsing red dot */}
      <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-slate-900 shadow-md animate-pulse" />

      {/* Floating Time Pill */}
      <div className="absolute -top-3.5 left-2 px-1.5 py-0.5 rounded-full bg-[#EF4444] text-white text-[10px] font-mono font-bold tracking-tight shadow-sm select-none">
        {timeStr}
      </div>

      {/* Vibrant Red Horizontal Line */}
      <div className="w-full h-[2px] bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
    </div>
  )
}

export default CurrentTimeIndicator
