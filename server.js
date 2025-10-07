require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// Enhanced CORS configuration for production
app.use(cors({
  origin: [
    'https://shuvo-rozario.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - more generous for production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // reduced for free tier
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Email transporter configuration with better error handling
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Better timeout settings for production
  connectionTimeout: 10000,
  socketTimeout: 15000,
  greetingTimeout: 10000
});

// Verify email configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Email transporter error:', error);
  } else {
    console.log('✅ Email transporter is ready to send messages');
  }
});

// ==================== HEALTH CHECK ENDPOINT ====================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    message: 'Portfolio server is running smoothly'
  });
});

// ==================== WAKE UP ENDPOINT ====================
app.get('/wakeup', (req, res) => {
  console.log('🔄 Server wakeup call received');
  res.status(200).json({ 
    success: true,
    message: 'Server is awake and ready',
    timestamp: new Date().toISOString()
  });
});

// ==================== CONTACT ENDPOINT ====================
app.post('/api/messages', async (req, res) => {
  try {
    console.log('📨 Received contact form submission:', { 
      name: req.body.name, 
      email: req.body.email,
      timestamp: new Date().toISOString()
    });
    
    const { name, number, email, message } = req.body;

    // Enhanced validation
    if (!name || !number || !email || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Name validation
    if (name.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Name must be at least 2 characters long' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email address' 
      });
    }

    // Phone number validation (basic)
    if (number.trim().length < 10) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid phone number' 
      });
    }

    // Message length validation
    if (message.trim().length < 10) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be at least 10 characters long' 
      });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be less than 1000 characters' 
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `📧 New Portfolio Message from ${name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Portfolio Contact</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; padding: 20px; }
        .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; color: white; }
        .email-header h1 { font-size: 28px; font-weight: 600; margin-bottom: 10px; }
        .email-body { padding: 30px; }
        .contact-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #667eea; }
        .info-item { margin-bottom: 12px; display: flex; align-items: center; }
        .info-label { font-weight: 600; color: #495057; min-width: 80px; }
        .info-value { color: #212529; flex: 1; }
        .message-section { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; }
        .message-label { font-weight: 600; color: #495057; margin-bottom: 10px; }
        .message-content { color: #212529; line-height: 1.7; white-space: pre-wrap; }
        .email-footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; color: #6c757d; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🎉 New Portfolio Message</h1>
            <p>Someone reached out through your portfolio website</p>
        </div>
        <div class="email-body">
            <div class="contact-info">
                <div class="info-item"><span class="info-label">Name:</span><span class="info-value">${name}</span></div>
                <div class="info-item"><span class="info-label">Phone:</span><span class="info-value"><a href="tel:${number}">${number}</a></span></div>
                <div class="info-item"><span class="info-label">Email:</span><span class="info-value"><a href="mailto:${email}">${email}</a></span></div>
                <div class="info-item"><span class="info-label">Time:</span><span class="info-value">${new Date().toLocaleString()}</span></div>
            </div>
            <div class="message-section">
                <div class="message-label">Message Content:</div>
                <div class="message-content">${message}</div>
            </div>
        </div>
        <div class="email-footer">
            <p>💼 This message was sent from your portfolio contact form</p>
        </div>
    </div>
</body>
</html>
      `,
    };

    // Send email with timeout
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timeout')), 10000)
    );

    await Promise.race([emailPromise, timeoutPromise]);

    console.log(`✅ Contact form submitted successfully by: ${name} (${email})`);

    res.status(200).json({ 
      success: true,
      message: 'Message sent successfully! You should receive a confirmation email shortly.' 
    });
    
  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send message. Please try again in a moment.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Keep the original /api/contact endpoint for backward compatibility
app.post('/api/contact', async (req, res) => {
  req.url = '/api/messages';
  app.handle(req, res);
});

// ==================== SIMPLIFIED PORTFOLIO ENDPOINTS ====================
app.get('/api/projects', (req, res) => {
  res.json({ 
    success: true, 
    projects: [
      {
        id: 1,
        title: "Yokebud E-commerce",
        description: "Full-stack e-commerce platform",
        technologies: ["React", "Node.js", "MySQL"],
        category: "Full Stack"
      }
    ]
  });
});

app.get('/api/skills', (req, res) => {
  res.json({ 
    success: true, 
    skills: {
      frontend: ["React", "JavaScript", "HTML5", "CSS3"],
      backend: ["Node.js", "Express.js", "MySQL"]
    }
  });
});

// ==================== ERROR HANDLING ====================
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error'
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found' 
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Portfolio Backend Server is running!',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER STARTUP ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Portfolio server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email service: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
});
