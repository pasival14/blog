import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'; // Import Firestore functions
import { auth, db } from '../../services/firebase';  // Import Firebase Auth and Firestore
import guy from '../../assets/guy-working-at-home.svg'
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [userUid, setUserUid] = useState(null);  // State to store user UID
  const [userPosts, setUserPosts] = useState([]);  // State to store posts from Firestore
  const [loading, setLoading] = useState(true);    // State for loading indicator

  // Fetch current user's UID on component mount
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserUid(user.uid);
      } else {
        setUserUid(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch posts created by the current user (limit to 4 most recent posts)
  useEffect(() => {
    const fetchUserPosts = async () => {
      if (!userUid) return;

      setLoading(true);
      // Query to get most recent 4 posts by the user
      const q = query(
        collection(db, 'posts'), 
        where('uid', '==', userUid), 
        orderBy('createdAt', 'desc'),  // Order by creation time (most recent first)
        limit(6)  // Limit to 6 posts
      );
      const querySnapshot = await getDocs(q);

      const posts = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUserPosts(posts);
      setLoading(false);
    };

    fetchUserPosts();
  }, [userUid]);

  return (
    <div className="w-full h-full grid gap-5 grid-cols-4">
      <div className="col-span-3 flex flex-col gap-4 h-[85%]">  
        {/* Top Banner */}
        <div className="w-full ml:h-[17%] h-[25%] flex items-center justify-between bg-warning rounded-2xl px-4">
          <img src={guy} alt="" className='w-[35%] h-full object-cover object-center' />
          <div className='text-neutral flex flex-col items-end w-[50%] mr-9'>
            <h2 className='text-3xl ml:text-xl font-semibold text-end'>Hello User!</h2>
            <p className='text-end ml:text-sm my-3'>Are you ready to share your thoughts and insights on trending topics?</p>
            <button className='btn ml:text-sm'>Create post</button>
          </div>
        </div>

        {/* User Posts Section */}
        <div className="h-full overflow-x-hidden bg-base-200 rounded-2xl">
          <div className='w-full h-full m-4'>
            <div className='flex items-center justify-between my-3'>
              <h2 className='text-xl'>Your Articles</h2>
            </div>

            {/* Show loading indicator */}
            {loading ? (
              <p>Loading...</p>
            ) : userPosts.length === 0 ? (
              <p>No posts found. Create your first post!</p>
            ) : (
              <div className='user-post py-5 w-full flex flex-col justify-between'>
                {userPosts.map((post, index) => (
                  <div key={post.id} className='w-full grid grid-cols-5 mb-4'>
                    <div className='w-full flex col-span-3 gap-4'>
                      <p className='h-full flex items-center'>{String(index + 1).padStart(2, '0')}</p>
                      {/* <div className='w-[50px] h-[50px] overflow-hidden rounded-xl'>
                        <img 
                          src={post.imageUrl} 
                          alt={post.title}
                          className='w-full h-full object-cover'
                        />
                      </div> */}
                      <div>
                        <Link to={`/post/${post.id}`}>
                          <h2 className='leading-[1.6] hover:underline'>{post.title}</h2>
                        </Link>
                        <p className='text-xs'>{new Date(post.createdAt.seconds * 1000).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side Section (Right) */}
      <div className="col-span-1 h-[85%]">
        <div className="w-full h-[60%] flex flex-col justify-between mb-[7%]">
            <div className="w-full h-[30%] flex gap-4 items-center border border-info rounded-2xl p-6">
                <div className='p-2 bg-base-200 inline-block rounded-2xl'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div>
                <div>
                    <h2 className='text-2xl font-bold text-center'>$0</h2>
                    <p className='text-sm text-center'>Total earnings</p>
                </div>
            </div>
            <div className="w-full h-[30%] flex gap-4 items-center border border-info rounded-2xl p-6">
                <div className='p-2 bg-base-200 inline-block rounded-2xl'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                </div>
                <div>
                    <h2 className='text-2xl font-bold text-center'>78</h2>
                    <p className='text-sm text-center'>Total articles</p>
                </div>
            </div>
            <div className="w-full h-[30%] flex gap-4 items-center border border-info rounded-2xl p-6">
                <div className='p-2 bg-base-200 inline-block rounded-2xl'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                </div>
                <div>
                    <h2 className='text-2xl font-bold text-center'>1M</h2>
                    <p className='text-sm text-center'>Total views</p>
                </div>
            </div>
        </div>
        <div className="w-full h-[37%] bg-base-200 p-4 rounded-2xl text-center">
          <h2 className='text-xl mb-2'>Trending posts</h2>
          <hr />
          <div className='flex flex-col justify-between'>
            <p className='border-b border-info py-4 hover:underline'>Sample Trending Post 1</p>
            <p className='border-b border-info py-4 hover:underline'>Sample Trending Post 2</p>
            <p className='border-b border-info py-4 hover:underline'>Sample Trending Post 3</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

