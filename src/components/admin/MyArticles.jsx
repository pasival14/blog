import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { auth, db } from '../../services/firebase';

const MyArticles = () => {
  const [userUid, setUserUid] = useState(null);
  const [allUserPosts, setAllUserPosts] = useState([]); // Store all fetched posts
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); // State for search input
  const [error, setError] = useState(''); // State for errors

  // Get current user UID
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserUid(user.uid);
      } else {
        setUserUid(null);
        setAllUserPosts([]); // Clear posts if user logs out
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch ALL posts created by the current user
  useEffect(() => {
    const fetchUserPosts = async () => {
      if (!userUid) {
          setLoading(false); // Not loading if no user
          return;
      };

      setLoading(true);
      setError('');
      try {
        // Query to get all posts by the user, ordered by creation time
        const q = query(
          collection(db, 'posts'),
          where('uid', '==', userUid),
          orderBy('createdAt', 'desc') // Most recent first
          // No limit here - fetch all user posts
        );
        const querySnapshot = await getDocs(q);

        const posts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
           // Ensure createdAt is converted if needed (might already be Timestamp)
           createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt?.seconds * 1000 || Date.now()),
        }));

        setAllUserPosts(posts);
      } catch (err) {
          console.error("Error fetching posts:", err);
          setError("Failed to fetch articles. Please try again.");
      } finally {
          setLoading(false);
      }
    };

    fetchUserPosts();
  }, [userUid]); // Re-fetch when user changes

  // Delete Post Functionality (adapted from PostsList.jsx)
  const handleDelete = async (id) => {
     if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
        return; // Stop if user cancels
     }

    setError(''); // Clear previous errors
    try {
        const postDoc = doc(db, "posts", id);
        await deleteDoc(postDoc);
        // Update local state to remove the post immediately
        setAllUserPosts(currentPosts => currentPosts.filter(post => post.id !== id));
        // Optionally show a success message
        // alert('Post deleted successfully!');
    } catch (err) {
        console.error("Error deleting post:", err);
        setError("Failed to delete post. Please try again.");
    }
  };

  // Client-side filtering based on search term
  // useMemo ensures filtering only happens when posts or search term change
  const filteredPosts = useMemo(() => {
    if (!searchTerm) {
      return allUserPosts; // Return all posts if search is empty
    }
    return allUserPosts.filter(post =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allUserPosts, searchTerm]); // Dependencies for memoization

  return (
    <div className="w-full h-full mt-12 md:mt-0 flex flex-col p-2 md:p-4">
      <h2 className="text-xl md:text-2xl font-semibold mb-4">My Articles</h2>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search articles by title..."
          className="input input-bordered w-full md:w-1/2 lg:w-1/3"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      {/* Posts List Area */}
      <div className="flex-grow overflow-y-auto"> {/* Make list scrollable */}
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <span className="loading loading-lg"></span>
          </div>
        ) : filteredPosts.length === 0 ? (
          <p className="text-center mt-10">{searchTerm ? 'No articles match your search.' : 'You haven\'t created any articles yet.'}</p>
        ) : (
          <div className="space-y-4"> {/* Add spacing between items */}
            {filteredPosts.map((post) => (
              <div key={post.id} className="p-4 bg-base-100 rounded-lg shadow flex items-center justify-between gap-4">
                {/* Post Info */}
                <div className='flex-grow'> {/* Allow title section to grow */}
                   <Link to={`/post/${post.id}`} className='hover:underline'>
                     <h3 className='font-semibold md:text-lg mb-1'>{post.title}</h3>
                   </Link>
                   <p className='text-xs text-gray-500 mb-2'>
                     Created: {post.createdAt instanceof Date ? post.createdAt.toLocaleDateString() : 'Unknown date'}
                   </p>
                    {/* Metrics (Views and Likes) */}
                   <div className='flex items-center gap-4 text-sm text-gray-600'>
                     {/* Views */}
                     <span className='flex items-center gap-1' title="Views">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /> </svg>
                         {post.viewCount || 0}
                     </span>
                     {/* Likes */}
                     <span className='flex items-center gap-1' title="Likes">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> </svg>
                         {post.likeCount || 0}
                     </span>
                   </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(post.id)}
                  className="btn btn-sm btn-error btn-outline"
                  aria-label="Delete post"
                  title="Delete Post"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyArticles;