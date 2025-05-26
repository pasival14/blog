import { useState, useEffect } from 'react';
import { db, storage, auth } from '../services/firebase';  // Import Firebase Auth
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './postform.css';

const PostForm = ({ title, setTitle, content, setContent, excerpt, setExcerpt, setImageUrl }) => {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [userUid, setUserUid] = useState(null);  // State to store user UID

  // Fetch and store the current authenticated user's UID
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserUid(user.uid);  // Set the user UID
      } else {
        setUserUid(null);  // No user is signed in
      }
    });
    
    // Cleanup the listener on unmount
    return () => unsubscribe();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setImageUrl(URL.createObjectURL(file));
  };

  const handleFileUpload = async (file, path) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        () => {},
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  };

  const handleContentUpload = async (htmlContent) => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const file = new File([blob], `${title}.html`, { type: 'text/html' });

    return handleFileUpload(file, `posts/${file.name}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!userUid) {
      alert("You need to be logged in to create a post.");
      return;
    }

    setUploading(true);

    let mainImageUrl = '';
    let contentUrl = '';

    if (image) {
      try {
        mainImageUrl = await handleFileUpload(image, `images/${image.name}`);
        setImageUrl(mainImageUrl);
      } catch (error) {
        console.error('Error uploading main image:', error);
      }
    }

    try {
      contentUrl = await handleContentUpload(content);
    } catch (error) {
      console.error('Error uploading content:', error);
    }

    try {
      await addDoc(collection(db, 'posts'), {
        title,
        contentUrl,
        excerpt,
        imageUrl: mainImageUrl,
        createdAt: new Date(),
        uid: userUid  // Attach the authenticated user's UID here
      });
      setTitle('');
      setContent('');
      setExcerpt('');
      setImage(null);
      setImageUrl('');
      alert('Post created successfully!');
    } catch (error) {
      console.error('Error adding document:', error);
    }

    setUploading(false);
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'blockquote'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  return (
    <form onSubmit={handleSubmit} className='w-full h-full'>
      {/* Title Input */}
      <div className='w-full'>
        <label className='md:text-lg block'>Title</label>
        <input
          type="text"
          className='my-2 bg-base-100 w-full h-[30px] md:h-[45px] border md:border-2 md:textarea-lg rounded md:rounded-lg'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      {/* Image Upload */}
      <div>
        <label className='md:text-lg block'>Main Image</label>
        <input className='my-2' type="file" accept="image/*" onChange={handleImageChange} />
      </div>

      {/* Content Editor */}
      <div>
        <label className='md:text-lg block'>Content</label>
        <ReactQuill
          value={content}
          onChange={(value) => setContent(value)}
          modules={modules}
          className='my-2 bg-base-100 w-full h-full border-none'
          placeholder='Write your content here...'
        />
      </div>

      {/* Excerpt Input */}
      <div>
        <label className='md:text-lg block'>Excerpt</label>
        <input
          type="text"
          className='my-2 bg-base-100 w-full h-[30px] md:h-[45px] border md:border-2 md:textarea-lg rounded md:rounded-lg'
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          required
        />
      </div>

      {/* Submit Button */}
      <div className='w-full flex justify-center my-2 md:my-5'>
        <button className='btn btn-success' type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Create Post'}
        </button>
      </div>
    </form>
  );
};

export default PostForm;

