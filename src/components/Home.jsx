// src/components/Home.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { db, auth } from '../services/firebase';
import {
    collection, getDocs, doc, getDoc, query, where,
    orderBy, limit, documentId, Timestamp // Added Timestamp
} from 'firebase/firestore';
import { Link } from 'react-router-dom';

const POSTS_PER_PAGE = 9; // Define limit for fallback/recommendation lists

const Home = () => {
    const [featuredPost, setFeaturedPost] = useState(null); // Will hold the admin-selected post
    const [currentUserUid, setCurrentUserUid] = useState(null);
    const [recommendedPosts, setRecommendedPosts] = useState([]);
    const [fallbackPosts, setFallbackPosts] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [displayMode, setDisplayMode] = useState('loading'); // 'loading', 'recommended', 'fallback'
    const [visibleRecCount, setVisibleRecCount] = useState(POSTS_PER_PAGE);
    const [visibleFallbackCount, setVisibleFallbackCount] = useState(POSTS_PER_PAGE);

    // --- Effect to listen for Auth changes ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            setCurrentUserUid(user ? user.uid : null);
            // Reset counts when user changes
            setVisibleRecCount(POSTS_PER_PAGE);
            setVisibleFallbackCount(POSTS_PER_PAGE);
        });
        return () => unsubscribe();
    }, []);

    // --- Helper to fetch profiles based on UIDs (Unchanged) ---
    const fetchProfiles = async (uids) => {
        const uniqueUids = [...new Set(uids)].filter(uid => uid); // Ensure UIDs are valid
        if (uniqueUids.length === 0) return new Map();

        const profilesMap = new Map();
        // Consider batching if uniqueUids.length > 10
        const idsToFetch = uniqueUids.slice(0, 10); // Firestore 'in' query limit is 10
        if (idsToFetch.length === 0) return profilesMap;

        try {
            const profilesQuery = query(
                collection(db, 'profiles'),
                where(documentId(), 'in', idsToFetch)
            );
            const querySnapshot = await getDocs(profilesQuery);
            querySnapshot.forEach((docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    profilesMap.set(docSnap.id, {
                        name: data.name || 'Author Name',
                        photoURL: data.profilePictureUrl || null
                    });
                } else {
                    profilesMap.set(docSnap.id, { name: 'Author Name', photoURL: null });
                }
            });
             // Fetch remaining profiles if needed (implement batching here for > 10 UIDs)
             // For now, this handles up to 10 unique profiles per fetch cycle

        } catch (error) {
            console.error("Error fetching profiles:", error);
            uniqueUids.forEach(uid => { // Provide default on error
                if (!profilesMap.has(uid)) {
                    profilesMap.set(uid, { name: 'Author Name', photoURL: null });
                }
            });
        }
        return profilesMap;
    };

     // --- Helper to format post data (handles Timestamps) ---
     const formatPostData = (docSnap) => {
        if (!docSnap.exists()) return null;
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp
                ? data.createdAt.toDate()
                : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date())
        };
     };


    // --- Main Data Fetching Logic (MODIFIED) ---
    const fetchData = useCallback(async () => {
        setLoadingData(true);
        setDisplayMode('loading');
        setFeaturedPost(null); setRecommendedPosts([]); setFallbackPosts([]); // Reset state
        console.log("fetchData triggered. User UID:", currentUserUid);

        let fetchedFeaturedPost = null;
        let fetchedRecommendedPosts = [];
        let fetchedFallbackPosts = [];
        let finalDisplayMode = 'fallback'; // Assume fallback initially
        let featuredPostIdFromSettings = null;

        try {
            // --- Step 1 & 2: Fetch Featured Post (from Settings or Latest) ---
            console.log("Fetching site settings for featured post ID...");
            const settingsRef = doc(db, "settings", "siteConfig");
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists() && settingsSnap.data().featuredPostId) {
                featuredPostIdFromSettings = settingsSnap.data().featuredPostId;
                const postRef = doc(db, "posts", featuredPostIdFromSettings);
                const postSnap = await getDoc(postRef);
                fetchedFeaturedPost = formatPostData(postSnap);
                if (!fetchedFeaturedPost) console.warn(`Featured post ${featuredPostIdFromSettings} not found.`);
                else console.log(`Fetched featured post: ${fetchedFeaturedPost.id}`);
            } else { console.log("Settings document or featuredPostId not found."); }

            if (!fetchedFeaturedPost) { // Fallback to latest if no setting or post not found
                console.log("Fetching latest post as fallback feature...");
                const latestQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(1));
                const latestSnapshot = await getDocs(latestQuery);
                if (!latestSnapshot.empty) fetchedFeaturedPost = formatPostData(latestSnapshot.docs[0]);
                else console.log("No posts found in database.");
            }

            const featuredPostIdToExclude = fetchedFeaturedPost?.id; // ID to exclude later

            // --- Step 3: Fetch Recommendations (if user logged in) ---
            let recommendedPostIds = []; // Keep track of IDs fetched for recommendations
            if (currentUserUid) {
                console.log(`User ${currentUserUid} logged in. Fetching recommendations...`);
                const recommendationsRef = doc(db, 'userRecommendations', currentUserUid);
                const recDocSnap = await getDoc(recommendationsRef);
                if (recDocSnap.exists() && Array.isArray(recDocSnap.data().postIds) && recDocSnap.data().postIds.length > 0) {
                    recommendedPostIds = recDocSnap.data().postIds; // Get the full list of IDs
                    const idsToFetch = recommendedPostIds
                        .filter(id => id !== featuredPostIdToExclude) // Exclude featured
                        .slice(0, 30); // Limit how many we actually try to fetch details for

                    if (idsToFetch.length > 0) {
                        // Fetch recommended posts (consider batching if > 10)
                        const postsQuery = query(collection(db, 'posts'), where(documentId(), 'in', idsToFetch.slice(0, 10)));
                        const postsSnapshot = await getDocs(postsQuery);
                        const postsDataMap = new Map();
                        postsSnapshot.forEach(doc => {
                            const formatted = formatPostData(doc);
                            if (formatted) postsDataMap.set(doc.id, formatted);
                        });
                        const orderedRecommendedPosts = idsToFetch
                            .map(id => postsDataMap.get(id))
                            .filter(post => post !== undefined);

                        if (orderedRecommendedPosts.length > 0) {
                            fetchedRecommendedPosts = orderedRecommendedPosts;
                            finalDisplayMode = 'recommended'; // Set display mode if recommendations found
                            console.log(`Workspaceed ${fetchedRecommendedPosts.length} recommended posts.`);
                        } else { console.log("Could not fetch details for recommended IDs."); }
                    } else { console.log("No valid recommended IDs to fetch after exclusion."); }
                } else { console.log(`No recommendations document or postIds found for user ${currentUserUid}.`); }
            }

            // --- Step 4: Fetch Fallback Posts (Latest/More) - ALWAYS RUN THIS NOW ---
            console.log("Fetching fallback/latest posts...");
            const postsToExclude = new Set([featuredPostIdToExclude, ...fetchedRecommendedPosts.map(p => p.id)].filter(id => id)); // Combine all IDs to exclude
            const fallbackLimit = POSTS_PER_PAGE + postsToExclude.size; // Fetch extra to account for exclusions
            let fallbackQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(fallbackLimit));
            const fallbackSnapshot = await getDocs(fallbackQuery);

            // Filter out excluded posts client-side and take the required number
            fetchedFallbackPosts = fallbackSnapshot.docs
                .map(formatPostData)
                .filter(post => post && !postsToExclude.has(post.id)) // Exclude featured and recommended
                .slice(0, POSTS_PER_PAGE); // Limit to page size

            console.log(`Workspaceed ${fetchedFallbackPosts.length} fallback/latest posts after filtering.`);

            // --- Step 5: Fetch Profiles ---
            console.log("Fetching author profiles...");
            const allPostUids = [
                ...(fetchedFeaturedPost ? [fetchedFeaturedPost.uid] : []),
                ...fetchedRecommendedPosts.map(p => p.uid),
                ...fetchedFallbackPosts.map(p => p.uid)
            ];
            const profilesMap = await fetchProfiles(allPostUids);
            console.log("Fetched profiles map:", profilesMap);

            // --- Step 6: Attach Profile Data ---
            if (fetchedFeaturedPost) { /* ... attach profile ... */
                const profile = profilesMap.get(fetchedFeaturedPost.uid);
                fetchedFeaturedPost.authorName = profile?.name || 'Author Name';
                fetchedFeaturedPost.authorPhotoURL = profile?.photoURL || null;
            }
            fetchedRecommendedPosts = fetchedRecommendedPosts.map(post => { /* ... attach profile ... */
                const profile = profilesMap.get(post.uid);
                return { ...post, authorName: profile?.name || 'Author Name', authorPhotoURL: profile?.photoURL || null };
            });
            fetchedFallbackPosts = fetchedFallbackPosts.map(post => { /* ... attach profile ... */
                const profile = profilesMap.get(post.uid);
                return { ...post, authorName: profile?.name || 'Author Name', authorPhotoURL: profile?.photoURL || null };
            });

        } catch (error) {
            console.error("Error fetching data for Home:", error);
            // Reset state on critical error
            fetchedFeaturedPost = null; fetchedFallbackPosts = []; fetchedRecommendedPosts = [];
            finalDisplayMode = 'fallback'; // Or set an error state
        } finally {
            // --- Step 7: Set final state ---
            console.log("Setting final state:", { finalDisplayMode, fetchedFeaturedPost, fetchedRecommendedPosts, fetchedFallbackPosts });
            setFeaturedPost(fetchedFeaturedPost);
            setRecommendedPosts(fetchedRecommendedPosts);
            setFallbackPosts(fetchedFallbackPosts);
            setDisplayMode(finalDisplayMode);
            setLoadingData(false);
            setVisibleRecCount(POSTS_PER_PAGE);
            setVisibleFallbackCount(POSTS_PER_PAGE);
        }
    }, [currentUserUid]);

    // Trigger data fetch when currentUserUid changes
    useEffect(() => {
        fetchData();
    }, [fetchData]);


    // --- Load More Handlers (Unchanged) ---
    const loadMoreRecommended = () => {
        setVisibleRecCount(prevCount => prevCount + POSTS_PER_PAGE);
    };
    const loadMoreFallback = () => {
        setVisibleFallbackCount(prevCount => prevCount + POSTS_PER_PAGE);
    };

    // --- Default Avatar (Unchanged) ---
    const DefaultAvatar = () => (
         <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden ring-1 ring-white/50">
             <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
         </div>
    );

    // --- Render Helper for Post Card (Unchanged) ---
    const renderPostCard = (post) => (
        <div key={post.id} className="w-full mb-6">
            <Link to={`/post/${post.id}`} className='w-full group'>
                <div
                    className='relative w-full h-[220px] md:h-[300px] bg-center bg-cover rounded md:rounded-xl mb-3 overflow-hidden transition-transform duration-300 md:group-hover:scale-105'
                    style={{ backgroundImage: `url(${post.imageUrl || 'https://placehold.co/600x400/EEE/31343C?text=No+Image'})` }} // Updated placeholder
                    title={post.title}
                >
                     <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex items-center gap-2">
                        {post.authorPhotoURL ? (
                            <img src={post.authorPhotoURL} alt={post.authorName || 'Author'} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/50" />
                        ) : ( <DefaultAvatar /> )}
                        <span className="text-white text-xs font-medium truncate">
                             {post.authorName || 'Unknown Author'}
                        </span>
                     </div>
                 </div>
                <h3 className='font-bold group-hover:text-primary transition-colors line-clamp-2'>{post.title}</h3> {/* Added line-clamp */}
                {post.excerpt && <p className='text-sm italic text-base-content/80 mt-1 line-clamp-2'>{post.excerpt}</p>}
                <p className="text-xs text-gray-500 mt-2">{post.createdAt ? post.createdAt.toLocaleDateString() : ''}</p>
            </Link>
        </div>
    );


    // --- Main Render (Structure Unchanged) ---
    return (
        <div className="">
            {/* Featured Post Section */}
             <div className='w-full h-[70vh] md:h-[95vh] px-2 md:px-6 pb-12'>
                {!loadingData && featuredPost ? (
                  <div className="relative w-full bg-center bg-cover rounded md:rounded-2xl text-white shadow-lg" // Added shadow
                    style={{ backgroundImage: `url('${featuredPost.imageUrl || 'https://placehold.co/1200x800/777/FFF?text=Featured+Image'}')`, height: '100%', width: '100%' }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent rounded md:rounded-2xl"></div> {/* Adjusted gradient */}
                    <div className='absolute bottom-8 left-5 md:bottom-12 md:left-10 lg:bottom-16 lg:left-16 max-w-[80%] md:max-w-[65%] z-10'> {/* Added z-index */}
                      <div>
                        <h2 className='text-[10px] md:text-xs uppercase tracking-wider mb-1 md:mb-2 font-semibold text-white/80'>Featured Article</h2>
                        <Link to={`/post/${featuredPost.id}`}>
                          <h3 className='text-xl md:text-3xl lg:text-5xl font-bold leading-tight hover:underline text-shadow-md'>{featuredPost.title}</h3> {/* Added text shadow */}
                        </Link>
                        {featuredPost.excerpt && <p className='text-[10px] md:text-sm lg:text-base mt-2 md:mt-3 line-clamp-2 md:line-clamp-3 opacity-90'>{featuredPost.excerpt}</p>}
                         {/* Optional: Display author info here too */}
                         {featuredPost.authorName && (
                             <div className="flex items-center gap-2 mt-3 md:mt-4">
                                 {featuredPost.authorPhotoURL ? (
                                     <img src={featuredPost.authorPhotoURL} alt={featuredPost.authorName} className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover ring-1 ring-white/50" />
                                 ) : ( <DefaultAvatar /> )}
                                 <span className="text-white/80 text-xs md:text-sm font-medium">
                                     {featuredPost.authorName}
                                 </span>
                             </div>
                         )}
                      </div>
                    </div>
                  </div>
                ) : loadingData ? ( // Loading state
                  <div className="flex justify-center items-center h-full bg-base-200 rounded-2xl animate-pulse">
                    {/* Skeleton loader */}
                  </div>
                ) : ( // No featured post available state
                   <div className="flex flex-col justify-center items-center h-full bg-base-200 rounded-2xl text-center p-4">
                      <h3 className="text-xl font-semibold mb-2">No Featured Post</h3>
                      <p className="text-base-content/70">Check back later or explore the latest articles below.</p>
                   </div>
                )}
             </div>

            {/* Posts Section */}
            <div className="posts-section px-4 md:px-10 pb-10">
                {loadingData ? (
                   <div className="text-center py-10"><span className="loading loading-dots loading-lg"></span></div>
                ) : (
                    <>
                        {/* Recommended Section */}
                        {displayMode === 'recommended' && recommendedPosts.length > 0 && (
                            <div className="mb-8 md:mb-12">
                                <h2 className='text-xl md:text-2xl font-semibold mb-4 md:mb-6 border-b pb-2'>Recommended For You</h2>
                                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8'>
                                    {recommendedPosts.slice(0, visibleRecCount).map(renderPostCard)}
                                </div>
                                {recommendedPosts.length > visibleRecCount && (
                                    <div className="text-center mt-8"> <button onClick={loadMoreRecommended} className="btn btn-primary btn-outline"> Load More Recommended </button> </div>
                                )}
                            </div>
                        )}

                        {/* Fallback/More Articles Section */}
                        {(displayMode === 'fallback' || (displayMode === 'recommended' && fallbackPosts.length > 0)) && (
                            <div className="mt-6">
                                <h2 className='text-xl md:text-2xl font-semibold mb-4 md:mb-6 border-b pb-2'>
                                    {displayMode === 'recommended' ? "More Articles" : "Latest Articles"}
                                </h2>
                                {fallbackPosts.length > 0 ? (
                                    <>
                                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8'>
                                            {fallbackPosts.slice(0, visibleFallbackCount).map(renderPostCard)}
                                        </div>
                                        {fallbackPosts.length > visibleFallbackCount && (
                                            <div className="text-center mt-8"> <button onClick={loadMoreFallback} className="btn btn-primary btn-outline"> Load More Articles </button> </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-center text-gray-500 py-10">No more articles available.</p>
                                )}
                            </div>
                        )}

                        {/* Handle case where nothing loaded at all */}
                        {!loadingData && !featuredPost && recommendedPosts.length === 0 && fallbackPosts.length === 0 && (
                            <p className="text-center text-gray-500 py-10">Could not load any articles.</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Home;

