export function isValidReminderTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function nextReminderDate(time: string, now = new Date()): Date {
  if (!isValidReminderTime(time)) {
    throw new Error('Reminder time must use HH:MM, for example 19:00.');
  }

  const [hourText, minuteText] = time.split(':');
  const next = new Date(now);
  next.setHours(Number(hourText), Number(minuteText), 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
