const admin = require("firebase-admin");


const { onCall, HttpsError } = require("firebase-functions/v2/https");
const algoliasearch = require('algoliasearch');
console.log("DEBUG: Type of imported 'algoliasearch' is:", typeof algoliasearch);
console.log("DEBUG: Keys of imported 'algoliasearch':", Object.keys(algoliasearch));

// Libraries
const fetch = require("node-fetch"); // Make sure this is node-fetch@2

// Import specific trigger types and logger
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();


exports.searchPosts = onCall({
    region: 'us-central1',
    memory: '256MiB',
}, async (request) => {

    // --- Get config values directly from process.env ---
    const appId = process.env.ALGOLIA_APP_ID;
    const searchKey = process.env.ALGOLIA_SEARCH_KEY; // Using Search Key
    const indexName = process.env.ALGOLIA_INDEX_NAME || 'posts'; // Default name if env var missing
    // --- END Get config values ---

    // --- Initialize Algolia Client INSIDE the handler ---
    let searchClient;
    console.log(`Attempting to initialize Algolia client from process.env. AppID: ${appId}, Key exists: ${!!searchKey}`);
    // Check if critical values were found in process.env
    if (!appId || !searchKey) {
        console.error("Algolia configuration missing or incomplete in process.env! Check ALGOLIA_APP_ID and ALGOLIA_SEARCH_KEY.");
        // Log available env vars (optional, be careful with secrets in logs)
        // console.log("Available process.env keys related to algolia:", Object.keys(process.env).filter(k => k.toLowerCase().includes('algolia')));
        throw new HttpsError('internal', 'Algolia search client configuration is missing in environment.');
    }
    try {
        searchClient = algoliasearch(appId, searchKey);
        console.log("Algolia client initialized successfully from process.env.");
    } catch (initError) {
         console.error("Error initializing Algolia client:", initError);
         throw new HttpsError('internal', 'Failed to initialize Algolia client.');
    }
    // --- END Initialize Algolia Client ---

    // Index name check
    if (!indexName) {
         throw new HttpsError('internal', 'Algolia index name is not configured in environment.');
    }

    // Query validation
    const queryString = request.data.query;
    if (!queryString || typeof queryString !== 'string' || queryString.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'The function must be called with a valid "query" string argument.');
    }

    const searchTerm = queryString.trim();
    const page = request.data.page || 0;
    const hitsPerPage = request.data.perPage || 20;

    console.log(`(Algolia - process.env) Received search query: "${searchTerm}"`);
    const index = searchClient.initIndex(indexName);

    // Perform search
    try {
        console.log(`Searching Algolia index '<span class="math-inline">\{indexName\}' for query "</span>{searchTerm}"...`);
        const searchResults = await index.search(searchTerm, {
            page: page,
            hitsPerPage: hitsPerPage,
        });
        console.log(`Algolia returned ${searchResults.nbHits} total hits, sending back ${searchResults.hits.length} for page ${page}.`);

        const results = searchResults.hits.map(hit => ({
             ...hit,
             id: hit.objectID
        }));

        return results;

    } catch (error) {
        console.error("(Algolia) Error during Algolia search execution:", error);
        throw new HttpsError('internal', 'Failed to perform search using Algolia.', error.message);
    }
});


/**
 * Analyzes post content when a post is created or updated.
 */
// --- analyzePostContent function (Unchanged) ---
exports.analyzePostContent = onDocumentWritten({ document: "posts/{postId}", memory: "512MB" }, async (event) => {
    // ... (other initial code like getting change, postId, postData, etc.) ...
    logger.log(`Processing post ${postId} in analyzePostContent.`);
  
    // ... (shouldProcess check) ...
  
    logger.log(`Analyzing content for post ${postId} from URL: ${postData.contentUrl}`);
    try {
      // 1. Fetch HTML Content
      const response = await fetch(postData.contentUrl);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const htmlContent = await response.text();
      logger.log(`Workspaceed HTML content for post ${postId}. Length: ${htmlContent.length}`);
  
      // 2. Extract Plain Text
      // ---> LAZY LOAD JSDOM HERE <---
      const { JSDOM } = require("jsdom");
      let textContent = "";
      try {
        const dom = new JSDOM(htmlContent);
        textContent = (dom.window.document.body?.textContent || "").replace(/\s+/g, ' ').trim();
        logger.log(`Extracted text content for post ${postId}. Length: ${textContent.length}`);
      } catch (parseError) {
        logger.error(`Error parsing HTML for post ${postId}:`, parseError);
        // textContent remains ""
      }
  
      if (!textContent) {
         logger.warn(`No text content for post ${postId}. Updating with empty keywords.`);
         await change.after.ref.update({ keywords: [] });
         return null;
      }
  
      // 3. Perform NLP Analysis
      // ---> LAZY LOAD NATURAL HERE <---
      const natural = require("natural");
      const tokenizer = new natural.WordTokenizer();
      const tokens = tokenizer.tokenize(textContent.toLowerCase());
      const englishStopwords = natural.stopwords;
      const filteredTokens = tokens.filter(token => !englishStopwords.includes(token));
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
      return null;
    }
  });


/**
 * NEW Scheduled function to calculate and store globally trending keywords.
 */
exports.calculateTrendingKeywords = onSchedule({
    // Schedule to run, e.g., every hour or every few hours
    schedule: "0 * * * *",
    timeZone: "Africa/Lagos", // Match your other function
    memory: "512MB"
  }, async (event) => {
    logger.info("Starting trending keyword calculation job.");

    const TREND_TIMEFRAME_HOURS = 24; // Look at interactions in the last 24 hours
    const MAX_INTERACTIONS_TO_PROCESS = 10000; // Limit to avoid excessive reads
    const TOP_N_KEYWORDS = 20; // How many trending keywords to store

    try {
        // 1. Get timestamp for the start of the timeframe
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - TREND_TIMEFRAME_HOURS);
        const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

        // 2. Query recent interactions
        logger.info(`Workspaceing interactions since ${cutoffDate.toISOString()}...`);
        const recentInteractionsQuery = db.collection('userInteractions')
            .where('timestamp', '>=', cutoffTimestamp)
            // Optionally limit the total interactions fetched for performance
            .limit(MAX_INTERACTIONS_TO_PROCESS)
            .select('postId'); // Only need postId

        const interactionsSnapshot = await recentInteractionsQuery.get();
        logger.info(`Found ${interactionsSnapshot.size} interactions in the last ${TREND_TIMEFRAME_HOURS} hours.`);

        if (interactionsSnapshot.empty) {
            logger.info("No recent interactions found. Skipping trend calculation.");
            // Optionally clear the existing trends doc or leave it as is
            // await db.collection('trends').doc('globalKeywords').set({ keywords: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            return null;
        }

        // 3. Get unique post IDs from interactions
        const recentPostIds = new Set();
        interactionsSnapshot.forEach(doc => {
            if (doc.data().postId) { // Ensure postId exists
                 recentPostIds.add(doc.data().postId);
            }
        });
        const uniquePostIds = Array.from(recentPostIds);
        logger.info(`Found ${uniquePostIds.length} unique posts with recent interactions.`);

        if (uniquePostIds.length === 0) {
             logger.info("No valid post IDs found in recent interactions.");
             return null;
        }

        // 4. Fetch keywords for these posts (using batch helper)
        const postKeywordsMap = await fetchPostKeywordsBatch(uniquePostIds);
        logger.info(`Workspaceed keywords for ${postKeywordsMap.size} posts.`);

        // 5. Aggregate keyword frequencies
        const keywordCounts = {};
        postKeywordsMap.forEach((keywords) => { // Iterate through the keywords arrays
            if (Array.isArray(keywords)) {
                keywords.forEach(keyword => {
                    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                });
            }
        });

        // 6. Determine top N keywords
        const sortedKeywords = Object.entries(keywordCounts)
            .sort(([, countA], [, countB]) => countB - countA); // Sort by count descending

        const topKeywords = sortedKeywords.slice(0, TOP_N_KEYWORDS).map(([keyword]) => keyword); // Get only the keyword strings

        logger.info(`Top ${topKeywords.length} trending keywords:`, topKeywords.join(', '));

        // 7. Store the trending keywords list in Firestore
        const trendsRef = db.collection('trends').doc('globalKeywords');
        await trendsRef.set({
            keywords: topKeywords,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            timeframeHours: TREND_TIMEFRAME_HOURS,
            calculatedAt: new Date().toISOString(), // For debugging
        });

        logger.info(`Successfully stored top ${topKeywords.length} trending keywords.`);

    } catch (error) {
        logger.error("Error during trending keyword calculation:", error);
        return null; // Indicate failure but allow potential retries
    }

    logger.info("Finished trending keyword calculation job successfully.");
    return null; // Indicate success
});


/**
 * MODIFIED Scheduled function to generate recommendations.
 * Includes weighted interactions AND cold-start logic using trending keywords.
 */
exports.generateRecommendations = onSchedule({
    schedule: "every 5 hours",
    timeZone: "Africa/Lagos",
    memory: "512MB"
  }, async (event) => {

    logger.info("Starting recommendation generation job (weighted + cold start).");

    const weights = { like: 3, comment: 2, view: 1 };
    const MIN_INTERACTIONS_FOR_PERSONALIZED = 5; // Min interactions needed to skip cold start
    const RECENT_POST_DAYS_FOR_COLD_START = 7; // How recent posts should be for cold start
    const COLD_START_RECOMMENDATION_LIMIT = 30; // How many cold start posts to recommend

    try {
      // 1. Identify Active Users (Unchanged)
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

      // --- Pre-fetch trending keywords for cold start ---
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
          // Continue without trending keywords if fetch fails
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

        // --- Check for Cold Start Condition ---
        if (userInteractions.length < MIN_INTERACTIONS_FOR_PERSONALIZED) {
            logger.info(`User ${userId} has fewer than ${MIN_INTERACTIONS_FOR_PERSONALIZED} interactions. Attempting cold start recommendation.`);

            if (trendingKeywords.length > 0) {
                try {
                    // Calculate date for recent posts
                    const recentPostCutoffDate = new Date();
                    recentPostCutoffDate.setDate(recentPostCutoffDate.getDate() - RECENT_POST_DAYS_FOR_COLD_START);
                    const recentPostCutoffTimestamp = admin.firestore.Timestamp.fromDate(recentPostCutoffDate);

                    // Query recent posts matching trending keywords
                    const coldStartQuery = db.collection('posts')
                        .where('keywords', 'array-contains-any', trendingKeywords)
                        .where('createdAt', '>=', recentPostCutoffTimestamp) // Ensure posts are recent
                        .orderBy('createdAt', 'desc') // Show newest first
                        .limit(COLD_START_RECOMMENDATION_LIMIT)
                        .select(); // Select all fields needed by frontend (or just ID if storing only IDs)

                    const coldStartSnapshot = await coldStartQuery.get();
                    const coldStartPostIds = coldStartSnapshot.docs.map(doc => doc.id);

                    if (coldStartPostIds.length > 0) {
                        // Store these IDs as recommendations
                        const recommendationsRef = db.collection('userRecommendations').doc(userId);
                        await recommendationsRef.set({
                            postIds: coldStartPostIds,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            type: 'cold_start_trending' // Add type for debugging/info
                        });
                        logger.info(`Stored ${coldStartPostIds.length} cold start (trending keyword) recommendations for user ${userId}.`);
                    } else {
                        logger.warn(`No recent posts found matching trending keywords for user ${userId}. No cold start recommendation generated.`);
                        // Optional: Generate recommendations based purely on latest posts as final fallback?
                    }
                } catch (coldStartError) {
                    logger.error(`Error generating cold start recommendations for user ${userId}:`, coldStartError);
                }
            } else {
                logger.warn(`No trending keywords available for cold start for user ${userId}.`);
                 // Optional: Generate recommendations based purely on latest posts as final fallback?
            }
            continue; // Move to the next user after handling cold start
        }

        // --- b. Build Personalized Weighted User Interest Profile ---
        // (This part runs only if user is NOT cold start)
        const userInterestProfile = {};
        const interactedPostData = new Map();
        userInteractions.forEach(interaction => {
            if (!weights[interaction.interactionType]) return;
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

        // --- c. Fetch Candidate Posts ---
        const interactedPostIdsSet = new Set(postIdsToFetchKeywords);
        const candidatePosts = [];
        const candidateLimit = 200;
        try {
            const postsRef = db.collection('posts');
            const candidatesQuery = postsRef.orderBy('createdAt', 'desc')
                .limit(candidateLimit).select('keywords');
            const candidatesSnapshot = await candidatesQuery.get();
            candidatesSnapshot.forEach(doc => {
                const postId = doc.id;
                if (!interactedPostIdsSet.has(postId)) {
                    const postKeywords = doc.data().keywords;
                    if (Array.isArray(postKeywords) && postKeywords.length > 0) {
                        candidatePosts.push({ id: postId, keywords: postKeywords });
                    }
                }
            });
            logger.debug(`Found ${candidatePosts.length} candidate posts for user ${userId}.`);
            if (candidatePosts.length === 0) { logger.info(`No candidates for user ${userId}. Skipping.`); continue; }
        } catch (candidateQueryError) { logger.error(`Error fetching candidates for user ${userId}:`, candidateQueryError); continue; }

        // --- d. Score Candidate Posts ---
        const scoredCandidates = [];
        candidatePosts.forEach(candidate => {
            let score = 0;
            candidate.keywords.forEach(keyword => { score += userInterestProfile[keyword] || 0; });
            if (score > 0) { scoredCandidates.push({ id: candidate.id, score: score }); }
        });
        logger.debug(`Scored ${scoredCandidates.length} candidates for user ${userId}.`);
        if (scoredCandidates.length === 0) { logger.info(`No candidates matched profile for user ${userId}. Skipping.`); continue; }

        // --- e. Rank Candidates ---
        scoredCandidates.sort((a, b) => b.score - a.score);
        const recommendationLimit = 30;
        const topCandidates = scoredCandidates.slice(0, recommendationLimit);
        const recommendedPostIds = topCandidates.map(candidate => candidate.id);
        logger.debug(`Ranked top ${recommendedPostIds.length} post IDs for user ${userId}.`);

        // --- f. Store Personalized Recommendations ---
        if (recommendedPostIds.length > 0) {
            const recommendationsRef = db.collection('userRecommendations').doc(userId);
            await recommendationsRef.set({
                postIds: recommendedPostIds,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                type: 'personalized_weighted' // Add type for debugging/info
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