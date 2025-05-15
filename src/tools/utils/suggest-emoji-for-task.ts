/**
 * Task emoji categories and suggestions
 */

/**
 * Map of common task types to emoji suggestions
 */
export const TASK_EMOJI_MAP = {
  // Calendar and schedule related
  meetings: '📅',
  meeting: '📅',
  appointment: '📅',
  schedule: '📅',
  calendar: '📅',
  plan: '📅',
  planning: '📅',
  reminder: '⏰',
  
  // Work related
  work: '💼',
  business: '💼',
  report: '📊',
  presentation: '📊',
  project: '📋',
  file: '📁',
  document: '📄',
  documentation: '📄',
  email: '📧',
  mail: '📧',
  message: '💬',
  call: '📞',
  phone: '📞',
  write: '📝',
  note: '📝',
  
  // Development and coding
  code: '💻',
  programming: '💻',
  develop: '💻',
  development: '💻',
  debug: '🐛',
  test: '✅',
  testing: '✅',
  feature: '✨',
  fix: '🔧',
  refactor: '♻️',
  
  // Travel and transport
  travel: '✈️',
  flight: '✈️',
  drive: '🚗',
  car: '🚗',
  trip: '🧳',
  commute: '🚆',
  train: '🚆',
  bus: '🚌',
  
  // Health and personal
  exercise: '🏃',
  workout: '💪',
  gym: '🏋️',
  health: '❤️',
  doctor: '🩺',
  medical: '🩺',
  medical_appointment: '🩺',
  
  // Food and meals
  food: '🍽️',
  meal: '🍽️',
  breakfast: '🍳',
  lunch: '🥪',
  dinner: '🍲',
  cook: '👨‍🍳',
  grocery: '🛒',
  shopping: '🛒',
  
  // Learning and education
  learn: '📚',
  study: '📚',
  book: '📚',
  read: '📚',
  research: '🔍',
  course: '🎓',
  class: '🎓',
  
  // Home and chores
  home: '🏠',
  house: '🏠',
  clean: '🧹',
  laundry: '🧺',
  repair: '🔨',
  garden: '🌱',
  
  // Finance and money
  finance: '💰',
  money: '💰',
  bank: '🏦',
  pay: '💳',
  payment: '💳',
  bill: '💸',
  invoice: '📊',
  budget: '💹',
  
  // Creative and arts
  create: '🎨',
  creative: '🎨',
  design: '🎨',
  draw: '✏️',
  paint: '🖌️',
  music: '🎵',
  photo: '📷',
  video: '🎬',
  
  // Social and communication
  social: '👥',
  friend: '👥',
  family: '👨‍👩‍👧‍👦',
  party: '🎉',
  celebrate: '🎉',
  chat: '💬',
  talk: '💬',
  
  // Miscellaneous
  idea: '💡',
  think: '🤔',
  question: '❓',
  important: '❗',
  priority: '🔥',
  urgent: '🔥'
};

/**
 * Suggests an emoji for a task based on its description
 * @param description The task description
 * @returns A suggested emoji or the default task emoji 📝
 */
export function suggestEmojiForTask(description: string): string {
  // Default emoji if no match is found
  const defaultEmoji = '📝';
  
  // Convert to lowercase for case-insensitive matching
  const lowercaseDesc = description.toLowerCase();
  
  // Check each keyword in the map
  for (const [keyword, emoji] of Object.entries(TASK_EMOJI_MAP)) {
    if (lowercaseDesc.includes(keyword.toLowerCase())) {
      return emoji;
    }
  }
  
  // Default fallback
  return defaultEmoji;
}
