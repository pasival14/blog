import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import guy from '../../assets/guy-working-at-home.svg'
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [userUid, setUserUid] = useState(null);
  // State for the list of latest posts (still limited)
  const [latestUserPosts, setLatestUserPosts] = useState([]);
  // State for overall stats
  const [totalPostsCount, setTotalPostsCount] = useState(0);
  const [totalViewsCount, setTotalViewsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');

  // Fetch current user's UID and Display Name
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserUid(user.uid);
        setUserName(user.displayName || 'User');
      } else {
        setUserUid(null);
        setUserName('User');
        // Reset stats on logout
        setLatestUserPosts([]);
        setTotalPostsCount(0);
        setTotalViewsCount(0);
      }
      // Set loading false here only if not dependent on subsequent fetches
      // setLoading(false); // It's better to set loading false in fetchUserData
    });
    return () => unsubscribe();
  }, []);

  // --- MODIFIED: Fetch ALL posts for stats, then slice for display ---
  useEffect(() => {
    const fetchUserData = async () => {
      if (!userUid) {
        setLoading(false); // Not loading if no user
        setLatestUserPosts([]);
        setTotalPostsCount(0);
        setTotalViewsCount(0);
        return;
      };

      setLoading(true);
      // Clear previous data
      setLatestUserPosts([]);
      setTotalPostsCount(0);
      setTotalViewsCount(0);

      try {
        // Query ALL posts by the user, ordered by creation time
        const q = query(
          collection(db, 'posts'),
          where('uid', '==', userUid),
          orderBy('createdAt', 'desc') // Order remains important for slicing latest
          // REMOVED limit(6) - fetch all posts
        );
        const querySnapshot = await getDocs(q);

        let calculatedTotalViews = 0;
        const allPosts = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // Calculate total views while mapping
          calculatedTotalViews += data.viewCount || 0;
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || Date.now()),
          };
        });

        // Set the calculated stats
        setTotalPostsCount(allPosts.length);
        setTotalViewsCount(calculatedTotalViews);

        // Set the list for display (slice the first 6 from all fetched posts)
        setLatestUserPosts(allPosts.slice(0, 4));

      } catch (error) {
        console.error("Error fetching user data:", error);
        // Optionally set an error state here
      } finally {
        setLoading(false); // Set loading false after fetching and processing
      }
    };

    fetchUserData();
  }, [userUid]); // Re-run only when userUid changes


  const handleCreatePostClick = () => {
    // Logic to navigate remains the same
    console.log("Navigate to Create Post section - Requires AdminPanel interaction");
    // Example: props.setActiveSection('create-post'); (if passed down)
    // Or use navigate('/admin', { state: { activeSection: 'create-post' } });
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 h-full">

      {/* Main Content Area (Left) */}
      <div className="md:col-span-3 flex flex-col gap-4">

        {/* Top Banner */}
        <div className="flex items-center justify-between bg-warning rounded-2xl px-4 py-3 overflow-hidden">
          <img src={guy} alt="Working illustration" className='w-1/3 max-w-xs h-auto object-contain' />
          <div className='text-neutral flex flex-col items-end text-right flex-1 pl-4'>
            <h2 className='text-xl lg:text-3xl font-semibold'>Hello {userName}!</h2>
            <p className='text-sm lg:text-base my-2 lg:my-3'>Ready to share your thoughts?</p>
            <Link to="/admin" state={{ activeSection: 'create-post' }} className='btn btn-sm lg:btn-md btn-neutral'>Create post</Link> {/* Updated button to Link */}
          </div>
        </div>

        {/* User Posts Section (Displays Latest 6) */}
        <div className="flex-grow bg-base-200 rounded-2xl p-4 overflow-y-auto">
            <h2 className='text-xl font-semibold mb-3'>Your Latest Articles</h2>
            {loading ? (
              <div className="flex justify-center items-center pt-10"><span className="loading loading-dots loading-md"></span></div>
            // Display message based on TOTAL posts count, not just latest
            ) : totalPostsCount === 0 ? (
              <p className='text-center pt-10 text-gray-500'>No posts found. Create your first post!</p>
            ) : (
              <ul className='space-y-3'>
                {/* Map over latestUserPosts (max 6) */}
                {latestUserPosts.map((post, index) => (
                  <li key={post.id} className='flex items-center justify-between gap-4 pb-3 border-b border-base-300 last:border-b-0'>
                    <div className='flex items-start gap-3 flex-grow min-w-0'>
                      <p className='pt-1 text-gray-400'>{String(index + 1).padStart(2, '0')}</p>
                      <div className='min-w-0'>
                        <Link to={`/post/${post.id}`} className='hover:underline'>
                          <h3 className='leading-tight font-medium truncate' title={post.title}>{post.title}</h3>
                        </Link>
                        <p className='text-xs text-gray-500 mt-1'>
                            {post.createdAt instanceof Date ? post.createdAt.toLocaleDateString() : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center flex-shrink-0 gap-3 text-sm text-gray-600'>
                      <span className='flex items-center gap-1' title="Views">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /> </svg>
                         {post.viewCount || 0}
                      </span>
                      <span className='flex items-center gap-1' title="Likes">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> </svg>
                         {post.likeCount || 0}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
             {/* Link to see all articles if more than 6 exist */}
             {!loading && totalPostsCount > 6 && (
                <div className="text-center mt-4">
                    <Link to="/admin" state={{ activeSection: 'my-articles' }} className="btn btn-sm btn-outline">View All My Articles</Link>
                </div>
            )}
        </div>
      </div>

      {/* Side Section (Right) - Updated Stats Cards */}
      <div className="md:col-span-1 flex flex-col gap-4">
        <div className="grid grid-rows-3 gap-4 flex-shrink-0">
            {/* Stat Card 1: Earnings (remains 0) */}
            <div className="flex gap-4 items-center border border-info rounded-2xl p-4">
                 <div className='p-2 bg-base-200 inline-block rounded-xl'> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6"> <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> </svg> </div>
                 <div> <h2 className='text-xl lg:text-2xl font-bold'>$0</h2> <p className='text-xs lg:text-sm'>Total earnings</p> </div>
            </div>

            {/* --- UPDATED: Stat Card 2: Total Articles --- */}
            <div className="flex gap-4 items-center border border-info rounded-2xl p-4">
                <div className='p-2 bg-base-200 inline-block rounded-xl'> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6"> <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /> </svg> </div>
                <div>
                    {/* Display TOTAL posts count from state */}
                    <h2 className='text-xl lg:text-2xl font-bold'>{loading ? '...' : totalPostsCount}</h2>
                    <p className='text-xs lg:text-sm'>Total articles</p>
                </div>
            </div>

             {/* --- UPDATED: Stat Card 3: Total Views --- */}
            <div className="flex gap-4 items-center border border-info rounded-2xl p-4">
                <div className='p-2 bg-base-200 inline-block rounded-xl'> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6"> <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /> <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /> </svg> </div>
                <div>
                    {/* Display TOTAL views count from state */}
                    {/* Use toLocaleString() for better number formatting */}
                    <h2 className='text-xl lg:text-2xl font-bold'>{loading ? '...' : totalViewsCount.toLocaleString()}</h2>
                    <p className='text-xs lg:text-sm'>Total views</p>
                </div>
            </div>
        </div>

        {/* Trending Posts Section (remains the same) */}
        <div className="bg-base-200 p-4 rounded-2xl flex-grow overflow-y-auto">
          <h2 className='text-lg font-semibold mb-2 text-center'>Trending Posts</h2>
          <hr className='border-base-300 mb-3'/>
          <div className='space-y-2 text-sm'>
            {/* Placeholder - You'd fetch actual trending posts here */}
            <p className='border-b border-base-300 py-2 hover:underline cursor-pointer'>Sample Trending Post 1</p>
            <p className='border-b border-base-300 py-2 hover:underline cursor-pointer'>Sample Trending Post 2</p>
            <p className='py-2 hover:underline cursor-pointer'>Sample Trending Post 3</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;