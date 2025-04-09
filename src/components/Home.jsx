import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import PostsList from './PostsList'

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [featuredPost, setFeaturedPost] = useState(null);

  useEffect(() => {
    const fetchPosts = async () => {
      const postCollection = await getDocs(collection(db, "posts"));
      const postList = postCollection.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() // createdAt is a Firestore timestamp
      }));

      // Sort posts by the creation date (newest first)
      const sortedPosts = postList.sort((a, b) => b.createdAt - a.createdAt);

      // Set the most recent post as the featured post
      if (sortedPosts.length > 0) {
        setFeaturedPost(sortedPosts[0]); // The most recent post
        setPosts(sortedPosts.slice(1));  // The remaining posts
      }
    };

    fetchPosts();
  }, []);

  return (
    <div className="">
      <div className='w-full h-[95vh] px-6 pb-12'>
        {featuredPost && (
          <div className="relative w-full bg-center bg-cover rounded-3xl text-white"
            style={{
              backgroundImage: `url('${featuredPost.imageUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              height: '100%', 
              width: '100%'
            }}
          >
            {/* Overlay with gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 rounded-3xl to-transparent"></div>
            
            <div className='absolute bottom-20 left-12 flex items-center justify-between'>
              <div>
                <h2 className='text-[14px]'>Featured</h2>
                <Link to={`/post/${featuredPost.id}`}>
                  <h3 className='text-5xl leading-[1.1] w-[70%] hover:underline'>{featuredPost.title}</h3>
                </Link>
                <p className='text-[16px] w-[60%] mt-4'>{featuredPost.excerpt}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* <div>
        <PostsList />
      </div> */}

      <div className="other-posts px-10">
        <h2 className='text-2xl font-semibold mb-6'>Trending Articles</h2>
        <div className='grid grid-cols-3 gap-12'>
          {posts.map(post => (
            <div key={post.id} className="w-full mb-12">
              <Link to={`/post/${post.id}`} className='w-full'>
                <div
                className='w-full h-[300px] bg-center bg-cover rounded-xl'
                style={{
                  backgroundImage: `url(${post.imageUrl})`
                }}
                />
                <h3 className='font-bold my-3'>{post.title}</h3>
                <p className=' italic'>{post.excerpt}</p>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
