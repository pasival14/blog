import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from "firebase/functions";
import { Link } from 'react-router-dom'; // For linking to posts

// Initialize Firebase Functions
const functions = getFunctions();
// Reference your existing searchPosts Cloud Function
const searchPostsCallable = httpsCallable(functions, 'searchPosts');

const SiteSettingsComponent = () => {
    const [currentFeaturedPost, setCurrentFeaturedPost] = useState(null); // Stores { id, title, authorName }
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [updateMessage, setUpdateMessage] = useState({ type: '', text: '' }); // { type: 'success'/'error', text: '...' }
    const [searchError, setSearchError] = useState('');

    const settingsDocRef = useMemo(() => doc(db, "settings", "siteConfig"), []); // Empty dependency array means it's created once


    // Fetch the currently featured post details
    const fetchCurrentFeatured = useCallback(async () => {
        console.log("fetchCurrentFeatured: Starting...");
        setLoadingCurrent(true);
        setCurrentFeaturedPost(null);
        setUpdateMessage({ type: '', text: '' });
        let fetchedPostSuccessfully = false;

        try {
            console.log("fetchCurrentFeatured: Fetching settings doc...");
            // Use the memoized or globally defined settingsDocRef
            const settingsSnap = await getDoc(settingsDocRef);
            let featuredPostId = null;

            if (settingsSnap.exists()) {
                console.log("fetchCurrentFeatured: Settings doc exists. Data:", settingsSnap.data());
                if (settingsSnap.data().featuredPostId) {
                    featuredPostId = settingsSnap.data().featuredPostId;
                    console.log(`fetchCurrentFeatured: Found featuredPostId: ${featuredPostId}`);
                } else {
                    console.log("fetchCurrentFeatured: Settings doc exists but 'featuredPostId' field is missing or empty.");
                }
            } else {
                console.log("fetchCurrentFeatured: Settings doc ('settings/siteConfig') does NOT exist.");
            }

            if (featuredPostId) {
                const postRef = doc(db, "posts", featuredPostId);
                console.log(`fetchCurrentFeatured: Fetching post doc (${featuredPostId})...`);
                const postSnap = await getDoc(postRef);

                if (postSnap.exists()) {
                    console.log(`fetchCurrentFeatured: Post doc (${featuredPostId}) exists.`);
                    const postData = postSnap.data();
                    let authorName = 'Unknown Author';
                    if (postData.uid) {
                        console.log(`fetchCurrentFeatured: Fetching profile for author UID: ${postData.uid}`);
                        try {
                            const profileRef = doc(db, 'profiles', postData.uid);
                            const profileSnap = await getDoc(profileRef);
                            if (profileSnap.exists()) {
                                authorName = profileSnap.data().name || authorName;
                                console.log(`fetchCurrentFeatured: Found author name: ${authorName}`);
                            } else {
                                console.log(`fetchCurrentFeatured: Profile doc for UID ${postData.uid} not found.`);
                            }
                        } catch (profileError) {
                            console.error("fetchCurrentFeatured: Error fetching author profile:", profileError);
                        }
                    } else {
                         console.log("fetchCurrentFeatured: Post data missing author UID.");
                    }
                    setCurrentFeaturedPost({
                        id: postSnap.id,
                        title: postData.title,
                        authorName: authorName
                    });
                    fetchedPostSuccessfully = true;
                    console.log("fetchCurrentFeatured: Set currentFeaturedPost state.");
                } else {
                    console.warn(`fetchCurrentFeatured: Post doc (${featuredPostId}) specified in settings NOT found.`);
                    setUpdateMessage({ type: 'error', text: `Error: Featured post ID (${featuredPostId}) not found in posts collection.` });
                }
            } else {
                 console.log("fetchCurrentFeatured: No featured post ID to fetch.");
            }
        } catch (error) {
            console.error("fetchCurrentFeatured: ERROR caught during fetch process:", error);
            if (error.code === 'permission-denied') {
                 setUpdateMessage({ type: 'error', text: 'Permission denied. Check Firestore rules for reading settings or posts.' });
            } else {
                 setUpdateMessage({ type: 'error', text: 'Could not load current featured post due to an error.' });
            }
        } finally {
            console.log("fetchCurrentFeatured: Reached finally block. Setting loadingCurrent to false.");
            setLoadingCurrent(false);
        }
    // --- REMOVED settingsDocRef from dependency array ---
    }, []); // Now depends on nothing, created once

    // Fetch current featured post on component mount
    useEffect(() => {
        fetchCurrentFeatured();
    }, [fetchCurrentFeatured]); // This dependency is now stable

    // Handle Search Submission (no changes needed)
    const handleSearch = async (e) => {
        e.preventDefault();
        const query = searchQuery.trim();
        if (!query) { setSearchResults([]); setSearchError(''); return; }
        setLoadingSearch(true); setSearchError(''); setSearchResults([]); setUpdateMessage({ type: '', text: '' });
        try {
            console.log(`Calling searchPosts function for: ${query}`);
            const response = await searchPostsCallable({ query: query });
            const searchData = response.data;
            if (Array.isArray(searchData)) {
                console.log(`Received ${searchData.length} search results.`);
                setSearchResults(searchData.map(hit => ({
                    id: hit.id || hit.objectID, title: hit.title || 'Untitled Post', authorName: hit.authorName || 'Unknown Author'
                })));
            } else {
                 console.error("Search function response.data is not an array:", searchData);
                 setSearchResults([]); setSearchError("Received invalid search results format.");
            }
        } catch (err) {
            console.error("Admin search failed:", err);
            const message = err.message || 'An unknown error occurred during search.';
            setSearchError(`Search failed: ${message}`); setSearchResults([]);
        } finally { setLoadingSearch(false); }
    };

    // Handle Setting a New Featured Post (no changes needed)
    const handleSetFeatured = async (postId, postTitle) => {
        if (!postId) return;
        setUpdateMessage({ type: '', text: '' });
        console.log(`Attempting to set post ${postId} (${postTitle}) as featured.`);
        try {
            // Use the memoized or globally defined settingsDocRef
            await setDoc(settingsDocRef, {
                featuredPostId: postId,
                lastUpdated: Timestamp.now()
            }, { merge: true });
            setUpdateMessage({ type: 'success', text: `Successfully set "${postTitle}" as the featured post!` });
            fetchCurrentFeatured(); // Refresh current display
            setSearchQuery(''); setSearchResults([]); // Clear search
        } catch (error) {
            console.error("Error setting featured post:", error);
            setUpdateMessage({ type: 'error', text: `Failed to set featured post. ${error.message}` });
        }
    };


    return (
        <div className="p-4 md:p-6 space-y-6">
            <h2 className="text-2xl font-semibold mb-4">Site Settings</h2>

            {/* Display Current Featured Post */}
            <div className="p-4 bg-base-200 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-2">Current Featured Post</h3>
                {loadingCurrent ? (
                    <div className="flex items-center gap-2">
                        <span className="loading loading-spinner loading-sm"></span>
                        <span>Loading...</span>
                    </div>
                ) : currentFeaturedPost ? (
                    <div className="flex items-center justify-between">
                         <div>
                             <Link to={`/post/${currentFeaturedPost.id}`} className="link link-hover font-semibold" target="_blank" rel="noopener noreferrer">
                                {currentFeaturedPost.title}
                             </Link>
                             <p className="text-sm text-base-content/70">by {currentFeaturedPost.authorName}</p>
                         </div>
                         {/* Maybe add an "Unfeature" button here if needed */}
                    </div>
                ) : (
                    <p className="text-sm text-base-content/70 italic">No post is currently featured.</p>
                )}
                 {updateMessage.text && updateMessage.type === 'error' && !loadingCurrent && (
                     <p className="text-xs text-error mt-2">{updateMessage.text}</p>
                 )}
            </div>

             {/* Update Status Message */}
             {updateMessage.text && updateMessage.type === 'success' && (
                <div role="alert" className="alert alert-success shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{updateMessage.text}</span>
                </div>
            )}

            {/* Search for Post to Feature */}
            <div className="p-4 bg-base-200 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-3">Set New Featured Post</h3>
                <form onSubmit={handleSearch} className="join w-full mb-4">
                    <input
                        type="text"
                        className="input input-bordered input-sm join-item flex-grow"
                        placeholder="Search posts by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search posts"
                    />
                    <button type="submit" className="btn btn-primary btn-sm join-item" disabled={loadingSearch}>
                        {loadingSearch ? <span className="loading loading-spinner loading-xs"></span> : 'Search'}
                    </button>
                </form>

                {/* Search Results */}
                {searchError && <p className="text-error text-sm mb-3">{searchError}</p>}
                {!loadingSearch && searchResults.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2"> {/* Scrollable results */}
                        <p className="text-sm font-medium text-base-content/80 mb-2">Search Results:</p>
                        {searchResults.map((post) => (
                            <div key={post.id} className="flex items-center justify-between gap-2 p-2 bg-base-100 rounded hover:bg-base-300/50">
                                <div>
                                    <p className="text-sm font-semibold line-clamp-1" title={post.title}>{post.title}</p>
                                    <p className="text-xs text-base-content/60">ID: {post.id} {post.authorName && `(by ${post.authorName})`}</p>
                                </div>
                                <button
                                    onClick={() => handleSetFeatured(post.id, post.title)}
                                    className="btn btn-xs btn-outline btn-secondary"
                                    disabled={currentFeaturedPost?.id === post.id} // Disable if already featured
                                >
                                    Set as Featured
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                 {!loadingSearch && searchQuery && searchResults.length === 0 && !searchError && (
                    <p className="text-sm text-base-content/70 italic mt-4">No posts found matching your query.</p>
                 )}
            </div>
        </div>
    );
};

export default SiteSettingsComponent;