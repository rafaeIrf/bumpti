/**
 * Detects items that exist locally but not in backend response
 * @param localIds - Array of local item IDs
 * @param backendItems - Array of backend items with 'id' property
 * @param logPrefix - Prefix for log messages (e.g., "[Chats]", "[Matches]")
 * @returns Array of deleted item IDs
 */
export function detectDeletedItems(
  localIds: string[],
  backendItems: any[],
  logPrefix: string
): string[] {
  if (localIds.length === 0) return [];

  const backendIds = new Set(backendItems.map((item) => item.id));
  const deletedIds = localIds.filter((localId) => !backendIds.has(localId));

  if (deletedIds.length > 0) {
    console.log(`${logPrefix} Detected deleted items:`, deletedIds.length);
  }

  return deletedIds;
}
