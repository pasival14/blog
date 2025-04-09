import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ isAuth, handleLogout }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const navigate = useNavigate();

  // Toggle theme between 'light' and 'synthwave'
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'synthwave' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Set the theme on initial load
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Enhanced logout function to include navigation
  const handleLogoutClick = () => {
    handleLogout();
    navigate('/'); // Redirect to the home page after logging out
  };

  // Check if user is authenticated
  const isAuthenticated = localStorage.getItem('authToken');

  return (
    <div className="navbar bg-base-100">
      <div className="navbar-start">
        <Link className="btn btn-ghost text-xl" to="/">explain</Link>
      </div>
      
      <div className="navbar-end mr-6">
         {/* Search and Filter Section */}
         <div className="dropdown dropdown-left dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div tabIndex={0} className="join dropdown-content">
              <input className="input input-bordered join-item" placeholder="Search" />
              <select className="select select-bordered join-item">
                <option disabled>Filter</option>
                <option>Politics</option>
                <option>Finance</option>
                <option>Football</option>
              </select>
              <button className="btn join-item">Search</button>
            </div>
          </div>

          {/* Theme Toggle */}
          <label className="flex cursor-pointer gap-2" onClick={toggleTheme}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
            </svg>
            <input
              type="checkbox"
              checked={theme === 'synthwave'}
              onChange={toggleTheme}
              className="toggle theme-controller"
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </label>

        {/* User Avatar and Dropdown Menu */}
        <div className="dropdown dropdown-bottom dropdown-end">
          <div
            tabIndex={0}
            role="button"
            onClick={() => {
              if (!isAuthenticated) navigate('/login');
            }}
          >
            <div className="avatar ml-4">
              <div className="ring-primary ring-offset-base-100 w-6 rounded-full ring ring-offset-2">
                <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" alt="User Avatar" />
              </div>
            </div>
          </div>

          {isAuthenticated && (
            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
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
