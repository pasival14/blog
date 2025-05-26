// src/components/AdminPanel.jsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Analytics from './admin/Analytics';
import CreatePost from './admin/CreatePost';
import Dashboard from './admin/Dashboard';
import Earnings from './admin/Earnings';
import Inbox from './admin/Inbox';
import MyArticles from './admin/MyArticles';
import Profile from './admin/Profile';
import './admin.css';
import SiteSettingsComponent from './admin/SiteSettingsComponent';
import ManageUsersComponent from './admin/ManageUsersComponent';
import AllPostsAdminView from './admin/AllPostsAdminView';


// --- Icons (BurgerIcon, CloseIcon remain the same) ---
const BurgerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);
const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);


// --- AdminPanel Component ---
// Accept isAdmin as a prop
const AdminPanel = ({ isAdmin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (location.state?.activeSection) {
      setActiveSection(location.state.activeSection);
      // navigate(location.pathname, { replace: true, state: {} }); // Optional state clearing
    }
    setIsMobileNavOpen(false); // Close mobile nav on route change
  }, [location]);


  const handleMenuItemClick = (sectionId) => {
    setActiveSection(sectionId);
    setIsMobileNavOpen(false);
  };
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
</svg>


  // --- Define Menu Items ---
  const baseMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75' },
    { id: 'create-post', label: 'Create Post', icon: 'M12 4.5v15m7.5-7.5h-15' },
    { id: 'my-articles', label: 'My Articles', icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z' },
    { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'inbox', label: 'Inbox', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z' },
    { id: 'profile', label: 'Profile', icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
    { id: 'earnings', label: 'Earnings', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z' },
  ];

  // --- Conditionally add Admin items ---
  const adminMenuItems = isAdmin ? [
    { id: 'site-settings', label: 'Site Settings', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z' }, // Settings icon
    { id: 'manage-users', label: 'Manage Users', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
    { id: 'manage-posts', label: 'Manage Posts', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
  ] : [];

  const menuItems = [...baseMenuItems, ...adminMenuItems]; // Combine base and admin items

  // --- Render Section Logic ---
  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'create-post': return <CreatePost />;
      case 'my-articles': return <MyArticles />;
      case 'analytics': return <Analytics />;
      case 'inbox': return <Inbox />;
      case 'profile': return <Profile />;
      case 'earnings': return <Earnings />;
      // Add cases for admin sections
      case 'site-settings': return isAdmin ? <SiteSettingsComponent /> : <Dashboard />; // Fallback to dashboard if not admin
      case 'manage-users': return isAdmin ? <ManageUsersComponent /> : <Dashboard />;
      case 'manage-posts': return isAdmin ? <AllPostsAdminView /> : <Dashboard />;
      default: return <Dashboard />; // Default fallback
    }
  };

  // --- JSX Structure ---
  return (
    // Container adjusted for potentially fixed navbar height
    <div className="relative min-h-[calc(100vh-var(--navbar-height,64px))]">

        {/* Burger Menu Button (Mobile) */}
        <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="btn btn-square btn-ghost md:hidden absolute top-4 left-4 z-50"
            aria-label="Open navigation menu"
        >
            <BurgerIcon />
        </button>

        {/* Mobile Nav Overlay & Sidebar */}
        {isMobileNavOpen && (
            <>
                {/* Overlay */}
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsMobileNavOpen(false)}
                    aria-hidden="true"
                ></div>
                {/* Mobile Sidebar */}
                <div className="fixed top-0 left-0 w-64 h-full bg-base-200 shadow-lg z-50 p-4 overflow-y-auto md:hidden">
                    <button
                       onClick={() => setIsMobileNavOpen(false)}
                       className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2" // Smaller close button
                       aria-label="Close navigation menu"
                    >
                       <CloseIcon />
                    </button>
                     <h2 className="text-xl font-semibold mb-6 mt-2 pl-2">Menu</h2>
                     {/* Use the combined menuItems array */}
                     <ul className="menu space-y-1">
                       {menuItems.map((item) => (
                         <li key={item.id} onClick={() => handleMenuItemClick(item.id)}>
                           <button
                             className={`${activeSection === item.id ? 'active bg-base-300 font-semibold' : 'hover:bg-base-300/50'} flex items-center gap-3 w-full text-left p-2 rounded-md text-sm`} // Adjusted styling
                             aria-current={activeSection === item.id ? 'page' : undefined}
                           >
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 flex-shrink-0">
                               <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                             </svg>
                             <span>{item.label}</span>
                           </button>
                         </li>
                       ))}
                     </ul>
                </div>
            </>
        )}

      {/* Main Layout Grid (Flexbox for Desktop) */}
      <div className='flex h-[calc(100vh-var(--navbar-height,64px))]'>

        {/* Desktop Sidebar Menu */}
        <div className='hidden md:block w-60 lg:w-64 bg-base-100 h-full pt-6 pl-4 pr-2 lg:pl-6 lg:pr-4 overflow-y-auto flex-shrink-0'> {/* Slightly adjusted width */}
          {/* Use the combined menuItems array */}
          <ul className="menu rounded-box space-y-1"> {/* Use space-y for spacing */}
            {menuItems.map((item) => (
              <li key={item.id}> {/* Removed onClick here, handled by button */}
                <button
                  onClick={() => handleMenuItemClick(item.id)} // onClick on the button itself
                  className={`${activeSection === item.id ? 'active btn-active bg-primary/10 text-primary font-semibold' : 'btn-ghost hover:bg-base-200/50'} btn justify-start w-full h-10 text-sm`} // Adjusted styling & height
                  aria-current={activeSection === item.id ? 'page' : undefined}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 mr-2 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content Area */}
        <div className='flex-1 h-full bg-base-300 md:rounded-tl-2xl md:rounded-bl-2xl p-1 md:p-4 overflow-hidden'>
           <div className="w-full h-full overflow-y-auto md:rounded-xl shadow">
             {renderSection()}
           </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;
