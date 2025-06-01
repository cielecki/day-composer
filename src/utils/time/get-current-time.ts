/**
 * Gets the current time formatted as HH:mm
 * @param customTime Optional custom time string in HH:mm format
 * @returns The formatted time string
 */
export function getCurrentTime(customTime?: string): string {
  if (customTime) return customTime;

  const moment = window.moment;
  return moment ? moment().format('HH:mm') : new Date().toTimeString().slice(0, 5);
}
