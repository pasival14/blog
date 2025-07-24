Blog Platform (https://blog-i4a73u7te-oluwafemi-olusojis-projects.vercel.app/)

This is a feature-rich, scalable blog platform built with a modern tech stack including React for the frontend and Firebase for the backend. It incorporates advanced features like full-text search with Algolia, personalized content recommendations, and a comprehensive admin panel for content and user management.

Features

-   User Authentication: Secure user login and registration handled by AWS Cognito, with session management using `react-oidc-context`.
-   Admin Panel: A dedicated, role-based admin dashboard to manage posts, users, and site settings.
-   Post Management: Full CRUD (Create, Read, Update, Delete) functionality for blog posts.
-   Rich Text Editor: A `React Quill` editor for creating engaging and well-formatted blog content.
-   Powerful Search: Instant and relevant search results powered by Algolia.
-   Content Analysis: An automated Cloud Function analyzes new posts to extract and store relevant keywords.
-   Trending Keywords: A scheduled function calculates and displays trending keywords based on user interactions.
-   Personalized Recommendations: A recommendation engine suggests posts to users based on their interaction history.
-   Role Management: Cloud Functions to dynamically grant or revoke admin privileges to users.

Tech Stack

Frontend

-   React: A JavaScript library for building user interfaces.
-   Vite: A fast build tool and development server.
-   Tailwind CSS: A utility-first CSS framework for rapid UI development.
-   DaisyUI: A component library for Tailwind CSS.
-   React Router: For declarative routing in the application.
-   React Quill: A rich text editor component.
-   OpenID Connect (OIDC): Using `react-oidc-context` for authentication against AWS Cognito.

Backend

-   Firebase:
    -   Firestore: A NoSQL database for storing post and user data.
    -   Firebase Storage: For storing images and other media.
    -   Firebase Authentication: Used for user management in conjunction with custom claims.
    -   Cloud Functions: For serverless backend logic.
-   Node.js: The runtime environment for the Cloud Functions.
-   Algolia: For implementing the powerful search functionality.

Project Structure


/
├── functions/                # Firebase Cloud Functions

│   ├── index.js              # Main entry point for all cloud functions

│   └── package.json

├── public/

├── src/

│   ├── components/

│   │   ├── admin/            # Components for the Admin Panel

│   │   ├── AdminPanel.jsx

│   │   ├── Home.jsx

│   │   ├── Login.jsx

│   │   ├── PostDetail.jsx

│   │   ├── PostForm.jsx

│   │   └── SearchResults.jsx

│   ├── services/

│   │   └── firebase.js       # Firebase initialization and configuration

│   ├── App.jsx               # Main application component with routing

│   ├── main.jsx              # Application entry point

│   └── index.css             # Global styles

├── .firebaserc

├── firebase.json             # Firebase project configuration

└── package.json


Setup and Installation

1.  Clone the repository:
    ```bash
    git clone github.com/pasival14/blog
    cd blog
    ```

2.  Install Frontend Dependencies:
    ```bash
    npm install
    ```

3.  Install Backend Dependencies:
    ```bash
    cd functions
    npm install
    cd ..
    ```

4.  Configure Environment Variables:
    -   You will need to set up a Firebase project and an Algolia account.
    -   Set up your Firebase configuration in `src/services/firebase.js`.
    -   For the Cloud Functions, you'll need to set environment variables for Algolia:
        ```bash
        firebase functions:config:set algolia.app_id="YOUR_APP_ID" algolia.search_key="YOUR_SEARCH_KEY" algolia.index_name="YOUR_INDEX_NAME"
        ```

5.  Run the Development Server:
    ```bash
    npm run dev
    ```

## Firebase Cloud Functions

The `functions/index.js` file contains several backend functions:

-   `searchPosts`: A callable function that uses Algolia to search for posts.
-   `analyzePostContent`: Triggered on new post creation/update in Firestore. It fetches the post content, extracts keywords, and updates the post document.
-   `calculateTrendingKeywords`: A scheduled function that runs periodically to determine and store trending keywords.
-   `generateRecommendations`: A scheduled function that generates personalized post recommendations for users.
-   `setAdminRole`: A callable function that allows an existing admin to grant admin privileges to another user.
-   `removeAdminRole`: A callable function for an admin to revoke admin rights from another user.

Authentication

Authentication is managed through AWS Cognito. The `main.jsx` file configures the `AuthProvider` with your Cognito User Pool details. The `App.jsx` component then uses the `useAuth` hook from `react-oidc-context` to manage the user's authentication state and determine if they belong to the 'Admins' group.

Admin Functionality

To make a user an admin, you need to call the `setAdminRole` cloud function. This must be done by a user who is already an admin. You can build a UI in the `AdminPanel` to call this function, passing the email of the user you want to promote.

Available Scripts

In the project directory, you can run:

-   `npm run dev`: Runs the app in development mode.
-   `npm run build`: Builds the app for production.
-   `npm run lint`: Lints the project files.
-   `npm run preview`: Serves the production build locally.

Contributing

Contributions are welcome! Please feel free to submit a pull request.

License

This project is licensed under the MIT License.
