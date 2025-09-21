# ArTaleStudios

ArTaleStudios is a web application that brings images to life by generating captivating stories and audio narrations. Users can upload an image, provide a description, and our AI-powered backend will create a unique story with an accompanying audio track. The platform also includes social features like user profiles, a main feed, likes, comments, and the ability to follow other users.

## Features

*   **AI-Powered Story Generation:** Utilizes Google Gemini's `gemini-1.5-flash` model to generate rich and descriptive stories, trailers, and voice descriptions based on user-provided images and descriptions.
*   **Text-to-Speech:** Leverages the ElevenLabs API (with the `eleven_multilingual_v2` model and a selection of voices) to create high-quality audio narrations for the generated stories. Includes fallback logic for robust audio generation.
*   **User Authentication:** Secure user registration and login functionality using JWT for session management.
*   **User Profiles:** Customizable user profiles with profile pictures, banners, and bios.
*   **Social Feed:** A main feed to discover and interact with posts from other users.
*   **Interactive Posts:** Users can like and comment on posts.
*   **Follow System:** Follow your favorite creators to keep up with their latest stories.
*   **Post Management:** Create new posts by uploading images and view your own posts on your profile page.

## Technologies Used

### Backend
*   **Node.js & Express.js:** For the main server and API.
*   **Python:** To run the AI generation scripts for stories and audio.
*   **SQLite:** As the database for storing user data, posts, and interactions.
*   **Google Gemini:** For the core story generation.
*   **ElevenLabs:** For text-to-speech conversion.

### Frontend
*   **HTML, CSS, JavaScript:** For the user interface and client-side logic.

### Key Libraries
*   **Node.js:** `express`, `cors`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `better-sqlite3`, `multer`.
*   **Python:** `google-generativeai`, `elevenlabs`, `Pillow`, `python-dotenv`, `requests`.

## Project Structure

```
ArTaleStudios1/model1/
├── .env                # Environment variables
├── .gitattributes
├── .gitignore
├── ArTales .ipynb      # Jupyter notebook for experimentation
├── create-canvas.html  # Frontend for creating posts
├── data.sqlite         # SQLite database file
├── db.js               # Database connection and setup
├── generate_story_final.py # Python script for story and audio generation
├── index.html          # Main feed page
├── login.html          # Login page
├── package.json        # Node.js dependencies and scripts
├── profile.html        # User profile page
├── render-start.sh     # Render deployment script
├── render.yaml         # Render configuration
├── requirements.txt    # Python dependencies
├── server.js           # Main Express.js server
├── setup_python.bat    # Windows script for Python setup
├── signup.html         # Signup page
├── story.html          # Story detail page
└── uploads/            # Directory for user-uploaded images and generated audio
```

## Database Schema

The application uses a SQLite database with the following tables:

*   **users**: Stores user information.
    *   `id` (INTEGER, PRIMARY KEY)
    *   `email` (TEXT, UNIQUE)
    *   `password_hash` (TEXT)
    *   `name` (TEXT)
    *   `profile_image` (TEXT)
    *   `banner_image` (TEXT)
    *   `bio` (TEXT)
*   **posts**: Stores post information.
    *   `id` (INTEGER, PRIMARY KEY)
    *   `user_id` (INTEGER, FOREIGN KEY to users.id)
    *   `title` (TEXT)
    *   `description` (TEXT)
    *   `story` (TEXT)
    *   `image_path` (TEXT)
    *   `audio_path` (TEXT)
    *   `created_at` (TEXT)
*   **likes**: Stores information about likes on posts.
    *   `id` (INTEGER, PRIMARY KEY)
    *   `user_id` (INTEGER, FOREIGN KEY to users.id)
    *   `post_id` (INTEGER, FOREIGN KEY to posts.id)
*   **comments**: Stores comments on posts.
    *   `id` (INTEGER, PRIMARY KEY)
    *   `user_id` (INTEGER, FOREIGN KEY to users.id)
    *   `post_id` (INTEGER, FOREIGN KEY to posts.id)
    *   `content` (TEXT)
*   **follows**: Stores follower-following relationships.
    *   `id` (INTEGER, PRIMARY KEY)
    *   `follower_id` (INTEGER, FOREIGN KEY to users.id)
    *   `following_id` (INTEGER, FOREIGN KEY to users.id)

## API Endpoints

The Express.js server exposes the following REST API endpoints:

### Auth
*   `POST /api/signup`: Register a new user.
*   `POST /api/login`: Log in a user.
*   `POST /api/logout`: Log out a user.

### Users
*   `GET /api/me`: Get the current authenticated user's profile.
*   `POST /api/me`: Update the current authenticated user's profile.
*   `GET /api/users/:id`: Get a user's profile by ID.
*   `GET /api/users/:id/posts`: Get all posts by a specific user.
*   `GET /api/users/:id/follow-status`: Get follow status and counts for a user.
*   `POST /api/users/:id/follow`: Follow or unfollow a user.

### Posts
*   `GET /api/posts`: Get all posts for the main feed.
*   `GET /api/posts/:id`: Get a single post by ID.
*   `POST /api/posts`: Create a new post.
*   `DELETE /api/posts/:id`: Delete a post.
*   `GET /api/my-posts`: Get all posts by the current authenticated user.

### Interactions
*   `POST /api/posts/:id/like`: Like or unlike a post.
*   `GET /api/posts/:id/likes`: Get the number of likes for a post.
*   `POST /api/posts/:id/comments`: Add a comment to a post.
*   `GET /api/posts/:id/comments`: Get all comments for a post.

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ArTaleStudios1/model1
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Create a `.env` file** in the `ArTaleStudios1/model1` directory and add the following environment variables with your API keys and secrets:
    ```
    GEMINI_API_KEY=your_gemini_api_key
    ELEVENLABS_API_KEY=your_elevenlabs_api_key
    JWT_SECRET=a_strong_jwt_secret_key
    PORT=3001
    ```

5.  **Run the application:**
    ```bash
    npm start
    ```

6. **For the final hosted web application. Use the given link - https://artalestudio.onrender.com**
