const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const app = express();
const PORT = 8000;

app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:3002',
}));


// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'your_secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = { userId: user.userId }; // Set user ID in the request object
    next();
  });
};



// MongoDB connection
mongoose.connect('mongodb+srv://saitejareddie22:Saiteja22@cluster1.he2a79y.mongodb.net/services', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define the user schema
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  
});

const ratingReviewSchema = new mongoose.Schema({
  hotelName: String,
  reviews: [
      {
          _id: mongoose.Schema.Types.ObjectId,
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Add userId field for each review
          rating: Number,
          review: String,
          userName: String,
      }
  ]
});





// Create the User model
const User = mongoose.model('User', userSchema);

// Create the RatingReview model
const RatingReview = mongoose.model('RatingReview', ratingReviewSchema);


const reportSchema = new mongoose.Schema({
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RatingReview', 
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  const Report = mongoose.model('Report', reportSchema);
  app.post('/api/review/report/:id', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
      // Create a new report
      const report = new Report({
        reviewId: id,
        reason
      });
      await report.save();
      res.status(200).json({ message: 'Review reported successfully' });
    } catch (error) {
      console.error('Error reporting review:', error);
      res.status(500).json({ error: 'An error occurred while reporting the review' });
    }
  });
  


// Signup route
app.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(201).json({ message: 'User signed up successfully!' });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ error: 'Failed to sign up.' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const token = jwt.sign({ userId: user._id }, 'your_secret_key');

      res.status(200).json({ token, username: user.firstName });
    } else {
      res.status(401).json({ error: 'Incorrect password.' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});



// Submit Review route
app.post('/submit-rating-review', authenticateToken, async (req, res) => {
  try {
    const { rating, review, hotelname } = req.body;
    const userId = req.user.userId; // Get user ID from authenticated request

    // Fetch user based on user ID
    const user = await User.findById(userId);

    // Ensure user exists
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Find or create ratingReview document for the hotel
    let ratingReview = await RatingReview.findOne({ hotelName: hotelname });

    if (!ratingReview) {
      ratingReview = new RatingReview({
        hotelName: hotelname,
        reviews: []
      });
    }

    // Add review with user ID
    ratingReview.reviews.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userId,
      rating: rating,
      review: review,
      userName: `${user.firstName} ${user.lastName}`,
    });

    await ratingReview.save();

    res.status(201).json({ message: 'Rating and review submitted successfully!' });
  } catch (error) {
    console.error('Error submitting rating and review:', error);
    res.status(500).json({ error: 'Failed to submit rating and review.' });
  }
});


// New route to fetch username associated with logged-in user

app.get('/get-username', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId; // Get user ID from authenticated request

        // Find the user by ID
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Send the username in the response
        res.status(200).json({ username: user.firstName });
    } catch (error) {
        console.error('Error fetching username:', error);
        res.status(500).json({ error: 'Failed to fetch username.' });
    }
});


// Fetch ratings and reviews endpoint
app.get('/get-ratings-reviews', async (req, res) => {
  try {
      const { hotelname } = req.query; // Get hotelname from query parameters
      // Fetch ratings and reviews based on the hotelname
      const ratingsReviews = await RatingReview.findOne({ hotelName: hotelname });
      if (!ratingsReviews) {
          return res.status(404).json({ error: 'No reviews found for this hotel' });
      }
      res.status(200).json(ratingsReviews.reviews);
  } catch (error) {
      console.error('Error fetching ratings and reviews:', error);
      res.status(500).json({ error: 'Failed to fetch ratings and reviews.' });
  }
});

// Update review route
app.put('/update-rating-review/:id', async (req, res) => {
  try {
    const { rating, review } = req.body;
    const reviewId = req.params.id;

    // Find the review by ID
    const existingReview = await RatingReview.findOne({ 'reviews._id': reviewId });

    // Ensure the review exists
    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    // Update the review data
    const reviewToUpdate = existingReview.reviews.find(review => review._id.toString() === reviewId);
    reviewToUpdate.rating = rating;
    reviewToUpdate.review = review;

    // Save the updated document
    await existingReview.save();

    res.status(200).json({ message: 'Review updated successfully!' });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review.' });
  }
});


// Delete review route
app.delete('/delete-rating-review/:id', async (req, res) => {
  try {
      const reviewId = req.params.id;

      // Find the review by ID
      const existingReview = await RatingReview.findOne({ 'reviews._id': reviewId });

      // Ensure the review exists
      if (!existingReview) {
          return res.status(404).json({ error: 'Review not found.' });
      }

      // Remove the review from the array
      existingReview.reviews = existingReview.reviews.filter(review => review._id.toString() !== reviewId);

      // Save the updated document
      await existingReview.save();

      res.status(200).json({ message: 'Review deleted successfully!' });
  } catch (error) {
      console.error('Error deleting review:', error);
      res.status(500).json({ error: 'Failed to delete review.' });
  }
});

// Add route for fetching the average rating of reviews for a specific hotel
app.get('/get-average-rating', async (req, res) => {
  try {
      const { hotelname } = req.query;

      // Fetch all ratings for the specific hotel from the database
      const ratings = await RatingReview.find({ hotelName: hotelname }, 'reviews.rating');

      // Calculate the total rating and total number of ratings
      let totalRating = 0;
      let totalRatings = 0;
      ratings.forEach((rating) => {
          rating.reviews.forEach((review) => {
              totalRating += review.rating;
              totalRatings++;
          });
      });

      // Calculate the average rating
      const averageRating = totalRating / totalRatings;

      res.status(200).json({ averageRating, totalReviews: totalRatings });
  } catch (error) {
      console.error('Error getting average rating:', error);
      res.status(500).json({ error: 'Failed to get average rating.' });
  }
});


// Add route for submitting a reply to a review
// Add route for submitting a reply to a review
app.post('/submit-reply/:id', authenticateToken, async (req, res) => {
    try {
        const { reply } = req.body;
        const reviewId = req.params.id;
        const userId = req.user.userId; // Get user ID from authenticated request

        // Find the review by ID
        const review = await RatingReview.findById(reviewId);

        if (!review) {
            return res.status(404).json({ error: 'Review not found.' });
        }

        // Check if the review belongs to the current user
        if (review.userId.toString() !== userId) {
            return res.status(403).json({ error: 'You are not authorized to reply to this review.' });
        }

        // Update the review with the reply
        review.reply = reply;
        await review.save();

        res.status(200).json({ message: 'Reply submitted successfully!' });
    } catch (error) {
        console.error('Error submitting reply:', error);
        res.status(500).json({ error: 'Failed to submit reply.' });
    }
});

// Example route for reporting reviews
app.post('/report-review', authenticateToken, async (req, res) => {
  try {
      const { reviewId } = req.body;

      // Update the 'reported' field for the review with the provided ID
      const updatedReview = await RatingReview.findByIdAndUpdate(reviewId, { reported: true });

      if (!updatedReview) {
          return res.status(404).json({ error: 'Review not found' });
      }

      // Notify the business dashboard or take any other necessary actions
      console.log(`Review ${reviewId} reported. Notify business dashboard.`);

      // Respond with a success message
      res.status(200).json({ message: 'Review reported successfully' });
  } catch (error) {
      console.error('Error reporting review:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});