import { useState } from 'react';
import PostForm from '../PostForm';
import './create.css'

const CreatePost = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [imageUrl, setImageUrl] = useState(null);

  return (
    <div className="mt-12 md:mt-0 md:grid grid-cols-5 h-full">
      <div className="col-span-3 flex flex-col my-6 overflow-y-auto">
        <h2 className="text-xl md:text-2xl font-semibold text-center">Create Post</h2>
        <div className="mt-4 mx-2 md:mx-6">
          <PostForm
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            excerpt={excerpt}
            setExcerpt={setExcerpt}
            setImageUrl={setImageUrl}
          />
        </div>
      </div>
      
      <div className="hidden md:block col-span-2 h-full mx-auto">
        <div className="mockup-phone h-fit">
          <div className="camera"></div>
          <div className="display">
            <div className="artboard relative w-[320px] bg-base-100 h-[696px]">
              <div className='contain mt-6 px-3'>
                <h3 className="text-lg font-semibold leading-[1.2]">{title || "Preview Title"}</h3>
                {imageUrl && <img src={imageUrl} alt="Preview" className="my-2 w-full h-auto"/>}
                {/* <p className="text-sm my-2">{excerpt || "Preview excerpt..."}</p> */}
                <div
                className="text-xs"
                dangerouslySetInnerHTML={{ __html: content || "Start typing content..." }}
                />
              </div>
              <div className='home-btn bg-base-100' />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;

