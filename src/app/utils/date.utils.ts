export const isTheSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate()
}

export const isWeekend = (date: Date): boolean => {
  return date.getDay() === 0 || date.getDay() === 6
}
