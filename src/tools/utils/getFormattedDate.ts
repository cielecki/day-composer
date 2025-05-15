/**
 * Gets the formatted date for today's daily note
 * @param format The date format to use
 * @returns The formatted date string
 */

export function getFormattedDate(format: string, date?: Date): string {
  if (!date) {
    date = new Date();
  }

  const moment = window.moment;
  return moment ? moment(date).format(format) : date.toISOString().split('T')[0];
}
