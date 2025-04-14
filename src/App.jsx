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
import SearchResults from './components/SearchResults'; // <--- Ensure this import is present
import { auth } from './services/firebase';

const App = () => {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    auth.signOut().then(() => {
        localStorage.removeItem('authToken');
        setIsAuth(false);
        console.log("User signed out successfully.");
    }).catch((error) => {
        console.error("Sign out error:", error);
    });
  };

   useEffect(() => {
    setLoading(true);
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setIsAuth(true);
      } else {
        setIsAuth(false);
        localStorage.removeItem('authToken');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);


  if (loading) {
      return (
          <div className="flex justify-center items-center min-h-screen">
              <span className="loading loading-dots loading-lg"></span>
          </div>
      );
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar isAuth={isAuth} handleLogout={handleLogout} />
        <main className="flex-grow bg-base-100"> {/* Added base background */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/login" element={!isAuth ? <Login setIsAuth={setIsAuth} /> : <Navigate to="/admin" replace />} />
            <Route path="/profile/:userId" element={<UserProfile />} />
            <Route path="/search" element={<SearchResults />} /> {/* <--- Ensure this route is present */}
            <Route
              path="/admin/*"
              element={isAuth ? <AdminPanel /> : <Navigate to="/login" replace />}
            />
             {/* Optional: Add a 404 Not Found Route */}
             {/* <Route path="*" element={<NotFoundComponent />} /> */}
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;