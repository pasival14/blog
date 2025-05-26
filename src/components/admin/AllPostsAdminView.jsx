// src/components/admin/AllPostsAdminView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy, limit, startAfter, Timestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const POSTS_PER_PAGE = 15; // Number of posts per page

const AllPostsAdminView = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastVisible, setLastVisible] = useState(null); // For pagination
    const [hasMore, setHasMore] = useState(true); // For pagination
    const [isDeleting, setIsDeleting] = useState(null); // Track which post ID is being deleted

    // Initial Fetch Function
    const fetchPosts = useCallback(async (loadMore = false) => {
        setLoading(true);
        setError('');
        try {
            let postsQuery;
            if (loadMore && lastVisible) {
                postsQuery = query(
                    collection(db, 'posts'),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastVisible),
                    limit(POSTS_PER_PAGE)
                );
            } else {
                // Initial fetch
                setPosts([]); // Clear posts on initial fetch
                postsQuery = query(
                    collection(db, 'posts'),
                    orderBy('createdAt', 'desc'),
                    limit(POSTS_PER_PAGE)
                );
            }

            const documentSnapshots = await getDocs(postsQuery);

            const fetchedPosts = documentSnapshots.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt instanceof Timestamp ? d.data().createdAt.toDate() : new Date()
            }));

            // Update state
            setPosts(prevPosts => loadMore ? [...prevPosts, ...fetchedPosts] : fetchedPosts);

            // Update pagination state
            const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            setLastVisible(lastDoc);
            setHasMore(documentSnapshots.docs.length === POSTS_PER_PAGE);

        } catch (err) {
            console.error("Error fetching posts:", err);
            setError("Failed to fetch posts. Please try again.");
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [lastVisible]); // Dependency for pagination

    // Initial fetch on mount
    useEffect(() => {
        fetchPosts(false); // Initial fetch, not loading more
    }, []); // Run only once on mount

    // Delete Handler
    const handleDelete = async (postId, postTitle) => {
        // Optional: Add confirmation dialog
        if (!window.confirm(`Are you sure you want to delete the post "${postTitle}"? This cannot be undone.`)) {
            return;
        }

        setIsDeleting(postId); // Set loading state for this specific button
        setError(''); // Clear previous errors

        try {
            const postDocRef = doc(db, "posts", postId);
            await deleteDoc(postDocRef);
            console.log(`Admin deleted post: ${postId}`);
            // Refresh the list by removing the post locally
            setPosts(currentPosts => currentPosts.filter(post => post.id !== postId));
            // Optionally show a success message (e.g., using toast notifications)

        } catch (err) {
            console.error(`Admin failed to delete post ${postId}:`, err);
            setError(`Failed to delete post "${postTitle}". Check permissions or try again.`);
        } finally {
            setIsDeleting(null); // Clear loading state for button
        }
    };

    return (
        <div className="p-4 md:p-6">
            <h2 className="text-2xl font-semibold mb-6">Manage All Posts</h2>

            {error && <div className="alert alert-error shadow-md mb-4">{error}</div>}

            {/* Posts Table/List */}
            <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
                <table className="table table-zebra w-full">
                    {/* head */}
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Author UID</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Render initial loading rows or empty state */}
                        {loading && posts.length === 0 && (
                            <tr><td colSpan="4" className="text-center py-4"><span className="loading loading-dots loading-md"></span></td></tr>
                        )}
                        {!loading && posts.length === 0 && (
                            <tr><td colSpan="4" className="text-center py-4 italic text-base-content/70">No posts found.</td></tr>
                        )}

                        {/* Map through posts */}
                        {posts.map((post) => (
                            <tr key={post.id} className="hover">
                                <td>
                                    <Link to={`/post/${post.id}`} className="link link-hover text-sm font-medium" title={post.title}>
                                        <span className="line-clamp-2">{post.title || 'Untitled'}</span>
                                    </Link>
                                </td>
                                <td className="text-xs text-base-content/70">{post.uid || 'N/A'}</td>
                                <td className="text-xs text-base-content/70">
                                    {post.createdAt ? post.createdAt.toLocaleDateString() : 'N/A'}
                                </td>
                                <td>
                                    <button
                                        onClick={() => handleDelete(post.id, post.title)}
                                        className="btn btn-xs btn-error btn-outline"
                                        disabled={isDeleting === post.id} // Disable button while deleting this specific post
                                    >
                                        {isDeleting === post.id ? <span className="loading loading-spinner loading-xs"></span> : 'Delete'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination / Load More */}
            <div className="text-center mt-8">
                {loading && posts.length > 0 && <span className="loading loading-dots loading-md"></span>}
                {!loading && hasMore && (
                    <button onClick={() => fetchPosts(true)} className="btn btn-primary btn-outline">
                        Load More Posts
                    </button>
                )}
                {!loading && !hasMore && posts.length > 0 && (
                    <p className="text-sm text-base-content/70 italic">No more posts to load.</p>
                )}
            </div>
        </div>
    );
};

export default AllPostsAdminView;
