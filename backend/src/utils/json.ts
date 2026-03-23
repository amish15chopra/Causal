export function parseJSON<T>(raw: string, errorMessage: string): T {
  try {
    const cleanedJSON = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedJSON) as T;
  } catch (error) {
    throw new Error(errorMessage);
  }
}
