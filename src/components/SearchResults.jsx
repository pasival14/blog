// src/components/SearchResults.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
// --- Import Firebase Functions SDK ---
import { getFunctions, httpsCallable } from "firebase/functions";

// --- Initialize Firebase Functions ---
const functions = getFunctions();

// --- Reference your Cloud Function (name should still be 'searchPosts') ---
const searchPostsCallable = httpsCallable(functions, 'searchPosts');

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const performSearch = useCallback(async () => {
        if (!query) {
            setResults([]); setError(null); setLoading(false);
            return;
        }
        setLoading(true); setError(null); setResults([]);

        try {
            console.log(`Calling Algolia-backed search function for: ${query}`);

            // --- Call your Cloud Function ---
            const response = await searchPostsCallable({ query: query });
            const searchData = response.data; // Data directly from v2 onCall return
            // -----------------------------

            if (Array.isArray(searchData)) {
                console.log(`Received ${searchData.length} results from backend.`);
                // Algolia results (mapped in backend) should have fields like id, title, etc.
                setResults(searchData);
            } else {
                 console.error("Search function response.data is not an array:", searchData);
                 setResults([]);
                 setError("Received invalid search results format.");
            }
        } catch (err) {
            console.error("Search failed:", err);
            const message = err.message || 'An unknown error occurred.';
            setError(`Search failed: ${message}`);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        performSearch();
    }, [performSearch]);

    // --- Render Card (ensure fields match data indexed in Algolia) ---
    const renderResultCard = (post) => (
         <Link to={`/post/${post.id}`} key={post.id} className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow duration-200 ease-in-out flex flex-row items-start gap-4 p-3">
             {post.imageUrl ? (
                 <figure className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden">
                     <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full"/>
                 </figure>
             ) : (
                 <div className="w-24 h-24 flex-shrink-0 rounded-md bg-base-300 flex items-center justify-center">
                     <svg className="w-10 h-10 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 7v10M4 7l4-4M4 7l4 4m6 6v-4m0 4l4 4m-4-4l-4 4m6-14v4m0-4l4-4m-4 4l-4-4" /></svg>
                 </div>
             )}
             <div className="flex-grow card-body p-0">
                 <h3 className="card-title text-md font-semibold leading-snug mb-1 line-clamp-2">{post.title || 'Untitled Post'}</h3>
                 {post.excerpt && <p className="text-sm text-base-content/80 line-clamp-2 mb-2">{post.excerpt}</p>}
                 {post.authorName && (
                     <div className="flex items-center gap-1 text-xs text-base-content/60 mt-1">
                          {post.authorPhotoURL ? (
                              <img src={post.authorPhotoURL} alt={post.authorName} className="w-4 h-4 rounded-full object-cover"/>
                          ) : (
                              <div className="w-4 h-4 rounded-full bg-base-300 ring-1 ring-inset ring-base-content/10"></div>
                          )}
                          <span>{post.authorName}</span>
                      </div>
                 )}
             </div>
         </Link>
    );

    // --- Main Render Logic (remains the same) ---
    return (
        <div className="container mx-auto p-4 md:p-6 min-h-[calc(100vh-128px)]">
             {/* ... Title, Loading, Error, No Results ... */}
             <h1 className="text-2xl md:text-3xl font-bold mb-6 border-b pb-3">
                Search Results {query ? <>for: <span className="text-primary font-semibold">{query}</span></> : ''}
            </h1>
             {/* ... */}
             {!loading && !error && results.length > 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map(renderResultCard)}
                 </div>
            )}
             {/* ... */}
        </div>
    );
};

export default SearchResults;