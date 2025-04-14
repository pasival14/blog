// /**
//  * Generates a consistent conversation ID for two user UIDs.
//  * Sorts the UIDs alphabetically and joins them with an underscore.
//  * @param {string} uid1 - First user UID.
//  * @param {string} uid2 - Second user UID.
//  * @returns {string} The generated conversation ID.
//  */
export const getConversationId = (uid1, uid2) => {
    const sortedUids = [uid1, uid2].sort();
    return `${sortedUids[0]}_${sortedUids[1]}`;
  };