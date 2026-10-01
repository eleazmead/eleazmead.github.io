import { APP_CONFIG } from '../../config/app.config';

// Builds and downloads an .ics on the fly so the event text follows the guest's language.
export function downloadWeddingCalendar(title: string, description: string): void {
  const cfg = APP_CONFIG.calendarEvent;
  const esc = (v: string) =>
    v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//eleazmead//Wedding//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Explicit zone so every calendar app pins the event to Singapore time.
    'BEGIN:VTIMEZONE',
    `TZID:${cfg.timeZone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:SGT',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:wedding-20270116@eleazmead.com',
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${cfg.timeZone}:${cfg.start}`,
    `DTEND;TZID=${cfg.timeZone}:${cfg.end}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(cfg.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'EleazMead_Wedding.ics';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
