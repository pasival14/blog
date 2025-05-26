import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom'; // Import Link
import {
    doc, getDoc, updateDoc, increment, serverTimestamp,
    collection, addDoc, query, where, getDocs, orderBy,
    setDoc, deleteDoc, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import './postform.css';

const PostDetail = () => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [contentHtml, setContentHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [submitError, setSubmitError] = useState('');
  const [posterName, setPosterName] = useState('');
  const [posterPhotoURL, setPosterPhotoURL] = useState('');
  const [postDate, setPostDate] = useState(null);
  const [posterUid, setPosterUid] = useState(null); // State to hold poster UID for linking

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const postRef = doc(db, 'posts', id);

    const fetchPostAndPoster = async () => {
      setLoading(true);
      setError(null);
      setSubmitError('');
      setPosterName('');
      setPosterPhotoURL('');
      setPostDate(null);
      setPosterUid(null); // Clear poster UID

      try {
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
          const postData = postSnap.data();
          setPost(postData); // Set the full post data first
          setLikeCount(postData.likeCount || 0);
          setViewCount(postData.viewCount || 0);
          setPosterUid(postData.uid); // <-- Store poster UID

          if (postData.createdAt?.toDate) {
            setPostDate(postData.createdAt.toDate());
          }

          // Increment View Count (handle potential errors)
          updateDoc(postRef, { viewCount: increment(1) })
             .then(() => setViewCount((prevCount) => (postData.viewCount || 0) + 1))
             .catch(err => console.warn("Failed to increment view count:", err));


          // Fetch Poster Profile using the stored UID
          if (postData.uid) {
              const profileRef = doc(db, 'profiles', postData.uid);
              try {
                  const profileSnap = await getDoc(profileRef);
                  if (profileSnap.exists()) {
                      const profileData = profileSnap.data();
                      setPosterName(profileData.name || 'Author Name');
                      setPosterPhotoURL(profileData.profilePictureUrl || '');
                  } else {
                      setPosterName('Author Name'); // Fallback if no profile
                  }
              } catch (profileError) {
                  console.error("Error fetching poster profile:", profileError);
                  setPosterName('Author Name'); // Fallback on error
              }
          } else {
              setPosterName('Author Name'); // Fallback if no UID in post
          }


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

          // Log the 'view' interaction after successfully loading the post
          const localCurrentUser = auth.currentUser; // Get current user within async scope
          if (localCurrentUser) { // Only log if a user is logged in
              try {
                  // Use addDoc to write to the 'userInteractions' collection
                  await addDoc(collection(db, 'userInteractions'), {
                      userId: localCurrentUser.uid,
                      postId: id, // 'id' comes from useParams() at the top
                      interactionType: 'view',
                      timestamp: serverTimestamp() // Use Firestore server timestamp
                  });
                  console.log("Logged 'view' interaction for user:", localCurrentUser.uid);
              } catch (interactionError) {
                  console.error("Error logging 'view' interaction:", interactionError);
                  // Handle potential errors logging the interaction
              }
          }

        } else {
          setError('Post not found.');
        }
      } catch (err) {
        setError('Failed to fetch post details.');
        console.error("Fetch post error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPostAndPoster();
  }, [id]);

  // Fetch Likes Status
  useEffect(() => {
    if (!currentUser || !id) {
        setIsLiked(false);
        return;
    };
    const likeId = `${currentUser.uid}_${id}`;
    const likeRef = doc(db, 'likes', likeId);
    getDoc(likeRef)
      .then(likeSnap => setIsLiked(likeSnap.exists()))
      .catch(err => console.error("Error checking like status:", err));
  }, [currentUser, id]);

  // Fetch Comments
   useEffect(() => {
       if (!id) return;
       const commentsQuery = query(
           collection(db, 'comments'),
           where('postId', '==', id),
           orderBy('createdAt', 'desc')
       );
       getDocs(commentsQuery)
         .then(querySnapshot => {
           const fetchedComments = querySnapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             createdAt: doc.data().createdAt?.toDate()
           }));
           setComments(fetchedComments);
         })
         .catch(commentError => {
           console.error("Error fetching comments:", commentError);
           setError(prev => prev ? `${prev} & Failed to load comments.` : 'Failed to load comments.');
         });
  }, [id]);

  // Adjust images after contentHtml is set
  useEffect(() => {
    if (contentHtml) {
        const contentDiv = document.querySelector('.post-content');
        if (contentDiv) {
            const images = contentDiv.querySelectorAll('img');
            images.forEach((img) => {
                img.classList.add('uploaded-image'); // From postform.css
                // Add other styles if needed
            });
        }
    }
  }, [contentHtml]);

  // Handle Like/Unlike
  const handleLike = async () => {
    if (!currentUser) {
      setSubmitError("Please log in to like posts.");
      return;
    }
    setSubmitError('');
    const postRef = doc(db, 'posts', id);
    const likeId = `${currentUser.uid}_${id}`;
    const likeRef = doc(db, 'likes', likeId);

    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;
    setIsLiked(!originalIsLiked);
    setLikeCount(prev => originalIsLiked ? Math.max(0, prev - 1) : prev + 1); // Prevent negative count

    try {
        if (originalIsLiked) {
            await deleteDoc(likeRef);
            await updateDoc(postRef, { likeCount: increment(-1) });
        } else {
            await setDoc(likeRef, {
                userId: currentUser.uid,
                postId: id,
                createdAt: serverTimestamp()
            });
            await updateDoc(postRef, { likeCount: increment(1) });

            // Log the 'like' interaction to the userInteractions collection
          if (currentUser) { // Ensure user is still logged in
            try {
                await addDoc(collection(db, 'userInteractions'), {
                    userId: currentUser.uid,
                    postId: id, // 'id' is the postId from useParams()
                    interactionType: 'like',
                    timestamp: serverTimestamp() // Use Firestore server timestamp
                });
                console.log("Logged 'like' interaction.");
            } catch (interactionError) {
                console.error("Error logging 'like' interaction:", interactionError);
                // Decide if you need to inform the user or just log the error
            }
          }
        }
    } catch (likeError) {
        console.error("Error updating like:", likeError);
        setSubmitError("Failed to update like status. Please try again.");
        setIsLiked(originalIsLiked);
        setLikeCount(originalLikeCount);
    }
  };

  // Handle Comment Submission
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setSubmitError("Please log in to comment.");
      return;
    }
    if (!newComment.trim()) {
        setSubmitError("Comment cannot be empty.");
        return;
    }
    setSubmitError('');

    const commentData = {
        postId: id,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Anonymous',
        userPhotoURL: currentUser.photoURL || '', // Get commenter photo
        text: newComment.trim(),
        createdAt: serverTimestamp(), // Use server timestamp
    };

    try {
      const docRef = await addDoc(collection(db, 'comments'), commentData);
      // Add to local state optimistically - use a client-side date for immediate display
      const newCommentForState = {
          ...commentData,
          id: docRef.id,
          createdAt: new Date() // Use current date for optimistic update
      };

      if (currentUser) { // Double-check user exists
        try {
           await addDoc(collection(db, 'userInteractions'), {
               userId: currentUser.uid,
               postId: id, // 'id' from useParams()
               interactionType: 'comment',
               timestamp: serverTimestamp()
           });
           console.log("Logged 'comment' interaction.");
        } catch (interactionError) {
           console.error("Error logging 'comment' interaction:", interactionError);
           // Optional: Handle logging error separately
        }
      }

      // Ensure comments are sorted correctly when adding new one
      setComments(prevComments => [newCommentForState, ...prevComments].sort((a, b) => b.createdAt - a.createdAt));
      setNewComment('');

    } catch (commentError) {
      console.error("Error adding comment: ", commentError);
      setSubmitError(`Failed to post comment: ${commentError.message}`);
    }
  };

   // Handle Comment Deletion
  const handleDeleteComment = async (commentIdToDelete) => {
    if (!currentUser) {
        setSubmitError("You must be logged in to delete comments.");
        return;
    }
    setSubmitError('');
    const commentRef = doc(db, 'comments', commentIdToDelete);

    // Verify ownership client-side before attempting deletion
    const commentToDelete = comments.find(c => c.id === commentIdToDelete);
    if (!commentToDelete || commentToDelete.userId !== currentUser.uid) {
        setSubmitError("You can only delete your own comments.");
        return;
    }

    // Optimistic UI update
    const originalComments = [...comments];
    setComments(prevComments => prevComments.filter(comment => comment.id !== commentIdToDelete));

    try {
        await deleteDoc(commentRef);
    } catch (deleteError) {
        console.error("Error deleting comment: ", deleteError);
        setSubmitError("Failed to delete comment. Please try again.");
        // Rollback UI update on error
        setComments(originalComments);
    }
  };

  // --- Render Logic ---
  if (loading && !post) return <div className="flex justify-center items-center h-screen"><span className="loading loading-lg"></span></div>;
  if (error && !post) return <div className="text-center text-error mt-10 p-4">{error}</div>;
  if (!post) return <div className="text-center mt-10 p-4">Post not found or still loading...</div>; // Handle case where post is null


  return (
      <div className="post-detail overscroll-none w-full flex flex-col items-center justify-center p-2 md:p-4 md:px-6 mb-6 md:mb-10">
        <div className='w-full lg:w-[70%] xl:w-[60%]'> {/* Adjusted width */}

           {/* --- Poster Info Display (Linked) --- */}
           {posterUid ? ( // Only render link if posterUid is available
                <Link to={`/profile/${posterUid}`} className="flex items-center gap-3 mb-4 group hover:bg-base-200 p-2 rounded-lg transition duration-150 ease-in-out">
                    <div className="avatar">
                        <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
                            <img src={posterPhotoURL || "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"} alt={posterName || 'Author'} />
                        </div>
                    </div>
                    <div>
                        <p className="font-semibold text-sm group-hover:underline">{posterName || 'Loading...'}</p>
                        <p className="text-xs text-gray-500">
                        {postDate ? postDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading date...'}
                        </p>
                    </div>
                </Link>
           ) : ( // Fallback if no poster UID
               <div className="flex items-center gap-3 mb-4 p-2">
                   {/* Non-linked version */}
                   <div className="avatar">
                       <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
                           <img src={posterPhotoURL || "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"} alt={posterName || 'Author'} />
                       </div>
                   </div>
                   <div>
                       <p className="font-semibold text-sm">{posterName || 'Loading...'}</p>
                       <p className="text-xs text-gray-500">
                       {postDate ? postDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading date...'}
                       </p>
                   </div>
               </div>
           )}
           {/* --- END Poster Info --- */}


          <h1 className='text-xl md:text-4xl font-bold mb-2'>{post.title}</h1>
          <p className="text-xs md:text-sm text-gray-500 mb-2 md:mb-4">Views: {viewCount}</p>

          {/* Display specific fetch error if post loaded but content/comments failed */}
          {error && <p className="text-center text-warning my-4">{error.includes('comments') || error.includes('content') ? error : ''}</p>}


          {post.imageUrl && (
            <div
              className='w-full h-[40vh] md:h-[60vh] bg-cover bg-center rounded md:rounded-lg mb-6 shadow-md'
              style={{ backgroundImage: `url(${post.imageUrl})` }}
              aria-label={`Featured image for ${post.title}`}
            />
          )}

          <div
            className=' mt-4 post-content prose lg:prose-lg max-w-none'
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* --- Likes Section --- */}
          <div className="mt-8 pt-4 border-t flex items-center gap-4">
             <button onClick={handleLike} disabled={!currentUser} className={`btn btn-sm gap-1 ${isLiked ? 'btn-primary' : 'btn-outline btn-primary'}`} title={!currentUser ? "Log in to like" : (isLiked ? "Unlike" : "Like")}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={isLiked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                {/* {isLiked ? 'Liked' : 'Like'} */}
             </button>
             <span className="text-sm text-gray-600">{likeCount} Likes</span>
          </div>


           {/* --- Comments Section --- */}
           <div className="mt-8 pt-6 border-t">
                <h2 className="md:text-xl font-semibold mb-4">Comments ({comments.length})</h2>

                 {submitError && <p className="alert alert-error text-sm p-3 mb-4 shadow-md">{submitError}</p>}


                 {/* Comment Form */}
                {currentUser ? (
                 <form onSubmit={handleCommentSubmit} className="mb-4 md:mb-6 flex items-start gap-3">
                    <div className="avatar flex-shrink-0 mt-1">
                        <div className="w-9 h-9 rounded-full">
                          {currentUser.photoURL ? (
                              <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-full h-full object-cover" /> // Keep existing image logic
                              ) : (
                              // *** START: Replace the default image with the user's SVG ***
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-base-content opacity-50" /* Adjusted size slightly for the 8x8 container */ fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                              </svg>
                              // *** END: Replacement ***
                            )}
                        </div>
                    </div>
                    <div className="flex-grow">
                        <textarea
                            className="textarea textarea-bordered w-full text-sm" // Smaller text
                            rows="2" // Fewer rows initially
                            placeholder="Add your comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-primary btn-xs mt-2">Post Comment</button>
                    </div>
                 </form>
                ) : (
                 <p className="mb-4 text-sm p-3 bg-base-200 rounded-md">Please <Link to="/login" className="link link-hover link-primary font-medium">log in</Link> to comment.</p>
                )}


                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length > 0 ? (
                    comments.map(comment => (
                      <div key={comment.id} className="p-2 md:p-3 bg-base-200 rounded-lg shadow-sm relative group flex gap-3 items-start"> {/* items-start */}
                          <div className="avatar flex-shrink-0 mt-1">
                              <div className="w-8 h-8 rounded-full">
                                {currentUser.photoURL ? (
                                  <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-full h-full object-cover" /> // Keep existing image logic
                                  ) : (
                                  // *** START: Replace the default image with the user's SVG ***
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-base-content opacity-50" /* Adjusted size slightly for the 8x8 container */ fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                  </svg>
                                  // *** END: Replacement ***
                                )}
                              </div>
                          </div>

                          <div className="flex-grow">
                              <div className="flex items-baseline justify-between">
                                  <p className="font-semibold text-sm">{comment.userName}</p>
                                  {currentUser && currentUser.uid === comment.userId && (
                                      <button
                                          onClick={() => handleDeleteComment(comment.id)}
                                          className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                          aria-label="Delete comment"
                                          title="Delete"
                                      >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                  )}
                              </div>
                              <p className="text-[8px] md:text-xs text-gray-500 mb-1">
                                  {comment.createdAt?.toLocaleTimeString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                              </p>
                              <p className='text-sm whitespace-pre-wrap break-words'>{comment.text}</p>
                          </div>
                      </div>
                    ))
                  ) : (
                    !loading && !error && <p className="text-sm text-gray-500 text-center py-4 italic">Be the first to comment!</p>
                  )}
                   {loading && comments.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Loading comments...</p>}
                </div>
           </div>

        </div>
      </div>
  );
};

export default PostDetail;