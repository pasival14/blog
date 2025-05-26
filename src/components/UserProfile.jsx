// src/components/UserProfile.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs, limit, startAfter, Timestamp } from 'firebase/firestore'; // Import startAfter
import { db, auth } from '../services/firebase';
import { getConversationId } from '../utils/messagingUtils';

const POSTS_PER_PAGE = 9; // Define limit constant

const UserProfile = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingPosts, setLoadingPosts] = useState(true); // Handles initial and subsequent loads
    const [error, setError] = useState('');
    const currentUser = auth.currentUser;

    // --- NEW STATE for pagination ---
    const [lastVisiblePost, setLastVisiblePost] = useState(null); // Stores the last doc snapshot for pagination
    const [hasMorePosts, setHasMorePosts] = useState(true);     // Tracks if more posts might exist

    // Fetch profile data - Remains the same
    useEffect(() => {
        setLoadingProfile(true);
        setError('');
        const profileRef = doc(db, 'profiles', userId);
        getDoc(profileRef)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    setProfile(docSnap.data());
                } else {
                    setError('User profile not found.');
                    setHasMorePosts(false); // No profile, no posts
                }
            })
            .catch((err) => {
                console.error("Error fetching profile:", err);
                setError('Failed to load profile.');
                setHasMorePosts(false);
            })
            .finally(() => {
                setLoadingProfile(false);
            });
    }, [userId]);

    // --- Initial Fetch for User's Posts (MODIFIED for pagination) ---
    const fetchInitialPosts = useCallback(async () => {
        if (!userId) return; // Don't fetch if userId isn't available

        setLoadingPosts(true);
        setError(prev => prev.replace(/ & Failed to load posts\.|Failed to load posts\./, '')); // Clear only post errors

        try {
            const postsQuery = query(
                collection(db, 'posts'),
                where('uid', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(POSTS_PER_PAGE) // Use the constant for the limit
            );

            const querySnapshot = await getDocs(postsQuery);
            const userPosts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Handle Timestamp conversion safely
                createdAt: doc.data().createdAt instanceof Timestamp
                    ? doc.data().createdAt.toDate()
                    : (doc.data().createdAt?.seconds ? new Date(doc.data().createdAt.seconds * 1000) : new Date())
            }));

            setPosts(userPosts); // Set initial posts

            // Set the last visible document for pagination
            const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            setLastVisiblePost(lastDoc);

            // Check if there might be more posts
            setHasMorePosts(querySnapshot.docs.length === POSTS_PER_PAGE);

        } catch (err) {
            console.error("Error fetching initial user posts:", err);
            setError(prev => prev ? `${prev} & Failed to load posts.` : 'Failed to load posts.');
            setHasMorePosts(false); // Assume no more on error
        } finally {
            setLoadingPosts(false);
        }
    }, [userId]); // Depend only on userId

    // Trigger initial fetch when userId is available
    useEffect(() => {
        fetchInitialPosts();
    }, [fetchInitialPosts]); // Use the memoized fetch function

    // --- NEW: Function to fetch more posts ---
    const fetchMorePosts = async () => {
        if (!userId || !lastVisiblePost || !hasMorePosts) {
            console.log("Cannot fetch more: no userId, lastVisible, or no more posts indicated.");
            return; // Exit if no starting point or no more posts expected
        }

        setLoadingPosts(true); // Indicate loading more
        setError(prev => prev.replace(/ & Failed to load posts\.|Failed to load posts\./, '')); // Clear only post errors

        try {
            const postsQuery = query(
                collection(db, 'posts'),
                where('uid', '==', userId),
                orderBy('createdAt', 'desc'),
                startAfter(lastVisiblePost), // Start after the last fetched document
                limit(POSTS_PER_PAGE)
            );

            const querySnapshot = await getDocs(postsQuery);
            const newPosts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt instanceof Timestamp
                    ? doc.data().createdAt.toDate()
                    : (doc.data().createdAt?.seconds ? new Date(doc.data().createdAt.seconds * 1000) : new Date())
            }));

            // Append new posts to the existing list
            setPosts(prevPosts => [...prevPosts, ...newPosts]);

            // Update the last visible document
            const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            setLastVisiblePost(lastDoc);

            // Update if there are potentially more posts
            setHasMorePosts(querySnapshot.docs.length === POSTS_PER_PAGE);

        } catch (err) {
            console.error("Error fetching more user posts:", err);
            setError(prev => prev ? `${prev} & Failed to load more posts.` : 'Failed to load more posts.');
            setHasMorePosts(false); // Stop trying on error
        } finally {
            setLoadingPosts(false); // Finish loading indicator
        }
    };


    // Handle Send Message - Remains the same
    const handleSendMessage = () => {
        if (!currentUser) {
            alert("Please log in to send messages.");
            navigate('/login');
            return;
        }
        if (currentUser.uid === userId) {
            alert("You cannot send a message to yourself.");
            return;
        }
        const conversationId = getConversationId(currentUser.uid, userId);
        navigate('/admin', {
            state: {
              activeSection: 'inbox',
              openConversationId: conversationId,
              recipientProfile: {
                ...profile, // Spread existing profile data
                uid: userId // Ensure UID from URL params is included
              }
            }
        });
    };

    // --- RENDER LOGIC ---

    // Loading/Error states for profile
    if (loadingProfile) return <div className="flex justify-center items-center h-60"><span className="loading loading-lg"></span></div>;
    if (error && !profile && !error.includes('posts')) return <p className="text-center text-error mt-10 p-4">{error}</p>; // Show profile error if it exists and isn't just a post error
    if (!profile) return <p className="text-center text-gray-500 mt-10">User profile not found.</p>;

    // Default Avatar (if profile picture URL is missing)
    const DefaultAvatar = ({className = "w-24 h-24"}) => (
      <div className={`${className} rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 flex items-center justify-center bg-base-300`}>
         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-base-content opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
         </svg>
      </div>
    );

    return (
        <div className="container mx-auto p-2 md:p-6 max-w-4xl">
            {/* Display post-related errors separately */}
            {error && error.includes('posts') && <p className="text-center text-warning mb-4">{error.replace(/.*& /, '')}</p>}

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6 p-6 bg-base-200 rounded md:rounded-lg shadow-md mb-8">
                <div className="avatar">
                    {profile.profilePictureUrl ? (
                        <div className="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                             <img src={profile.profilePictureUrl} alt={`${profile.name}'s avatar`} />
                        </div>
                    ) : (
                         <DefaultAvatar />
                    )}
                </div>
                <div className="text-center sm:text-left flex-grow">
                    <h1 className="text-xl md:text-3xl font-bold">{profile.name}</h1>
                    {profile.bio && <p className="text-base-content/80 mt-2">{profile.bio}</p>}
                    {/* {profile.gender && <p className="text-xs text-base-content/60 mt-1">Gender: {profile.gender}</p>} */}
                </div>
                {/* Send Message Button */}
                {currentUser && currentUser.uid !== userId && (
                    <button
                        onClick={handleSendMessage}
                        className="btn btn-primary btn-sm mt-4 sm:mt-0"
                    >
                         {/* SVG icon remains same */}
                        Send Message
                    </button>
                )}
            </div>

            {/* User's Posts Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Articles by {profile.name}</h2>

                {/* Show initial loading spinner only if posts array is empty */}
                {loadingPosts && posts.length === 0 ? (
                    <div className="flex justify-center p-4"><span className="loading loading-md"></span></div>
                ) : posts.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">This user hasn't published any articles yet.</p>
                ) : (
                    <>
                        {/* --- Posts Grid --- */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {posts.map(post => (
                                <Link to={`/post/${post.id}`} key={post.id} className="card rounded md:rounded-lg bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                                    {post.imageUrl ? ( // Check if imageUrl exists
                                        <figure className="h-48">
                                            <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full"/>
                                        </figure>
                                    ) : ( // Fallback placeholder if no image
                                        <figure className="h-48 bg-base-300 flex items-center justify-center">
                                            <svg className="w-16 h-16 text-base-content opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 7v10M4 7l4-4M4 7l4 4m6 6v-4m0 4l4 4m-4-4l-4 4m6-14v4m0-4l4-4m-4 4l-4-4" /></svg>
                                        </figure>
                                    )}
                                    <div className="card-body p-4">
                                        <h3 className="card-title text-lg leading-snug line-clamp-2">{post.title}</h3> {/* Added line-clamp */}
                                        <p className="text-sm text-base-content/70 line-clamp-2">{post.excerpt || 'No excerpt available.'}</p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {post.createdAt ? post.createdAt.toLocaleDateString() : 'Unknown date'}
                                        </p>
                                        {/* View/Like counts */}
                                        <div className="flex gap-4 text-xs mt-2">
                                             {/* SVG icons remain same */}
                                             <span><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>{post.viewCount || 0}</span>
                                             <span><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>{post.likeCount || 0}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {/* --- Load More Button Area --- */}
                        <div className="text-center mt-8">
                            {loadingPosts && posts.length > 0 && ( // Show loading indicator when loading *more*
                                <span className="loading loading-dots loading-md"></span>
                            )}
                            {!loadingPosts && hasMorePosts && ( // Show button only if not loading and more posts might exist
                                <button
                                    onClick={fetchMorePosts}
                                    className="btn btn-primary btn-outline"
                                >
                                    Load More Articles
                                </button>
                            )}
                            {!loadingPosts && !hasMorePosts && posts.length > 0 && ( // Indicate end of list
                                <p className="text-sm text-gray-500">No more articles to load.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default UserProfile;