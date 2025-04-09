import { useState } from 'react';
import Analytics from './admin/Analytics';
import CreatePost from './admin/CreatePost';
import Dashboard from './admin/Dashboard';
import Earnings from './admin/Earnings';
import Inbox from './admin/Inbox';
import MyArticles from './admin/MyArticles';
import Profile from './admin/Profile';
import './admin.css';

const AdminPanel = () => {
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'create-post':
        return <CreatePost />;
      case 'my-articles':
        return <MyArticles />;
      case 'analytics':
        return <Analytics />;
      case 'inbox':
        return <Inbox />;
      case 'profile':
        return <Profile />;
      case 'earnings':
        return <Earnings />;
      default:
        return <Dashboard />;
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75' },
    { id: 'create-post', label: 'Create Post', icon: 'M12 4.5v15m7.5-7.5h-15' },
    { id: 'my-articles', label: 'My Articles', icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z' },
    { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'inbox', label: 'Inbox', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z' },
    { id: 'profile', label: 'Profile', icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
    { id: 'earnings', label: 'Earnings', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z' },
  ];

  return (
    <div className="pr-6">
      <div className='grid grid-cols-5'>
        {/* Sidebar Menu */}
        <div className='col-span-1 h-[92vh] pt-24'>
          <ul className="menu rounded-box gap-3">
            {menuItems.map((item) => (
              <li key={item.id} onClick={() => setActiveSection(item.id)}>
                <button
                  className={activeSection === item.id ? 'active' : ''}
                  aria-current={activeSection === item.id ? 'page' : undefined}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content */}
        <div className='col-span-4 h-[87vh] mx-4 bg-base-300 rounded-2xl p-4'>
          {renderSection()}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

