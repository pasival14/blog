// src/App.jsx
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from './components/Home';
import PostDetail from './components/PostDetail';
import AdminPanel from './components/AdminPanel';
import Navbar from './Navbar';
import Footer from './Footer';
import Login from './components/Login';
import UserProfile from './components/UserProfile';
import SearchResults from './components/SearchResults';
import { auth } from './services/firebase';

const App = () => {
  const [isAuth, setIsAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Still need this state
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    auth.signOut().then(() => {
        localStorage.removeItem('authToken');
        setIsAuth(false);
        setIsAdmin(false); // Reset admin status on logout
        console.log("User signed out successfully.");
    }).catch((error) => {
        console.error("Sign out error:", error);
    });
  };

   // Effect to check authentication state AND admin claim (Keep this logic)
   useEffect(() => {
    setLoading(true);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsAuth(true);
        console.log("App.jsx: User authenticated:", user.uid);
        try {
          const idTokenResult = await user.getIdTokenResult();
          console.log("App.jsx: User Claims:", idTokenResult.claims);
          const userIsAdmin = idTokenResult.claims.admin === true;
          console.log("App.jsx: Setting isAdmin to:", userIsAdmin);
          setIsAdmin(userIsAdmin); // Set isAdmin based on claims
        } catch (error) {
          console.error("App.jsx: Error fetching user token claims:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAuth(false);
        setIsAdmin(false); // Reset on logout
        localStorage.removeItem('authToken');
        console.log("App.jsx: User signed out.");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);


  if (loading) {
      return (
          <div className="flex justify-center items-center min-h-screen bg-base-200">
              <span className="loading loading-dots loading-lg"></span>
          </div>
      );
  }

  return (
    <Router>
      <div className="flex flex-col overscroll-none min-h-screen">
        {/* Pass isAdmin down so Navbar/AdminPanel can use it */}
        <Navbar isAuth={isAuth} isAdmin={isAdmin} handleLogout={handleLogout} />
        <main className="flex-grow bg-base-100">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/login" element={!isAuth ? <Login setIsAuth={setIsAuth} /> : <Navigate to="/admin" replace />} />
            <Route path="/profile/:userId" element={<UserProfile />} />
            <Route path="/search" element={<SearchResults />} />
            <Route
              path="/admin/*"
              // --- UPDATED Route Protection ---
              // Render AdminPanel if user is authenticated (isAuth is true)
              // Redirect to login if not authenticated
              element={isAuth ? <AdminPanel isAdmin={isAdmin} /> : <Navigate to="/login" replace />}
              // We STILL pass isAdmin down to AdminPanel for conditional UI rendering inside it
            />
             {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
