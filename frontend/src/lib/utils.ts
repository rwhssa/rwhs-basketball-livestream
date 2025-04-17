/**
 * Format a class name for display (e.g., "Class101" -> "Class 101")
 * @param className Original class name
 * @returns Formatted class name
 */
export function formatClassName(className: string): string {
  // Handle common class name patterns (e.g., "Class101", "101班")
  return className
    .replace(/([A-Za-z]+)(\d+)/, '$1 $2')
    .replace(/(\d+)班/, '$1 班');
}

/**
 * Safely parse JSON with error handling
 * @param jsonString JSON string to parse
 * @param defaultValue Default value to return on error
 * @returns Parsed object or default value
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.error('JSON parse error:', e);
    return defaultValue;
  }
}

/**
 * Format error message for display
 * @param error Error object or string
 * @returns Formatted error message
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else {
    return 'Unknown error';
  }
}

/**
 * Simple debounce function
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  
  return function(...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay) as unknown as number;
  };
}