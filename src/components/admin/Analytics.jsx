// src/components/admin/Analytics.jsx

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { auth, db } from '../../services/firebase'; // Ensure db and auth are imported

// Import Chart.js components and register necessary elements
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Add BarElement
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2'; // Import Line and Bar

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Register BarElement
  Title,
  Tooltip,
  Legend
);

const Analytics = () => {
  const [userUid, setUserUid] = useState(null);
  const [allPosts, setAllPosts] = useState([]); // Store all fetched posts
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalViews: 0,
    totalLikes: 0,
  });
  const [topPosts, setTopPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Chart Data State
  const [postsOverTimeData, setPostsOverTimeData] = useState(null);
  const [topPostsViewsData, setTopPostsViewsData] = useState(null);


  // --- (useEffect for userUid remains the same) ---
   useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserUid(user.uid);
      } else {
        setUserUid(null);
        setStats({ totalPosts: 0, totalViews: 0, totalLikes: 0 });
        setTopPosts([]);
        setAllPosts([]); // Clear all posts too
        setPostsOverTimeData(null); // Clear chart data
        setTopPostsViewsData(null); // Clear chart data
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);


  // Fetch all posts, calculate stats, and prepare chart data
  useEffect(() => {
    const fetchData = async () => {
      if (!userUid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const q = query(
          collection(db, 'posts'),
          where('uid', '==', userUid)
        );
        const querySnapshot = await getDocs(q);

        let totalViews = 0;
        let totalLikes = 0;
        const posts = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          totalViews += data.viewCount || 0;
          totalLikes += data.likeCount || 0;
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || Date.now()),
          };
        });

        setAllPosts(posts); // Store all posts

        // Set calculated stats
        setStats({
          totalPosts: posts.length,
          totalViews: totalViews,
          totalLikes: totalLikes,
        });

        // Sort posts by viewCount to find top posts
        const sortedByViews = [...posts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        const top5Posts = sortedByViews.slice(0, 5);
        setTopPosts(top5Posts); // Keep top 5 for the table

        // --- Prepare Chart Data ---

        // 1. Posts Over Time Data (Group by Month)
        const postsByMonth = posts.reduce((acc, post) => {
          // Ensure createdAt is a valid Date object
          if (post.createdAt instanceof Date && !isNaN(post.createdAt)) {
                const monthYear = `${post.createdAt.getFullYear()}-${String(post.createdAt.getMonth() + 1).padStart(2, '0')}`; // Format YYYY-MM
                acc[monthYear] = (acc[monthYear] || 0) + 1;
          }
          return acc;
        }, {});

        const sortedMonths = Object.keys(postsByMonth).sort(); // Sort chronologically
        setPostsOverTimeData({
          labels: sortedMonths,
          datasets: [
            {
              label: 'Articles Created',
              data: sortedMonths.map(month => postsByMonth[month]),
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
              tension: 0.1, // Make the line slightly curved
            },
          ],
        });


        // 2. Top Posts Views Data (for Bar Chart) - Use the top 5 already sorted
         setTopPostsViewsData({
           labels: top5Posts.map(p => p.title.length > 20 ? p.title.substring(0, 20) + '...' : p.title), // Shorten labels if needed
           datasets: [
             {
               label: 'Views',
               data: top5Posts.map(p => p.viewCount || 0),
               backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue bars
               borderColor: 'rgba(54, 162, 235, 1)',
               borderWidth: 1,
             },
            //  Optionally add likes as another dataset for a grouped bar chart
            //  {
            //    label: 'Likes',
            //    data: top5Posts.map(p => p.likeCount || 0),
            //    backgroundColor: 'rgba(255, 99, 132, 0.6)', // Pink bars
            //    borderColor: 'rgba(255, 99, 132, 1)',
            //    borderWidth: 1,
            //  },
           ],
         });

      } catch (err) {
        console.error("Error fetching analytics data:", err);
        setError("Failed to load analytics. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userUid]);

  // Chart options (can be customized further)
   const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Articles Created Over Time' },
    },
     scales: { y: { beginAtZero: true } }, // Ensure Y-axis starts at 0
   };

    const barChartOptions = {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Top 5 Articles by Views' },
      },
       scales: { y: { beginAtZero: true } },
       indexAxis: 'y', // Make it a horizontal bar chart for better label readability
    };

  return (
    // Added pb-6 for bottom padding
    <div className="mt-12 md:mt-0 w-full h-full flex flex-col p-2 md:p-4 gap-6 overflow-y-auto pb-6">
      <h2 className="text-xl md:text-2xl font-semibold">Analytics Overview</h2>

      {error && <div className="alert alert-error shadow-md">{error}</div>}

      {loading ? (
         <div className="flex justify-center items-center flex-grow">
            <span className="loading loading-lg"></span>
         </div>
      ) : allPosts.length === 0 && !error ? ( // Check if there are posts, even if not loading
           <p className="text-center text-gray-500 py-10">No data available to generate analytics yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> {/* Main layout grid */}

          {/* Column 1: Stats and Top Posts Table */}
          <div className="flex flex-col gap-6">
                {/* Overall Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* --- Stat Cards remain the same as before --- */}
                    {/* Total Posts Card */}
                     <div className="stats shadow bg-base-100 overflow-hidden"> <div className="stat"> <div className="stat-figure text-info"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block size-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div> <div className="stat-title">Total Articles</div> <div className="stat-value text-lg md:text-xl text-info">{stats.totalPosts}</div> </div> </div>
                     {/* Total Views Card */}
                     <div className="stats shadow bg-base-100"> <div className="stat"> <div className="stat-figure text-success"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block size-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></div> <div className="stat-title">Total Views</div> <div className="stat-value text-lg md:text-xl text-success">{stats.totalViews.toLocaleString()}</div> </div> </div>
                     {/* Total Likes Card */}
                     <div className="stats shadow bg-base-100"> <div className="stat"> <div className="stat-figure text-error"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block size-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg></div> <div className="stat-title">Total Likes</div> <div className="stat-value text-lg md:text-xl text-error">{stats.totalLikes.toLocaleString()}</div> </div> </div>
                </div>

                {/* Top Performing Articles Table */}
                <div className="bg-base-100 rounded-lg shadow p-4 flex-grow"> {/* Added flex-grow */}
                    <h3 className="text-lg font-semibold mb-3">Top 5 Most Viewed Articles</h3>
                    {topPosts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra table-sm w-full">
                        <thead><tr><th>#</th><th>Title</th><th>Views</th><th>Likes</th></tr></thead>
                        <tbody>
                            {topPosts.map((post, index) => (
                            <tr key={post.id}>
                                <th>{index + 1}</th>
                                <td><Link to={`/post/${post.id}`} className="link link-hover text-sm" title={post.title}><span className="line-clamp-1">{post.title}</span></Link></td>
                                <td className='text-right'>{post.viewCount || 0}</td>{/* Right align numbers */}
                                <td className='text-right'>{post.likeCount || 0}</td>{/* Right align numbers */}
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                    ) : (
                    <p className="text-center text-gray-500 py-4">No articles with views yet.</p>
                    )}
                </div>
          </div>

          {/* Column 2: Charts */}
          <div className="flex flex-col gap-6">
                {/* Posts Over Time Chart */}
                <div className="bg-base-100 rounded-lg shadow p-4">
                    {postsOverTimeData ? (
                        <Line options={lineChartOptions} data={postsOverTimeData} />
                    ) : (
                        <p className="text-center text-gray-500 py-4">Not enough data for time chart.</p>
                    )}
                </div>

                 {/* Top Posts Views Chart */}
                <div className="bg-base-100 rounded-lg shadow p-4">
                    {topPostsViewsData ? (
                        <Bar options={barChartOptions} data={topPostsViewsData} />
                    ) : (
                        <p className="text-center text-gray-500 py-4">Not enough data for top posts chart.</p>
                    )}
                </div>
          </div>

        </div> // End main layout grid
      )}
    </div> // End component container
  );
};

export default Analytics;