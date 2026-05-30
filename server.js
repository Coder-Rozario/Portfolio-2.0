require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const axios = require('axios'); // Nodemailer এর পরিবর্তে axios ব্যবহার করা হয়েছে

const app = express();

// Helper function to prevent HTML Injection (XSS) in Emails
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (match) {
    const chars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return chars[match];
  });
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'https://shuvo-rozario.netlify.app'
    ];

    const isLocalhost = !!origin && /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isLoopback = !!origin && /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);

    if (!origin || allowedOrigins.includes(origin) || isLocalhost || isLoopback) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Handle preflight requests
app.options('*', cors());

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting to prevent Brute Force/DDoS on contact endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use(limiter);

// ==================== BREVO API EMAIL FUNCTION ====================
// SMTP পোর্ট ব্লকিং এড়াতে সরাসরি HTTP API কল করা হচ্ছে
const sendEmailViaBrevoAPI = async (toEmail, subject, htmlContent) => {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { 
          email: process.env.EMAIL_FROM // আপনার Brevo অ্যাকাউন্টের ভেরিফাইড প্রেরক ইমেইল
        },
        to: [{ email: toEmail }],
        subject: subject,
        htmlContent: htmlContent,
      },
      {
        headers: {
          'accept': 'application/json',
          'api-key': process.env.EMAIL_PASS, // আপনার Brevo API Key
          'content-type': 'application/json',
        },
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Brevo API Error Detail:', error.response ? error.response.data : error.message);
    return { success: false, error: error.message };
  }
};

// ==================== HEALTH CHECK ENDPOINT ====================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Portfolio server is running smoothly'
  });
});

// ==================== CONTACT LOGIC FUNCTION ====================
const handleContactForm = async (req, res) => {
  try {
    console.log('📨 Received contact form submission:', req.body);
    
    const { name, number, email, message } = req.body;

    // Enhanced validation
    if (!name || !number || !email || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters long' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    if (String(number).trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid phone number' });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Message must be at least 10 characters long' });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Message must be less than 1000 characters' });
    }

    // XSS Protection
    const safeName = escapeHTML(name.trim());
    const safeNumber = escapeHTML(String(number).trim());
    const safeEmail = escapeHTML(email.trim());
    const safeMessage = escapeHTML(message.trim());

    // ১. আপনার নিজের জন্য অ্যাডমিন ইমেইল টেমপ্লেট
    const adminHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', sans-serif; color: #333; background: #f4f6f9; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .header { background: #764ba2; color: white; padding: 15px; border-radius: 6px; text-align: center; font-size: 20px; font-weight: bold; }
        .info-box { background: #f8f9fa; border-left: 4px solid #764ba2; padding: 15px; margin: 20px 0; }
        .msg-box { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 6px; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">🎉 New Portfolio Message</div>
        <div class="info-box">
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Phone:</strong> ${safeNumber}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div class="msg-box"><strong>Message Content:</strong><br><br>${safeMessage}</div>
    </div>
</body>
</html>
    `;

    // ২. ভিজিটরের জন্য কনফার্মেশন ইমেইল টেমপ্লেট
    const userHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', sans-serif; color: #333; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 30px; }
        .header { text-align: center; color: #667eea; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
        .footer { text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; font-size: 14px; color: #777; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Thank You, ${safeName}!</div>
        <p>I have successfully received your message sent through my portfolio website.</p>
        <p>I will review your inquiry carefully and get back to you within 24 hours.</p>
        <br>
        <p>Best regards,</p>
        <p><strong>Shuvro Rozario</strong></p>
        <div class="footer">© ${new Date().getFullYear()} Shuvro Rozario. All rights reserved.</div>
    </div>
</body>
</html>
    `;

    // API এর মাধ্যমে দুটি ইমেইল পাঠানো
    const results = await Promise.allSettled([
      sendEmailViaBrevoAPI(process.env.EMAIL_TO, `📧 New Portfolio Message from ${safeName}`, adminHtml),
      sendEmailViaBrevoAPI(email, '✅ Thank you for contacting Shuvro Rozario', userHtml)
    ]);
    
    console.log(`✅ Email API process status for ${safeName}:`, results.map(r => r.status));

    // যদি অন্তত একটি মেইলও সফলভাবে চলে যায়
    if (results[0].status === 'fulfilled' && results[0].value.success) {
      return res.status(200).json({ 
        success: true,
        message: 'Message received! A confirmation email will arrive shortly.' 
      });
    } else {
      throw new Error('Email dispatch failed via Brevo API.');
    }
    
  } catch (error) {
    console.error('❌ Contact form error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
};

// Map both endpoints to the safe handler function
app.post('/api/messages', handleContactForm);
app.post('/api/contact', handleContactForm);

// ==================== ADDITIONAL PORTFOLIO ENDPOINTS ====================
app.get('/api/projects', (req, res) => {
  const projects = [
    {
      id: 1,
      title: "Yokebud E-commerce",
      description: "Full-stack e-commerce platform with advanced features",
      technologies: ["React", "Node.js", "MySQL", "Cloudinary"],
      category: "Full Stack",
      image: "/projects/yokebud.jpg",
      liveUrl: "https://yokebud.com",
      githubUrl: "https://github.com/yourusername/yokebud"
    },
    {
      id: 2,
      title: "Portfolio Website",
      description: "Responsive portfolio with contact form and email integration",
      technologies: ["React", "Node.js", "Express", "Nodemailer"],
      category: "Full Stack",
      image: "/projects/portfolio.jpg",
      liveUrl: "https://shuvorozario.com",
      githubUrl: "https://github.com/yourusername/portfolio"
    }
  ];
  res.json({ success: true, projects });
});

app.get('/api/skills', (req, res) => {
  const skills = {
    frontend: [
      { name: "React", level: 90 },
      { name: "JavaScript", level: 85 },
      { name: "HTML5", level: 95 },
      { name: "CSS3", level: 90 }
    ],
    backend: [
      { name: "Node.js", level: 88 },
      { name: "Express.js", level: 85 },
      { name: "MySQL", level: 80 },
      { name: "MongoDB", level: 75 }
    ]
  };
  res.json({ success: true, skills });
});

// ==================== ERROR HANDLING ====================
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Portfolio Backend Server is running!',
    endpoints: {
      health: '/health',
      contact: '/api/contact & /api/messages',
      projects: '/api/projects',
      skills: '/api/skills'
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER STARTUP ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Portfolio server running on port ${PORT}`);
  
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || `http://localhost:${PORT}/health`;
  const ping = () => {
    try {
      const client = keepAliveUrl.startsWith('https') ? require('https') : require('http');
      const req = client.get(keepAliveUrl, (res) => { res.resume(); });
      req.on('error', () => {});
      req.setTimeout(8000, () => req.destroy());
    } catch {}
  };
  setInterval(ping, 14 * 60 * 1000);
  ping();
});
