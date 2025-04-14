import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs, limit, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getConversationId } from '../utils/messagingUtils';

const UserProfile = () => {
    const { userId } = useParams(); // Get user ID from URL
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [error, setError] = useState('');
    const currentUser = auth.currentUser;

    // Fetch profile data
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
                }
            })
            .catch((err) => {
                console.error("Error fetching profile:", err);
                setError('Failed to load profile.');
            })
            .finally(() => {
                setLoadingProfile(false);
            });
    }, [userId]);

    // Fetch user's posts
    useEffect(() => {
        setLoadingPosts(true);
        const postsQuery = query(
            collection(db, 'posts'),
            where('uid', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(10) // Limit the number of posts displayed initially
        );
        getDocs(postsQuery)
            .then((querySnapshot) => {
                const userPosts = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date() // Handle Timestamp
                }));
                setPosts(userPosts);
            })
            .catch((err) => {
                console.error("Error fetching user posts:", err);
                setError(prev => prev ? `${prev} & Failed to load posts.` : 'Failed to load posts.');
            })
            .finally(() => {
                setLoadingPosts(false);
            });
    }, [userId]);

    const handleSendMessage = () => {
        if (!currentUser) {
            alert("Please log in to send messages.");
            navigate('/login'); // Redirect to login if not authenticated
            return;
        }
        if (currentUser.uid === userId) {
            alert("You cannot send a message to yourself.");
            return;
        }

        // Option 1: Navigate to Inbox and open/select the conversation
        const conversationId = getConversationId(currentUser.uid, userId);
        navigate('/admin', { 
            state: { 
              activeSection: 'inbox',
              openConversationId: conversationId,
              recipientProfile: {
                ...profile,
                uid: userId // Add UID from URL params
              }
            } 
        });

        // Option 2: Open a message compose modal (more complex state management)
        // Implement modal logic here if preferred
    };


    if (loadingProfile) return <div className="flex justify-center items-center h-60"><span className="loading loading-lg"></span></div>;
    if (error && !profile) return <p className="text-center text-error mt-10 p-4">{error}</p>;
    if (!profile) return <p className="text-center text-gray-500 mt-10">User profile not found.</p>;

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-4xl">
            {error && <p className="text-center text-warning mb-4">{error.includes('posts') ? error : ''}</p>}

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6 p-6 bg-base-200 rounded-lg shadow-md mb-8">
                <div className="avatar">
                    <div className="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                        <img src={profile.profilePictureUrl || "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"} alt={`${profile.name}'s avatar`} />
                    </div>
                </div>
                <div className="text-center sm:text-left flex-grow">
                    <h1 className="text-2xl md:text-3xl font-bold">{profile.name}</h1>
                    {profile.bio && <p className="text-base-content/80 mt-2">{profile.bio}</p>}
                    {/* Add other profile details like gender if available */}
                    {profile.gender && <p className="text-xs text-base-content/60 mt-1">Gender: {profile.gender}</p>}
                </div>
                {/* Send Message Button - Hide if viewing own profile */}
                {currentUser && currentUser.uid !== userId && (
                    <button
                        onClick={handleSendMessage}
                        className="btn btn-primary btn-sm mt-4 sm:mt-0"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 mr-1">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                         </svg>
                        Send Message
                    </button>
                )}
            </div>

            {/* User's Posts Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Articles by {profile.name}</h2>
                {loadingPosts ? (
                    <div className="flex justify-center p-4"><span className="loading loading-md"></span></div>
                ) : posts.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">This user hasn't published any articles yet.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {posts.map(post => (
                            <Link to={`/post/${post.id}`} key={post.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                                {post.imageUrl && (
                                    <figure className="h-48">
                                        <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full"/>
                                    </figure>
                                )}
                                <div className="card-body p-4">
                                    <h3 className="card-title text-lg leading-snug">{post.title}</h3>
                                    <p className="text-sm text-base-content/70 line-clamp-2">{post.excerpt || 'No excerpt available.'}</p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {post.createdAt ? post.createdAt.toLocaleDateString() : 'Unknown date'}
                                    </p>
                                    {/* Optionally add view/like counts */}
                                    <div className="flex gap-4 text-xs mt-2">
                                         <span><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>{post.viewCount || 0}</span>
                                         <span><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>{post.likeCount || 0}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;