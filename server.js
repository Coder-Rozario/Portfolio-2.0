require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const axios = require('axios');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL, 
    'http://localhost:5173',
    'https://aboutshuvo.netlify.app'
  ],
  credentials: true
}));
app.use(bodyParser.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100')
});
app.use(limiter);

// Email transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Self-pinging function to prevent Render sleep mode (only in production)
if (process.env.NODE_ENV === 'production') {
  const SELF_PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
  
  setInterval(() => {
    const backendUrl = process.env.BACKEND_URL || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;
    console.log(`Performing self-ping to: ${backendUrl}/api/health`);
    
    axios.get(`${backendUrl}/api/health`)
      .then(response => {
        console.log('Self-ping successful:', response.status);
      })
      .catch(error => {
        console.log('Self-ping error:', error.message);
      });
  }, SELF_PING_INTERVAL);
}

// Health check endpoint for monitoring and self-pinging
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Contact endpoint
app.post('/api/messages', async (req, res) => {
  try {
    const { name, number, email, message } = req.body;

    // Basic validation
    if (!name || !number || !email || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `New Message from ${name}`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); border: 1px solid #e0e0e0;">
    <div style="background-color: #007BFF; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">📩 New Contact Form Submission</h2>
    </div>

    <div style="padding: 20px;">
        <h4 style="color: #333; font-size: 18px; margin-bottom: 10px;">Hello, you have a new message!</h4>

        <p style="font-size: 16px; margin-bottom: 5px;"><strong>Name:</strong> ${name}</p>

        <p style="font-size: 16px; margin-bottom: 5px;"><strong>Phone:</strong> 
            <a href="tel:${number}" style="color: #007BFF; text-decoration: none; font-weight: bold;">${number}</a>
        </p>

        <p style="font-size: 16px; margin-bottom: 5px;"><strong>Email:</strong> 
            <a href="mailto:${email}" style="color: #007BFF; text-decoration: none; font-weight: bold;">${email}</a>
        </p>

        <p style="font-size: 16px; font-weight: bold; margin-top: 15px;">Message:</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #007BFF;">
            <p style="color: #333; line-height: 1.5; font-size: 16px;">${message}</p>
        </div>

        <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #777;">📌 This email was sent from your website's contact form.</p>
    </div>
</div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Message sent successfully!' });
    
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ 
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('Self-ping mechanism activated to prevent Render sleep mode');
  }
});
