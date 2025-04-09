import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const PostsList = () => {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchPosts = async () => {
      const postCollection = await getDocs(collection(db, "posts"));
      const postList = postCollection.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postList);
    };

    fetchPosts();
  }, []);

  const handleDelete = async (id) => {
    const postDoc = doc(db, "posts", id);
    await deleteDoc(postDoc);
    setPosts(posts.filter(post => post.id !== id));
    alert('Post deleted successfully!');
  };

  return (
    <div className="posts-list">
      <h2>Posts</h2>
      {posts.length === 0 ? (
        <p>No posts available.</p>
      ) : (
        posts.map(post => (
          <div key={post.id} className="post-card">
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <button onClick={() => handleDelete(post.id)}>Delete</button>
          </div>
        ))
      )}
    </div>
  );
};

export default PostsList;
