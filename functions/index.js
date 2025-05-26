const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions"); // Use v2 logger

// Firebase Admin SDK
const admin = require("firebase-admin");

// Other Libraries
const algoliasearch = require('algoliasearch');
const fetch = require("node-fetch"); // Ensure node-fetch v2 for CommonJS compatibility

// Initialize Firebase Admin SDK ONLY ONCE
try {
  admin.initializeApp();
  logger.info("Firebase Admin SDK initialized successfully.");
} catch (e) {
  logger.error("Firebase Admin SDK initialization error:", e);
  if (e.code !== 'app/duplicate-app') {
    throw e; // Re-throw other initialization errors
  }
}
const db = admin.firestore();

// --- Existing Algolia Search Function (Unchanged) ---
exports.searchPosts = onCall({
    region: 'us-central1',
    memory: '256MiB',
}, async (request) => {
    logger.info("searchPosts called with data:", request.data); // Use v2 logger

    // --- Get config values directly from process.env ---
    const appId = process.env.ALGOLIA_APP_ID;
    const searchKey = process.env.ALGOLIA_SEARCH_KEY; // Using Search Key
    const indexName = process.env.ALGOLIA_INDEX_NAME || 'posts';

    // --- Initialize Algolia Client INSIDE the handler ---
    let searchClient;
    logger.info(`Attempting to initialize Algolia client. AppID: ${appId}, Key exists: ${!!searchKey}`);
    if (!appId || !searchKey) {
        logger.error("Algolia configuration missing or incomplete in process.env! Check ALGOLIA_APP_ID and ALGOLIA_SEARCH_KEY.");
        throw new HttpsError('internal', 'Algolia search client configuration is missing in environment.');
    }
    try {
        searchClient = algoliasearch(appId, searchKey);
        logger.info("Algolia client initialized successfully from process.env.");
    } catch (initError) {
        logger.error("Error initializing Algolia client:", initError);
        throw new HttpsError('internal', 'Failed to initialize Algolia client.');
    }

    if (!indexName) {
        logger.error("Algolia index name is not configured.");
        throw new HttpsError('internal', 'Algolia index name is not configured in environment.');
    }

    const queryString = request.data.query;
    if (!queryString || typeof queryString !== 'string' || queryString.trim().length === 0) {
        logger.warn("Invalid query argument received.");
        throw new HttpsError('invalid-argument', 'The function must be called with a valid "query" string argument.');
    }

    const searchTerm = queryString.trim();
    const page = request.data.page || 0;
    const hitsPerPage = request.data.perPage || 20;

    logger.info(`(Algolia - process.env) Received search query: "${searchTerm}"`);
    const index = searchClient.initIndex(indexName);

    try {
        logger.info(`Searching Algolia index '${indexName}' for query "${searchTerm}"...`);
        const searchResults = await index.search(searchTerm, {
            page: page,
            hitsPerPage: hitsPerPage,
        });
        logger.info(`Algolia returned ${searchResults.nbHits} total hits, sending back ${searchResults.hits.length} for page ${page}.`);

        // Map results, ensuring objectID is included as id
        const results = searchResults.hits.map(hit => ({
            ...hit,
            id: hit.objectID // Ensure the document ID is mapped correctly
        }));

        return results; // Return the mapped results

    } catch (error) {
        logger.error("(Algolia) Error during Algolia search execution:", error);
        throw new HttpsError('internal', 'Failed to perform search using Algolia.', error.message);
    }
});


// --- Existing analyzePostContent Function (Unchanged except logger) ---
exports.analyzePostContent = onDocumentWritten({ document: "posts/{postId}", memory: "512MB" }, async (event) => {
    const change = event.data; // Get before/after data
    const postId = event.params.postId;

    // Check if document was deleted or doesn't exist after write
    if (!change || !change.after || !change.after.exists) {
        logger.log(`Post ${postId} deleted or does not exist after write. Skipping analysis.`);
        return null;
    }

    const postData = change.after.data();

    // Check if contentUrl exists
    if (!postData || !postData.contentUrl) {
        logger.warn(`Post ${postId} missing contentUrl. Skipping analysis.`);
        return null;
    }

    // Optional: Check if keywords already exist or contentUrl hasn't changed
    const beforeData = change.before ? change.before.data() : null;
    if (beforeData && beforeData.contentUrl === postData.contentUrl && postData.keywords && postData.keywords.length > 0) {
        logger.log(`Content URL for post ${postId} unchanged and keywords exist. Skipping analysis.`);
        return null;
    }

    logger.log(`Processing post ${postId} in analyzePostContent.`);
    logger.log(`Analyzing content for post ${postId} from URL: ${postData.contentUrl}`);

    try {
        // 1. Fetch HTML Content
        const response = await fetch(postData.contentUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const htmlContent = await response.text();
        logger.log(`Workspaceed HTML content for post ${postId}. Length: ${htmlContent.length}`);

        // 2. Extract Plain Text (Lazy load JSDOM)
        const { JSDOM } = require("jsdom");
        let textContent = "";
        try {
            const dom = new JSDOM(htmlContent);
            textContent = (dom.window.document.body?.textContent || "").replace(/\s+/g, ' ').trim();
            logger.log(`Extracted text content for post ${postId}. Length: ${textContent.length}`);
        } catch (parseError) {
            logger.error(`Error parsing HTML for post ${postId}:`, parseError);
            // Continue, textContent will be empty
        }

        if (!textContent) {
            logger.warn(`No text content extracted for post ${postId}. Updating with empty keywords.`);
            await change.after.ref.update({ keywords: [] });
            return null;
        }

        // 3. Perform NLP Analysis (Lazy load Natural)
        const natural = require("natural");
        const tokenizer = new natural.WordTokenizer();
        const tokens = tokenizer.tokenize(textContent.toLowerCase());
        const englishStopwords = natural.stopwords;
        const filteredTokens = tokens.filter(token => /^[a-z]+$/.test(token) && !englishStopwords.includes(token)); // Basic filter for words

        if (filteredTokens.length === 0) {
            logger.warn(`No valid tokens after filtering for post ${postId}. Updating with empty keywords.`);
            await change.after.ref.update({ keywords: [] });
            return null;
        }

        const TfIdf = natural.TfIdf;
        const tfidf = new TfIdf();
        tfidf.addDocument(filteredTokens.join(" "));
        const numberOfKeywords = 10;
        const keywordData = tfidf.listTerms(0).slice(0, numberOfKeywords);
        const keywords = keywordData.map((item) => item.term);
        logger.log(`Extracted keywords for post ${postId}:`, keywords);

        // 4. Update Firestore Document
        await change.after.ref.update({ keywords: keywords });
        logger.log(`Successfully updated post ${postId} with keywords.`);

        return null;

    } catch (error) {
        logger.error(`Failed to analyze content for post ${postId}:`, error);
        // Optional: Update post with an error status?
        return null;
    }
});

// --- Helper Function (Placeholder - Needed by generateRecommendations) ---
// NOTE: You need to implement or provide the actual 'fetchPostKeywordsBatch' function
async function fetchPostKeywordsBatch(postIds) {
    logger.warn(`fetchPostKeywordsBatch called for ${postIds.length} IDs, but it's not fully implemented.`);
    // Placeholder implementation: Reads each doc individually.
    // In production, use Promise.all with batched reads (getAll) for efficiency.
    const keywordsMap = new Map();
    for (const postId of postIds) {
        try {
            const docRef = db.collection('posts').doc(postId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                keywordsMap.set(postId, docSnap.data().keywords || []);
            } else {
                keywordsMap.set(postId, []); // Post not found
            }
        } catch (error) {
            logger.error(`Error fetching keywords for post ${postId} in batch helper:`, error);
            keywordsMap.set(postId, []); // Set empty on error
        }
    }
    return keywordsMap;
}


// --- Existing calculateTrendingKeywords Function (Unchanged except logger) ---
exports.calculateTrendingKeywords = onSchedule({
    schedule: "0 * * * *", // Every hour at minute 0
    timeZone: "Africa/Lagos",
    memory: "512MB"
}, async (event) => {
    logger.info("Starting trending keyword calculation job.");

    const TREND_TIMEFRAME_HOURS = 24;
    const MAX_INTERACTIONS_TO_PROCESS = 10000;
    const TOP_N_KEYWORDS = 20;

    try {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - TREND_TIMEFRAME_HOURS);
        const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

        logger.info(`Workspaceing interactions since ${cutoffDate.toISOString()}...`);
        const recentInteractionsQuery = db.collection('userInteractions')
            .where('timestamp', '>=', cutoffTimestamp)
            .limit(MAX_INTERACTIONS_TO_PROCESS)
            .select('postId');

        const interactionsSnapshot = await recentInteractionsQuery.get();
        logger.info(`Found ${interactionsSnapshot.size} interactions in the last ${TREND_TIMEFRAME_HOURS} hours.`);

        if (interactionsSnapshot.empty) {
            logger.info("No recent interactions found. Skipping trend calculation.");
            // Optionally clear existing trends
            // await db.collection('trends').doc('globalKeywords').set({ keywords: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            return null;
        }

        const recentPostIds = new Set();
        interactionsSnapshot.forEach(doc => {
            if (doc.data().postId) {
                recentPostIds.add(doc.data().postId);
            }
        });
        const uniquePostIds = Array.from(recentPostIds);
        logger.info(`Found ${uniquePostIds.length} unique posts with recent interactions.`);

        if (uniquePostIds.length === 0) {
            logger.info("No valid post IDs found in recent interactions.");
            return null;
        }

        // Fetch keywords (uses the placeholder helper above)
        const postKeywordsMap = await fetchPostKeywordsBatch(uniquePostIds);
        logger.info(`Workspaceed keywords for ${postKeywordsMap.size} posts.`);

        const keywordCounts = {};
        postKeywordsMap.forEach((keywords) => {
            if (Array.isArray(keywords)) {
                keywords.forEach(keyword => {
                    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                });
            }
        });

        const sortedKeywords = Object.entries(keywordCounts)
            .sort(([, countA], [, countB]) => countB - countA);

        const topKeywords = sortedKeywords.slice(0, TOP_N_KEYWORDS).map(([keyword]) => keyword);
        logger.info(`Top ${topKeywords.length} trending keywords:`, topKeywords.join(', '));

        const trendsRef = db.collection('trends').doc('globalKeywords');
        await trendsRef.set({
            keywords: topKeywords,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            timeframeHours: TREND_TIMEFRAME_HOURS,
            calculatedAt: new Date().toISOString(),
        });
        logger.info(`Successfully stored top ${topKeywords.length} trending keywords.`);

    } catch (error) {
        logger.error("Error during trending keyword calculation:", error);
        return null;
    }

    logger.info("Finished trending keyword calculation job successfully.");
    return null;
});


// --- Existing generateRecommendations Function (Unchanged except logger and uses helper) ---
exports.generateRecommendations = onSchedule({
    schedule: "every 5 hours",
    timeZone: "Africa/Lagos",
    memory: "512MB"
}, async (event) => {
    logger.info("Starting recommendation generation job (weighted + cold start).");

    const weights = { like: 3, comment: 2, view: 1 };
    const MIN_INTERACTIONS_FOR_PERSONALIZED = 5;
    const RECENT_POST_DAYS_FOR_COLD_START = 7;
    const COLD_START_RECOMMENDATION_LIMIT = 30;

    try {
        // 1. Identify Active Users
        const activeUserIds = new Set();
        const interactionCutoffDays = 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - interactionCutoffDays);
        const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

        logger.info(`Finding users with interactions since ${cutoffDate.toISOString()}...`);
        try {
            const recentInteractionsQuery = db.collection('userInteractions')
                .where('timestamp', '>=', cutoffTimestamp).select('userId');
            const querySnapshot = await recentInteractionsQuery.get();
            querySnapshot.forEach((doc) => { activeUserIds.add(doc.data().userId); });
            logger.info(`Found ${activeUserIds.size} unique active users.`);
            if (activeUserIds.size === 0) { logger.info("No active users. Exiting."); return null; }
        } catch (userQueryError) { logger.error("Error fetching active users:", userQueryError); throw userQueryError; }

        const activeUserIdsArray = Array.from(activeUserIds);

        // Pre-fetch trending keywords
        let trendingKeywords = [];
        try {
            const trendsSnap = await db.collection('trends').doc('globalKeywords').get();
            if (trendsSnap.exists && Array.isArray(trendsSnap.data().keywords)) {
                trendingKeywords = trendsSnap.data().keywords;
                logger.info(`Successfully fetched ${trendingKeywords.length} global trending keywords.`);
            } else {
                logger.warn("Global trending keywords document not found or invalid.");
            }
        } catch (trendFetchError) {
            logger.error("Error fetching trending keywords:", trendFetchError);
        }


        // 2. Loop through each active user
        for (const userId of activeUserIdsArray) {
            logger.info(`Processing recommendations for user ${userId}...`);

            // a. Fetch User's Recent Interaction History
            const interactionLimit = 100;
            const userInteractions = [];
            try {
                const interactionsQuery = db.collection('userInteractions')
                    .where('userId', '==', userId).orderBy('timestamp', 'desc')
                    .limit(interactionLimit).select('postId', 'interactionType');
                const interactionsSnapshot = await interactionsQuery.get();
                interactionsSnapshot.forEach((doc) => { userInteractions.push(doc.data()); });
                logger.debug(`Workspaceed ${userInteractions.length} interactions for user ${userId}.`);
            } catch (interactionQueryError) {
                logger.error(`Error fetching interactions for user ${userId}:`, interactionQueryError);
                continue; // Skip user
            }

            // b. Check for Cold Start Condition
            if (userInteractions.length < MIN_INTERACTIONS_FOR_PERSONALIZED) {
                logger.info(`User ${userId} has fewer than ${MIN_INTERACTIONS_FOR_PERSONALIZED} interactions. Attempting cold start recommendation.`);
                if (trendingKeywords.length > 0) {
                    try {
                        const recentPostCutoffDate = new Date();
                        recentPostCutoffDate.setDate(recentPostCutoffDate.getDate() - RECENT_POST_DAYS_FOR_COLD_START);
                        const recentPostCutoffTimestamp = admin.firestore.Timestamp.fromDate(recentPostCutoffDate);

                        const coldStartQuery = db.collection('posts')
                            .where('keywords', 'array-contains-any', trendingKeywords.slice(0, 10)) // Limit keywords for query performance
                            .where('createdAt', '>=', recentPostCutoffTimestamp)
                            .orderBy('createdAt', 'desc')
                            .limit(COLD_START_RECOMMENDATION_LIMIT);
                            // .select(); // Select only ID if storing only IDs

                        const coldStartSnapshot = await coldStartQuery.get();
                        const coldStartPostIds = coldStartSnapshot.docs.map(doc => doc.id);

                        if (coldStartPostIds.length > 0) {
                            const recommendationsRef = db.collection('userRecommendations').doc(userId);
                            await recommendationsRef.set({
                                postIds: coldStartPostIds,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                type: 'cold_start_trending'
                            });
                            logger.info(`Stored ${coldStartPostIds.length} cold start (trending keyword) recommendations for user ${userId}.`);
                        } else {
                            logger.warn(`No recent posts found matching trending keywords for user ${userId}. No cold start recommendation generated.`);
                        }
                    } catch (coldStartError) {
                        logger.error(`Error generating cold start recommendations for user ${userId}:`, coldStartError);
                    }
                } else {
                    logger.warn(`No trending keywords available for cold start for user ${userId}.`);
                }
                continue; // Move to the next user after handling cold start
            }

            // c. Build Personalized Weighted User Interest Profile
            // (Runs only if NOT cold start)
            const userInterestProfile = {};
            const interactedPostData = new Map();
            userInteractions.forEach(interaction => {
                if (!weights[interaction.interactionType] || !interaction.postId) return; // Skip if no weight or postId
                if (!interactedPostData.has(interaction.postId)) {
                    interactedPostData.set(interaction.postId, { interactionTypes: new Set() });
                }
                interactedPostData.get(interaction.postId).interactionTypes.add(interaction.interactionType);
            });
            const postIdsToFetchKeywords = Array.from(interactedPostData.keys());
            if (postIdsToFetchKeywords.length === 0) {
                logger.info(`No relevant weighted interactions for user ${userId}. Skipping personalized.`);
                continue;
            }
            // Use the placeholder helper
            const postKeywordsMap = await fetchPostKeywordsBatch(postIdsToFetchKeywords);
            interactedPostData.forEach(({ interactionTypes }, postId) => {
                const keywords = postKeywordsMap.get(postId);
                if (Array.isArray(keywords)) {
                    let postWeight = 0;
                    interactionTypes.forEach(type => { postWeight += weights[type] || 0; });
                    if (postWeight > 0) {
                        keywords.forEach(keyword => {
                            userInterestProfile[keyword] = (userInterestProfile[keyword] || 0) + postWeight;
                        });
                    }
                }
            });
            if (Object.keys(userInterestProfile).length === 0) {
                logger.info(`Could not build personalized keyword profile for user ${userId}. Skipping.`);
                continue;
            }
            logger.debug(`User ${userId} personalized profile built.`);

            // d. Fetch Candidate Posts
            const interactedPostIdsSet = new Set(postIdsToFetchKeywords);
            const candidatePosts = [];
            const candidateLimit = 200;
            try {
                const postsRef = db.collection('posts');
                const candidatesQuery = postsRef.orderBy('createdAt', 'desc')
                    .limit(candidateLimit).select('keywords'); // Only select keywords
                const candidatesSnapshot = await candidatesQuery.get();
                candidatesSnapshot.forEach(doc => {
                    const postId = doc.id;
                    if (!interactedPostIdsSet.has(postId)) { // Exclude already interacted posts
                        const postKeywords = doc.data().keywords;
                        if (Array.isArray(postKeywords) && postKeywords.length > 0) {
                            candidatePosts.push({ id: postId, keywords: postKeywords });
                        }
                    }
                });
                logger.debug(`Found ${candidatePosts.length} candidate posts for user ${userId}.`);
                if (candidatePosts.length === 0) { logger.info(`No candidates for user ${userId}. Skipping.`); continue; }
            } catch (candidateQueryError) { logger.error(`Error fetching candidates for user ${userId}:`, candidateQueryError); continue; }

            // e. Score Candidate Posts
            const scoredCandidates = [];
            candidatePosts.forEach(candidate => {
                let score = 0;
                candidate.keywords.forEach(keyword => { score += userInterestProfile[keyword] || 0; });
                if (score > 0) { scoredCandidates.push({ id: candidate.id, score: score }); }
            });
            logger.debug(`Scored ${scoredCandidates.length} candidates for user ${userId}.`);
            if (scoredCandidates.length === 0) { logger.info(`No candidates matched profile for user ${userId}. Skipping.`); continue; }

            // f. Rank Candidates
            scoredCandidates.sort((a, b) => b.score - a.score);
            const recommendationLimit = 30;
            const topCandidates = scoredCandidates.slice(0, recommendationLimit);
            const recommendedPostIds = topCandidates.map(candidate => candidate.id);
            logger.debug(`Ranked top ${recommendedPostIds.length} post IDs for user ${userId}.`);

            // g. Store Personalized Recommendations
            if (recommendedPostIds.length > 0) {
                const recommendationsRef = db.collection('userRecommendations').doc(userId);
                await recommendationsRef.set({
                    postIds: recommendedPostIds,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'personalized_weighted'
                });
                logger.info(`Stored ${recommendedPostIds.length} personalized recommendations for user ${userId}.`);
            } else {
                logger.info(`No personalized recommendations generated for user ${userId} to store.`);
            }

            logger.info(`Finished personalized recommendations for user ${userId}.`);
        } // End user loop

    } catch (error) {
        logger.error("Critical error during recommendation generation job:", error);
        return null;
    }

    logger.info("Finished recommendation generation job successfully.");
    return null;
});


// --- NEW: Function to Set Admin Role (Adapted for v2) ---
exports.setAdminRole = onCall({
    region: 'us-central1', // Optional: Specify region
    memory: '128MiB'      // Optional: Specify memory
}, async (request) => {
    // request.auth holds the authentication context in v2 onCall
    const callerAuth = request.auth;
    const data = request.data; // Data passed from the client

    logger.info("setAdminRole called with data:", data);
    logger.info("Caller context auth:", callerAuth);

    // --- SECURITY CHECK: Ensure the caller is an admin ---
    if (callerAuth?.token?.admin !== true) {
       logger.error("Permission denied: Caller is not an admin.", callerAuth?.token);
       throw new HttpsError(
         "permission-denied",
         "You must be an administrator to grant admin roles."
       );
    }
    // ------------------------------------------------------

    // Validate input data
    if (!data.email || typeof data.email !== "string") {
        logger.error("Invalid input: Email is required and must be a string.");
        throw new HttpsError(
            "invalid-argument",
            "Please provide a valid user email address."
        );
    }

    const userEmail = data.email;
    logger.info(`Attempting to grant admin role to email: ${userEmail}`);

    try {
        // Get the user account by email using the Admin SDK
        const user = await admin.auth().getUserByEmail(userEmail);
        logger.info(`Found user: ${user.uid} for email: ${userEmail}`);

        // Check if user already has the admin claim
        if (user.customClaims && user.customClaims.admin === true) {
            logger.info(`User ${user.uid} (${userEmail}) is already an admin.`);
            return { result: `User ${userEmail} is already an admin.` };
        }

        // Set the custom claim { admin: true }
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        logger.info(`Successfully set admin claim for user: ${user.uid}`);

        return { result: `Success! ${userEmail} has been made an admin.` };

    } catch (error) {
        logger.error(`Error setting admin role for ${userEmail}:`, error);
        if (error.code === "auth/user-not-found") {
            throw new HttpsError(
                "not-found",
                `User with email ${userEmail} not found.`
            );
        } else {
            throw new HttpsError(
                "internal",
                "An unexpected error occurred while setting the admin role."
            );
        }
    }
});

// --- NEW: Function to Remove Admin Role ---
exports.removeAdminRole = onCall({
    region: 'us-central1',
    memory: '128MiB'
}, async (request) => {
    const callerAuth = request.auth;
    const data = request.data;

    logger.info("removeAdminRole called with data:", data);
    logger.info("Caller context auth:", callerAuth);

    // --- SECURITY CHECK: Ensure the caller is an admin ---
    if (callerAuth?.token?.admin !== true) {
       logger.error("Permission denied: Caller is not an admin.", callerAuth?.token);
       throw new HttpsError(
         "permission-denied",
         "You must be an administrator to revoke admin roles."
       );
    }
    // ------------------------------------------------------

    // Validate input data
    if (!data.email || typeof data.email !== "string") {
        logger.error("Invalid input: Email is required and must be a string.");
        throw new HttpsError(
            "invalid-argument",
            "Please provide a valid user email address."
        );
    }

    const userEmail = data.email;
    logger.info(`Attempting to remove admin role from email: ${userEmail}`);

    try {
        // Get the user account by email
        const user = await admin.auth().getUserByEmail(userEmail);
        logger.info(`Found user: ${user.uid} for email: ${userEmail}`);

        // Check if user actually has the admin claim to remove
        if (!user.customClaims || user.customClaims.admin !== true) {
           logger.info(`User ${user.uid} (${userEmail}) is not currently an admin.`);
           return { result: `User ${userEmail} is not an admin.` };
        }

        // Set custom claims, effectively removing/setting admin to false
        // Setting an empty object {} or explicitly { admin: false } works
        await admin.auth().setCustomUserClaims(user.uid, { admin: false });
        logger.info(`Successfully removed admin claim for user: ${user.uid}`);

        return { result: `Success! ${userEmail} is no longer an admin.` };

    } catch (error) {
        logger.error(`Error removing admin role for ${userEmail}:`, error);
        if (error.code === "auth/user-not-found") {
            throw new HttpsError(
                "not-found",
                `User with email ${userEmail} not found.`
            );
        } else {
            throw new HttpsError(
                "internal",
                "An unexpected error occurred while removing the admin role."
            );
        }
    }
});
