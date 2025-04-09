import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom'; 
import {
    doc, getDoc, updateDoc, increment, serverTimestamp,
    collection, addDoc, query, where, getDocs, orderBy,
    setDoc,
    deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import './postform.css';

const PostDetail = () => {
  const { id } = useParams(); // Post ID from URL
  const [post, setPost] = useState(null);
  const [contentHtml, setContentHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // For general post loading errors
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [submitError, setSubmitError] = useState(''); // State for like/comment errors


  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return unsubscribe; // Cleanup listener on unmount
  }, []);


  // --- Fetch Post and Increment View Count ---
  useEffect(() => {
    const postRef = doc(db, 'posts', id);

    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      setSubmitError(''); // Clear submit errors on new load
      try {
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
          const postData = postSnap.data();
          setPost(postData);
          setLikeCount(postData.likeCount || 0);
          setViewCount(postData.viewCount || 0);

          // --- Increment View Count ---
          // Consider debouncing or using Cloud Functions for production
          await updateDoc(postRef, {
            viewCount: increment(1)
          }).catch(err => console.warn("Failed to increment view count:", err)); // Log warning if view increment fails

          setViewCount((prevCount) => (postData.viewCount || 0) + 1); // Update local state using fetched count + 1


          // Fetch content HTML
          if (postData.contentUrl) {
            try {
              const response = await fetch(postData.contentUrl);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const htmlContent = await response.text();
              setContentHtml(htmlContent);
            } catch (fetchError) {
              console.error('Error fetching content:', fetchError);
              // Optionally set a specific error state for content
            }
          }
        } else {
          setError('Post not found.');
        }
      } catch (err) {
        setError('Failed to fetch post.');
        console.error("Fetch post error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]); // Re-run only if post ID changes

  // --- Fetch Likes Status ---
  useEffect(() => {
    if (!currentUser || !id) {
        setIsLiked(false); // Reset if user logs out or ID is missing
        return;
    };

    const checkLikeStatus = async () => {
        const likeId = `${currentUser.uid}_${id}`;
        const likeRef = doc(db, 'likes', likeId);
        try {
             const likeSnap = await getDoc(likeRef);
             setIsLiked(likeSnap.exists());
        } catch (err) {
            console.error("Error checking like status:", err);
            // Don't necessarily block UI for this, just log it
        }
    };

    checkLikeStatus();

  }, [currentUser, id]); // Check like status when user or post changes

  // --- Fetch Comments ---
   useEffect(() => {
       if (!id) return; // Don't fetch if no ID

       const fetchComments = async () => {
          const commentsQuery = query(
              collection(db, 'comments'),
              where('postId', '==', id),
              orderBy('createdAt', 'desc')
          );

          try {
              const querySnapshot = await getDocs(commentsQuery);
              const fetchedComments = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate() // Convert Timestamp
              }));
              setComments(fetchedComments);
          } catch (commentError) {
              console.error("Error fetching comments:", commentError);
              setError('Failed to load comments.'); // Set general error or specific comment error
          }
       };

       fetchComments();

  }, [id]); // Re-fetch comments if post ID changes


  // Adjust images after contentHtml is set
  useEffect(() => {
    // Ensure this runs *after* content is rendered
    if (contentHtml) {
        const contentDiv = document.querySelector('.post-content');
        if (contentDiv) {
            const images = contentDiv.querySelectorAll('img');
            images.forEach((img) => {
                img.classList.add('uploaded-image'); // Ensure this class exists or styles are applied directly
                img.style.maxWidth = '100%';
                img.style.height = 'auto'; // Maintain aspect ratio
                img.style.margin = '20px auto';
                img.style.display = 'block';
                img.style.objectFit = 'cover';
            });
        }
    }
  }, [contentHtml]); // Dependency on contentHtml

  // --- Handle Like/Unlike ---
  const handleLike = async () => {
    if (!currentUser) {
      setSubmitError("Please log in to like posts."); // Set UI error
      return;
    }
    setSubmitError(''); // Clear previous errors

    const postRef = doc(db, 'posts', id);
    const likeId = `${currentUser.uid}_${id}`;
    const likeRef = doc(db, 'likes', likeId);

    // Optimistic UI update
    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;
    setIsLiked(!originalIsLiked);
    setLikeCount(prev => originalIsLiked ? prev - 1 : prev + 1);


    try {
        if (originalIsLiked) {
            // --- Unlike ---
            await deleteDoc(likeRef);
            await updateDoc(postRef, { likeCount: increment(-1) });
        } else {
            // --- Like ---
            await setDoc(likeRef, {
                userId: currentUser.uid,
                postId: id,
                createdAt: serverTimestamp()
            });
            await updateDoc(postRef, { likeCount: increment(1) });
        }
    } catch (likeError) {
        console.error("Error updating like:", likeError);
        setSubmitError("Failed to update like status. Please try again."); // Set UI error
        // Revert optimistic update on error
        setIsLiked(originalIsLiked);
        setLikeCount(originalLikeCount);
    }
  };


  // --- Handle Comment Submission ---
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setSubmitError("Please log in to comment."); // Set UI error
      return;
    }
    if (!newComment.trim()) {
        setSubmitError("Comment cannot be empty."); // Set UI error
        return;
    }
    setSubmitError(''); // Clear previous errors

    const commentData = {
        postId: id,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Anonymous', // Better fallback
        text: newComment.trim(),
        createdAt: serverTimestamp(),
    };

    try {
      // Add comment to Firestore
      const docRef = await addDoc(collection(db, 'comments'), commentData);

      // Add to local state for immediate UI update (simulate timestamp)
      setComments(prevComments => [
        { ...commentData, id: docRef.id, createdAt: new Date() },
        ...prevComments
      ]);
      setNewComment(''); // Clear the input field

    } catch (commentError) {
      console.error("Error adding comment: ", commentError);
      // Check for specific permission error
      if (commentError.code === 'permission-denied') {
         setSubmitError("Permission denied. Please check Firestore rules.");
      } else {
         setSubmitError("Failed to post comment. Please try again."); // Set UI error
      }
    }
  };

  const handleDeleteComment = async (commentIdToDelete) => {
    if (!currentUser) {
        setSubmitError("You must be logged in to delete comments.");
        return;
    }
    setSubmitError('');

    const commentRef = doc(db, 'comments', commentIdToDelete);

    try {
        // Check ownership again client-side (optional but good practice)
        const commentToDelete = comments.find(c => c.id === commentIdToDelete);
        if (commentToDelete && commentToDelete.userId !== currentUser.uid) {
              throw new Error("You can only delete your own comments.");
        }

        // Delete from Firestore
        await deleteDoc(commentRef);

        // Remove from local state for immediate UI update
        setComments(prevComments => prevComments.filter(comment => comment.id !== commentIdToDelete));

    } catch (deleteError) {
        console.error("Error deleting comment: ", deleteError);
        setSubmitError("Failed to delete comment. Please try again."); // Set UI error
        // Note: Firestore rules will ultimately prevent unauthorized deletion even if client-side check fails.
    }
    };


  // --- Render Logic ---
  if (loading) return <div className="flex justify-center items-center h-screen"><span className="loading loading-lg"></span></div>;
  // Display general loading error first
  if (error && !post) return <p className="text-center text-red-500 mt-10">{error}</p>;


  return (
    post ? (
      <div className="post-detail w-full flex flex-col items-center justify-center p-4 md:px-6 mb-10">
        <div className='w-full lg:w-[60%]'>
          <h1 className='text-4xl font-bold mb-4'>{post.title}</h1>
          <p className="text-sm text-gray-500 mb-2">Views: {viewCount}</p> {/* Display View Count */}

          {/* Display general fetch error if post loaded but something else failed */}
          {error && <p className="text-center text-red-500 my-4">{error}</p>}


          {post.imageUrl && (
            <div
              className='w-full h-[80vw] md:h-[60vh] bg-cover bg-center rounded mb-4'
              style={{ backgroundImage: `url(${post.imageUrl})` }}
            />
          )}

          {/* Render fetched HTML content */}
          <div
            className='text-balance mt-4 post-content prose lg:prose-xl max-w-none'
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* --- Likes Section --- */}
          <div className="mt-6 flex items-center gap-4">
             <button onClick={handleLike} className={`btn btn-sm ${isLiked ? 'btn-primary' : 'btn-outline btn-primary'}`}>
                {/* Optional: Add loading state to button */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                {isLiked ? 'Unlike' : 'Like'}
             </button>
             <span>{likeCount} Likes</span>
          </div>


           {/* --- Comments Section --- */}
           <div className="mt-8 pt-6 border-t">
                <h2 className="text-2xl font-semibold mb-4">Comments ({comments.length})</h2>

                 {/* Display Submit Errors (Likes/Comments) */}
                 {submitError && <p className="text-red-500 mb-4">{submitError}</p>}


                 {/* Comment Form */}
                {currentUser && (
                 <form onSubmit={handleCommentSubmit} className="mb-6">
                    <textarea
                        className="textarea textarea-bordered w-full"
                        rows="3"
                        placeholder="Write your comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn btn-primary mt-2">Post Comment</button>
                 </form>
                )}
                 {!currentUser && <p className="mb-4">Please <Link to="/login" className="link link-primary">log in</Link> to comment.</p>}


                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length > 0 ? (
                    comments.map(comment => (
                      <div key={comment.id} className="p-3 bg-base-200 rounded-lg shadow-sm relative group"> {/* Added relative and group */}
                        <p className="font-semibold">{comment.userName}</p>
                        <p className="text-sm text-gray-600 mb-1">
                          {comment.createdAt?.toLocaleTimeString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </p>
                        <p className='whitespace-pre-wrap'>{comment.text}</p>

                        {/* ---> ADD DELETE BUTTON CONDITIONALLY <--- */}
                        {currentUser && currentUser.uid === comment.userId && (
                            <button
                                onClick={() => handleDeleteComment(comment.id)}
                                // Styling for button (e.g., top-right corner, only visible on hover)
                                className="btn btn-xs btn-error btn-outline absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Delete comment"
                            >
                                {/* Optional: Add an icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                        {/* ---> END OF DELETE BUTTON <--- */}

                      </div>
                    ))
                  ) : (
                    !error && <p>No comments yet. Be the first to comment!</p>
                  )}
                </div>
           </div>

        </div>
      </div>
    ) : (
         // Handle case where post is null but not loading and no error yet (should be brief)
         !loading && !error && <p className="text-center mt-10">Post not found.</p>
    )
  );
};

export default PostDetail;