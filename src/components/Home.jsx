import React, { useEffect, useState, useCallback } from 'react';
import { db, auth } from '../services/firebase';
import {
    collection, getDocs, doc, getDoc, query, where,
    orderBy, limit, documentId
} from 'firebase/firestore';
import { Link } from 'react-router-dom';

const Home = () => {
    // Keep state variables
    const [featuredPost, setFeaturedPost] = useState(null);
    const [currentUserUid, setCurrentUserUid] = useState(null);
    const [recommendedPosts, setRecommendedPosts] = useState([]);
    const [fallbackPosts, setFallbackPosts] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [displayMode, setDisplayMode] = useState('loading');
    const [visibleRecCount, setVisibleRecCount] = useState(9);
    const [visibleFallbackCount, setVisibleFallbackCount] = useState(9);

    // --- Effect to listen for Auth changes ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            setCurrentUserUid(user ? user.uid : null);
        });
        return () => unsubscribe();
    }, []);

    // --- Helper to fetch profiles based on UIDs ---
    const fetchProfiles = async (uids) => {
        const uniqueUids = [...new Set(uids)]; // Get unique UIDs
        if (uniqueUids.length === 0) {
            return new Map(); // Return empty map if no UIDs
        }

        const profilesMap = new Map();
        try {
             // Fetch profiles in batches of 10 (Firestore 'in' query limit) if needed,
             // but for simplicity here, fetch all unique ones if <= 10, otherwise handle batches
             // For now, let's assume we fetch all unique ones in one go if possible within limits
             // In a real app, you'd batch this if uniqueUids.length > 10
             const profilesQuery = query(
                 collection(db, 'profiles'),
                 where(documentId(), 'in', uniqueUids.slice(0, 10)) // Fetch up to 10, adjust if needed
             );
            const querySnapshot = await getDocs(profilesQuery);
            querySnapshot.forEach((docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    profilesMap.set(docSnap.id, {
                        name: data.name || 'Author Name', // Fallback name
                        photoURL: data.profilePictureUrl || null // Use null if no picture
                    });
                } else {
                     profilesMap.set(docSnap.id, { name: 'Author Name', photoURL: null }); // Fallback if profile doc doesn't exist
                }
            });
        } catch (error) {
            console.error("Error fetching profiles:", error);
            // Provide default for all requested UIDs on error
            uniqueUids.forEach(uid => {
                 if (!profilesMap.has(uid)) {
                     profilesMap.set(uid, { name: 'Author Name', photoURL: null });
                 }
            });
        }
        return profilesMap;
    };


    // --- Main Data Fetching Logic ---
    const fetchData = useCallback(async () => {
        setLoadingData(true);
        setDisplayMode('loading');
        console.log("fetchData triggered. User UID:", currentUserUid);

        let fetchedFeaturedPost = null;
        let fetchedFallbackPosts = [];
        let fetchedRecommendedPosts = [];
        let finalDisplayMode = 'fallback';

        try {
            // --- Step 1: Always fetch recent posts for potential fallback/feature ---
            console.log("Fetching initial posts for fallback/feature...");
            const postCollection = collection(db, "posts");
            const fallbackQuery = query(postCollection, orderBy("createdAt", "desc"), limit(30));
            const fallbackSnapshot = await getDocs(fallbackQuery);
            let initialPostList = fallbackSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate()
            }));
            console.log(`Workspaceed ${initialPostList.length} initial posts.`);

            if (initialPostList.length > 0) {
                fetchedFeaturedPost = initialPostList[0];
                fetchedFallbackPosts = initialPostList.slice(1);
            } else {
                console.log("No posts found in the database.");
            }

            // --- Step 2: If user is logged in, try to get personalized recommendations ---
            if (currentUserUid) {
                 console.log(`User ${currentUserUid} is logged in. Fetching recommendations...`);
                 const recommendationsRef = doc(db, 'userRecommendations', currentUserUid);
                 const recDocSnap = await getDoc(recommendationsRef);

                if (recDocSnap.exists()) {
                    const recData = recDocSnap.data();
                    const recommendedPostIds = recData.postIds;

                    if (Array.isArray(recommendedPostIds) && recommendedPostIds.length > 0) {
                         const idsToFetch = recommendedPostIds.slice(0, 30);
                         console.log("Recommended Post IDs to fetch:", idsToFetch);

                        if (idsToFetch.length > 0) {
                            const postsQuery = query(collection(db, 'posts'), where(documentId(), 'in', idsToFetch));
                            const postsSnapshot = await getDocs(postsQuery);
                            const postsDataMap = new Map();
                            postsSnapshot.forEach(doc => {
                                postsDataMap.set(doc.id, { id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() });
                            });

                            const orderedRecommendedPosts = idsToFetch
                                .map(id => postsDataMap.get(id))
                                .filter(post => post !== undefined);

                            if (orderedRecommendedPosts.length > 0) {
                                fetchedRecommendedPosts = orderedRecommendedPosts;
                                finalDisplayMode = 'recommended';
                                console.log(`Workspaceed ${fetchedRecommendedPosts.length} recommended posts.`);

                                const recommendedAndFeaturedIds = new Set(idsToFetch);
                                if (fetchedFeaturedPost) {
                                    recommendedAndFeaturedIds.add(fetchedFeaturedPost.id);
                                }
                                fetchedFallbackPosts = initialPostList.filter(post => !recommendedAndFeaturedIds.has(post.id));
                                console.log(`Adjusted fallback list size: ${fetchedFallbackPosts.length}`);
                            } else {
                                console.log("Could not fetch post details for recommended IDs.");
                            }
                        } else {
                             console.log("No valid recommended IDs to fetch.");
                        }
                    } else {
                         console.log(`No recommendation postIds found for user ${currentUserUid}.`);
                    }
                } else {
                    console.log(`No recommendations document found for user ${currentUserUid}.`);
                }
            } else {
                 console.log("User is logged out. Using default fallback.");
            }

             // --- Step 3: Fetch Author Profiles for Recommended and Fallback Posts ---
             console.log("Fetching author profiles...");
             const allPostUids = [
                 ...fetchedRecommendedPosts.map(p => p.uid),
                 ...fetchedFallbackPosts.map(p => p.uid)
             ].filter(uid => uid); // Filter out any undefined UIDs

             const profilesMap = await fetchProfiles(allPostUids);
             console.log("Fetched profiles map:", profilesMap);

             // --- Step 4: Attach Profile Data to Posts ---
             fetchedRecommendedPosts = fetchedRecommendedPosts.map(post => ({
                 ...post,
                 authorName: profilesMap.get(post.uid)?.name || 'Author Name',
                 authorPhotoURL: profilesMap.get(post.uid)?.photoURL // Will be null if not found
             }));
             fetchedFallbackPosts = fetchedFallbackPosts.map(post => ({
                 ...post,
                 authorName: profilesMap.get(post.uid)?.name || 'Author Name',
                 authorPhotoURL: profilesMap.get(post.uid)?.photoURL // Will be null if not found
             }));

             // Also fetch profile for featured post if needed (optional, depends on design)
             if (fetchedFeaturedPost && fetchedFeaturedPost.uid && !profilesMap.has(fetchedFeaturedPost.uid)) {
                  const featuredProfile = await fetchProfiles([fetchedFeaturedPost.uid]);
                  if (featuredProfile.has(fetchedFeaturedPost.uid)) {
                       fetchedFeaturedPost.authorName = featuredProfile.get(fetchedFeaturedPost.uid)?.name || 'Author Name';
                       fetchedFeaturedPost.authorPhotoURL = featuredProfile.get(fetchedFeaturedPost.uid)?.photoURL;
                  }
             } else if (fetchedFeaturedPost && fetchedFeaturedPost.uid) {
                 fetchedFeaturedPost.authorName = profilesMap.get(fetchedFeaturedPost.uid)?.name || 'Author Name';
                 fetchedFeaturedPost.authorPhotoURL = profilesMap.get(fetchedFeaturedPost.uid)?.photoURL;
             }


        } catch (error) {
            console.error("Error fetching data:", error);
            fetchedFeaturedPost = null;
            fetchedFallbackPosts = [];
            fetchedRecommendedPosts = [];
            finalDisplayMode = 'fallback';
        } finally {
            // --- Step 5: Set all states together ---
            console.log("Setting final state:", { finalDisplayMode, fetchedFeaturedPost, fetchedRecommendedPosts, fetchedFallbackPosts });
            setFeaturedPost(fetchedFeaturedPost);
            setRecommendedPosts(fetchedRecommendedPosts);
            setFallbackPosts(fetchedFallbackPosts);
            setDisplayMode(finalDisplayMode);
            setLoadingData(false);
            setVisibleRecCount(9);
            setVisibleFallbackCount(9);
        }
    }, [currentUserUid]); // Effect depends on user UID

    // Trigger data fetch when currentUserUid changes
    useEffect(() => {
        fetchData();
    }, [fetchData]);


    // --- Load More Handlers ---
    const loadMoreRecommended = () => {
        setVisibleRecCount(prevCount => prevCount + 9);
    };

    const loadMoreFallback = () => {
        setVisibleFallbackCount(prevCount => prevCount + 9);
    };

    // --- Default Avatar ---
    const DefaultAvatar = () => (
         <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden ring-1 ring-white/50">
             <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
         </div>
    );

    // --- Render Helper for Post Card ---
    const renderPostCard = (post) => (
        <div key={post.id} className="w-full mb-6">
            <Link to={`/post/${post.id}`} className='w-full group'>
                {/* Image container made relative */}
                <div
                    className='relative w-full h-[300px] bg-center bg-cover rounded-xl mb-3 overflow-hidden transition-transform duration-300 group-hover:scale-105'
                    style={{ backgroundImage: `url(${post.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image'})` }}
                    title={post.title}
                >
                     {/* Author Info Overlay - positioned at bottom */}
                     <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex items-center gap-2">
                        {post.authorPhotoURL ? (
                            <img src={post.authorPhotoURL} alt={post.authorName || 'Author'} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/50" />
                        ) : (
                             <DefaultAvatar /> // Use the default placeholder
                        )}
                        <span className="text-white text-xs font-medium truncate">
                             {post.authorName || 'Unknown Author'}
                        </span>
                     </div>
                 </div>
                <h3 className='font-bold group-hover:text-primary transition-colors'>{post.title}</h3>
                {post.excerpt && <p className='text-sm italic text-base-content/80 mt-1 line-clamp-2'>{post.excerpt}</p>}
                <p className="text-xs text-gray-500 mt-2">{post.createdAt ? post.createdAt.toLocaleDateString() : ''}</p>
            </Link>
        </div>
    );


    // --- Main Render ---
    return (
        <div className="">
            {/* Featured Post Section */}
             <div className='w-full h-[95vh] px-6 pb-12'>
                {!loadingData && featuredPost ? (
                  <div className="relative w-full bg-center bg-cover rounded-3xl text-white"
                    style={{ backgroundImage: `url('${featuredPost.imageUrl || 'https://via.placeholder.com/1200x800?text=Featured+Image'}')`, height: '100%', width: '100%' }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-3xl"></div> {/* Darker gradient */}
                    <div className='absolute bottom-12 left-8 md:bottom-20 md:left-12 max-w-[75%] md:max-w-[70%]'>
                      <div>
                        {/* Optional: Display featured post author info if desired */}
                        {/*
                        <div className="flex items-center gap-2 mb-2 opacity-80">
                           {featuredPost.authorPhotoURL ? <img src={featuredPost.authorPhotoURL} alt={featuredPost.authorName} className="w-5 h-5 rounded-full object-cover ring-1 ring-white/50"/> : <DefaultAvatar /> }
                           <span className="text-xs font-medium">{featuredPost.authorName}</span>
                        </div>
                        */}
                        <h2 className='text-xs md:text-sm uppercase tracking-wider mb-1 font-semibold'>Featured</h2>
                        <Link to={`/post/${featuredPost.id}`}>
                          <h3 className='text-3xl md:text-5xl font-bold leading-tight hover:underline'>{featuredPost.title}</h3>
                        </Link>
                        {featuredPost.excerpt && <p className='text-sm md:text-base mt-3 md:mt-4 line-clamp-2 md:line-clamp-3 opacity-90'>{featuredPost.excerpt}</p>}
                      </div>
                    </div>
                  </div>
                ) : loadingData ? (
                  <div className="flex justify-center items-center h-full bg-base-200 rounded-3xl">
                    <span className="loading loading-spinner loading-lg"></span>
                  </div>
                ) : (
                   <div className="flex justify-center items-center h-full bg-base-200 rounded-3xl">
                      <p>No featured post available.</p>
                   </div>
                )}
             </div>

            {/* Posts Section */}
            <div className="posts-section px-6 md:px-10 pb-10">
                {loadingData ? (
                   <div className="text-center py-10"><span className="loading loading-dots loading-lg"></span></div>
                ) : (
                    <>
                        {/* Recommended Section */}
                        {displayMode === 'recommended' && recommendedPosts.length > 0 && (
                            <div className="mb-12">
                                <h2 className='text-2xl font-semibold mb-6'>Recommended For You</h2>
                                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12'> {/* Increased gap */}
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
                                <h2 className='text-2xl font-semibold mb-6'>
                                    {displayMode === 'recommended' ? "More Articles" : "Latest Articles"}
                                </h2>
                                {fallbackPosts.length > 0 ? (
                                    <>
                                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12'> {/* Increased gap */}
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

                        {/* Handle case where nothing loaded */}
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