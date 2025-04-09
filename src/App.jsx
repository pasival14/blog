import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from './components/Home';
import PostDetail from './components/PostDetail';
import AdminPanel from './components/AdminPanel';
import Navbar from './Navbar';
import Footer from './Footer';
import Login from './components/Login';

const App = () => {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check authentication status on initial load
  useEffect(() => {
    const storedAuthToken = localStorage.getItem('authToken');
    if (storedAuthToken) {
      setIsAuth(true);
    }
    setLoading(false);
  }, []);

  // Handle user logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsAuth(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Navbar isAuth={isAuth} handleLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/login" element={<Login setIsAuth={setIsAuth} />} />
        <Route path="/admin" element={isAuth ? <AdminPanel /> : <Navigate to="/login" replace />} />
      </Routes>
      <Footer />
    </Router>
  );
};

export default App;
