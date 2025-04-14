// src/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from './services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import GoogleIcon from './components/GoogleIcon';

const Navbar = ({ isAuth, handleLogout }) => {
    // Theme state - reads from localStorage or defaults to 'light'
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const navigate = useNavigate();
    const [userPhotoURL, setUserPhotoURL] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const currentUser = auth.currentUser;

    // Effect to apply the theme to the HTML tag whenever the theme state changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme); // Save theme choice
    }, [theme]);

    // Function to toggle theme state
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'synthwave' : 'light');
    };

    // Logout function
    const handleLogoutClick = () => {
        handleLogout();
    };

    // Fetch profile picture
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                const profileRef = doc(db, 'profiles', user.uid);
                try {
                    const docSnap = await getDoc(profileRef);
                    if (docSnap.exists() && docSnap.data().profilePictureUrl) {
                        setUserPhotoURL(docSnap.data().profilePictureUrl);
                    } else {
                        setUserPhotoURL(user.photoURL); // Fallback to Auth URL
                    }
                } catch (error) {
                    console.error("Error fetching profile picture:", error);
                    setUserPhotoURL(user.photoURL); // Fallback on error
                }
            } else {
                setUserPhotoURL(null);
            }
        });
        return unsubscribe;
    }, []);

    // Handle Search Submission
    const handleSearch = (e) => {
        e.preventDefault();
        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery) {
            navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
            setSearchQuery('');
             // Close the dropdown after search (optional)
             if (document.activeElement instanceof HTMLElement) {
                 document.activeElement.blur();
             }
        }
    };

    const isAuthenticated = !!currentUser;

    return (
        <div className="navbar bg-base-100 shadow-sm sticky top-0 z-50"> {/* Made navbar sticky */}
            <div className="navbar-start">
                <Link className="btn btn-ghost text-xl font-bold" to="/">
                    explain
                </Link>
            </div>

            <div className="navbar-end mr-2 md:mr-6 gap-1 md:gap-2">

                {/* Search Section - Reverted to simpler DaisyUI dropdown style */}
                <div className="dropdown dropdown-end">
                    <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div tabIndex={0} className="mt-3 z-[1] card card-compact dropdown-content w-64 bg-base-100 shadow">
                        <div className="card-body p-2">
                             <form onSubmit={handleSearch} className="join w-full">
                                <input
                                    type="text"
                                    className="input input-bordered input-sm join-item flex-grow"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    aria-label="Search articles"
                                />
                                {/* Filter Select Removed */}
                                <button type="submit" className="btn btn-primary btn-sm join-item" aria-label="Search">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Theme Toggle - Simplified */}
                <label className="flex cursor-pointer gap-2 items-center px-2"> {/* Added items-center */}
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
                     <input
                        type="checkbox"
                        onChange={toggleTheme}
                        checked={theme === 'synthwave'} // Check if dark theme is active
                        className="toggle toggle-sm theme-controller" // Added toggle-sm
                        aria-label="Toggle theme"
                     />
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                 </label>


                {/* User Avatar and Dropdown */}
                <div className="dropdown dropdown-end">
                    <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-ghost btn-circle avatar"
                        onClick={() => { if (!isAuthenticated) navigate('/login'); }}
                        aria-label="User menu"
                    >
                        <div className="w-8 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1 flex items-center justify-center overflow-hidden"> {/* Adjusted ring */}
                            {isAuthenticated && userPhotoURL ? (
                                <img src={userPhotoURL} alt="User Avatar" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-base-300 text-primary">
                                     <GoogleIcon />
                                 </div>
                            )}
                        </div>
                    </div>
                    {isAuthenticated && (
                        <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
                             <li><Link to="/admin">Dashboard</Link></li>
                             <li><button onClick={handleLogoutClick}>Sign Out</button></li>
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Navbar;